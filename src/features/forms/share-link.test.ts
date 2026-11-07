import { describe, expect, it } from 'vitest';
import { shareLink } from './share-link';

describe('shareLink', () => {
  it('builds a link under the app base, carrying the token', () => {
    expect(shareLink('https://murpiano.github.io', '/my-world/', 'acc-1', 'album', 'a1', 'tok-9')).toBe(
      'https://murpiano.github.io/my-world/shared/acc-1/album/a1?t=tok-9',
    );
  });

  it('works at the root base, with no doubled slash', () => {
    expect(shareLink('http://127.0.0.1:3001', '/', 'acc-1', 'trip', 't1', 'tok-9')).toBe(
      'http://127.0.0.1:3001/shared/acc-1/trip/t1?t=tok-9',
    );
  });

  it('is null without a token, since the link is what the token unlocks', () => {
    expect(shareLink('https://x', '/', 'acc-1', 'photo', 'p1', null)).toBeNull();
  });

  it('escapes anything in the ids that a URL would mangle', () => {
    expect(shareLink('https://x', '/', 'acc 1', 'album', 'a/1', 'tok 9')).toBe(
      'https://x/shared/acc%201/album/a%2F1?t=tok+9',
    );
  });
});
