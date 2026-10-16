// src/backend/handle.test.ts
import { describe, expect, it } from 'vitest';
import { handleSeed, slugify } from './handle';

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

describe('handleSeed', () => {
  it('uses the name when there is one', () => {
    expect(handleSeed('Ivan Petrov')).toBe('ivan-petrov');
  });

  it('never builds a handle out of the email address', () => {
    // profiles is readable by anyone, so an email-shaped handle would publish the address
    const seed = handleSeed('');
    expect(seed).not.toContain('bvtrots');
    expect(seed).not.toContain('gmail');
  });

  it('falls back to something random, not a shared default', () => {
    expect(handleSeed('')).not.toBe(handleSeed(''));
  });

  it('falls back to a handle the database will accept', () => {
    expect(handleSeed('')).toMatch(/^[a-z0-9-]{3,30}$/);
  });
});
