import { describe, it, expect } from 'vitest';
import { shouldIgnorePath, isRelevantFile } from '../source/analyser.js';

describe('File filtering', () => {
  it('correctly identifies relevant files', () => {
    // Should return true for supported file types
    expect(isRelevantFile('app.js')).toBe(true);
    expect(isRelevantFile('component.jsx')).toBe(true);
    expect(isRelevantFile('service.ts')).toBe(true);
    expect(isRelevantFile('app.tsx')).toBe(true);
    expect(isRelevantFile('script.py')).toBe(true);

    // Should return false for unsupported file types
    expect(isRelevantFile('readme.md')).toBe(false);
    expect(isRelevantFile('styles.css')).toBe(false);
    expect(isRelevantFile('data.json')).toBe(false);
  });

  it('correctly identifies paths to ignore', () => {
    // Should ignore common directories
    expect(shouldIgnorePath('node_modules/package')).toBe(true);
    expect(shouldIgnorePath('dist/bundle.js')).toBe(true);
    expect(shouldIgnorePath('.git/HEAD')).toBe(true);

    // Should not ignore regular directories
    expect(shouldIgnorePath('src/components')).toBe(false);
    expect(shouldIgnorePath('lib/utils')).toBe(false);
    expect(shouldIgnorePath('.aimd/doc.md')).toBe(false);
  });
});
