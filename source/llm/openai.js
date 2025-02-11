import { OpenAI } from 'openai';
import Instructor from '@instructor-ai/instructor';
import { BaseLLMProvider } from './base.js';

export class OpenAIProvider extends BaseLLMProvider {
  constructor(config) {
    super();
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY environment variable is required for OpenAI integration');
    }

    this.client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      dangerouslyAllowBrowser: true,
    });

    this.instructor = Instructor({
      client: this.client,
      mode: 'TOOLS',
    });

    this.config = {
      model: config.model || 'gpt-4',
      temperature: config.temperature || 0.1,
      maxTokensPerRequest: config.maxTokensPerRequest || 4000,
    };
  }

  async complete(prompt, options = {}) {
    const messages = Array.isArray(prompt) ? prompt : [{ role: 'user', content: prompt }];

    console.log(`\n🤖 Sending request to OpenAI (${this.config.model})...`);

    const requestOptions = {
      model: options.model || this.config.model,
      messages,
      temperature: options.temperature || this.config.temperature,
      max_tokens: options.max_tokens || this.config.maxTokensPerRequest,
    };

    // If a response schema is provided, use instructor
    if (options.responseSchema) {
      const completion = await this.instructor.chat.completions.create({
        ...requestOptions,
        response_model: {
          name: 'Analysis',
          schema: options.responseSchema,
        },
      });
      return completion;
    }

    // Otherwise use standard completion
    const completion = await this.client.chat.completions.create(requestOptions);
    return completion.choices[0].message.content;
  }

  async *stream(prompt, options = {}) {
    const messages = Array.isArray(prompt) ? prompt : [{ role: 'user', content: prompt }];

    console.log(`\n🤖 Sending request to OpenAI (${this.config.model})...`);

    const requestOptions = {
      model: options.model || this.config.model,
      messages,
      temperature: options.temperature || this.config.temperature,
      max_tokens: options.max_tokens || this.config.maxTokensPerRequest,
      stream: true,
    };

    try {
      const stream = await this.client.chat.completions.create(requestOptions);

      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content;
        if (content) {
          yield content;
        }
      }
    } catch (error) {
      console.error('Error in OpenAI stream:', error);
      throw error;
    }
  }
}
