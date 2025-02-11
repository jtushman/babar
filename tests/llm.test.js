import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { OllamaProvider } from '../source/llm/ollama.js';
import { OpenAIProvider } from '../source/llm/openai.js';
import { createLLMProvider } from '../source/llm/factory.js';

describe('LLM Integration', () => {
  describe('OllamaProvider', () => {
    it('should create provider with default settings', () => {
      const provider = new OllamaProvider({});
      expect(provider.endpoint).toBe('http://localhost:11434');
      expect(provider.model).toBe('llama2');
    });

    it('should create provider with custom settings', () => {
      const provider = new OllamaProvider({
        endpoint: 'http://custom:11434',
        model: 'codellama',
      });
      expect(provider.endpoint).toBe('http://custom:11434');
      expect(provider.model).toBe('codellama');
    });

    it('should make API call with correct parameters', async () => {
      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ response: 'test response' }),
        })
      );

      const provider = new OllamaProvider({});
      const response = await provider.complete('test prompt', { temperature: 0.5 });

      expect(fetch).toHaveBeenCalledWith('http://localhost:11434/api/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'llama2',
          prompt: 'test prompt',
          stream: false,
          options: {
            temperature: 0.5,
            top_p: 1,
            max_tokens: undefined,
          },
        }),
      });

      expect(response).toBe('test response');
    });

    it('should handle structured output with schema', async () => {
      const mockResponse = {
        overview: 'Test overview',
        components: ['Component 1', 'Component 2'],
      };

      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ response: JSON.stringify(mockResponse) }),
        })
      );

      const provider = new OllamaProvider({});
      const schema = {
        shape: {
          overview: { type: 'string' },
          components: { type: 'array' },
        },
      };

      const response = await provider.complete('test prompt', { responseSchema: schema });
      expect(response).toEqual(mockResponse);
    });

    it('should format non-JSON response to match schema', async () => {
      const mockResponse = 'Overview: Test overview\n\nComponents:\n- Component 1\n- Component 2';

      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ response: mockResponse }),
        })
      );

      const provider = new OllamaProvider({});
      const schema = {
        shape: {
          overview: { type: 'string' },
          components: { type: 'array' },
        },
      };

      const response = await provider.complete('test prompt', { responseSchema: schema });
      expect(response.overview).toBeTruthy();
      expect(Array.isArray(response.components)).toBe(true);
    });

    it('should stream responses', async () => {
      const responses = ['chunk1', 'chunk2', 'chunk3'];
      let requestCount = 0;

      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: true,
          body: {
            getReader: () => ({
              read: async () => {
                if (requestCount >= responses.length) {
                  return { done: true };
                }
                const chunk = JSON.stringify({ response: responses[requestCount] }) + '\n';
                requestCount++;
                return {
                  done: false,
                  value: new TextEncoder().encode(chunk),
                };
              },
              releaseLock: () => {},
            }),
          },
        })
      );

      const provider = new OllamaProvider({});
      const streamedResponses = [];
      for await (const chunk of provider.stream('test prompt')) {
        streamedResponses.push(chunk);
      }

      expect(streamedResponses).toEqual(responses);
    });
  });

  describe('OpenAIProvider', () => {
    beforeEach(() => {
      process.env.OPENAI_API_KEY = 'test-key';
    });

    afterEach(() => {
      delete process.env.OPENAI_API_KEY;
      vi.clearAllMocks();
    });

    it('should create provider with default settings', () => {
      const provider = new OpenAIProvider({});
      expect(provider.config.model).toBe('gpt-4');
      expect(provider.config.temperature).toBe(0.1);
      expect(provider.config.maxTokensPerRequest).toBe(4000);
    });

    it('should create provider with custom settings', () => {
      const provider = new OpenAIProvider({
        model: 'gpt-3.5-turbo',
        temperature: 0.5,
        maxTokensPerRequest: 2000,
      });
      expect(provider.config.model).toBe('gpt-3.5-turbo');
      expect(provider.config.temperature).toBe(0.5);
      expect(provider.config.maxTokensPerRequest).toBe(2000);
    });

    it('should make standard completion API call', async () => {
      const mockCompletion = {
        choices: [{ message: { content: 'test response' } }],
      };

      const provider = new OpenAIProvider({});
      provider.client.chat.completions.create = vi.fn().mockResolvedValue(mockCompletion);

      const response = await provider.complete('test prompt', { temperature: 0.5 });

      expect(provider.client.chat.completions.create).toHaveBeenCalledWith({
        model: 'gpt-4',
        messages: [{ role: 'user', content: 'test prompt' }],
        temperature: 0.5,
        max_tokens: 4000,
      });

      expect(response).toBe('test response');
    });

    it('should make instructor API call with schema', async () => {
      const mockCompletion = {
        overview: 'Test overview',
        components: ['Component 1', 'Component 2'],
      };

      const schema = {
        shape: {
          overview: { type: 'string' },
          components: { type: 'array' },
        },
      };

      const provider = new OpenAIProvider({});
      provider.instructor.chat.completions.create = vi.fn().mockResolvedValue(mockCompletion);

      const response = await provider.complete('test prompt', {
        temperature: 0.5,
        responseSchema: schema,
      });

      expect(provider.instructor.chat.completions.create).toHaveBeenCalledWith({
        model: 'gpt-4',
        messages: [{ role: 'user', content: 'test prompt' }],
        temperature: 0.5,
        max_tokens: 4000,
        response_model: {
          name: 'Analysis',
          schema: schema,
        },
      });

      expect(response).toEqual(mockCompletion);
    });

    it('should stream responses', async () => {
      const chunks = [
        { choices: [{ delta: { content: 'Hello' } }] },
        { choices: [{ delta: { content: ' world' } }] },
        { choices: [{ delta: { content: '!' } }] },
      ];

      const provider = new OpenAIProvider({});
      provider.client.chat.completions.create = vi.fn().mockReturnValue({
        async *[Symbol.asyncIterator]() {
          for (const chunk of chunks) {
            yield chunk;
          }
        },
      });

      const streamedResponses = [];
      for await (const chunk of provider.stream('test prompt')) {
        streamedResponses.push(chunk);
      }

      expect(streamedResponses).toEqual(['Hello', ' world', '!']);
    });
  });

  describe('LLMFactory', () => {
    beforeEach(() => {
      process.env.OPENAI_API_KEY = 'test-key';
    });

    afterEach(() => {
      delete process.env.OPENAI_API_KEY;
    });

    it('should create Ollama provider', () => {
      const config = {
        llm: {
          provider: 'ollama',
          ollama: {
            endpoint: 'http://test:11434',
            model: 'codellama',
          },
        },
      };

      const provider = createLLMProvider(config);
      expect(provider).toBeInstanceOf(OllamaProvider);
      expect(provider.endpoint).toBe('http://test:11434');
      expect(provider.model).toBe('codellama');
    });

    it('should create OpenAI provider', () => {
      const config = {
        llm: {
          provider: 'openai',
          openai: {
            model: 'gpt-3.5-turbo',
            temperature: 0.5,
          },
        },
      };

      const provider = createLLMProvider(config);
      expect(provider).toBeInstanceOf(OpenAIProvider);
      expect(provider.config.model).toBe('gpt-3.5-turbo');
      expect(provider.config.temperature).toBe(0.5);
    });

    it('should create OpenAI provider by default', () => {
      const config = {};
      const provider = createLLMProvider(config);
      expect(provider).toBeInstanceOf(OpenAIProvider);
    });
  });
});
