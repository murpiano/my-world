// src/data/shared-repository.ts
import { fetchSharedContent } from '@/backend/sharing';
import type { SharedAlbum, SharedPhoto } from '@/backend/sharing';
import { forgetOwnUrls, rememberOwnUrl } from './blobs';
import { cleanArchive } from './repository';
import type { Repository } from './repository';
import type { AlbumData, ArchiveData, PhotoRef } from './types';

const EMPTY: ArchiveData = { countries: [], trips: [] };

const toAlbumData = (shared: SharedAlbum): AlbumData => ({
  id: shared.id,
  title: shared.title,
  year: shared.year,
  month: shared.month,
  day: shared.day,
  time: shared.time,
  photoCount: shared.photoCount,
  photos: shared.photos as PhotoRef[],
});

const archiveOfAlbum = (shared: SharedAlbum): unknown => ({
  countries: [
    {
      id: shared.countryId,
      name: shared.countryName,
      cities: [
        {
          key: shared.cityKey,
          name: shared.cityName,
          lat: 0,
          lon: 0,
          albums: [toAlbumData(shared)],
        },
      ],
    },
  ],
  trips: [],
});

interface LooseCity {
  key: string;
  name: string;
  lat: number;
  lon: number;
  albums: AlbumData[];
}

const archiveOfTrip = (
  trip: { id: string; name: string; start: unknown; end: unknown; albumIds: string[] },
  albums: SharedAlbum[],
): unknown => {
  const cities = new Map<string, LooseCity>();
  const countries = new Map<string, { id: string; name: string; cities: LooseCity[] }>();
  for (const album of albums) {
    let country = countries.get(album.countryId);
    if (!country) {
      country = { id: album.countryId, name: album.countryName, cities: [] };
      countries.set(album.countryId, country);
    }
    let city = cities.get(album.cityKey);
    if (!city) {
      city = { key: album.cityKey, name: album.cityName, lat: 0, lon: 0, albums: [] };
      cities.set(album.cityKey, city);
      country.cities.push(city);
    }
    city.albums.push(toAlbumData(album));
  }
  return {
    countries: [...countries.values()],
    trips: [{ id: trip.id, name: trip.name, start: trip.start, end: trip.end, albumIds: trip.albumIds }],
  };
};

const readOnly = (name: string) => () => Promise.reject(new Error(`sharedRepository is read-only: ${name}`));

/** What a stranger sees of one shared trip or album: the same `Repository` seam as the demo
 *  and the owner's own storage, so `loadWorld` and `Stage` need no special case for it. */
export const sharedRepository = (
  ownerId: string,
  kind: 'trip' | 'album',
  itemId: string,
  opts: { token?: string; bearer?: string } = {},
): Repository => ({
  editable: false,
  async load() {
    const result = await fetchSharedContent(ownerId, kind, itemId, opts);
    if (!result) return EMPTY;
    // the Edge Function signs each photo it is willing to hand over; `photoUrl` reads those
    // addresses from here, so a shared photo shows nothing until they are registered
    forgetOwnUrls();
    const remember = (photos: SharedPhoto[]) => {
      for (const photo of photos) {
        if (photo.kind === 'own' && photo.url) rememberOwnUrl(photo.id, photo.url);
      }
    };
    if (result.kind === 'trip') for (const album of result.albums) remember(album.photos);
    if (result.kind === 'album') remember(result.album.photos);
    if (result.kind === 'photo') remember([result.photo]);
    const raw =
      result.kind === 'trip'
        ? archiveOfTrip(result.trip, result.albums)
        : result.kind === 'album'
          ? archiveOfAlbum(result.album)
          : null;
    // the server's answer is no more trusted than stored JSON is: same cleaning, same fallback
    if (raw === null) return EMPTY;
    return cleanArchive(raw) ?? EMPTY;
  },
  save: readOnly('save'),
  addPhoto: readOnly('addPhoto') as unknown as Repository['addPhoto'],
  dropPhotos: readOnly('dropPhotos'),
  readPhoto: () => Promise.resolve(null as never),
  restore: readOnly('restore'),
  clear: readOnly('clear'),
});
