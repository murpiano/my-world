import { expect } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';
import { levelOf } from './seed';
import type { Kind, Level, Owner } from './seed';

/** Logs in through the menu, the way a person does; the page reloads into their own archive. */
export const logIn = async (page: Page, who: { email: string; password: string }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Menu' }).click();
  await page.getByRole('button', { name: 'Log in' }).click();
  const sheet = page.getByRole('dialog', { name: 'Log in' });
  await sheet.getByLabel('Email').fill(who.email);
  await sheet.getByLabel('Password').fill(who.password);
  const reloaded = page.waitForEvent('load');
  await sheet.getByRole('button', { name: 'Log in' }).click();
  await reloaded;
};

/** The owner's archive, opened from the menu. */
export const openArchive = async (page: Page): Promise<Locator> => {
  await page.getByRole('button', { name: 'Menu' }).click();
  await page.getByRole('button', { name: /^Archive/ }).click();
  const archive = page.getByRole('region', { name: 'Archive' });
  await expect(archive).toBeVisible();
  return archive;
};

/**
 * Opens an edit sheet from the archive and sets who can see the item. The setting is its own
 * write, apart from the archive's save, so the step waits until it is in the database.
 * Returns the sheet, still open.
 */
export const setLevel = async (
  page: Page,
  archive: Locator,
  edit: string,
  owner: Owner,
  item: { kind: Kind; id: string },
  level: Level,
): Promise<Locator> => {
  await archive.getByRole('button', { name: edit, exact: true }).click();
  const sheet = page.getByRole('dialog');
  await sheet.getByLabel('Who can see it').selectOption(level);
  await expect.poll(() => levelOf(owner, item.kind, item.id)).toBe(level);
  return sheet;
};

/** Cancel: the sharing setting is already kept, whatever happens to the rest of the form. */
export const closeSheet = async (page: Page) => {
  const sheet = page.getByRole('dialog');
  await sheet.getByRole('button', { name: 'Cancel' }).click();
  await expect(sheet).toBeHidden();
};

/** A visitor plays what was shared and waits for the owner's photo to load from storage. */
export const seesPhoto = async (page: Page, owner: Owner) => {
  await page.getByRole('button', { name: 'Play' }).click();
  const photo = page
    .locator(`img[src*="/storage/v1/object/sign/photos/${owner.id}/${owner.photoId}"]`)
    .first();
  await expect(photo).toBeVisible();
  await expect
    .poll(() => photo.evaluate((img: HTMLImageElement) => img.naturalWidth))
    .toBeGreaterThan(0);
};

export const notAvailable = async (page: Page) => {
  await expect(page.getByText('Not available.')).toBeVisible();
};
