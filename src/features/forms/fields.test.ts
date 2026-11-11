import i18next from 'i18next';
import { describe, expect, it } from 'vitest';
import en from '@/i18n/locales/en.json';
import {
  accountProblem,
  handleProblem,
  signInProblem,
  dateInput,
  parseDate,
  placeLabel,
  samePlace,
} from './fields';

// a plain instance, not the app's own @/i18n/config: that one touches document/navigator,
// which this Node-environment test has none of
const test18n = i18next.createInstance();
void test18n.init({
  lng: 'en',
  resources: { en: { translation: en } },
  interpolation: { escapeValue: false },
});
const tr = test18n.t.bind(test18n);

const PARIS = { name: 'Paris', country: 'France', countryId: '250', lat: 48.86, lon: 2.35 };

describe('the form fields', () => {
  it('writes a date the way an input wants it', () => {
    expect(dateInput({ year: 2022, month: 5, day: 3 })).toBe('2022-05-03');
  });

  it('reads a date back, and refuses one that is not a date', () => {
    expect(parseDate('2022-05-03')).toEqual({ year: 2022, month: 5, day: 3 });
    expect(parseDate('')).toBeNull();
    expect(parseDate('2022-13-40')).toBeNull();
  });

  it('shows a place as its city and country', () => {
    expect(placeLabel(PARIS)).toBe('Paris, France');
  });

  it('tells two places apart by name and country, not by object', () => {
    expect(samePlace(PARIS, { ...PARIS })).toBe(true);
    expect(samePlace(PARIS, { ...PARIS, country: 'Texas', countryId: '840' })).toBe(false);
    expect(samePlace(null, PARIS)).toBe(false);
  });
});

describe('accountProblem', () => {
  const good = { name: 'Ann', email: 'ann@example.com', password: 'secret1', home: PARIS };

  it('lets a whole account through', () => {
    expect(accountProblem(good, tr)).toBeNull();
  });

  it('asks for a name, a real-looking email, a password and a home, in that order', () => {
    expect(accountProblem({ ...good, name: ' a ' }, tr)).toMatch(/name/);
    expect(accountProblem({ ...good, email: 'ann' }, tr)).toMatch(/email/);
    expect(accountProblem({ ...good, email: 'ann@example' }, tr)).toMatch(/email/);
    expect(accountProblem({ ...good, email: 'a b@example.com' }, tr)).toMatch(/email/);
    expect(accountProblem({ ...good, password: '123' }, tr)).toMatch(/password/);
    expect(accountProblem({ ...good, home: null }, tr)).toMatch(/home base/);
  });

  it('lets an edited account keep its password empty, but not a half-typed or unmatched one', () => {
    expect(
      accountProblem({ ...good, password: '', again: '', passwordOptional: true }, tr),
    ).toBeNull();
    expect(
      accountProblem({ ...good, password: '123', again: '123', passwordOptional: true }, tr),
    ).toMatch(/password/);
    expect(
      accountProblem({ ...good, password: 'secret1', again: 'secret2', passwordOptional: true }, tr),
    ).toMatch(/do not match/);
  });
});

describe('signInProblem', () => {
  it('needs an email that looks like one, and a password of any kind', () => {
    expect(signInProblem('ann@example.com', 'x', tr)).toBeNull();
    expect(signInProblem('ann', 'x', tr)).toMatch(/email/);
    expect(signInProblem('ann@example.com', '', tr)).toMatch(/password/);
  });
});

describe('handleProblem', () => {
  it('passes a plain handle', () => {
    expect(handleProblem('ivan-petrov', tr)).toBeNull();
  });

  it('passes an empty handle, since it only means "leave it as it is"', () => {
    expect(handleProblem('', tr)).toBeNull();
  });

  it('asks for at least three characters', () => {
    expect(handleProblem('ab', tr)).toMatch(/three/);
  });

  it('turns down characters a URL would mangle', () => {
    expect(handleProblem('ivan petrov', tr)).toMatch(/letters, numbers/);
    expect(handleProblem('ivan_petrov', tr)).toMatch(/letters, numbers/);
    expect(handleProblem('Ivan', tr)).toMatch(/letters, numbers/);
  });

  it('turns down more than thirty characters', () => {
    expect(handleProblem('a'.repeat(31), tr)).toMatch(/thirty/);
  });
});
