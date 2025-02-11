import { BaseLLMProvider } from './base.js';

export class OllamaProvider extends BaseLLMProvider {
  constructor(config) {
    super();
    this.endpoint = config.endpoint || 'http://localhost:11434';
    this.model = config.model || 'llama2';
  }

  async complete(prompt, options = {}) {
    const messages = Array.isArray(prompt) ? prompt : [{ role: 'user', content: prompt }];
    const combinedPrompt = messages.map((m) => `${m.role}: ${m.content}`).join('\n');

    const response = await fetch(`${this.endpoint}/api/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: this.model,
        prompt: combinedPrompt,
        stream: false,
        options: {
          temperature: options.temperature || 0.1,
          top_p: options.top_p || 1,
          max_tokens: options.max_tokens,
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`Ollama API error: ${response.statusText}`);
    }

    const result = await response.json();

    // If a schema is provided, attempt to parse the response as JSON
    if (options.responseSchema) {
      try {
        // First, try to parse the response as JSON directly
        const jsonResponse = JSON.parse(result.response);
        return jsonResponse;
      } catch (e) {
        // If direct parsing fails, try to extract JSON from the text
        const jsonMatch = result.response.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          try {
            return JSON.parse(jsonMatch[0]);
          } catch (e2) {
            console.warn('Failed to parse JSON from response:', e2);
          }
        }

        // If all parsing attempts fail, format the response to match the schema
        console.warn('Failed to parse structured response, attempting to format raw response');
        return this.formatResponseToSchema(result.response, options.responseSchema);
      }
    }

    return result.response;
  }

  formatResponseToSchema(response, schema) {
    // Simple schema-based formatting for common types
    const result = {};
    for (const [key, value] of Object.entries(schema.shape || {})) {
      if (value instanceof Array || value.type === 'array') {
        // For array types, split by newlines and filter empty lines
        result[key] = response.split('\n').filter((line) => line.trim());
      } else {
        // For string types, use the full response
        result[key] = response;
      }
    }
    return result;
  }

  async *stream(prompt, options = {}) {
    const messages = Array.isArray(prompt) ? prompt : [{ role: 'user', content: prompt }];
    const combinedPrompt = messages.map((m) => `${m.role}: ${m.content}`).join('\n');

    const response = await fetch(`${this.endpoint}/api/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: this.model,
        prompt: combinedPrompt,
        stream: true,
        options: {
          temperature: options.temperature || 0.1,
          top_p: options.top_p || 1,
          max_tokens: options.max_tokens,
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`Ollama API error: ${response.statusText}`);
    }

    if (!response.body) {
      throw new Error('ReadableStream not supported');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.trim()) {
            try {
              const chunk = JSON.parse(line);
              if (chunk.response) {
                yield chunk.response;
              }
            } catch (e) {
              console.warn('Failed to parse JSON chunk:', line);
            }
          }
        }
      }

      if (buffer.trim()) {
        try {
          const chunk = JSON.parse(buffer);
          if (chunk.response) {
            yield chunk.response;
          }
        } catch (e) {
          console.warn('Failed to parse final JSON chunk:', buffer);
        }
      }
    } finally {
      reader.releaseLock();
    }
  }
}
