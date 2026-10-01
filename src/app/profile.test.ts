import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { profileState } from './profile';
import { resolveHandle } from '@/backend/handle';

describe('profileState', () => {
  it('is loading until the trips arrive', () => {
    expect(profileState(null)).toEqual({ status: 'loading' });
  });

  it('is away when there is nothing to show, telling a private archive from a missing one', () => {
    expect(profileState([])).toEqual({ status: 'away' });
  });

  it('lists what came back', () => {
    expect(profileState([{ id: 't1', name: 'Peru' }])).toEqual({
      status: 'trips',
      trips: [{ id: 't1', name: 'Peru' }],
    });
  });
});

describe('resolveHandle', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://proj.supabase.co');
    vi.stubEnv('VITE_SUPABASE_KEY', 'anon-key');
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('asks profiles for the account behind a handle', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue({ ok: true, json: () => Promise.resolve([{ user_id: 'acc-1' }]) });
    vi.stubGlobal('fetch', fetchMock);
    await expect(resolveHandle('ivan-petrov')).resolves.toBe('acc-1');
    const [url] = fetchMock.mock.calls[0] as [string];
    expect(url).toBe(
      'https://proj.supabase.co/rest/v1/profiles?handle=eq.ivan-petrov&select=user_id',
    );
  });

  it('escapes a handle that would otherwise alter the query', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve([]) });
    vi.stubGlobal('fetch', fetchMock);
    await resolveHandle('a&b=c');
    const [url] = fetchMock.mock.calls[0] as [string];
    expect(url).toContain('handle=eq.a%26b%3Dc');
  });

  it('is null for an unknown handle', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve([]) }));
    await expect(resolveHandle('nobody')).resolves.toBeNull();
  });

  it('is null when the request fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, json: () => Promise.resolve({}) }));
    await expect(resolveHandle('ivan-petrov')).resolves.toBeNull();
  });

  it('is null without a backend', async () => {
    vi.unstubAllEnvs();
    await expect(resolveHandle('ivan-petrov')).resolves.toBeNull();
  });
});
