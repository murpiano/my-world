import { describe, expect, it } from 'vitest';
import { friendlyError } from './account';

describe('friendlyError', () => {
  it('turns what a person can act on into plain words, and leaves the rest as it is', () => {
    expect(friendlyError('Invalid login credentials')).toMatch(/do not match/);
    expect(friendlyError('Email not confirmed')).toMatch(/Confirm your email/);
    expect(friendlyError('User already registered')).toMatch(/already has an account/);
    expect(friendlyError('email rate limit exceeded')).toMatch(/Too many/);
    expect(friendlyError('TypeError: Failed to fetch')).toMatch(/cannot be reached/);
    expect(friendlyError('duplicate key value violates unique constraint "profiles_handle_key"')).toMatch(
      /handle is taken/,
    );
    expect(friendlyError('Something odd')).toBe('Something odd');
  });
});
