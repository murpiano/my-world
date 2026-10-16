// src/backend/sharing.ts
import { backendConfig } from './config';
import type { VisibilityKind } from './types';

export type SharedPhoto =
  | { kind: 'stock'; file: string; caption?: string }
  | { kind: 'own'; id: string; name: string; caption?: string; url: string };

export interface SharedAlbum {
  id: string;
  title: string;
  year: number;
  month: number;
  day: number;
  time: string;
  photoCount: number;
  photos: SharedPhoto[];
  cityKey: string;
  cityName: string;
  /** Where the city is: the globe puts the album's light there and flies the plane to it. */
  cityLat: number;
  cityLon: number;
  countryId: string;
  countryName: string;
}

export interface SharedTrip {
  id: string;
  name: string;
}

interface SharedTripContent {
  kind: 'trip';
  trip: { id: string; name: string; start: unknown; end: unknown; albumIds: string[] };
  albums: SharedAlbum[];
}
interface SharedAlbumContent {
  kind: 'album';
  album: SharedAlbum;
}
interface SharedPhotoContent {
  kind: 'photo';
  photo: SharedPhoto;
}

const call = async <T>(fn: string, body: unknown, bearer?: string): Promise<T | null> => {
  const config = backendConfig();
  if (!config) return null;
  const response = await fetch(`${config.url}/functions/v1/${fn}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      apikey: config.key,
      authorization: `Bearer ${bearer ?? config.key}`,
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) return null;
  return (await response.json()) as T;
};

/**
 * The Edge Function hands back a signed *path*, because inside its own network it only knows
 * the internal hostname — which no browser can reach. The address is finished here, against
 * the URL this build was given.
 */
const absolute = (url: string, base: string): string =>
  url.startsWith('/') ? `${base.replace(/\/$/, '')}${url}` : url;

const resolvePhotos = (photos: SharedPhoto[], base: string): SharedPhoto[] =>
  photos.map((photo) => (photo.kind === 'own' ? { ...photo, url: absolute(photo.url, base) } : photo));

export const fetchSharedContent = async (
  ownerId: string,
  kind: VisibilityKind,
  itemId: string,
  opts: { token?: string; bearer?: string } = {},
): Promise<SharedTripContent | SharedAlbumContent | SharedPhotoContent | null> => {
  const config = backendConfig();
  const result = await call<SharedTripContent | SharedAlbumContent | SharedPhotoContent>(
    'shared-content',
    { owner_id: ownerId, kind, item_id: itemId, token: opts.token },
    opts.bearer,
  );
  if (!result || !config) return result;
  if (result.kind === 'trip') {
    return {
      ...result,
      albums: result.albums.map((album) => ({
        ...album,
        photos: resolvePhotos(album.photos, config.url),
      })),
    };
  }
  if (result.kind === 'album') {
    return { ...result, album: { ...result.album, photos: resolvePhotos(result.album.photos, config.url) } };
  }
  return { ...result, photo: resolvePhotos([result.photo], config.url)[0] as SharedPhoto };
};

export const fetchPublicTrips = async (ownerId: string, bearer?: string): Promise<SharedTrip[]> => {
  const result = await call<{ trips: SharedTrip[] }>('public-trips', { owner_id: ownerId }, bearer);
  return result?.trips ?? [];
};
