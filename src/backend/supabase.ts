import type { SupabaseClient, User as AuthUser } from '@supabase/supabase-js';
import { DEMO_HOME } from '@/data/demo';
import { cleanPlace } from '@/state/user';
import type {
  Account,
  Auth,
  Backend,
  Storage,
  VisibilityLevel,
  VisibilitySetting,
} from './types';
import type { BackendConfig } from './config';

const BUCKET = 'photos';
const SIGNED_FOR_S = 7 * 24 * 3600;
const PAGE = 1000;

const accountOf = (user: AuthUser): Account => {
  const meta = user.user_metadata as { name?: unknown; home?: unknown };
  return {
    id: user.id,
    email: user.email ?? '',
    name: typeof meta.name === 'string' ? meta.name : (user.email ?? ''),
    // an account made elsewhere may have no home base yet: the demo's stands in until it is set
    home: cleanPlace(meta.home) ?? DEMO_HOME,
  };
};

const fail = (error: { message: string } | null): void => {
  if (error) throw new Error(error.message);
};

export const authOf = (client: SupabaseClient): Auth => ({
  async session() {
    const { data, error } = await client.auth.getSession();
    fail(error);
    return data.session ? accountOf(data.session.user) : null;
  },
  async accessToken() {
    const { data, error } = await client.auth.getSession();
    fail(error);
    return data.session?.access_token ?? null;
  },
  async signUp({ email, password, name, home }) {
    const { data, error } = await client.auth.signUp({
      email,
      password,
      options: { data: { name, home } },
    });
    fail(error);
    return data.session ? 'signed-in' : 'confirm-email';
  },
  async signIn(email, password) {
    const { error } = await client.auth.signInWithPassword({ email, password });
    fail(error);
  },
  async signOut() {
    const { error } = await client.auth.signOut();
    fail(error);
  },
  async update({ name, email, home, password }) {
    const { error } = await client.auth.updateUser({
      email,
      ...(password ? { password } : {}),
      data: { name, home },
    });
    fail(error);
  },
});

export const storageOf = (client: SupabaseClient, accountId: string): Storage => {
  const path = (id: string) => `${accountId}/${id}`;
  const bucket = client.storage.from(BUCKET);
  const visibilityTable = () => client.from('content_visibility');
  const readVisibility = async (kind: string, itemId: string): Promise<VisibilitySetting> => {
    const { data, error } = await visibilityTable()
      .select('level, link_token')
      .eq('owner_id', accountId)
      .eq('kind', kind)
      .eq('item_id', itemId)
      .maybeSingle();
    fail(error);
    const row = data as { level: VisibilityLevel; link_token: string | null } | null;
    return { level: row?.level ?? 'private', linkToken: row?.link_token ?? null };
  };
  return {
    async loadArchive() {
      const { data, error } = await client
        .from('archives')
        .select('data')
        .eq('user_id', accountId)
        .maybeSingle();
      fail(error);
      return (data as { data: unknown } | null)?.data ?? null;
    },
    async saveArchive(data) {
      const { error } = await client
        .from('archives')
        .upsert({ user_id: accountId, data, updated_at: new Date().toISOString() });
      fail(error);
    },
    async putPhoto(id, blob) {
      const { error } = await bucket.upload(path(id), blob, {
        upsert: true,
        contentType: blob.type || 'image/jpeg',
      });
      fail(error);
    },
    async getPhoto(id) {
      const { data, error } = await bucket.download(path(id));
      return error ? null : data;
    },
    async removePhotos(ids) {
      if (ids.length === 0) return;
      const { error } = await bucket.remove(ids.map(path));
      fail(error);
    },
    async photoUrls(ids) {
      const urls = new Map<string, string>();
      // the service answers for a limited number of paths at a time
      for (let from = 0; from < ids.length; from += PAGE) {
        const chunk = ids.slice(from, from + PAGE);
        const { data, error } = await bucket.createSignedUrls(chunk.map(path), SIGNED_FOR_S);
        fail(error);
        for (const [index, entry] of (data ?? []).entries()) {
          const id = chunk[index];
          if (id !== undefined && entry.signedUrl && !entry.error) urls.set(id, entry.signedUrl);
        }
      }
      return urls;
    },
    async wipe() {
      for (;;) {
        const { data, error } = await bucket.list(accountId, { limit: PAGE });
        fail(error);
        if (!data || data.length === 0) break;
        const { error: removing } = await bucket.remove(
          data.map((file) => `${accountId}/${file.name}`),
        );
        fail(removing);
        if (data.length < PAGE) break;
      }
      const { error } = await client.from('archives').delete().eq('user_id', accountId);
      fail(error);
    },
    getVisibility: (kind, itemId) => readVisibility(kind, itemId),
    async setVisibility(kind, itemId, level) {
      const linkToken =
        level === 'link'
          ? ((await readVisibility(kind, itemId)).linkToken ?? crypto.randomUUID())
          : null;
      const { error } = await visibilityTable().upsert(
        {
          owner_id: accountId,
          kind,
          item_id: itemId,
          level,
          link_token: linkToken,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'owner_id,kind,item_id' },
      );
      fail(error);
      return { level, linkToken };
    },
  };
};

/** The Supabase backend: loaded only when the build has one, so the app does not carry it otherwise. */
export const createSupabase = async ({ url, key }: BackendConfig): Promise<Backend> => {
  const { createClient } = await import('@supabase/supabase-js');
  const client = createClient(url, key);
  return { auth: authOf(client), storage: (accountId) => storageOf(client, accountId) };
};
