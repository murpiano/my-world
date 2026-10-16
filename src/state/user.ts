import type { Place, User } from '@/data/types';
import { readJSON, writeJSON } from '@/lib/storage';
import { createStore } from './store';

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

export const cleanPlace = (raw: unknown): Place | null => {
  if (!isObject(raw)) return null;
  const { name, country, countryId, lat, lon } = raw;
  if (typeof name !== 'string' || typeof country !== 'string' || typeof countryId !== 'string') {
    return null;
  }
  if (typeof lat !== 'number' || typeof lon !== 'number') return null;
  return { name, country, countryId, lat, lon };
};

/** Who the browser remembers. Anything else is nobody: the demo runs instead. */
export const cleanUser = (raw: unknown): User | null => {
  if (!isObject(raw)) return null;
  const home = cleanPlace(raw.home);
  if (typeof raw.name !== 'string' || typeof raw.email !== 'string' || !home) return null;
  return {
    name: raw.name,
    email: raw.email,
    home,
    ...(typeof raw.handle === 'string' ? { handle: raw.handle } : {}),
  };
};

export const userStore = createStore<{ user: User | null }>({
  user: cleanUser(readJSON<unknown>('user', null)),
});

const keep = (user: User | null) => {
  userStore.set({ user });
  writeJSON('user', user);
};

// the password is never stored: there is no server to check it against yet
export const logIn = (user: User): void => keep(user);

export const logOut = (): void => keep(null);

export const saveAccount = (patch: Partial<User>): void => {
  const { user } = userStore.get();
  if (!user) return;
  keep({ ...user, ...patch });
};
