export const defaultConfig = {
  prompt: `You are a technical documentation expert. Analyze this directory containing {fileCount} files and {childCount} subdirectories.

Create a comprehensive but concise summary that includes:
1. The overall purpose of this directory
2. Key components and their relationships
3. Important patterns and conventions
4. Notable dependencies or integrations
5. Any notable conventions or practices
{includeSubdirs}

Keep the response informative but brief, focusing on what would be most helpful for developers to understand this codebase.`,
  
  // OpenAI API settings
  model: 'gpt-4',
  temperature: 0.1,
  
  // Analysis settings
  includeFiles: ['**/*.js', '**/*.jsx', '**/*.ts', '**/*.tsx', '**/*.py', '**/*.rb', '**/*.go'],
  excludePatterns: ['**/node_modules/**', '**/dist/**', '**/build/**', '**/.git/**'],
  maxTokensPerRequest: 4000,
  
  // Output settings
  outputFile: '.aimd',
};

export function loadConfig() {
  let config = { ...defaultConfig };
  
  // Override with environment variables if present
  if (process.env.BABAR_PROMPT) {
    config.prompt = process.env.BABAR_PROMPT;
  }
  if (process.env.BABAR_MODEL) {
    config.model = process.env.BABAR_MODEL;
  }
  if (process.env.BABAR_TEMPERATURE) {
    config.temperature = parseFloat(process.env.BABAR_TEMPERATURE);
  }
  
  // Look for .babarrc.json in the current directory or parent directories
  try {
    const userConfig = require(process.cwd() + '/.babarrc.json');
    config = { ...config, ...userConfig };
  } catch (error) {
    // No config file found, use defaults
  }
  
  return config;
}
