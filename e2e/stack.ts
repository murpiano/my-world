import { execFileSync } from 'node:child_process';

/** The local Supabase the end-to-end tests run against, as `npm run db:start` left it. */
export interface Stack {
  url: string;
  /** What the app is built with: the same kind of key the deployed site carries. */
  publishableKey: string;
  /** For the tests themselves, around the browser: making accounts, reading settings back. */
  serviceRoleKey: string;
}

let known: Stack | null = null;

export const localStack = (): Stack => {
  if (known) return known;
  let status: Record<string, string | undefined>;
  try {
    const out = execFileSync('npx', ['supabase', 'status', '-o', 'json'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    status = JSON.parse(out) as Record<string, string | undefined>;
  } catch {
    throw new Error('The local Supabase is not running. Start it with `npm run db:start`.');
  }
  const {
    API_URL: url,
    PUBLISHABLE_KEY: publishableKey,
    SERVICE_ROLE_KEY: serviceRoleKey,
  } = status;
  if (!url || !publishableKey || !serviceRoleKey) {
    throw new Error('`supabase status` did not report the API address and the keys.');
  }
  known = { url, publishableKey, serviceRoleKey };
  return known;
};
