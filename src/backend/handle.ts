// src/backend/handle.ts
/** A URL-safe slug from an account's name, for its public profile at /u/<handle>.
 *  Uniqueness (appending -2, -3, ...) is the caller's job, since only the caller knows
 *  which handles are already taken. */
export const slugify = (name: string): string => {
  const base = name
    .toLowerCase()
    // an apostrophe sits inside a word: O'Brien is obrien, not o-brien
    .replace(/['\u2019]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 30)
    .replace(/-+$/, '');
  return base || 'traveller';
};
