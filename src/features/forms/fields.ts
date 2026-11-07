import type { PickedPlace } from '@/data/places';
import { pad2 } from '@/lib/math';

export const dateInput = (when: { year: number; month: number; day: number }): string =>
  `${when.year}-${pad2(when.month)}-${pad2(when.day)}`;

/** "YYYY-MM-DD" from a date input, or nothing when the field is empty or impossible. */
export const parseDate = (value: string): { year: number; month: number; day: number } | null => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return { year, month, day };
};

export const placeLabel = (place: PickedPlace): string => `${place.name}, ${place.country}`;

export const samePlace = (a: PickedPlace | null, b: PickedPlace | null): boolean =>
  a !== null && b !== null && a.name === b.name && a.country === b.country;

const MAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
export const MIN_PASSWORD = 6;

/**
 * The first thing wrong with an account's fields, in words for the person, or null when all is
 * well. A password left empty is fine when `passwordOptional` (an account that is only edited).
 */
export const accountProblem = (fields: {
  name: string;
  email: string;
  password: string;
  again?: string;
  home: PickedPlace | null;
  passwordOptional?: boolean;
}): string | null => {
  if (fields.name.trim().length < 2) return 'Enter your name (at least two letters).';
  if (!MAIL.test(fields.email.trim())) return 'Enter an email like name@example.com.';
  const mustHave = !fields.passwordOptional || fields.password !== '';
  if (mustHave && fields.password.length < MIN_PASSWORD) {
    return `The password needs at least ${MIN_PASSWORD} characters.`;
  }
  if (fields.again !== undefined && fields.password !== fields.again) {
    return 'The two passwords do not match.';
  }
  if (!fields.home) return 'Pick your home base from the list of cities.';
  return null;
};

/**
 * What is wrong with a public handle, in the same words the database's own rule enforces
 * (`^[a-z0-9-]{3,30}$`). Empty means "leave the handle alone", which is always fine.
 */
export const handleProblem = (handle: string): string | null => {
  const wanted = handle.trim();
  if (wanted === '') return null;
  if (wanted.length < 3) return 'A handle needs at least three characters.';
  if (wanted.length > 30) return 'A handle can be at most thirty characters.';
  if (!/^[a-z0-9-]+$/.test(wanted)) {
    return 'A handle takes lowercase letters, numbers and hyphens only.';
  }
  return null;
};

/** What is wrong with a sign-in: only the pair is needed, and the service checks the password. */
export const signInProblem = (email: string, password: string): string | null => {
  if (!MAIL.test(email.trim())) return 'Enter an email like name@example.com.';
  return password ? null : 'Enter your password.';
};
