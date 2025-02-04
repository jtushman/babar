import { describe, it, expect } from 'vitest';

describe('hello world', () => {
  it('adds 1 + 1', () => {
    expect(1 + 1).toBe(2);
  });

  it('concatenates strings', () => {
    expect('hello' + ' world').toBe('hello world');
  });
});
