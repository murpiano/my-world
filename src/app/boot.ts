import { linkArchive } from '@/data/archive';
import type { Archive } from '@/data/archive';
import { DEMO_HOME } from '@/data/demo';
import { startBackend } from '@/backend/session';
import { demoRepository } from '@/data/demo-repository';
import { localRepository } from '@/data/local-repository';
import { remoteRepository } from '@/data/remote-repository';
import type { Credit, Place } from '@/data/types';
import { earthFromTopology } from '@/geo/world';
import type { EarthGeo, WorldTopology } from '@/geo/world';
import { demoUrl } from '@/lib/assets';
import { lightsFromRows } from '@/render/lights';
import { setSource } from '@/state/owner';
import { userStore } from '@/state/user';
import type { Light, LightRow } from '@/render/lights';

export { demoUrl };
export { routeOf } from './route';
export type { Route } from './route';

export interface World {
  earth: EarthGeo;
  lights: Light[];
  archive: Archive;
  home: Place;
  /** The signed-in account, when a backend holds this archive; null otherwise. */
  accountId: string | null;
  /** Photo credits of the demo, by file name. */
  credits: ReadonlyMap<string, Credit>;
}

const fetchJson = async <T>(path: string): Promise<T> => {
  const response = await fetch(demoUrl(path));
  if (!response.ok) {
    throw new Error(`${path}: HTTP ${response.status}`);
  }
  return (await response.json()) as T;
};

/** Loads the world map and the archive: the demo traveller, or the owner's own. */
export const loadWorld = async (): Promise<World> => {
  const [topology, credits, rows] = await Promise.all([
    fetchJson<WorldTopology>('countries-110m.json'),
    fetchJson<Credit[]>('photos.json'),
    fetchJson<LightRow[]>('lights.json'),
  ]);
  const earth = earthFromTopology(topology);
  // with a backend the account is whoever the backend says is signed in; without one, the browser
  const back = await startBackend().catch(() => null);
  const account = back ? await back.auth.session().catch(() => null) : null;
  if (back) {
    userStore.set({
      user: account
        ? {
            name: account.name,
            email: account.email,
            home: account.home,
            handle: account.handle,
          }
        : null,
    });
  }
  const { user } = userStore.get();
  // logged out it is the demo traveller, read-only; logged in it is the owner's own archive
  const repo =
    back && account
      ? remoteRepository(back.storage(account.id), credits)
      : user && !back
        ? localRepository(credits)
        : demoRepository(credits);
  const archive = linkArchive(await repo.load());
  setSource(archive, repo);
  return {
    earth,
    lights: lightsFromRows(rows),
    archive,
    home: user?.home ?? DEMO_HOME,
    accountId: back && account ? account.id : null,
    credits: new Map(credits.map((credit) => [credit.file, credit])),
  };
};
