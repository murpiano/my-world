import type { VisibilityKind } from '@/backend/types';

/**
 * The address to hand someone for one shared trip, album or photo. Null without a token: a
 * link-level item is only reachable by its token, so there is no link to copy until it has one.
 */
export const shareLink = (
  origin: string,
  base: string,
  accountId: string,
  kind: VisibilityKind,
  itemId: string,
  token: string | null,
): string | null => {
  if (!token) return null;
  const path = `${base.endsWith('/') ? base : `${base}/`}shared`;
  const where = [accountId, kind, itemId].map(encodeURIComponent).join('/');
  return `${origin}${path}/${where}?${new URLSearchParams({ t: token }).toString()}`;
};
