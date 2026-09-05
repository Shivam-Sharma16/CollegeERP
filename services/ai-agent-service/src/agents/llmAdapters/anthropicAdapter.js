const Anthropic = require('@anthropic-ai/sdk');

/**
 * AnthropicAdapter — wraps the Anthropic Messages API for multi-turn tool use.
 *
 * Normalised interface (same as StubAdapter):
 *   chat(messages, toolDefs, options) → { type: 'text'|'tool_calls', ... }
 *
 * messages format (internal):
 *   [
 *     { role: 'user', content: string },
 *     { role: 'assistant', toolCalls: [{ id, name, args }] },
 *     { role: 'tool_results', results: [{ id, name, result }] },
 *     ...
 *   ]
 *
 * toolDefs format (Anthropic-compatible — input_schema):
 *   [{ name, description, input_schema: { type, properties, required } }]
 */
class AnthropicAdapter {
  constructor(apiKey, model = 'claude-opus-4-5') {
    this.client = new Anthropic({ apiKey });
    this.model = model;
  }

  /** Convert internal message format → Anthropic API format */
  _toAnthropicMessages(messages) {
    const result = [];

    for (const msg of messages) {
      if (msg.role === 'user') {
        result.push({ role: 'user', content: msg.content });
        continue;
      }

      if (msg.role === 'assistant' && msg.toolCalls) {
        result.push({
          role: 'assistant',
          content: msg.toolCalls.map(tc => ({
            type: 'tool_use',
            id: tc.id,
            name: tc.name,
            input: tc.args,
          })),
        });
        continue;
      }

      if (msg.role === 'tool_results') {
        result.push({
          role: 'user',
          content: msg.results.map(r => ({
            type: 'tool_result',
            tool_use_id: r.id,
            content: JSON.stringify(r.result),
          })),
        });
        continue;
      }
    }

    return result;
  }

  async chat(messages, toolDefs = [], { systemPrompt = '' } = {}) {
    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: 4096,
      ...(systemPrompt ? { system: systemPrompt } : {}),
      tools: toolDefs,
      messages: this._toAnthropicMessages(messages),
    });

    // Pure text response
    if (response.stop_reason === 'end_turn') {
      const textBlock = response.content.find(b => b.type === 'text');
      return { type: 'text', text: textBlock?.text ?? '' };
    }

    // Tool use
    if (response.stop_reason === 'tool_use') {
      const toolCalls = response.content
        .filter(b => b.type === 'tool_use')
        .map(b => ({ id: b.id, name: b.name, args: b.input }));
      return { type: 'tool_calls', toolCalls };
    }

    return { type: 'text', text: '' };
  }
}

module.exports = { AnthropicAdapter };
