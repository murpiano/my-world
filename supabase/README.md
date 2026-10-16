# The backend

My World runs without one: every archive stays in the browser of the person who made it. With a
[Supabase](https://supabase.com) project behind it, the same app gets accounts, an archive kept
on any device, and photos in a private bucket. Nothing in the app changes but where things are
kept (`src/data/remote-repository.ts` instead of `local-repository.ts`).

The app is built for one or the other: with `VITE_SUPABASE_URL` and `VITE_SUPABASE_KEY` set it
uses the project; without them it stays local. Both values are public by design: what protects
the data is row level security in the database, set up by the migration below.

## What is stored

| Where | What | Who can touch it |
| --- | --- | --- |
| `auth.users` | email, password hash, `user_metadata` (name, home base) | the account itself |
| `public.archives` | one row per account: the archive as one JSON document | its owner only (RLS) |
| bucket `photos` | `<account id>/<photo id>`: the photo files, private | its owner only (RLS) |
| `public.content_visibility` | how open one trip, album or photo is, and its link token | its owner (RLS); read server-side by the Edge Functions |
| `public.profiles` | the account's public handle | anyone may read it; its owner writes it |

## Set it up

1. Make a project at [supabase.com](https://supabase.com) (the free plan is enough to start).
2. Run the migrations in [`migrations/`](migrations), oldest first: open **SQL Editor**, paste each, run.
   (Or with the CLI: `npx supabase link --project-ref <ref>` and `npx supabase db push`.)
3. **Authentication → Providers → Email**: for a first test, switch **Confirm email** off, so an
   account works at once. The free plan sends only a few confirmation emails an hour; before
   opening the app to people, set up an SMTP service under **Authentication → SMTP** and switch
   confirmation back on.
4. **Authentication → URL Configuration**: set **Site URL** to `https://murpiano.github.io/my-world/`
   (and add `http://127.0.0.1:3001` to the redirect URLs for local work).
5. Deploy the sharing Edge Functions: `npx supabase functions deploy shared-content` and
   `npx supabase functions deploy public-trips`. They run with the service-role key Supabase
   sets for every Edge Function automatically — nothing to configure.
6. **Project Settings → API**: copy the **Project URL** and the **anon public** key.
7. For the live site: in the GitHub repository, **Settings → Secrets and variables → Actions →
   Variables**, add `SUPABASE_URL` and `SUPABASE_KEY` with those two values. The next push to
   `main` builds the app with them.
8. For local work: copy [`.env.example`](../.env.example) to `.env.local`, fill it in, `npm run dev`.

Never put the **service_role** key anywhere in this repository or in the page.

## Limits to know

- The free plan has about 1 GB of file storage and 500 MB of database, and pauses a project after
  a week without requests. A photo is about 300–400 KB after the app resizes it.
- An edit replaces the whole archive document; two devices editing at once, the last save wins.
- Deleting an account itself (not just its data) needs a server-side function and is not built:
  "Reset archive to the demo" in the account settings deletes the archive and every photo.

## Sharing

Every trip, album and photo is `private` until its owner opens it, one of four ways: `private`,
`link` (whoever holds the generated link), `registered` (anyone with an account), or `public`.
The levels are set per item, and the strictest one among an item and everything above it wins —
a `public` album inside a `private` trip stays hidden, because the trip is the way in.

Nothing but the owner reads the database directly. `archives` and the `photos` bucket keep their
owner-only RLS, and every other reader goes through two Edge Functions:

| Function | Answers |
| --- | --- |
| `shared-content` | one trip, album or photo — with the photos the viewer may see, each as a signed URL |
| `public-trips` | the trips an account has opened, for its profile page at `/u/<handle>` |

Both call `can_view(owner, kind, item_id, viewer, token)`, the one place the rule lives. The
viewer and the link token are passed in explicitly rather than read from `auth.uid()`, because
an Edge Function runs with the service-role key and would otherwise look anonymous to the
database no matter who is actually visiting.

`node supabase/verify-visibility.mjs` checks the whole of it against a project — twenty checks
over two accounts and an anonymous caller. It needs `SUPABASE_URL`, `SUPABASE_ANON_KEY` and
`SUPABASE_SERVICE_ROLE_KEY`, and it makes and deletes its own test accounts.
