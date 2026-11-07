// supabase/functions/public-trips/index.ts
import { createClient } from 'npm:@supabase/supabase-js@2';

const url = Deno.env.get('SUPABASE_URL')!;
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const admin = createClient(url, serviceKey);

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'content-type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  let body: { owner_id?: string };
  try {
    body = await req.json();
  } catch {
    return json({ trips: [] });
  }
  const ownerId = body.owner_id;
  if (!ownerId) return json({ trips: [] });

  let viewer: string | null = null;
  const header = req.headers.get('Authorization');
  if (header?.startsWith('Bearer ')) {
    const { data } = await admin.auth.getUser(header.slice(7));
    viewer = data.user?.id ?? null;
  }

  const levels = viewer ? ['public', 'registered'] : ['public'];
  const { data: rows } = await admin
    .from('content_visibility')
    .select('item_id')
    .eq('owner_id', ownerId)
    .eq('kind', 'trip')
    .in('level', levels);
  const visible = new Set((rows ?? []).map((row) => row.item_id as string));
  if (visible.size === 0) return json({ trips: [] });

  const { data: archiveRow } = await admin
    .from('archives')
    .select('data')
    .eq('user_id', ownerId)
    .maybeSingle();
  const trips = (archiveRow?.data as { trips?: Array<{ id: string; name: string }> } | undefined)
    ?.trips ?? [];
  return json({ trips: trips.filter((trip) => visible.has(trip.id)).map((trip) => ({ id: trip.id, name: trip.name })) });
});
