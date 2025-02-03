#!/usr/bin/env node
import React from 'react';
import {render} from 'ink';
import meow from 'meow';
import App from './app.js';

const cli = meow(
  `
    Usage
      $ babar -d <directory>

    🐘 Babar - Intelligent Codebase Analysis

    Options
      --directory, -d  Directory to analyze
      --help          Show this help message

    Examples
      $ babar -d /path/to/your/project
  `,
  {
    importMeta: import.meta,
    flags: {
      directory: {
        type: 'string',
        alias: 'd',
        required: true
      }
    }
  }
);

render(<App directory={cli.flags.directory} />);
