import { readFile, writeFile, stat } from 'fs/promises';
import { join, relative, basename } from 'path';
import { OpenAI } from 'openai';
import { config } from 'dotenv';
import { readdir } from 'fs/promises';

config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

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
  'vendor'
];

const shouldIgnorePath = (path) => {
  const name = basename(path);
  // Ignore dot files/directories (except .aimd files)
  if (name.startsWith('.') && !name.endsWith('.aimd')) return true;
  // Ignore common patterns
  return IGNORED_PATTERNS.some(pattern => path.includes(pattern));
};

const isRelevantFile = (path) => {
  const validExtensions = ['.js', '.jsx', '.ts', '.tsx', '.py', '.go', '.java', '.rb'];
  return validExtensions.some(ext => path.endsWith(ext));
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
            stats: await stat(path)
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

async function analyzeWithAI(content, systemPrompt) {
  const debug = process.env.DEBUG === 'true';
  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content }
  ];

  if (debug) {
    console.log('\n=== OpenAI Request ===');
    console.log('System prompt:', systemPrompt);
    console.log('Content:', content);
  }

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4',
      messages,
      temperature: 0.7,
      max_tokens: 1000
    });

    const response = completion.choices[0].message.content;

    if (debug) {
      console.log('\n=== OpenAI Response ===');
      console.log(response);
      console.log('======================\n');
    }

    return response;
  } catch (error) {
    console.error('Error calling OpenAI:', error);
    throw error;
  }
}

const analyzeDirectory = async (dirPath, files, childrenAimd = []) => {
  try {
    console.log(`🐘 Analyzing directory: ${dirPath}`);
    console.log(`Found ${files.length} relevant files and ${childrenAimd.length} child summaries`);

    // Read the content of each file
    const fileContents = await Promise.all(
      files.map(async file => {
        try {
          const content = await readFile(file.path, 'utf-8');
          return {
            name: relative(dirPath, file.path),
            content: content
          };
        } catch (error) {
          console.error(`Error reading file ${file.path}:`, error);
          return null;
        }
      })
    );

    // Filter out any files that couldn't be read
    const validFiles = fileContents.filter(f => f !== null);

    // If no valid files and no children summaries, skip analysis
    if (validFiles.length === 0 && childrenAimd.length === 0) {
      return null;
    }

    // Create a directory summary for the AI
    let prompt = '';
    
    if (validFiles.length > 0) {
      prompt += '# Source Files\n\n' + validFiles.map(file => 
        `File: ${file.name}\n\n${file.content.slice(0, 1000)}${file.content.length > 1000 ? '...' : ''}\n\n`
      ).join('---\n\n');
    }
    
    if (childrenAimd.length > 0) {
      prompt += '\n# Child Directory Summaries\n\n' + childrenAimd.map(child => 
        `Directory: ${child.name}\n\n${child.content}\n\n`
      ).join('---\n\n');
    }

    const response = await analyzeWithAI(prompt, `You are a technical documentation expert. Analyze this directory containing ${validFiles.length} files and ${childrenAimd.length} subdirectories.
Create a comprehensive but concise summary that includes:
1. The overall purpose of this directory
2. Key components and their relationships
3. Important patterns or architectural decisions
4. Dependencies and external integrations
5. Any notable conventions or practices
${childrenAimd.length > 0 ? '6. How this directory organizes and uses its subdirectories' : ''}

Keep the response informative but brief, focusing on what would be most helpful for developers to understand this codebase.`);

    if (response) {
      const aimdPath = join(dirPath, '.aimd');
      await writeFile(aimdPath, response, 'utf-8');
      console.log(`🐘 Successfully analyzed directory: ${relative(dirPath, dirPath)}`);
    }

    return response;
  } catch (error) {
    console.error(`Error analyzing directory ${dirPath}:`, error);
    return null;
  }
};

// Process a single directory node
const processDirectoryNode = async (node, baseDir, onProgress, processedCount) => {
  const relativePath = relative(baseDir, node.path);
  const aimdPath = join(node.path, '.aimd');

  // Check if we need to analyze this directory
  if (node.files.length > 0) {
    let needsAnalysis = true;
    try {
      const aimdStats = await stat(aimdPath);
      needsAnalysis = node.files.some(file => file.stats.mtime > aimdStats.mtime);
    } catch (error) {
      // .aimd doesn't exist, needs analysis
    }

    if (needsAnalysis) {
      if (onProgress) {
        onProgress({
          type: 'analyzing',
          directory: relativePath,
          progress: { current: processedCount.value, total: processedCount.total },
          action: 'start'
        });
      }

      processedCount.value++;
      // Collect child .aimd files
      const childrenAimd = await Promise.all(
        Array.from(node.children.entries()).map(async ([name, childNode]) => {
          const childAimdPath = join(childNode.path, '.aimd');
          const content = await readAimdFile(childAimdPath);
          return content ? { name, content } : null;
        })
      );

      const analysis = await analyzeDirectory(
        node.path,
        node.files,
        childrenAimd.filter(child => child !== null)
      );

      if (onProgress) {
        onProgress({
          type: 'analyzing',
          directory: relativePath,
          progress: { current: processedCount.value, total: processedCount.total },
          action: 'end'
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
      nodes.map(node => processDirectoryNode(node, directory, onProgress, processedCount))
    );
  }

  console.log(`Analysis complete. Processed ${processedCount.value}/${totalToProcess} directories.`);
};
