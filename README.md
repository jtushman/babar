# Babar :elephant:

Babar is an intelligent codebase analyzer designed to bridge the gap between your existing codebase and modern AI-powered development workflows. By recursively analyzing your project's directory structure and creating smart summaries, Babar helps both developers and AI tools better understand and work with your codebase.

## Why Babar?

As AI-powered development tools become increasingly prevalent, they need rich context about your codebase to be truly effective. Babar solves this by:

1. **Creating Digestible Context**: Analyzes your codebase directory by directory, generating concise summaries that capture the essential purpose, patterns, and relationships
2. **Building Knowledge Hierarchies**: Understands how different parts of your codebase relate to each other by incorporating child directory summaries into parent contexts
3. **Maintaining Living Documentation**: Generates `.aimd` files throughout your codebase that serve as living documentation, making it easier for both humans and AI tools to understand your project's structure

## Features

- **Parallel Processing**: Analyzes directories at the same depth concurrently, significantly speeding up analysis of large codebases
- **Hierarchical Context**: Intelligently includes summaries from child directories in parent analysis, providing comprehensive context up the directory tree
- **Smart Caching**: Creates `.aimd` files to cache analysis results and skip previously analyzed directories
- **Debug Mode**: Enable detailed logging of OpenAI requests and responses by setting `DEBUG=true`

## Getting Started

### Installation

```bash
npm install -g babar-ai
```

### Configuration

#### Environment Variables

Create a `.env` file with your OpenAI API key and optional settings:

```bash
OPENAI_API_KEY=your-api-key-here
DEBUG=false  # Set to true to see OpenAI requests and responses

# Optional: Override default prompt and model settings
BABAR_PROMPT="Your custom prompt for directory analysis"
BABAR_MODEL="gpt-4"  # or another OpenAI model
BABAR_TEMPERATURE=0.1  # 0.0 to 1.0
```

#### Custom Configuration

Create a `.babarrc.json` file in your project root to customize Babar's behavior:

```json
{
	"prompt": "Custom prompt for analyzing directories. Available variables:\n{fileCount} - number of files\n{childCount} - number of subdirectories\n{includeSubdirs} - placeholder for subdirectory instructions",

	"model": "gpt-4",
	"temperature": 0.1,

	"includeFiles": ["**/*.js", "**/*.py", "**/*.rb"],
	"excludePatterns": ["**/node_modules/**", "**/dist/**"],
	"maxTokensPerRequest": 4000,
	"outputFile": ".aimd"
}
```

### Configuration Priority

1. Environment variables take highest precedence
2. Project-specific `.babarrc.json`
3. Default configuration

### Usage

Note: While the package is installed as `babar-ai`, the command is available as `babar` for convenience.

```bash
# Analyze a specific directory
babar -d /path/to/your/project

# Show help
babar --help
```

## How It Works

1. Babar recursively scans your project directory
2. For each directory, it:
   - Analyzes the contents of all relevant files
   - Incorporates summaries from child directories
   - Generates a comprehensive summary in a `.aimd` file
3. These `.aimd` files can then be used by AI development tools to better understand your codebase's structure and purpose

The resulting `.aimd` files serve as a knowledge graph that helps AI tools provide more contextually aware and accurate assistance when working with your codebase.

## Integration with AI-Powered IDEs

### Windsurf/Cursor Configuration

To help AI assistants better understand your codebase, add the following to your `.windsurfrules` or `.cursorrules` file:

```json
{
	"contextRules": {
		"includeFiles": ["**/.aimd"],
		"maxFilesToSearch": 500,
		"maxCharsPerFile": 100000
	},
	"searchPaths": [
		{
			"path": ".",
			"pattern": "**/.aimd",
			"maxFiles": 50
		}
	]
}
```

This configuration:

1. Includes `.aimd` files in the context provided to AI assistants
2. Prioritizes `.aimd` files during codebase searches
3. Ensures the AI has access to Babar's hierarchical documentation when answering questions about your codebase

For the best results:

- Run Babar before starting new development sessions to ensure up-to-date context
- Consider adding `.aimd` files to your version control to share context with your team
- Exclude `.aimd` files from your `.gitignore` if you want to preserve the analysis across clones
