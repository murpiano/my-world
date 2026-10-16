import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import type { ArchiveData } from '../src/data/types';
import { localStack } from './stack';

const stack = localStack();

/** The service role: sets the scene and reads results back, never inside the browser. */
const admin = createClient(stack.url, stack.serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const PHOTO = readFileSync(new URL('../public/demo/photos/w-amsterdam-0.jpg', import.meta.url));
const PASSWORD = 'e2e-Pass-1234';

/** An account with a public handle and one trip → one album → one photo of its own. */
export interface Owner {
  id: string;
  email: string;
  password: string;
  handle: string;
  tripId: string;
  tripName: string;
  albumId: string;
  albumTitle: string;
  photoId: string;
}

export type Kind = 'trip' | 'album' | 'photo';
export type Level = 'private' | 'link' | 'registered' | 'public';

const must = async (op: PromiseLike<{ error: unknown }>): Promise<void> => {
  const { error } = await op;
  if (error) throw error;
};

export const seedOwner = async (): Promise<Owner> => {
  const tag = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const email = `e2e-${tag}@example.com`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: {
      name: 'E2E Owner',
      home: {
        name: 'Saint Petersburg',
        country: 'Russia',
        countryId: '643',
        lat: 59.94,
        lon: 30.31,
      },
    },
  });
  if (error) throw error;
  const owner: Owner = {
    id: data.user.id,
    email,
    password: PASSWORD,
    handle: `e2e-${tag}`,
    tripId: `t-${tag}`,
    tripName: `Trip ${tag}`,
    albumId: `a-${tag}`,
    albumTitle: `Canals ${tag}`,
    photoId: `p-${tag}`,
  };
  const archive: ArchiveData = {
    countries: [
      {
        id: '528',
        name: 'Netherlands',
        cities: [
          {
            key: `c-${tag}`,
            name: 'Amsterdam',
            lat: 52.37,
            lon: 4.9,
            albums: [
              {
                id: owner.albumId,
                title: owner.albumTitle,
                year: 2025,
                month: 5,
                day: 12,
                time: '10:30',
                photoCount: 1,
                photos: [{ kind: 'own', id: owner.photoId, name: 'canal.jpg' }],
              },
            ],
          },
        ],
      },
    ],
    trips: [
      {
        id: owner.tripId,
        name: owner.tripName,
        start: { home: true },
        end: { home: true },
        albumIds: [owner.albumId],
      },
    ],
  };
  await must(admin.from('profiles').insert({ user_id: owner.id, handle: owner.handle }));
  await must(
    admin.storage
      .from('photos')
      .upload(`${owner.id}/${owner.photoId}`, PHOTO, { contentType: 'image/jpeg' }),
  );
  await must(admin.from('archives').insert({ user_id: owner.id, data: archive }));
  return owner;
};

/** The account goes, and with it (by cascade) its archive, handle and sharing settings. */
export const removeOwner = async (owner: Owner): Promise<void> => {
  await admin.storage.from('photos').remove([`${owner.id}/${owner.photoId}`]);
  await admin.auth.admin.deleteUser(owner.id);
};

/** What the database holds for one item: the page's own write, not what the page shows. */
export const levelOf = async (owner: Owner, kind: Kind, itemId: string): Promise<Level> => {
  const { data } = await admin
    .from('content_visibility')
    .select('level')
    .eq('owner_id', owner.id)
    .eq('kind', kind)
    .eq('item_id', itemId)
    .maybeSingle();
  return (data as { level: Level } | null)?.level ?? 'private';
};
