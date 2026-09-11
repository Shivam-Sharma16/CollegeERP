const { GoogleGenerativeAI, SchemaType } = require('@google/generative-ai');

/**
 * GeminiAdapter — wraps the Google Generative AI API for multi-turn tool use.
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
 * toolDefs format:
 *   [{ name, description, input_schema: { type, properties, required } }]
 */
class GeminiAdapter {
  constructor(apiKey, model = 'gemini-1.5-pro') {
    this.genAI = new GoogleGenerativeAI(apiKey);
    this.modelName = model;
  }

  /** Recursively map JSON Schema to Gemini SchemaType */
  _mapSchema(schema) {
    if (!schema) return undefined;
    
    const typeMap = {
      'string': SchemaType.STRING,
      'number': SchemaType.NUMBER,
      'integer': SchemaType.INTEGER,
      'boolean': SchemaType.BOOLEAN,
      'array': SchemaType.ARRAY,
      'object': SchemaType.OBJECT,
    };

    const mapped = {
      type: typeMap[schema.type] || SchemaType.STRING,
      description: schema.description,
    };

    if (schema.properties) {
      mapped.properties = {};
      for (const key in schema.properties) {
        mapped.properties[key] = this._mapSchema(schema.properties[key]);
      }
    }

    if (schema.items) {
      mapped.items = this._mapSchema(schema.items);
    }

    if (schema.required) {
      mapped.required = schema.required;
    }

    if (schema.enum) {
      mapped.enum = schema.enum;
    }

    return mapped;
  }

  /** Convert internal message format → Gemini contents format */
  _toGeminiMessages(messages) {
    const contents = [];

    for (const msg of messages) {
      if (msg.role === 'user') {
        contents.push({ role: 'user', parts: [{ text: msg.content }] });
      } else if (msg.role === 'assistant' && msg.toolCalls) {
        contents.push({
          role: 'model',
          parts: msg.toolCalls.map(tc => ({
            functionCall: {
              name: tc.name,
              args: tc.args
            }
          }))
        });
      } else if (msg.role === 'tool_results') {
        contents.push({
          role: 'function',
          parts: msg.results.map(r => ({
            functionResponse: {
              name: r.name,
              response: { result: r.result }
            }
          }))
        });
      }
    }

    return contents;
  }

  async chat(messages, toolDefs = [], { systemPrompt = '' } = {}) {
    const modelOptions = { model: this.modelName };
    if (systemPrompt) {
      modelOptions.systemInstruction = { role: 'system', parts: [{ text: systemPrompt }] };
    }

    const model = this.genAI.getGenerativeModel(modelOptions);

    let tools = undefined;
    if (toolDefs && toolDefs.length > 0) {
      tools = [{
        functionDeclarations: toolDefs.map(t => ({
          name: t.name,
          description: t.description,
          parameters: this._mapSchema(t.input_schema)
        }))
      }];
    }

    const contents = this._toGeminiMessages(messages);

    try {
      const result = await model.generateContent({
        contents,
        tools
      });

      const response = result.response;
      const functionCalls = response.functionCalls();

      // Tool use
      if (functionCalls && functionCalls.length > 0) {
        return {
          type: 'tool_calls',
          toolCalls: functionCalls.map((fc, i) => ({
            id: `call_${Date.now()}_${i}`, // Gemini doesn't use IDs natively, mock one for internal use
            name: fc.name,
            args: fc.args
          }))
        };
      }

      // Pure text response
      return { type: 'text', text: response.text() };
    } catch (error) {
      console.error("Gemini API Error:", error);
      return { type: 'text', text: "Error communicating with LLM." };
    }
  }
}

module.exports = { GeminiAdapter };
