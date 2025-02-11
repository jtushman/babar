# Babar :elephant:

Babar is an intelligent codebase analyzer designed to bridge the gap between your existing codebase and modern AI-powered development workflows. By recursively analyzing your project's directory structure and creating smart summaries, Babar helps both developers and AI tools better understand and work with your codebase.

## Why Babar?

- 🤖 **AI-First Documentation**: Creates documentation that's optimized for both humans and AI assistants
- 📦 **Codebase Understanding**: Helps new developers and AI tools quickly understand your project structure
- 🔄 **Living Documentation**: Automatically updates as your codebase evolves
- 🎯 **Contextual Analysis**: Provides deep insights about components, patterns, and technical debt
- 🚀 **Fast & Efficient**: Processes directories in parallel and caches results

## Getting Started

### Installation

```bash
npm install -g babar-ai
```

### Environment Variables

```bash
OPENAI_API_KEY=your-api-key-here
DEBUG=false  # Set to true to see OpenAI requests and responses
```

## Configuration

Babar can be customized using a `.babar.json` file in your project root. This allows you to define:

- Custom analysis sections
- Prompt templates
- LLM settings (OpenAI or Ollama)
- File patterns

### Configuration Options

| Option            | Description                     | Default                        |
| ----------------- | ------------------------------- | ------------------------------ |
| `sections`        | Define custom analysis sections | See default config             |
| `promptTemplate`  | Template for the AI prompt      | See default config             |
| `llm`             | LLM provider configuration      | See LLM Configuration          |
| `includeFiles`    | File patterns to analyze        | `["**/*.js", "**/*.jsx", ...]` |
| `excludePatterns` | File patterns to ignore         | `["**/node_modules/**", ...]`  |
| `outputFile`      | File to write the analysis      | `.babar.md`                    |

### LLM Configuration

Babar supports both OpenAI and Ollama as LLM providers. Configure them in your `.babar.json`:

```json
{
  "llm": {
    "provider": "openai", // "openai" or "ollama"
    "openai": {
      "model": "gpt-4",
      "temperature": 0.1,
      "maxTokensPerRequest": 4000
    },
    "ollama": {
      "endpoint": "http://localhost:11434",
      "model": "llama2",
      "temperature": 0.1,
      "maxTokensPerRequest": 4000
    }
  }
}
```

#### OpenAI Provider

- Requires `OPENAI_API_KEY` environment variable
- Supports GPT-4 and other OpenAI models
- Includes structured output support via instructor

#### Ollama Provider

- Run locally with Docker support
- Compatible with various open-source models
- No API key required

### Docker Support

Babar includes Docker support for local development and testing. Use the provided `docker-compose.yml`:

```bash
# Start Babar with Ollama support
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

The Docker setup includes:

- Babar service with Node.js and Python support
- Ollama service with GPU support (if available)
- Shared volume for model persistence

### Streaming Support

Both OpenAI and Ollama providers support streaming responses. Enable streaming in your code:

```javascript
import { createLLMProvider } from './llm/factory.js';

const provider = createLLMProvider(config);

// Stream responses
for await (const chunk of provider.stream('Your prompt here')) {
  console.log(chunk); // Process each chunk as it arrives
}

// Or use standard completion
const response = await provider.complete('Your prompt here');
console.log(response);
```

### Default Configuration

By default, Babar analyzes your codebase with these sections:

```json
{
  "sections": {
    "components": {
      "type": "array",
      "description": "Key components and modules",
      "required": true
    },
    "architecture": {
      "type": "string",
      "description": "Component interactions and patterns",
      "required": true
    },
    "conventions": {
      "type": "string",
      "description": "Coding standards and practices",
      "required": true
    },
    "refactoringOpportunities": {
      "type": "array",
      "description": "Potential improvements",
      "required": true
    },
    "technicalDebt": {
      "type": "string",
      "description": "Areas needing attention",
      "required": true
    }
  },
  "promptTemplate": "You are a technical documentation expert analyzing {fileCount} files and {childCount} subdirectories.\n\nCreate a comprehensive analysis following this structure:\n\n{sections}\n\n{includeSubdirs}\n\nFocus on clarity and maintainability. Explain complex concepts clearly.",
  "llm": {
    "provider": "openai",
    "openai": {
      "model": "gpt-4",
      "temperature": 0.1,
      "maxTokensPerRequest": 4000
    }
  },
  "includeFiles": ["**/*.js", "**/*.py", "**/*.rb"],
  "excludePatterns": ["**/node_modules/**", "**/dist/**"],
  "outputFile": ".babar.md"
}
```

### Configuration Priority

1. Environment variables take highest precedence
2. Project-specific `.babar.json`
3. Default configuration

### Usage

```bash
# Analyze current directory
babar -d .

# Analyze specific directory
babar -d /path/to/project

# Show help
babar --help
```

## How It Works

1. Babar recursively scans your project directory
2. For each directory, it:
   - Lists all files and subdirectories
   - Analyzes the contents using GPT-4
   - Generates a `.babar.md` file with the analysis
3. The analysis includes:
   - Key components and their purposes
   - Architecture patterns
   - Coding conventions
   - Potential improvements
   - Technical debt notes

## Using with AI Assistants

To help AI assistants understand your codebase, add this to your assistant's configuration (such as .windsurfrules or .cursorrules):

```json
{
  "contextRules": {
    "includeFiles": ["**/.babar.md"],
    "maxFilesToSearch": 500,
    "maxCharsPerFile": 100000
  },
  "fileSearch": {
    "include": ["**/.babar.md"],
    "exclude": [],
    "maxResults": 10
  }
}
```

This configuration:

1. Includes `.babar.md` files in the context provided to AI assistants
2. Prioritizes `.babar.md` files during codebase searches
3. Ensures the AI has access to Babar's hierarchical documentation when answering questions about your codebase

For the best results:

- Run Babar before starting new development sessions to ensure up-to-date context
- Consider adding `.babar.md` files to your version control to share context with your team
- Exclude `.babar.md` files from your `.gitignore` if you want to preserve the analysis across clones

## License

MIT
