import type { SharedPhoto, SharedTrip } from '@/backend/sharing';

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

export type PhotoViewState =
  | { status: 'loading' }
  | { status: 'away' }
  | { status: 'photo'; url: string; caption?: string };

/**
 * What a single shared photo shows. `undefined` is "still asking", `null` is the Edge Function's
 * flat refusal. A stock photo has no address of its own here — it is a bundled demo file, never
 * something an owner shares on its own — so it lands on the same `away`.
 */
export const photoState = (
  answer: { kind: string; photo?: SharedPhoto } | null | undefined,
): PhotoViewState => {
  if (answer === undefined) return { status: 'loading' };
  if (!answer || answer.kind !== 'photo') return { status: 'away' };
  const photo = answer.photo;
  if (!photo || photo.kind !== 'own' || !photo.url) return { status: 'away' };
  return { status: 'photo', url: photo.url, ...(photo.caption ? { caption: photo.caption } : {}) };
};
