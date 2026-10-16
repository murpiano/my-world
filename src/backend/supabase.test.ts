// src/backend/supabase.test.ts
import { describe, expect, it, vi } from 'vitest';
import { authOf, storageOf } from './supabase';

const fakeClient = (overrides: {
  visibilityRow?: { level: string; link_token: string | null } | null;
  upsertError?: { message: string } | null;
  session?: { access_token: string } | null;
} = {}) => {
  const upsert = vi.fn().mockResolvedValue({ error: overrides.upsertError ?? null });
  const maybeSingle = vi.fn().mockResolvedValue({ data: overrides.visibilityRow ?? null, error: null });
  const eq3 = vi.fn(() => ({ maybeSingle }));
  const eq2 = vi.fn(() => ({ eq: eq3 }));
  const eq1 = vi.fn(() => ({ eq: eq2 }));
  const select = vi.fn(() => ({ eq: eq1 }));
  const from = vi.fn(() => ({ select, upsert }));
  const client = {
    // storageOf reaches for the bucket as soon as it is built; these tests never use it
    storage: { from: () => ({}) },
    auth: {
      getSession: vi
        .fn()
        .mockResolvedValue({ data: { session: overrides.session ?? null }, error: null }),
    },
    from,
  };
  return { client, from, upsert, maybeSingle };
};

describe('storageOf: visibility', () => {
  it('reads private with no link token when there is no row', async () => {
    const { client } = fakeClient({ visibilityRow: null });
    const storage = storageOf(client as never, 'acc-1');
    await expect(storage.getVisibility('album', 'a1')).resolves.toEqual({
      level: 'private',
      linkToken: null,
    });
  });

  it('reads the stored level and token', async () => {
    const { client } = fakeClient({ visibilityRow: { level: 'public', link_token: null } });
    const storage = storageOf(client as never, 'acc-1');
    await expect(storage.getVisibility('trip', 't1')).resolves.toEqual({
      level: 'public',
      linkToken: null,
    });
  });

  it('writes the level with the account as owner', async () => {
    const { client, from, upsert } = fakeClient({ visibilityRow: null });
    const storage = storageOf(client as never, 'acc-1');
    await storage.setVisibility('album', 'a1', 'public');
    expect(from).toHaveBeenCalledWith('content_visibility');
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({ owner_id: 'acc-1', kind: 'album', item_id: 'a1', level: 'public', link_token: null }),
      expect.objectContaining({ onConflict: 'owner_id,kind,item_id' }),
    );
  });

  it('generates a link token the first time a level becomes link, and keeps it after', async () => {
    const { client, upsert } = fakeClient({ visibilityRow: null });
    const storage = storageOf(client as never, 'acc-1');
    const first = await storage.setVisibility('album', 'a1', 'link');
    expect(first.linkToken).toMatch(/^[0-9a-f-]{36}$/);
    const usedToken = (upsert.mock.calls[0]?.[0] as { link_token: string }).link_token;
    expect(usedToken).toBe(first.linkToken);
  });

  it('throws the backend error message when the write fails', async () => {
    const { client } = fakeClient({ upsertError: { message: 'nope' } });
    const storage = storageOf(client as never, 'acc-1');
    await expect(storage.setVisibility('trip', 't1', 'public')).rejects.toThrow('nope');
  });
});

describe('authOf: accessToken', () => {
  it('is null with no session', async () => {
    const { client } = fakeClient({ session: null });
    const auth = authOf(client as never);
    await expect(auth.accessToken()).resolves.toBeNull();
  });

  it('is the session token when signed in', async () => {
    const { client } = fakeClient({ session: { access_token: 'jwt-abc' } });
    const auth = authOf(client as never);
    await expect(auth.accessToken()).resolves.toBe('jwt-abc');
  });
});
