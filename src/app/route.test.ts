// src/app/route.test.ts
import { describe, expect, it } from 'vitest';
import { routeOf } from './route';

describe('routeOf', () => {
  it('is the app for the root path', () => {
    expect(routeOf('/my-world/', '', '/my-world/')).toEqual({ kind: 'app' });
  });

  it('reads a profile handle', () => {
    expect(routeOf('/my-world/u/ivan-petrov', '', '/my-world/')).toEqual({
      kind: 'profile',
      handle: 'ivan-petrov',
    });
  });

  it('reads a shared trip with a token', () => {
    expect(routeOf('/my-world/shared/owner-1/trip/t1', '?t=abc-123', '/my-world/')).toEqual({
      kind: 'shared',
      owner: 'owner-1',
      content: 'trip',
      item: 't1',
      token: 'abc-123',
    });
  });

  it('reads a shared album with no token', () => {
    expect(routeOf('/my-world/shared/owner-1/album/a1', '', '/my-world/')).toEqual({
      kind: 'shared',
      owner: 'owner-1',
      content: 'album',
      item: 'a1',
      token: undefined,
    });
  });

  it('falls back to the app for anything it does not recognize', () => {
    expect(routeOf('/my-world/nonsense', '', '/my-world/')).toEqual({ kind: 'app' });
    expect(routeOf('/my-world/shared/owner-1/not-a-kind/x', '', '/my-world/')).toEqual({ kind: 'app' });
  });

  it('strips the base path first, so it works under any BASE_URL', () => {
    expect(routeOf('/u/ivan-petrov', '', '/')).toEqual({ kind: 'profile', handle: 'ivan-petrov' });
  });
});
