// src/backend/handle.ts
import { backendConfig } from './config';

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

/**
 * The account id behind a public handle, read straight from `profiles`, which the migration
 * makes readable by anyone — that is what a profile page is for. Null when there is no backend,
 * no such handle, or the request fails: the caller shows the same "not available" either way.
 */
export const resolveHandle = async (handle: string): Promise<string | null> => {
  const config = backendConfig();
  if (!config) return null;
  const query = new URLSearchParams({ handle: `eq.${handle}`, select: 'user_id' });
  const response = await fetch(`${config.url}/rest/v1/profiles?${query.toString()}`, {
    headers: { apikey: config.key, authorization: `Bearer ${config.key}` },
  });
  if (!response.ok) return null;
  const rows = (await response.json()) as Array<{ user_id: string }>;
  return rows[0]?.user_id ?? null;
};
