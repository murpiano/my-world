// src/data/shared-repository.test.ts
import { describe, expect, it, vi } from 'vitest';
import * as sharing from '@/backend/sharing';
import { forgetOwnUrls, ownUrl } from './blobs';
import { sharedRepository } from './shared-repository';

vi.mock('@/backend/sharing');

describe('sharedRepository', () => {
  it('is not editable', () => {
    expect(sharedRepository('owner-1', 'trip', 't1').editable).toBe(false);
  });

  it('loads a single trip into an archive with its albums under one country/city', async () => {
    vi.mocked(sharing.fetchSharedContent).mockResolvedValue({
      kind: 'trip',
      trip: { id: 't1', name: 'Peru', start: { home: true }, end: { home: true }, albumIds: ['a1'] },
      albums: [
        {
          id: 'a1',
          title: 'Lima days',
          year: 2024,
          month: 3,
          day: 1,
          time: '09:00',
          photoCount: 1,
          photos: [{ kind: 'own', id: 'p1', name: 'one.jpg', url: 'https://x/p1' }],
          cityKey: 'lima',
          cityName: 'Lima',
          cityLat: -12.05,
          cityLon: -77.04,
          countryId: '604',
          countryName: 'Peru',
        },
      ],
    });
    const data = await sharedRepository('owner-1', 'trip', 't1').load();
    expect(data.trips).toEqual([
      { id: 't1', name: 'Peru', start: { home: true }, end: { home: true }, albumIds: ['a1'] },
    ]);
    expect(data.countries[0]?.cities[0]?.albums[0]?.id).toBe('a1');
    expect(data.countries[0]?.cities[0]?.key).toBe('lima');
    // where the city really is, not 0°, 0° in the ocean
    expect(data.countries[0]?.cities[0]).toMatchObject({ lat: -12.05, lon: -77.04 });
  });

  it('loads a single album into an archive with no trips', async () => {
    vi.mocked(sharing.fetchSharedContent).mockResolvedValue({
      kind: 'album',
      album: {
        id: 'a1',
        title: 'Lima days',
        year: 2024,
        month: 3,
        day: 1,
        time: '09:00',
        photoCount: 0,
        photos: [],
        cityKey: 'lima',
        cityName: 'Lima',
        cityLat: -12.05,
        cityLon: -77.04,
        countryId: '604',
        countryName: 'Peru',
      },
    });
    const data = await sharedRepository('owner-1', 'album', 'a1').load();
    expect(data.trips).toEqual([]);
    expect(data.countries[0]?.cities[0]?.albums[0]?.id).toBe('a1');
  });

  it('loads an empty archive when the fetch finds nothing', async () => {
    vi.mocked(sharing.fetchSharedContent).mockResolvedValue(null);
    const data = await sharedRepository('owner-1', 'trip', 'gone').load();
    expect(data).toEqual({ countries: [], trips: [] });
  });

  it('registers the signed URL of every shared photo, so the page can show it', async () => {
    forgetOwnUrls();
    vi.mocked(sharing.fetchSharedContent).mockResolvedValue({
      kind: 'album',
      album: {
        id: 'a1',
        title: 'Lima days',
        year: 2024,
        month: 3,
        day: 1,
        time: '09:00',
        photoCount: 1,
        photos: [{ kind: 'own', id: 'p1', name: 'one.jpg', url: 'https://signed/p1' }],
        cityKey: 'lima',
        cityName: 'Lima',
        cityLat: -12.05,
        cityLon: -77.04,
        countryId: '604',
        countryName: 'Peru',
      },
    });
    await sharedRepository('owner-1', 'album', 'a1').load();
    expect(ownUrl('p1')).toBe('https://signed/p1');
  });

  it('cleans what it loads, like the other repositories do', async () => {
    vi.mocked(sharing.fetchSharedContent).mockResolvedValue({
      kind: 'trip',
      // a trip whose endpoints are nonsense, and an album with an impossible month
      trip: { id: 't1', name: 'Peru', start: 'nope', end: null, albumIds: ['a1'] },
      albums: [
        {
          id: 'a1',
          title: 'Lima days',
          year: 2024,
          month: 99,
          day: 1,
          time: '09:00',
          photoCount: 0,
          photos: [],
          cityKey: 'lima',
          cityName: 'Lima',
          cityLat: -12.05,
          cityLon: -77.04,
          countryId: '604',
          countryName: 'Peru',
        },
      ],
    } as never);
    const data = await sharedRepository('owner-1', 'trip', 't1').load();
    expect(data.trips).toEqual([]);
    expect(data.countries[0]?.cities[0]?.albums ?? []).toEqual([]);
  });

  it('rejects every write', async () => {
    const repo = sharedRepository('owner-1', 'trip', 't1');
    await expect(Promise.resolve(repo.save({ countries: [], trips: [] }))).rejects.toThrow();
    await expect(repo.addPhoto(new Blob(), 'x')).rejects.toThrow();
    await expect(repo.dropPhotos([])).rejects.toThrow();
    await expect(repo.restore({ countries: [], trips: [] }, new Map())).rejects.toThrow();
    await expect(repo.clear()).rejects.toThrow();
  });
});
