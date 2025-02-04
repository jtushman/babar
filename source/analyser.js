import { readdir } from 'fs/promises';
import { readFile, writeFile, stat } from 'fs/promises';
import { join, relative, basename } from 'path';
import { OpenAI } from 'openai';
import Instructor from '@instructor-ai/instructor';
import { loadConfig } from './config.js';
import minimatch from 'minimatch';

const config = loadConfig();

// Common directories and files to ignore
const IGNORED_PATTERNS = [
  'node_modules',
  'dist',
  'build',
  'coverage',
  '.git',
  '.next',
  '.cache',
  '.temp',
  'vendor',
];

export const shouldIgnorePath = (path) => {
  const name = basename(path);
  // Ignore dot files/directories (except .aimd files)
  if (name.startsWith('.') && !name.endsWith('.aimd')) return true;
  // Ignore common patterns
  return IGNORED_PATTERNS.some((pattern) => path.includes(pattern));
};

export const isRelevantFile = (path) => {
  const validExtensions = ['.js', '.jsx', '.ts', '.tsx', '.py', '.go', '.java', '.rb'];
  return validExtensions.some((ext) => path.endsWith(ext));
};

// Initialize OpenAI only when needed
const getOpenAIClient = () => {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY environment variable is required for AI analysis');
  }
  return new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });
};

const getInstructorClient = () => {
  const openai = getOpenAIClient();
  return Instructor({
    client: openai,
    mode: 'TOOLS',
  });
};

// Read .aimd file if it exists
const readAimdFile = async (path) => {
  try {
    const content = await readFile(path, 'utf-8');
    return content;
  } catch (error) {
    return null;
  }
};

class DirectoryNode {
  constructor(path, parent = null) {
    this.path = path;
    this.parent = parent;
    this.children = new Map();
    this.files = [];
    this.depth = parent ? parent.depth + 1 : 0;
    this.needsAnalysis = false;
  }

  addChild(name, node) {
    this.children.set(name, node);
  }

  addFile(file) {
    this.files.push(file);
    this.needsAnalysis = true;
  }
}

// Build directory tree and identify which directories need processing
const buildDirectoryTree = async (rootPath) => {
  const root = new DirectoryNode(rootPath);
  let totalToProcess = 0;

  async function buildTree(node) {
    try {
      const entries = await readdir(node.path, { withFileTypes: true });

      for (const entry of entries) {
        const path = join(node.path, entry.name);

        if (shouldIgnorePath(path)) {
          console.log(`Skipping ignored path: ${path}`);
          continue;
        }

        if (entry.isDirectory()) {
          const childNode = new DirectoryNode(path, node);
          await buildTree(childNode);
          // Only add the child if it needs analysis or has children that need analysis
          if (childNode.needsAnalysis || childNode.children.size > 0) {
            node.addChild(entry.name, childNode);
          }
        } else if (isRelevantFile(path)) {
          node.addFile({
            path,
            stats: await stat(path),
          });
        }
      }

      // If this directory has files that need analysis, increment counter
      if (node.files.length > 0) {
        totalToProcess++;
      }
    } catch (error) {
      console.error(`Error building tree for ${node.path}:`, error);
    }
  }

  await buildTree(root);
  return { root, totalToProcess };
};

async function analyzeWithAI(content, metadata) {
  const debug = process.env.DEBUG === 'true';
  const timestamp = new Date().toISOString();

  // Replace variables in the prompt template
  const prompt = config.prompt
    .replace('{fileCount}', metadata.fileCount)
    .replace('{childCount}', metadata.childCount)
    .replace('{timestamp}', timestamp)
    .replace(
      '{includeSubdirs}',
      metadata.childCount > 0
        ? '## Subdirectories\n[Explain how this directory organizes and uses its subdirectories]'
        : ''
    );

  const messages = [
    { role: 'system', content: prompt },
    { role: 'user', content },
  ];

  if (debug) {
    console.log('\n=== OpenAI Request ===');
    console.log('System prompt:', prompt);
    console.log('Content:', content);
  }

  try {
    const instructor = getInstructorClient();
    const completion = await instructor.chat.completions.create({
      model: config.model,
      messages,
      temperature: config.temperature,
      max_tokens: config.maxTokensPerRequest,
      response_model: {
        name: 'Analysis',
        schema: config.schema,
      },
    });

    // Generate markdown from the structured response
    const analysis = ['<!-- Generated by Babar on ' + timestamp + ' -->', '# Directory Analysis'];

    // Add each section from the schema in order
    for (const [key, _field] of Object.entries(config.schema.shape)) {
      const content = completion[key];
      if (content) {
        analysis.push(`\n## ${key}`);
        if (Array.isArray(content)) {
          analysis.push(content.join('\n'));
        } else {
          analysis.push(content);
        }
      }
    }

    const markdownOutput = analysis.join('\n');

    if (debug) {
      console.log('\n=== OpenAI Response ===');
      console.log(markdownOutput);
      console.log('======================\n');
    }

    return markdownOutput;
  } catch (error) {
    console.error('Error calling OpenAI:', error);
    throw error;
  }
}

const analyzeDirectory = async (dirPath, files, childrenAimd = []) => {
  try {
    console.log(`🐘 Analyzing directory: ${dirPath}`);
    console.log(`Found ${files.length} relevant files and ${childrenAimd.length} child summaries`);

    // Filter files based on configuration
    const validFiles = files.filter((file) => {
      const relativePath = relative(dirPath, file.path);
      return config.includeFiles.some(
        (pattern) =>
          minimatch(relativePath, pattern) &&
          !config.excludePatterns.some((exclude) => minimatch(relativePath, exclude))
      );
    });

    // Read file contents
    const fileContents = await Promise.all(
      validFiles.map(async (file) => {
        const content = await readFile(file.path, 'utf-8');
        return `File: ${relative(dirPath, file.path)}\n\n${content}`;
      })
    );

    let prompt = fileContents.join('\n\n---\n\n');

    if (childrenAimd.length > 0) {
      prompt += '\n\nChild Directory Summaries:\n\n' + childrenAimd.join('\n\n---\n\n');
    }

    const analysis = await analyzeWithAI(prompt, {
      fileCount: validFiles.length,
      childCount: childrenAimd.length,
    });

    if (analysis) {
      const aimdPath = join(dirPath, config.outputFile);
      await writeFile(aimdPath, analysis, 'utf-8');
      console.log(`🐘 Successfully analyzed directory: ${relative(process.cwd(), dirPath)}`);
    }

    return analysis;
  } catch (error) {
    console.error(`Error analyzing directory ${dirPath}:`, error);
    return null;
  }
};

// Process a single directory node
const processDirectoryNode = async (node, baseDir, onProgress, processedCount) => {
  const relativePath = relative(baseDir, node.path);
  const aimdPath = join(node.path, config.outputFile);

  // Check if we need to analyze this directory
  if (node.files.length > 0) {
    let needsAnalysis = true;
    try {
      const aimdStats = await stat(aimdPath);
      needsAnalysis = node.files.some((file) => file.stats.mtime > aimdStats.mtime);
    } catch (error) {
      // .aimd doesn't exist, needs analysis
    }

    if (needsAnalysis) {
      if (onProgress) {
        onProgress({
          type: 'analyzing',
          directory: relativePath,
          progress: {
            current: processedCount.value,
            total: processedCount.total,
          },
          action: 'start',
        });
      }

      processedCount.value++;
      // Collect child .aimd files
      const childrenAimd = await Promise.all(
        Array.from(node.children.entries()).map(async ([name, childNode]) => {
          const childAimdPath = join(childNode.path, config.outputFile);
          const content = await readAimdFile(childAimdPath);
          return content ? { name, content } : null;
        })
      );

      await analyzeDirectory(
        node.path,
        node.files,
        childrenAimd.filter((child) => child !== null)
      );

      if (onProgress) {
        onProgress({
          type: 'analyzing',
          directory: relativePath,
          progress: {
            current: processedCount.value,
            total: processedCount.total,
          },
          action: 'end',
        });
      }
    } else {
      console.log(`Skipping ${relativePath} - already analyzed`);
    }
  }
};

export const processDirectory = async (directory, onProgress) => {
  // First, build the directory tree
  console.log('Building directory tree...');
  const { root, totalToProcess } = await buildDirectoryTree(directory);
  console.log(`Found ${totalToProcess} directories to analyze`);

  // Group nodes by depth
  const nodesByDepth = new Map();
  const processedCount = { value: 0, total: totalToProcess };

  function groupByDepth(node) {
    const depth = node.depth;
    if (!nodesByDepth.has(depth)) {
      nodesByDepth.set(depth, []);
    }
    nodesByDepth.get(depth).push(node);

    for (const child of node.children.values()) {
      groupByDepth(child);
    }
  }

  groupByDepth(root);

  // Process each depth level in parallel, starting from the deepest
  const depths = Array.from(nodesByDepth.keys()).sort((a, b) => b - a);

  for (const depth of depths) {
    const nodes = nodesByDepth.get(depth);
    console.log(`Processing depth ${depth} (${nodes.length} directories)...`);

    // Process all nodes at this depth in parallel
    await Promise.all(
      nodes.map((node) => processDirectoryNode(node, directory, onProgress, processedCount))
    );
  }

  console.log(
    `Analysis complete. Processed ${processedCount.value}/${totalToProcess} directories.`
  );
};
