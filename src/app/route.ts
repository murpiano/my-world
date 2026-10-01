// src/app/route.ts
export type Route =
  | { kind: 'app' }
  | { kind: 'profile'; handle: string }
  | { kind: 'shared'; owner: string; content: 'trip' | 'album' | 'photo'; item: string; token?: string };

const APP: Route = { kind: 'app' };

/** Reads the two shareable paths out of the URL; everything else is the app itself. Read once
 *  at boot — the app has no client-side router, on purpose (see the spec). */
export const routeOf = (pathname: string, search: string, base: string): Route => {
  const trimmedBase = base.endsWith('/') ? base.slice(0, -1) : base;
  const path = pathname.startsWith(trimmedBase) ? pathname.slice(trimmedBase.length) : pathname;
  const parts = path.split('/').filter(Boolean);

  if (parts[0] === 'u' && parts[1]) {
    return { kind: 'profile', handle: parts[1] };
  }

  if (parts[0] === 'shared' && parts[1] && parts[2] && parts[3]) {
    const content = parts[2];
    if (content !== 'trip' && content !== 'album' && content !== 'photo') return APP;
    const token = new URLSearchParams(search).get('t');
    return {
      kind: 'shared',
      owner: parts[1],
      content,
      item: parts[3],
      // the key is left off entirely when there is no token, not set to undefined
      ...(token === null ? {} : { token }),
    };
  }

  return APP;
};
