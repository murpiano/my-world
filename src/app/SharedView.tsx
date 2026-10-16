import { useEffect, useState } from 'react';
import { resolveHandle } from '@/backend/handle';
import { fetchPublicTrips, fetchSharedContent } from '@/backend/sharing';
import type { SharedPhoto, SharedTrip } from '@/backend/sharing';
import { startBackend } from '@/backend/session';
import { photoState, profileState } from './profile';
import type { Route } from './route';
import './shared.scss';

/**
 * The visitor's own sign-in, if any: it is what makes 'registered' content visible to them. These
 * views build no world, so nothing has started the backend before them.
 */
const viewerBearer = async (): Promise<string | undefined> => {
  const back = await startBackend().catch(() => null);
  return (await back?.auth.accessToken().catch(() => null)) ?? undefined;
};

/** The flat "not available": a private item, a revoked link, an unknown handle, all alike. */
export function Away() {
  return (
    <div className="shared shared--away">
      <p>Not available.</p>
      <a href={import.meta.env.BASE_URL}>My World</a>
    </div>
  );
}

/** Someone else's public profile: the trips they have opened, and nothing else. */
export function SharedView({ route }: { route: Extract<Route, { kind: 'profile' }> }) {
  const [trips, setTrips] = useState<SharedTrip[] | null>(null);
  // the share URLs are keyed by account id, the same as the ones the owner copies
  const [owner, setOwner] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    void (async () => {
      const ownerId = await resolveHandle(route.handle);
      const bearer = await viewerBearer();
      const list = ownerId ? await fetchPublicTrips(ownerId, bearer) : [];
      if (!live) return;
      setOwner(ownerId);
      setTrips(list);
    })();
    return () => {
      live = false;
    };
  }, [route.handle]);

  const state = profileState(trips);
  if (state.status === 'loading') return <div className="shared shared--loading">Loading…</div>;
  if (state.status === 'away') return <Away />;

  return (
    <div className="shared">
      <h1>@{route.handle}</h1>
      <ul>
        {state.trips.map((trip) => (
          <li key={trip.id}>
            <a href={`${import.meta.env.BASE_URL}shared/${owner ?? ''}/trip/${trip.id}`}>
              {trip.name}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** One shared photo on its own, for a link an owner copied from a single photo. */
export function SharedPhotoView({ route }: { route: Extract<Route, { kind: 'shared' }> }) {
  const [answer, setAnswer] = useState<{ kind: string; photo?: SharedPhoto } | null | undefined>(
    undefined,
  );

  useEffect(() => {
    let live = true;
    void (async () => {
      const bearer = await viewerBearer();
      const result = await fetchSharedContent(route.owner, 'photo', route.item, {
        ...(route.token === undefined ? {} : { token: route.token }),
        ...(bearer === undefined ? {} : { bearer }),
      });
      if (live) setAnswer(result as { kind: string; photo?: SharedPhoto } | null);
    })();
    return () => {
      live = false;
    };
  }, [route.owner, route.item, route.token]);

  const state = photoState(answer);
  if (state.status === 'loading') return <div className="shared shared--loading">Loading…</div>;
  if (state.status === 'away') return <Away />;

  return (
    <div className="shared shared--photo">
      <img src={state.url} alt={state.caption ?? ''} />
      {state.caption && <p>{state.caption}</p>}
      <a href={import.meta.env.BASE_URL}>My World</a>
    </div>
  );
}
