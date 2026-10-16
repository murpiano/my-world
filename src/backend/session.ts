import { backendConfig } from './config';
import type { Backend } from './types';

let current: Backend | null = null;
let starting: Promise<Backend | null> | null = null;

/**
 * Sets the backend up once, by whichever view needs it first: the world at boot, or a profile
 * or a lone shared photo, which build no world. Null when the build has none (the app stays
 * local); a failed start can be tried again.
 */
export const startBackend = (): Promise<Backend | null> => {
  starting ??= (async () => {
    const config = backendConfig();
    if (!config) return null;
    const { createSupabase } = await import('./supabase');
    current = await createSupabase(config);
    return current;
  })().catch((error: unknown) => {
    starting = null;
    throw error;
  });
  return starting;
};

/** The backend, once `startBackend` has made it. */
export const backend = (): Backend | null => current;
