// Base LLM provider interface
export class BaseLLMProvider {
  /* eslint-disable no-unused-vars, require-yield */
  async complete(prompt, options = {}) {
    throw new Error('Method not implemented');
  }

  async *stream(prompt, options = {}) {
    throw new Error('Method not implemented');
  }
  /* eslint-enable no-unused-vars, require-yield */
}
