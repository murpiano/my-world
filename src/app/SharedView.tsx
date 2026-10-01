import { useEffect, useState } from 'react';
import { resolveHandle } from '@/backend/handle';
import { fetchPublicTrips } from '@/backend/sharing';
import type { SharedTrip } from '@/backend/sharing';
import { backend } from '@/backend/session';
import { profileState } from './profile';
import type { Route } from './route';
import './shared.scss';

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
      // signed in as someone else? the token is what makes 'registered' trips visible
      const bearer = (await backend()?.auth.accessToken().catch(() => null)) ?? undefined;
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
