import type { ArchiveData, Id, Place } from '@/data/types';

/** Who is signed in: what the account keeps besides the archive. */
export interface Account {
  id: string;
  name: string;
  email: string;
  home: Place;
  /** The public handle, for the profile at /u/<handle>; empty until one is made. */
  handle: string;
}

export interface SignUp {
  email: string;
  password: string;
  name: string;
  home: Place;
}

export type VisibilityKind = 'trip' | 'album' | 'photo';
export type VisibilityLevel = 'private' | 'link' | 'registered' | 'public';
export interface VisibilitySetting {
  level: VisibilityLevel;
  linkToken: string | null;
}

/** Accounts. The one seam between the app and whatever runs them (Supabase today). */
export interface Auth {
  /** The account that is signed in in this browser, if any. */
  session(): Promise<Account | null>;
  /** The signed-in account's own access token, for calling the sharing Edge Functions as a
   *  registered viewer; null when signed out. */
  accessToken(): Promise<string | null>;
  /** 'confirm-email' when the service wants the address confirmed before the first sign-in. */
  signUp(input: SignUp): Promise<'signed-in' | 'confirm-email'>;
  signIn(email: string, password: string): Promise<void>;
  signOut(): Promise<void>;
  update(input: {
    name: string;
    email: string;
    home: Place;
    password?: string;
    handle?: string;
  }): Promise<void>;
}

/** The storage of one signed-in account: its archive, and the photo files that go with it. */
export interface Storage {
  /** The stored archive as it was saved, or null when nothing was saved yet. */
  loadArchive(): Promise<unknown>;
  saveArchive(data: ArchiveData): Promise<void>;
  putPhoto(id: Id, blob: Blob): Promise<void>;
  getPhoto(id: Id): Promise<Blob | null>;
  removePhotos(ids: Id[]): Promise<void>;
  /** Addresses the page can show the photos from; a photo that is gone has none. */
  photoUrls(ids: Id[]): Promise<Map<Id, string>>;
  /** Deletes everything the account has kept: the archive and every photo. */
  wipe(): Promise<void>;
  getVisibility(kind: VisibilityKind, itemId: Id): Promise<VisibilitySetting>;
  setVisibility(kind: VisibilityKind, itemId: Id, level: VisibilityLevel): Promise<VisibilitySetting>;
}

/** A backend that is set up and reachable: the accounts, and the storage of an account. */
export interface Backend {
  auth: Auth;
  storage(accountId: string): Storage;
}
