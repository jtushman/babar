import { OllamaProvider } from './ollama.js';
import { OpenAIProvider } from './openai.js';

export function createLLMProvider(config) {
  const provider = config.llm?.provider || 'openai';
  const settings = config.llm?.[provider.toLowerCase()] || {};

  console.log('\n🤖 LLM Configuration:');
  console.log(`Provider: ${provider}`);
  console.log(`Model: ${settings.model || 'default'}`);
  if (provider.toLowerCase() === 'ollama') {
    console.log(`Endpoint: ${settings.endpoint || 'http://localhost:11434'}\n`);
  }

  switch (provider.toLowerCase()) {
    case 'ollama':
      return new OllamaProvider(settings);
    case 'openai':
      return new OpenAIProvider(settings);
    default:
      throw new Error(`Unknown LLM provider: ${provider}`);
  }
}
