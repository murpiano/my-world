# My World

_Memories of the places I've been._

A personal travel archive on a night globe. Every place you have been is a light; click one and
the plane flies there, the album opens, and the photos from that day come up one by one.
React, TypeScript and SCSS on a 2D canvas — no WebGL, no map tiles, no server.

[Live demo](https://murpiano.github.io/my-world/) · [How it works](#how-it-works) · [Run locally](#run-locally)

## Two modes

**Demo (logged out).** A sample traveller from Saint Petersburg: 17 countries, 20 cities, 22 albums of
ten photos each, 10 trips from 2016 to 2026, each one starting and ending at home. Stock photos from
Wikimedia Commons with their credits. The globe, the timeline, the
tours, the album panel and the photo window all work. Nothing is saved.

**Owner (logged in).** Your own archive. On the first login it starts as a copy of the demo, so
there is something to walk through, and every change after that is kept in your browser. Logging
out shows the untouched demo again; "Reset archive to the demo" in the account settings starts
over. Login is local: a name, an email, a password that is never stored, and a home base.

## What you can do

Drag the globe and let go to spin it; scroll to move closer. On a phone, pinch to zoom and twist
two fingers to turn the globe the way your hand turns. Zoomed out far enough, the sphere
unrolls into a flat map and rolls back up when you return. Click a light and the plane flies from
your home base to that city, the album panel opens on the left and the photos pass by.

The timeline at the bottom is the years of your travels. Click a point to see everything up to
it, drag to pick a range, click a year to pick that year and click it again to open it in the
archive. Press play and the whole range plays as a tour, flight by flight. On a phone the strip is
too short to aim at, so the first tap on it grows it into a wide, scrolling strip with a Done
button, picks what was tapped, and gives the range two handles to stretch and narrow it.

Click a photo and it grows out of its card into the photo window: arrow keys or a swipe to turn
the pages, Space for a slideshow, a heart and a comment box under it. Esc closes whatever is
innermost — a form, a menu, the photo, one step of the archive, then the place in focus.

The archive lists the same collection five ways: trips, albums, countries, cities and years. Each
page has "Show on map", which closes the archive and shows that year or trip on the globe; when
the tour ends by itself, the archive fades back in where you left it.

Logged in, the archive also edits: a trip (a name, where it starts and ends, which albums belong
to it), an album (a title, a place, a day, a trip, and photos dropped straight in), and a photo
(its caption, or away with it). Any city of the world can be picked (a list of about 70,000 towns and cities, searchable in English and Russian, from
GeoNames, loaded when a place field opens); a place that is not on the map yet becomes a new light,
and a new country joins the list. Everything is kept in your browser, so the account settings can
download the whole archive, photos included, as one backup file and restore it later, here or in
another browser.

## How it works

### One clock, two worlds

A single `requestAnimationFrame` loop owns time (`src/engine/`). It keeps a **world clock** that
stops while a form, the photo window or the archive is open, and every animation reads it — the
plane, the smoke over the house, the twinkling sky, the slideshow. React never renders per frame:
the canvas engine and the components share a tiny store (`src/state/store.ts`, read through
`useSyncExternalStore`), and the engine writes to it only when something actually changes, such
as the city under the cursor or a landing.

### The globe that unrolls

`src/geo/projection.ts` blends an orthographic globe into an equirectangular map as you zoom out,
and clips the land the right way in both, plus everywhere in between. Rotation is a trackball:
drags multiply into quaternions (`src/geo/camera.ts`), so the globe turns the way you push it,
with no gimbal lock at the poles. A throw keeps spinning from the last pointer samples and eases
back to a stop.

### The director

The journey has a brain, and it is pure (`src/tour/director.ts`): what is in focus, which flight
is under way, where the camera should look, how long to wait at a place, and what comes next in
a tour. The engine calls `step(dt, rotation, zoom)` each frame and draws what `view()` returns.
That split is what makes the hard parts testable — flight phases, tour scope, the timeline range
and the projection each have their own unit tests.

### Storage behind one seam

`Repository` (`src/data/repository.ts`) is the only way anything is stored. `demo-repository` is
read-only and built from the bundled demo; `local-repository` keeps the graph in `localStorage`
and the photo files in IndexedDB; `remote-repository` keeps them with a backend, the archive as one
JSON document and the photos in a private bucket. Photos are resized in the browser to at most
1600 px on the long side, JPEG at quality 0.86, before they are kept. Whatever comes back out of
storage goes through `cleanArchive` first, so a half-written or hand-edited entry cannot break the
page.

The backend is optional and chosen when the app is built: with `VITE_SUPABASE_URL` and
`VITE_SUPABASE_KEY` set it uses a [Supabase](https://supabase.com) project for accounts and
storage (loaded only then, as a separate chunk); without them everything stays in the browser. The
setup, the database migration and its row level security are in [supabase/](supabase/README.md).

With a backend behind it, any trip, album or photo can also be opened to other people — to
whoever holds a link, to anyone signed in, or to everyone — each set on its own, and each
private until it is not. An opened trip is shown on the owner's profile at `/u/<handle>`, and
shares open the same globe the owner sees, read-only. The strictest setting among an item and
everything above it wins, so a public album inside a private trip stays hidden. How it is
enforced is in [supabase/](supabase/README.md#sharing).

### Edits without a rebuild

An edit runs as a pure function on the stored graph (`src/data/edits.ts`), then `relinkInto`
rebuilds the linked archive **inside the same object** — the director and the engine hold that
object and read it every frame, so they never see a stale one. A revision counter in a store
tells React to render again.

## Run locally

```bash
git clone https://github.com/murpiano/my-world.git
cd my-world
npm install

npm run dev       # dev server, prints the local URL
npm run check     # tsc, eslint and vitest
npm run build     # type-check and build into dist/
npm run preview   # serve the build
```

Needs Node 22.12 or newer. Every push to `main` runs `npm run check`, builds and deploys to
GitHub Pages (`.github/workflows/deploy.yml`).

### End-to-end tests

The sharing path runs end to end against a local Supabase in Docker, with the migrations and the
Edge Functions of this checkout — never the real project:

```bash
npm run db:start                    # local Supabase, only the services the app uses
npx playwright install chromium     # once
npm run e2e                         # builds the app against it and drives it in Chromium
npm run db:stop
```

An owner opens a trip to everyone, by link and to signed-in people; a stranger, and then another
account, opens it from the profile or the link and sees the photo load; the owner closes it again
and the same address says "Not available". Every pull request runs `npm run check`, the visibility
checks of `supabase/verify-visibility.mjs` and these tests (`.github/workflows/ci.yml`).

## Where things live

```text
src/
├── app/         boots the world, lays out the screen
├── state/       the store, the app state, layers, settings, session
├── engine/      the frame loop, gestures, inertia
├── geo/         projection, camera, the world map
├── render/      land, lights, the house, the sky, routes and the plane
├── tour/        the director, flights, tour scope
├── timeline/    ranges and the progress along them
├── archive/     the archive pages model
├── data/        types, the demo, the repository, edits, photos
├── features/    one folder per feature, each with its SCSS
│   ├── globe/ panel/ timeline/ lightbox/ archive/ forms/ header/ keys/
└── styles/      tokens and SCSS helpers
```

Every pure module has its tests next to it; there are over 300 of them.

## Not there yet

Likes and comments are local stubs. Without a backend there is no server: the password is not
stored or checked, and an owner's archive lives in one browser only, so clear the site data and it
is gone. With one, deleting the account itself (not only its data) still needs a server-side
function, and two devices saving at once keep the last save.

---

<sub>[Bogdan Trotsenko](https://github.com/murpiano) · [murpiano](https://github.com/murpiano) · [Telegram](https://t.me/murpiano) · [MIT](LICENSE)</sub>
