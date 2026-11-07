-- Sharing & visibility: who besides the owner can see a trip, an album, or a photo.
--
-- Independent of `archives` (unchanged) and the `photos` bucket (unchanged, still owner-only
-- RLS). A row here only ever needs to answer "how strict is this one item", never who a viewer
-- is beyond what is passed in explicitly — see can_view below for why.

create table public.content_visibility (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references auth.users(id) on delete cascade,
  kind        text not null check (kind in ('trip', 'album', 'photo')),
  item_id     text not null,
  level       text not null default 'private'
              check (level in ('private', 'link', 'registered', 'public')),
  link_token  uuid,
  updated_at  timestamptz not null default now(),
  unique (owner_id, kind, item_id)
);

alter table public.content_visibility enable row level security;

create policy "visibility: read own" on public.content_visibility
  for select using (auth.uid() = owner_id);
create policy "visibility: add own" on public.content_visibility
  for insert with check (auth.uid() = owner_id);
create policy "visibility: change own" on public.content_visibility
  for update using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
create policy "visibility: delete own" on public.content_visibility
  for delete using (auth.uid() = owner_id);

-- A public handle, separate from email. Readable by anyone (that is the point of a profile
-- page); writable only by its own account.
create table public.profiles (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  handle     text not null unique check (handle ~ '^[a-z0-9-]{3,30}$'),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles: read all" on public.profiles for select using (true);
create policy "profiles: add own" on public.profiles
  for insert with check (auth.uid() = user_id);
create policy "profiles: change own" on public.profiles
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Walks from an item up to its trip: photo -> album -> trip, album -> trip, or trip -> itself.
-- The archive is one JSON document per owner (see `archives`), not rows, so this walk reads
-- `archives.data` directly instead of following foreign keys. An item that no longer exists in
-- the archive (deleted after a visibility row was set) yields only itself as an "ancestor": the
-- caller (can_view) still runs, but `shared-content` separately re-reads the live archive to
-- extract the item, so a stale visibility row on a deleted item can never actually expose data —
-- there is nothing left to extract.
create or replace function public.visibility_ancestors(p_owner uuid, p_kind text, p_item_id text)
returns table(kind text, item_id text)
language plpgsql security definer stable as $$
declare
  arc jsonb;
  found_album_id text;
  found_trip_id text;
begin
  select data into arc from public.archives where user_id = p_owner;
  if arc is null then
    return query select p_kind, p_item_id;
    return;
  end if;

  if p_kind = 'trip' then
    return query select 'trip'::text, p_item_id;
    return;
  end if;

  if p_kind = 'album' then
    return query select 'album'::text, p_item_id;
    select t ->> 'id' into found_trip_id
      from jsonb_array_elements(coalesce(arc -> 'trips', '[]'::jsonb)) t
      where (t -> 'albumIds') @> to_jsonb(p_item_id)
      limit 1;
    if found_trip_id is not null then
      return query select 'trip'::text, found_trip_id;
    end if;
    return;
  end if;

  -- p_kind = 'photo'
  return query select 'photo'::text, p_item_id;
  select c_album ->> 'id' into found_album_id
    from jsonb_array_elements(coalesce(arc -> 'countries', '[]'::jsonb)) country,
         jsonb_array_elements(coalesce(country -> 'cities', '[]'::jsonb)) city,
         jsonb_array_elements(coalesce(city -> 'albums', '[]'::jsonb)) c_album,
         jsonb_array_elements(coalesce(c_album -> 'photos', '[]'::jsonb)) photo
    where photo ->> 'kind' = 'own' and photo ->> 'id' = p_item_id
    limit 1;
  if found_album_id is not null then
    return query select 'album'::text, found_album_id;
    select t ->> 'id' into found_trip_id
      from jsonb_array_elements(coalesce(arc -> 'trips', '[]'::jsonb)) t
      where (t -> 'albumIds') @> to_jsonb(found_album_id)
      limit 1;
    if found_trip_id is not null then
      return query select 'trip'::text, found_trip_id;
    end if;
  end if;
end;
$$;

-- Whether p_viewer (null means anonymous) may see p_item_id, given every ancestor's own level.
-- `p_viewer` and `p_token` are explicit parameters, not read from auth.uid(): this function is
-- called both from the app (where auth.uid() would be meaningful) and from an Edge Function
-- running with the service-role key (where auth.uid() is always null regardless of who the real
-- visitor is) — see the spec's "Access paths" section for why the service-role call is needed.
-- Keeping the viewer explicit makes the function correct in both callers and directly testable
-- from plain SQL, without faking a JWT.
create or replace function public.can_view(
  p_owner uuid,
  p_kind text,
  p_item_id text,
  p_viewer uuid default null,
  p_token uuid default null
) returns boolean
language plpgsql security definer stable as $$
declare
  blocked boolean;
begin
  if p_viewer is not null and p_viewer = p_owner then
    return true;
  end if;
  select bool_or(
    coalesce(cv.level, 'private') = 'private'
    or (coalesce(cv.level, 'private') = 'link'
        and (p_token is null or cv.link_token is distinct from p_token))
    or (coalesce(cv.level, 'private') = 'registered' and p_viewer is null)
  ) into blocked
  from public.visibility_ancestors(p_owner, p_kind, p_item_id) a
  left join public.content_visibility cv
    on cv.owner_id = p_owner and cv.kind = a.kind and cv.item_id = a.item_id;
  return coalesce(not blocked, false);
end;
$$;
