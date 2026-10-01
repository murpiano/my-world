// src/backend/handle.test.ts
import { describe, expect, it } from 'vitest';
import { slugify } from './handle';

describe('slugify', () => {
  it('lowercases and hyphenates', () => {
    expect(slugify('Ivan Petrov')).toBe('ivan-petrov');
  });

  it('strips characters outside a-z0-9-', () => {
    expect(slugify("O'Brien & Co.")).toBe('obrien-co');
  });

  it('collapses repeated separators and trims the ends', () => {
    expect(slugify('  Too   Many   Spaces  ')).toBe('too-many-spaces');
  });

  it('falls back to "traveller" for a name with nothing left to slugify', () => {
    expect(slugify('★★★')).toBe('traveller');
  });

  it('clamps to 30 characters', () => {
    expect(slugify('a'.repeat(50)).length).toBe(30);
  });
});
