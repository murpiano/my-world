import { logOut } from '@/state/user';
import { backend } from './session';

/** Signs out of the backend (when there is one) and of this browser, and opens the page again. */
export const signOutAccount = async (): Promise<void> => {
  await backend()
    ?.auth.signOut()
    .catch(() => undefined);
  logOut();
  location.reload();
};

/** The backend's own words, made plainer for the few things a person can do something about. */
export const friendlyError = (message: string): string => {
  const text = message.toLowerCase();
  if (text.includes('invalid login')) return 'That email and password do not match.';
  if (text.includes('not confirmed'))
    return 'Confirm your email first: the link is in the message we sent.';
  if (text.includes('already registered'))
    return 'That email already has an account. Log in instead.';
  if (text.includes('rate limit')) return 'Too many tries. Wait a little and try again.';
  if (text.includes('profiles_handle_key') || (text.includes('duplicate key') && text.includes('handle'))) {
    return 'That handle is taken. Try another.';
  }
  if (text.includes('failed to fetch') || text.includes('network')) {
    return 'The server cannot be reached. Check the connection and try again.';
  }
  return message;
};
