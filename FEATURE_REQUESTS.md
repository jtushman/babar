# Feature Requests 🐘

This document tracks planned features and improvements for Babar.

## Planned Features

### Watch Mode (`babar:watch`)

Add a watch mode that continuously monitors the codebase for changes and updates `.aimd` files automatically.

**Details:**

- Command: `babar watch -d <directory>`
- Watches for file changes in the specified directory
- Only re-analyzes directories affected by changes (and their parent directories)
- Provides real-time feedback about which directories are being updated
- Optional debounce configuration to prevent too frequent updates

**Implementation Considerations:**

- Use `chokidar` or similar for file watching
- Implement smart caching to only update affected directories
- Add configuration options for ignore patterns
- Consider adding websocket support for real-time UI updates

### Local LLM Support (Ollama Integration)

Add support for running Babar with local LLMs through Ollama integration.

**Details:**

- Allow configuration of different LLM backends
- Support for Ollama's API
- Configuration in `.env`:
  ```bash
  LLM_PROVIDER=ollama  # or openai
  OLLAMA_MODEL=codellama  # or other models
  OLLAMA_ENDPOINT=http://localhost:11434  # custom endpoint if needed
  ```

**Implementation Considerations:**

- Abstract the LLM interface to support multiple providers
- Add model-specific prompt templates
- Support for different token limits and capabilities
- Add documentation for setting up and running Ollama locally

## Contributing

If you'd like to work on implementing any of these features:

1. Open an issue to discuss the implementation approach
2. Reference the feature request in your PR
3. Update documentation to reflect the new functionality

Feel free to submit additional feature requests through GitHub issues!
