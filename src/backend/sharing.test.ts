// src/backend/sharing.test.ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchPublicTrips, fetchSharedContent } from './sharing';

beforeEach(() => {
  vi.stubEnv('VITE_SUPABASE_URL', 'https://proj.supabase.co');
  vi.stubEnv('VITE_SUPABASE_KEY', 'anon-key');
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('fetchSharedContent', () => {
  it('posts to shared-content with the anon key when there is no bearer', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ kind: 'trip', trip: { id: 't1', name: 'Peru' }, albums: [] }),
    });
    vi.stubGlobal('fetch', fetchMock);
    const result = await fetchSharedContent('owner-1', 'trip', 't1');
    expect(result).toEqual({ kind: 'trip', trip: { id: 't1', name: 'Peru' }, albums: [] });
    const [calledUrl, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(calledUrl).toBe('https://proj.supabase.co/functions/v1/shared-content');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toEqual({ owner_id: 'owner-1', kind: 'trip', item_id: 't1', token: undefined });
    expect((init.headers as Record<string, string>).authorization).toBe('Bearer anon-key');
  });

  it('uses the given bearer token when the viewer is signed in', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({ kind: 'photo', photo: { kind: 'own', id: 'p1', name: 'x.jpg', url: 'https://x' } }) });
    vi.stubGlobal('fetch', fetchMock);
    await fetchSharedContent('owner-1', 'photo', 'p1', { bearer: 'jwt-123' });
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect((init.headers as Record<string, string>).authorization).toBe('Bearer jwt-123');
  });

  it('returns null on a 404', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, json: () => Promise.resolve({ error: 'not found' }) }));
    await expect(fetchSharedContent('owner-1', 'trip', 'gone')).resolves.toBeNull();
  });

  it('returns null when the app has no backend configured', async () => {
    vi.unstubAllEnvs();
    await expect(fetchSharedContent('owner-1', 'trip', 't1')).resolves.toBeNull();
  });
});

describe('fetchSharedContent photo addresses', () => {
  it('resolves the signed path against the URL the app was built with', async () => {
    // the Edge Function returns a path, not a full address: inside its own network it only
    // knows the internal hostname, which no browser can reach
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            kind: 'album',
            album: {
              id: 'a1',
              photos: [
                { kind: 'own', id: 'p1', name: 'one.jpg', url: '/storage/v1/object/sign/photos/x?token=t' },
                { kind: 'stock', file: 'w-x.jpg' },
              ],
            },
          }),
      }),
    );
    const result = await fetchSharedContent('owner-1', 'album', 'a1');
    const photos = result?.kind === 'album' ? result.album.photos : [];
    expect(photos[0]).toMatchObject({
      url: 'https://proj.supabase.co/storage/v1/object/sign/photos/x?token=t',
    });
    expect(photos[1]).toEqual({ kind: 'stock', file: 'w-x.jpg' });
  });

  it('leaves an address that is already absolute alone', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            kind: 'photo',
            photo: { kind: 'own', id: 'p1', name: 'one.jpg', url: 'https://cdn.example/p1' },
          }),
      }),
    );
    const result = await fetchSharedContent('owner-1', 'photo', 'p1');
    expect(result?.kind === 'photo' && result.photo).toMatchObject({
      url: 'https://cdn.example/p1',
    });
  });

  it('resolves the photos of every album in a shared trip', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            kind: 'trip',
            trip: { id: 't1', name: 'Peru', albumIds: ['a1'] },
            albums: [
              { id: 'a1', photos: [{ kind: 'own', id: 'p1', name: 'one.jpg', url: '/storage/v1/x' }] },
            ],
          }),
      }),
    );
    const result = await fetchSharedContent('owner-1', 'trip', 't1');
    const photos = result?.kind === 'trip' ? result.albums[0]?.photos : [];
    expect(photos?.[0]).toMatchObject({ url: 'https://proj.supabase.co/storage/v1/x' });
  });
});

describe('fetchPublicTrips', () => {
  it('posts to public-trips and returns the list', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({ trips: [{ id: 't1', name: 'Peru' }] }) });
    vi.stubGlobal('fetch', fetchMock);
    await expect(fetchPublicTrips('owner-1')).resolves.toEqual([{ id: 't1', name: 'Peru' }]);
    const [calledUrl] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(calledUrl).toBe('https://proj.supabase.co/functions/v1/public-trips');
  });
});
