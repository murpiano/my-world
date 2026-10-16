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
                  id: 'album-in-link-trip',
                  title: 'Inside a link trip',
                  year: 2024,
                  month: 1,
                  day: 4,
                  time: '10:00',
                  photoCount: 1,
                  photos: [{ kind: 'own', id: 'photo-in-link-trip', name: 'two.jpg' }],
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
        // public-trips and shared-content both read the live archive, so every trip the
        // visibility rows above point at has to exist here as well
        { id: 'pub-trip', name: 'Public trip', start: { home: true }, end: { home: true }, albumIds: [] },
        { id: 'reg-trip', name: 'Registered trip', start: { home: true }, end: { home: true }, albumIds: [] },
        { id: 'link-trip', name: 'Link trip', start: { home: true }, end: { home: true }, albumIds: ['album-in-link-trip'] },
      ],
    },
  });
  // a signed URL can only be made for a file that is really there
  await admin.storage
    .from('photos')
    .upload(`${owner}/photo-in-link-trip`, new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xd9])], { type: 'image/jpeg' }), {
      contentType: 'image/jpeg',
      upsert: true,
    });

  await admin.from('content_visibility').insert([
    { owner_id: owner, kind: 'album', item_id: 'album-in-private-trip', level: 'public' },
    { owner_id: owner, kind: 'album', item_id: 'album-with-private-photo', level: 'public' },
    { owner_id: owner, kind: 'photo', item_id: 'private-photo', level: 'private' },
    { owner_id: owner, kind: 'album', item_id: 'album-in-link-trip', level: 'public' },
    { owner_id: owner, kind: 'photo', item_id: 'photo-in-link-trip', level: 'public' },
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
  // unique per run: `handle` is unique, and a run that dies early leaves its row behind
  const handle = `verify-${Date.now().toString(36)}`;
  await admin.from('profiles').insert({ user_id: owner, handle });
  const anon = createClient(url, anonKey);
  const { data: readAsAnon } = await anon
    .from('profiles')
    .select('handle')
    .eq('user_id', owner)
    .maybeSingle();
  check('a stranger can read a handle', readAsAnon?.handle === handle);

  // Edge Functions
  const call = async (fn, payload, bearer = anonKey) => {
    const response = await fetch(`${url}/functions/v1/${fn}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', apikey: anonKey, authorization: `Bearer ${bearer}` },
      body: JSON.stringify(payload),
    });
    const text = await response.text();
    let body;
    try {
      body = JSON.parse(text);
    } catch {
      body = { error: text };
    }
    return { status: response.status, body };
  };

  const pubTrip = await call('shared-content', { owner_id: owner, kind: 'trip', item_id: 'pub-trip' });
  check('shared-content returns a public trip anonymously', pubTrip.status === 200 && pubTrip.body.trip?.id === 'pub-trip');

  const hidden = await call('shared-content', { owner_id: owner, kind: 'trip', item_id: tripId });
  check('shared-content 404s a private trip', hidden.status === 404);

  const linked = await call('shared-content', { owner_id: owner, kind: 'trip', item_id: 'link-trip', token });
  check('shared-content honors the right link token', linked.status === 200);
  const wrongLinked = await call('shared-content', { owner_id: owner, kind: 'trip', item_id: 'link-trip', token: wrongToken });
  check('shared-content rejects the wrong link token', wrongLinked.status === 404);

  const strictAlbum = await call('shared-content', { owner_id: owner, kind: 'album', item_id: 'album-in-private-trip' });
  check('shared-content 404s a public album inside a private trip', strictAlbum.status === 404);

  const withPrivatePhoto = await call('shared-content', { owner_id: owner, kind: 'album', item_id: 'album-with-private-photo' });
  check(
    'shared-content strips a private photo from an otherwise-public album',
    withPrivatePhoto.status === 200 && withPrivatePhoto.body.album?.photos?.length === 0,
  );

  const linkedTrip = await call('shared-content', { owner_id: owner, kind: 'trip', item_id: 'link-trip', token });
  check(
    'a link-shared trip carries the albums inside it',
    linkedTrip.status === 200 && linkedTrip.body.albums?.length === 1,
    JSON.stringify(linkedTrip.body.albums?.map((a) => a.id) ?? linkedTrip.body),
  );
  check(
    'and their photos, signed',
    typeof linkedTrip.body.albums?.[0]?.photos?.[0]?.url === 'string',
    JSON.stringify(linkedTrip.body.albums?.[0]?.photos ?? []),
  );

  const trips = await call('public-trips', { owner_id: owner });
  check(
    'public-trips lists the public trip anonymously, and not the registered-only one',
    JSON.stringify(trips.body.trips) === JSON.stringify([{ id: 'pub-trip', name: 'Public trip' }]),
  );

  // the visibility functions are the server's business: a stranger must not be able to call
  // them, least of all visibility_ancestors, which would map a private archive's structure
  const anonRpc = async (fn, args) => {
    const response = await fetch(`${url}/rest/v1/rpc/${fn}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', apikey: anonKey, authorization: `Bearer ${anonKey}` },
      body: JSON.stringify(args),
    });
    return response.status;
  };
  check(
    'a stranger cannot call can_view',
    (await anonRpc('can_view', { p_owner: owner, p_kind: 'trip', p_item_id: 'pub-trip' })) >= 400,
  );
  check(
    'a stranger cannot map an archive with visibility_ancestors',
    (await anonRpc('visibility_ancestors', { p_owner: owner, p_kind: 'photo', p_item_id: 'private-photo' })) >= 400,
  );

  await admin.auth.admin.deleteUser(owner);
  await admin.auth.admin.deleteUser(other);

  console.log(failed === 0 ? '\nAll checks passed.' : `\n${failed} check(s) failed.`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error('Script error (expected before the migration is applied):', error.message);
  process.exit(1);
});
