import { z } from 'zod';

// Base schema that all analyses must include
const baseSchema = z.object({
  overview: z.string().describe("A summary of the directory's purpose and role"),
});

// Default sections schema - can be extended by user config
const defaultSectionsSchema = z.object({
  components: z.array(z.string()).describe('Key components and modules'),
  architecture: z.string().describe('Component interactions and patterns'),
  conventions: z.string().describe('Coding standards and practices'),
  refactoringOpportunities: z.array(z.string()).describe('Potential improvements'),
  technicalDebt: z.string().describe('Areas needing attention'),
});

// // Schema for user-defined custom sections in .babarrc.json
// z.object({
//   type: z.enum(['string', 'array']).describe('Type of the section content'),
//   description: z.string().describe('Description for the AI model'),
//   required: z.boolean().default(false).describe('Whether this section is required'),
// });

// Helper to convert user config sections to Zod schema
function buildSchemaFromConfig(config) {
  const customSections = config.sections || {};
  const customSchema = Object.entries(customSections).reduce((acc, [key, section]) => {
    const fieldSchema =
      section.type === 'array'
        ? z.array(z.string()).describe(section.description)
        : z.string().describe(section.description);

    return {
      ...acc,
      [key]: section.required ? fieldSchema : fieldSchema.optional(),
    };
  }, {});

  // Combine base schema with custom sections
  return z.object({
    ...baseSchema.shape,
    ...customSchema,
    ...defaultSectionsSchema.shape,
  });
}

// Helper to generate prompt from schema
function generatePromptFromSchema(schema) {
  const descriptions = Object.entries(schema.shape).map(([key, field]) => {
    const desc = field.description;
    const type = field instanceof z.ZodArray ? 'array' : 'string';
    return `## ${key}\n[${desc}]${type === 'array' ? '\n- Item 1\n- Item 2\n...' : ''}`;
  });

  return descriptions.join('\n\n');
}

export const defaultConfig = {
  // Default sections configuration
  sections: {
    domainConcepts: {
      type: 'array',
      description: 'Key domain concepts and terminology',
      required: true,
    },
    businessLogic: {
      type: 'string',
      description: 'Core business rules and workflows',
      required: true,
    },
    dataModels: {
      type: 'array',
      description: 'Data structures and their relationships',
      required: false,
    },
  },

  // Base prompt that can be customized
  promptTemplate: `You are a technical documentation expert analyzing {fileCount} files and {childCount} subdirectories.

Create a comprehensive analysis following this structure:

{sections}

{includeSubdirs}

Focus on clarity and maintainability. Explain complex concepts clearly.`,

  // OpenAI settings
  model: 'gpt-4',
  temperature: 0.1,
  maxTokensPerRequest: 4000,

  // File patterns
  includeFiles: ['**/*.js', '**/*.jsx', '**/*.ts', '**/*.tsx', '**/*.py', '**/*.rb', '**/*.go'],
  excludePatterns: ['**/node_modules/**', '**/dist/**', '**/build/**', '**/.git/**'],

  // Output settings
  outputFile: '.aimd',
};

export function loadConfig() {
  let config = { ...defaultConfig };

  // Try to load user config
  try {
    const userConfig = require(process.cwd() + '/.babarrc.json');
    config = {
      ...config,
      ...userConfig,
      // Merge sections rather than replace
      sections: { ...config.sections, ...(userConfig.sections || {}) },
    };
  } catch (error) {
    // No config file found, use defaults
  }

  // Build final schema based on config
  const schema = buildSchemaFromConfig(config);

  // Generate sections part of the prompt
  const sectionsPrompt = generatePromptFromSchema(schema);

  // Build final prompt
  const prompt = config.promptTemplate.replace('{sections}', sectionsPrompt);

  return {
    ...config,
    schema,
    prompt,
  };
}
