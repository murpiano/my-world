// supabase/functions/shared-content/index.ts
import { createClient } from 'npm:@supabase/supabase-js@2';

const url = Deno.env.get('SUPABASE_URL')!;
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const admin = createClient(url, serviceKey);

type Kind = 'trip' | 'album' | 'photo';

/** Short on purpose: a URL already in a tab must not outlive the owner closing the share. */
const SIGNED_FOR_S = 300;
type PhotoRef =
  | { kind: 'stock'; file: string; caption?: string }
  | { kind: 'own'; id: string; name: string; caption?: string };
interface AlbumData {
  id: string;
  title: string;
  year: number;
  month: number;
  day: number;
  time: string;
  photoCount: number;
  photos: PhotoRef[];
}
interface CityData {
  key: string;
  name: string;
  lat: number;
  lon: number;
  albums: AlbumData[];
}
interface CountryData {
  id: string;
  name: string;
  cities: CityData[];
}
interface TripData {
  id: string;
  name: string;
  start: unknown;
  end: unknown;
  albumIds: string[];
}
interface ArchiveData {
  countries: CountryData[];
  trips: TripData[];
}

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'content-type': 'application/json' } });
const notFound = () => json({ error: 'not found' }, 404);

const viewerFromAuth = async (req: Request): Promise<string | null> => {
  const header = req.headers.get('Authorization');
  if (!header?.startsWith('Bearer ')) return null;
  const { data } = await admin.auth.getUser(header.slice(7));
  return data.user?.id ?? null;
};

const canView = (ownerId: string, kind: Kind, itemId: string, viewer: string | null, token?: string) =>
  admin
    .rpc('can_view', { p_owner: ownerId, p_kind: kind, p_item_id: itemId, p_viewer: viewer, p_token: token ?? null })
    .then(({ data }) => data === true);

const signPhoto = async (
  ownerId: string,
  viewer: string | null,
  token: string | undefined,
  photo: PhotoRef,
): Promise<(PhotoRef & { url?: string }) | null> => {
  if (photo.kind === 'stock') return photo;
  if (!(await canView(ownerId, 'photo', photo.id, viewer, token))) return null;
  const { data: signed } = await admin.storage
    .from('photos')
    .createSignedUrl(`${ownerId}/${photo.id}`, SIGNED_FOR_S);
  if (!signed) return null;
  // the path, not the whole address: in here SUPABASE_URL is the internal hostname, which is
  // no use to a browser. The client finishes the address with the URL it was built with.
  const url = new URL(signed.signedUrl);
  return { ...photo, url: `${url.pathname}${url.search}` };
};

const filterPhotos = async (
  ownerId: string,
  viewer: string | null,
  token: string | undefined,
  photos: PhotoRef[],
) => {
  const signed = await Promise.all(photos.map((photo) => signPhoto(ownerId, viewer, token, photo)));
  return signed.filter((photo): photo is PhotoRef & { url?: string } => photo !== null);
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  let body: { owner_id?: string; kind?: Kind; item_id?: string; token?: string };
  try {
    body = await req.json();
  } catch {
    return notFound();
  }
  const { owner_id: ownerId, kind, item_id: itemId, token } = body;
  if (!ownerId || !itemId) return notFound();
  if (kind !== 'trip' && kind !== 'album' && kind !== 'photo') return notFound();

  const viewer = await viewerFromAuth(req);
  if (!(await canView(ownerId, kind, itemId, viewer, token))) return notFound();

  const { data: archiveRow } = await admin
    .from('archives')
    .select('data')
    .eq('user_id', ownerId)
    .maybeSingle();
  const archive = archiveRow?.data as ArchiveData | undefined;
  if (!archive) return notFound();

  if (kind === 'photo') {
    for (const country of archive.countries) {
      for (const city of country.cities) {
        for (const album of city.albums) {
          const photo = album.photos.find((one) => one.kind === 'own' && one.id === itemId);
          if (!photo) continue;
          const signed = await signPhoto(ownerId, viewer, token, photo);
          return signed ? json({ kind: 'photo', photo: signed }) : notFound();
        }
      }
    }
    return notFound();
  }

  if (kind === 'album') {
    for (const country of archive.countries) {
      for (const city of country.cities) {
        const album = city.albums.find((one) => one.id === itemId);
        if (!album) continue;
        const photos = await filterPhotos(ownerId, viewer, token, album.photos);
        // flat, exactly like the trip branch below: the client's SharedAlbum carries its own
        // place, so a lone shared album needs no second lookup to know where it was taken
        return json({
          kind: 'album',
          album: {
            ...album,
            // the owner's own tally counts photos this viewer may not see
            photoCount: photos.length,
            photos,
            cityKey: city.key,
            cityName: city.name,
            countryId: country.id,
            countryName: country.name,
          },
        });
      }
    }
    return notFound();
  }

  // kind === 'trip'
  const trip = archive.trips.find((one) => one.id === itemId);
  if (!trip) return notFound();
  const albums: Array<AlbumData & { cityKey: string; cityName: string; countryId: string; countryName: string }> = [];
  for (const country of archive.countries) {
    for (const city of country.cities) {
      for (const album of city.albums) {
        if (!trip.albumIds.includes(album.id)) continue;
        if (!(await canView(ownerId, 'album', album.id, viewer, token))) continue;
        const photos = await filterPhotos(ownerId, viewer, token, album.photos);
        albums.push({
          ...album,
          photoCount: photos.length,
          photos,
          cityKey: city.key,
          cityName: city.name,
          countryId: country.id,
          countryName: country.name,
        });
      }
    }
  }
  return json({ kind: 'trip', trip, albums });
});
