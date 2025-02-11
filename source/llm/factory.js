import { OllamaProvider } from './ollama.js';
import { OpenAIProvider } from './openai.js';

export function createLLMProvider(config) {
  const provider = config.llm?.provider || 'openai';

  switch (provider.toLowerCase()) {
    case 'ollama':
      return new OllamaProvider(config.llm?.ollama || {});
    case 'openai':
      return new OpenAIProvider(config.llm?.openai || {});
    default:
      throw new Error(`Unknown LLM provider: ${provider}`);
  }
}
