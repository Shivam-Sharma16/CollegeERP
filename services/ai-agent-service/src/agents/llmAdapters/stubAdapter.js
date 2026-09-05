/**
 * StubAdapter — deterministic LLM adapter for automated tests.
 *
 * Constructor accepts a script: an ordered array of responses the adapter
 * will return one-by-one on each `chat()` call. Each item is either:
 *   { type: 'text', text: string }
 *   { type: 'tool_calls', toolCalls: [{ id, name, args }] }
 *
 * When the script is exhausted, returns { type: 'text', text: '[stub exhausted]' }.
 *
 * Usage:
 *   const adapter = new StubAdapter([
 *     { type: 'tool_calls', toolCalls: [{ id: 'tc1', name: 'myTool', args: { x: 1 } }] },
 *     { type: 'text', text: 'Analysis complete.' },
 *   ]);
 */
class StubAdapter {
  constructor(script = []) {
    if (!Array.isArray(script)) throw new TypeError('StubAdapter script must be an array');
    this.script = script;
    this.callIndex = 0;
    this.callHistory = []; // records what messages were sent each turn (for assertions)
  }

  async chat(messages, _toolDefs, _options) {
    this.callHistory.push(messages);

    if (this.callIndex >= this.script.length) {
      return { type: 'text', text: '[stub exhausted]' };
    }

    return this.script[this.callIndex++];
  }

  /** Reset so the adapter can be re-used in the same test file. */
  reset() {
    this.callIndex = 0;
    this.callHistory = [];
  }
}

module.exports = { StubAdapter };
