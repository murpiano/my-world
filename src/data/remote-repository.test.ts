import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Storage, VisibilitySetting } from '@/backend/types';
import { ownUrl } from './blobs';
import { remoteRepository } from './remote-repository';
import type { ArchiveData, Id } from './types';

const archive = (): ArchiveData => ({
  countries: [
    {
      id: '250',
      name: 'France',
      cities: [
        {
          key: 'paris',
          name: 'Paris',
          lat: 48.86,
          lon: 2.35,
          albums: [
            {
              id: 'a1',
              title: 'Roofs',
              year: 2022,
              month: 5,
              day: 3,
              time: '10:00',
              photoCount: 1,
              photos: [{ kind: 'own', id: 'p1', name: 'one.jpg' }],
            },
          ],
        },
      ],
    },
  ],
  trips: [],
});

/** A backend that keeps everything in memory, and can be told to be slow or to fail. */
const memory = (start: unknown = null) => {
  const state = {
    archive: start,
    photos: new Map<Id, Blob>(),
    saved: [] as unknown[],
    visibility: new Map<string, VisibilitySetting>(),
    failSave: false,
    delay: (() => 0) as (n: number) => number,
    calls: 0,
  };
  const store: Storage = {
    loadArchive: () => Promise.resolve(state.archive),
    async saveArchive(data) {
      const wait = state.delay(state.calls++);
      await new Promise((done) => setTimeout(done, wait));
      if (state.failSave) throw new Error('offline');
      state.archive = data;
      state.saved.push(data);
    },
    putPhoto: (id, blob) => {
      state.photos.set(id, blob);
      return Promise.resolve();
    },
    getPhoto: (id) => Promise.resolve(state.photos.get(id) ?? null),
    removePhotos: (ids) => {
      for (const id of ids) state.photos.delete(id);
      return Promise.resolve();
    },
    photoUrls: (ids) =>
      Promise.resolve(
        new Map(ids.filter((id) => state.photos.has(id)).map((id) => [id, `https://x/${id}`])),
      ),
    wipe: () => {
      state.archive = null;
      state.photos.clear();
      return Promise.resolve();
    },
    getVisibility: (kind, itemId) =>
      Promise.resolve(
        state.visibility.get(`${kind}:${itemId}`) ?? { level: 'private' as const, linkToken: null },
      ),
    setVisibility: (kind, itemId, level) => {
      const setting = { level, linkToken: level === 'link' ? 'token' : null };
      state.visibility.set(`${kind}:${itemId}`, setting);
      return Promise.resolve(setting);
    },
  };
  return { state, store };
};

beforeEach(() => {
  vi.stubGlobal('URL', { ...URL, createObjectURL: () => 'blob:local', revokeObjectURL: () => {} });
});

describe('remoteRepository', () => {
  it('starts a new account from a copy of the demo', async () => {
    const { store } = memory(null);
    const data = await remoteRepository(store, []).load();
    expect(data.countries.length).toBeGreaterThan(0);
  });

  it('loads the saved archive and the addresses of its photos', async () => {
    const { state, store } = memory(archive());
    state.photos.set('p1', new Blob(['x']));
    const data = await remoteRepository(store, []).load();
    expect(data.countries[0]?.cities[0]?.albums[0]?.title).toBe('Roofs');
    expect(ownUrl('p1')).toBe('https://x/p1');
  });

  it('cleans what it loads, like the local one does', async () => {
    const { store } = memory({ countries: 'nope' });
    const data = await remoteRepository(store, []).load();
    expect(Array.isArray(data.countries)).toBe(true);
  });

  it('saves a copy, and saves one after another in the order they were asked', async () => {
    const { state, store } = memory(null);
    state.delay = (n) => (n === 0 ? 30 : 0);
    const repo = remoteRepository(store, []);
    const data = archive();
    const first = repo.save(data);
    data.trips.push({
      id: 't',
      name: 'Later',
      start: { home: true },
      end: { home: true },
      albumIds: [],
    });
    const second = repo.save(data);
    await Promise.all([first, second]);
    expect((state.saved[0] as ArchiveData).trips).toHaveLength(0);
    expect((state.saved[1] as ArchiveData).trips).toHaveLength(1);
  });

  it('tells the caller when a save failed, and saves the next one all the same', async () => {
    const { state, store } = memory(null);
    const repo = remoteRepository(store, []);
    state.failSave = true;
    await expect(repo.save(archive())).rejects.toThrow('offline');
    state.failSave = false;
    await repo.save(archive());
    expect(state.saved).toHaveLength(1);
  });

  it('keeps a photo file with the backend, and takes it away again', async () => {
    const { state, store } = memory(null);
    const repo = remoteRepository(store, []);
    const ref = await repo.addPhoto(new Blob(['x']), 'one.jpg');
    expect(ref).toMatchObject({ kind: 'own', name: 'one.jpg' });
    if (ref.kind !== 'own') throw new Error('not own');
    expect(state.photos.has(ref.id)).toBe(true);
    expect(await repo.readPhoto(ref.id)).not.toBeNull();
    await repo.dropPhotos([ref, { kind: 'stock', file: 'w-x.jpg' }]);
    expect(state.photos.has(ref.id)).toBe(false);
  });

  it('puts a backup in place of everything, and clears everything on a reset', async () => {
    const { state, store } = memory(archive());
    state.photos.set('old', new Blob(['old']));
    const repo = remoteRepository(store, []);
    await repo.restore(archive(), new Map([['p1', new Blob(['new'])]]));
    expect([...state.photos.keys()]).toEqual(['p1']);
    expect(state.archive).not.toBeNull();
    await repo.clear();
    expect(state.archive).toBeNull();
    expect(state.photos.size).toBe(0);
  });
});
