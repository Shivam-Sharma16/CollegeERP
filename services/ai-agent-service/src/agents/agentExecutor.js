/**
 * AgentExecutor — drives the multi-turn tool-use loop and enforces allowlists.
 *
 * This is the TRUST BOUNDARY. The LLM adapter can return any tool name it wants;
 * the executor checks it against the agent's hardcoded allowlist BEFORE calling
 * the tool registry. Disallowed tool calls terminate the run immediately.
 *
 * Flow:
 *   1. Build tool definitions for ONLY the allowed tools (LLM never sees others).
 *   2. Start conversation with userPrompt.
 *   3. On each LLM response:
 *      a. If text → return result.
 *      b. If tool_calls → for each tool call:
 *           i.  CHECK allowlist — if not allowed, reject and STOP (no retry).
 *           ii. Call toolRegistry[name](args, context).
 *           iii.Feed result back into conversation.
 *   4. Repeat up to maxIterations turns.
 */

const { AGENT_ALLOWLISTS } = require('./allowlists');
const { toolRegistry: defaultRegistry, TOOL_DEFINITIONS } = require('./toolRegistry');

class AgentExecutor {
  /**
   * @param {Object} options
   * @param {Object}   options.adapter         - LLM adapter (stubAdapter or anthropicAdapter)
   * @param {Object}   [options.toolRegistry]  - Defaults to the global tool registry
   * @param {Object}   [options.allowlists]    - Defaults to AGENT_ALLOWLISTS
   * @param {number}   [options.maxIterations] - Safety cap on tool-use turns (default 10)
   */
  constructor({
    adapter,
    toolRegistry  = defaultRegistry,
    allowlists    = AGENT_ALLOWLISTS,
    maxIterations = 10,
  }) {
    if (!adapter) throw new Error('AgentExecutor requires an adapter');
    this.adapter       = adapter;
    this.toolRegistry  = toolRegistry;
    this.allowlists    = allowlists;
    this.maxIterations = maxIterations;
  }

  /**
   * Run an agent turn.
   *
   * @param {string} agentName   - Must be a key in this.allowlists
   * @param {string} userPrompt  - The user's message
   * @param {Object} context     - Runtime context: { userId, internalKey, serviceUrls, _fetch }
   * @param {Object} [opts]
   * @param {string} [opts.systemPrompt] - Optional system prompt override
   *
   * @returns {Promise<{
   *   result:      string|null,   // final text from LLM, or null on error/rejection
   *   error:       string|null,   // set when run terminated early
   *   toolCallLog: Array,         // ordered log of every tool call attempted
   * }>}
   */
  async run(agentName, userPrompt, context = {}, { systemPrompt = '' } = {}) {
    const allowedTools = this.allowlists[agentName];
    if (!allowedTools) {
      return { result: null, error: `Unknown agent: '${agentName}'`, toolCallLog: [] };
    }

    const toolCallLog = [];

    // Only expose definitions for tools this agent is allowed to use
    const toolDefs = [...allowedTools]
      .map(name => TOOL_DEFINITIONS[name])
      .filter(Boolean);

    // Internal conversation history
    const messages = [{ role: 'user', content: userPrompt }];

    for (let iter = 0; iter < this.maxIterations; iter++) {
      let response;
      try {
        response = await this.adapter.chat(messages, toolDefs, { systemPrompt });
      } catch (err) {
        return { result: null, error: `LLM adapter error: ${err.message}`, toolCallLog };
      }

      // ── Text response: agent is done ─────────────────────────────────────────
      if (response.type === 'text') {
        return { result: response.text, toolCallLog };
      }

      // ── Tool call response ────────────────────────────────────────────────────
      if (response.type !== 'tool_calls' || !Array.isArray(response.toolCalls)) {
        return { result: null, error: 'Unexpected LLM response format', toolCallLog };
      }

      const toolResults = [];

      for (const tc of response.toolCalls) {
        const logEntry = {
          tool:    tc.name,
          args:    tc.args,
          allowed: false,
          result:  null,
        };

        // ════════════════════════════════════════════════════════════════════
        //  ALLOWLIST ENFORCEMENT — this is the security boundary
        //  Must happen before ANY call into the tool registry or any network.
        // ════════════════════════════════════════════════════════════════════
        if (!allowedTools.has(tc.name)) {
          logEntry.allowed = false;
          logEntry.result  = {
            error: `Tool '${tc.name}' is not in the allowlist for agent '${agentName}'`,
          };
          toolCallLog.push(logEntry);

          // Terminate immediately — the run is poisoned; we do NOT allow the
          // LLM to continue after a security violation.
          return {
            result:      null,
            error:       `Security violation: agent '${agentName}' attempted to call disallowed tool '${tc.name}'`,
            toolCallLog,
          };
        }
        // ════════════════════════════════════════════════════════════════════

        logEntry.allowed = true;

        const toolFn = this.toolRegistry[tc.name];
        if (!toolFn) {
          logEntry.result = { error: `Tool '${tc.name}' has no implementation in the registry` };
        } else {
          try {
            logEntry.result = await toolFn(tc.args, context);
          } catch (err) {
            logEntry.result = { error: err.message };
          }
        }

        toolCallLog.push(logEntry);
        toolResults.push({ id: tc.id, name: tc.name, result: logEntry.result });
      }

      // Feed tool results back into the conversation for next LLM turn
      messages.push({ role: 'assistant', toolCalls: response.toolCalls });
      messages.push({ role: 'tool_results', results: toolResults });
    }

    return { result: null, error: `Max iterations (${this.maxIterations}) reached`, toolCallLog };
  }
}

module.exports = { AgentExecutor };
