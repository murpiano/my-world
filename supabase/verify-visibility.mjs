// supabase/verify-visibility.mjs
// Run after applying 20260930010000_visibility.sql (and, for the later steps, after deploying
// the Edge Functions): node supabase/verify-visibility.mjs
//
// Needs env vars: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL;
const anonKey = process.env.SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !anonKey || !serviceKey) {
  console.error('Set SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY first.');
  process.exit(1);
}

const admin = createClient(url, serviceKey);
const email = (tag) => `visibility-test-${tag}-${Date.now()}@example.com`;

let failed = 0;
const check = (label, ok) => {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${label}`);
  if (!ok) failed++;
};

const makeAccount = async (tag) => {
  const { data, error } = await admin.auth.admin.createUser({
    email: email(tag),
    password: 'Test1234!',
    email_confirm: true,
  });
  if (error) throw error;
  return data.user.id;
};

async function main() {
  const owner = await makeAccount('owner');
  const other = await makeAccount('other');

  // A trip visible only to the owner (no row at all): blocked for everyone else.
  const tripId = 'plain-trip';
  check(
    'no visibility row defaults to blocked for a stranger',
    (await admin.rpc('can_view', { p_owner: owner, p_kind: 'trip', p_item_id: tripId })).data ===
      false,
  );
  check(
    'no visibility row defaults to blocked for a different registered account',
    (
      await admin.rpc('can_view', {
        p_owner: owner,
        p_kind: 'trip',
        p_item_id: tripId,
        p_viewer: other,
      })
    ).data === false,
  );
  check(
    'the owner always passes, row or not',
    (
      await admin.rpc('can_view', {
        p_owner: owner,
        p_kind: 'trip',
        p_item_id: tripId,
        p_viewer: owner,
      })
    ).data === true,
  );

  // public
  await admin
    .from('content_visibility')
    .insert({ owner_id: owner, kind: 'trip', item_id: 'pub-trip', level: 'public' });
  check(
    'public is visible anonymously',
    (await admin.rpc('can_view', { p_owner: owner, p_kind: 'trip', p_item_id: 'pub-trip' }))
      .data === true,
  );

  // registered
  await admin
    .from('content_visibility')
    .insert({ owner_id: owner, kind: 'trip', item_id: 'reg-trip', level: 'registered' });
  check(
    'registered blocks an anonymous viewer',
    (await admin.rpc('can_view', { p_owner: owner, p_kind: 'trip', p_item_id: 'reg-trip' }))
      .data === false,
  );
  check(
    'registered allows a different signed-in account',
    (
      await admin.rpc('can_view', {
        p_owner: owner,
        p_kind: 'trip',
        p_item_id: 'reg-trip',
        p_viewer: other,
      })
    ).data === true,
  );

  // link
  const token = crypto.randomUUID();
  const wrongToken = crypto.randomUUID();
  await admin
    .from('content_visibility')
    .insert({ owner_id: owner, kind: 'trip', item_id: 'link-trip', level: 'link', link_token: token });
  check(
    'link blocks with no token',
    (await admin.rpc('can_view', { p_owner: owner, p_kind: 'trip', p_item_id: 'link-trip' }))
      .data === false,
  );
  check(
    'link blocks with the wrong token',
    (
      await admin.rpc('can_view', {
        p_owner: owner,
        p_kind: 'trip',
        p_item_id: 'link-trip',
        p_token: wrongToken,
      })
    ).data === false,
  );
  check(
    'link allows the right token',
    (
      await admin.rpc('can_view', {
        p_owner: owner,
        p_kind: 'trip',
        p_item_id: 'link-trip',
        p_token: token,
      })
    ).data === true,
  );

  // strictest-ancestor-wins: build a tiny archive for `owner` with a public album inside a
  // private trip, and a private photo inside a public album.
  await admin.from('archives').upsert({
    user_id: owner,
    data: {
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
                  id: 'album-in-private-trip',
                  title: 'Hidden inside',
                  year: 2024,
                  month: 1,
                  day: 1,
                  time: '10:00',
                  photoCount: 0,
                  photos: [],
                },
                {
                  id: 'album-with-private-photo',
                  title: 'Mostly open',
                  year: 2024,
                  month: 1,
                  day: 2,
                  time: '10:00',
                  photoCount: 1,
                  photos: [{ kind: 'own', id: 'private-photo', name: 'one.jpg' }],
                },
              ],
            },
          ],
        },
      ],
      trips: [
        {
          id: 'private-trip',
          name: 'Private trip',
          start: { home: true },
          end: { home: true },
          albumIds: ['album-in-private-trip'],
        },
      ],
    },
  });
  await admin.from('content_visibility').insert([
    { owner_id: owner, kind: 'album', item_id: 'album-in-private-trip', level: 'public' },
    { owner_id: owner, kind: 'album', item_id: 'album-with-private-photo', level: 'public' },
    { owner_id: owner, kind: 'photo', item_id: 'private-photo', level: 'private' },
  ]);
  check(
    'a public album inside a private (default) trip is blocked',
    (
      await admin.rpc('can_view', {
        p_owner: owner,
        p_kind: 'album',
        p_item_id: 'album-in-private-trip',
      })
    ).data === false,
  );
  check(
    'a public album with no trip is visible',
    (
      await admin.rpc('can_view', {
        p_owner: owner,
        p_kind: 'album',
        p_item_id: 'album-with-private-photo',
      })
    ).data === true,
  );
  check(
    'a private photo inside a public album stays blocked',
    (
      await admin.rpc('can_view', {
        p_owner: owner,
        p_kind: 'photo',
        p_item_id: 'private-photo',
      })
    ).data === false,
  );

  // profiles: public read, owner-only write
  await admin.from('profiles').insert({ user_id: owner, handle: 'verify-owner' });
  const anon = createClient(url, anonKey);
  const { data: readAsAnon } = await anon
    .from('profiles')
    .select('handle')
    .eq('user_id', owner)
    .maybeSingle();
  check('a stranger can read a handle', readAsAnon?.handle === 'verify-owner');

  await admin.auth.admin.deleteUser(owner);
  await admin.auth.admin.deleteUser(other);

  console.log(failed === 0 ? '\nAll checks passed.' : `\n${failed} check(s) failed.`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error('Script error (expected before the migration is applied):', error.message);
  process.exit(1);
});
