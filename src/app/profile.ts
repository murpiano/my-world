import type { SharedTrip } from '@/backend/sharing';

export type ProfileState =
  | { status: 'loading' }
  | { status: 'away' }
  | { status: 'trips'; trips: SharedTrip[] };

/**
 * What a public profile shows. An empty list and an unknown handle land on the same `away`
 * state on purpose: a visitor must not be able to tell a private archive from one that was
 * never there.
 */
export const profileState = (trips: SharedTrip[] | null): ProfileState => {
  if (trips === null) return { status: 'loading' };
  if (trips.length === 0) return { status: 'away' };
  return { status: 'trips', trips };
};
