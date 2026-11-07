import { expect, test } from '@playwright/test';
import type { Browser, Locator, Page } from '@playwright/test';
import { closeSheet, logIn, notAvailable, openArchive, seesPhoto, setLevel } from './app';
import { removeOwner, seedOwner } from './seed';
import type { Level, Owner } from './seed';

let owner: Owner;

test.beforeEach(async () => {
  owner = await seedOwner();
});

test.afterEach(async () => {
  await removeOwner(owner);
});

const tripOf = (one: Owner) => ({ kind: 'trip' as const, id: one.tripId });

const linkIn = async (sheet: Locator): Promise<string> => {
  const box = sheet.locator('input[readonly]');
  await expect(box).toHaveValue(/\?t=/);
  return box.inputValue();
};

/** Someone with no account and nothing in their browser. */
const stranger = async (browser: Browser): Promise<Page> => (await browser.newContext()).newPage();

/**
 * The owner logs in and opens the trip at `level`. The strictest setting of an item and everything
 * above it wins, and an item with no setting of its own is private, so the album and the photo are
 * opened to everyone as well: still behind the trip. Ends on the trip's page in the archive.
 */
const shareTrip = async (page: Page, level: Level) => {
  await logIn(page, owner);
  const archive = await openArchive(page);
  await archive.getByRole('button', { name: owner.tripName }).click();
  const sheet = await setLevel(page, archive, '✎ Edit trip', owner, tripOf(owner), level);
  const link = level === 'link' ? await linkIn(sheet) : '';
  await closeSheet(page);
  await archive.getByRole('button', { name: owner.albumTitle }).click();
  await setLevel(
    page,
    archive,
    '✎ Edit album',
    owner,
    { kind: 'album', id: owner.albumId },
    'public',
  );
  await closeSheet(page);
  await setLevel(
    page,
    archive,
    'Edit photo',
    owner,
    { kind: 'photo', id: owner.photoId },
    'public',
  );
  await closeSheet(page);
  // exact: a photo's caption can have "back" in it too
  await archive.getByRole('button', { name: 'Back', exact: true }).click();
  return { archive, link };
};

test('a public trip is on the profile and plays for anyone; closing it takes both away', async ({
  page,
  browser,
}) => {
  const { archive } = await shareTrip(page, 'public');

  const guest = await stranger(browser);
  await guest.goto(`/u/${owner.handle}`);
  await expect(guest.getByRole('heading', { name: `@${owner.handle}` })).toBeVisible();
  await guest.getByRole('link', { name: owner.tripName }).click();
  await expect(guest).toHaveURL(new RegExp(`/shared/${owner.id}/trip/${owner.tripId}$`));
  await seesPhoto(guest, owner);

  await setLevel(page, archive, '✎ Edit trip', owner, tripOf(owner), 'private');
  await guest.reload();
  await notAvailable(guest);
  await guest.goto(`/u/${owner.handle}`);
  await notAvailable(guest);
});

test('a trip shared by link opens only with its token, and closing it ends that link for good', async ({
  page,
  context,
  browser,
}) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  const { archive, link } = await shareTrip(page, 'link');
  expect(link).toContain(`/shared/${owner.id}/trip/${owner.tripId}?t=`);

  const guest = await stranger(browser);
  await guest.goto(link);
  await seesPhoto(guest, owner);
  // the same address without its token
  await guest.goto(link.replace(/\?t=.*$/, ''));
  await notAvailable(guest);

  await setLevel(page, archive, '✎ Edit trip', owner, tripOf(owner), 'private');
  await closeSheet(page);
  await guest.goto(link);
  await notAvailable(guest);

  // shared by link again, the trip gets a new token: the old link stays dead
  const sheet = await setLevel(page, archive, '✎ Edit trip', owner, tripOf(owner), 'link');
  const fresh = await linkIn(sheet);
  expect(fresh).not.toBe(link);
  await sheet.getByRole('button', { name: 'Copy link' }).click();
  await expect(sheet.getByRole('button', { name: 'Copied' })).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(fresh);
  await guest.goto(link);
  await notAvailable(guest);
  await guest.goto(fresh);
  await seesPhoto(guest, owner);
});

test('a trip for signed-in people is hidden from strangers and open to another account', async ({
  page,
  browser,
}) => {
  const member = await seedOwner();
  try {
    await shareTrip(page, 'registered');

    const guest = await stranger(browser);
    await guest.goto(`/u/${owner.handle}`);
    await notAvailable(guest);
    await guest.goto(`/shared/${owner.id}/trip/${owner.tripId}`);
    await notAvailable(guest);

    const other = await stranger(browser);
    await logIn(other, member);
    await other.goto(`/u/${owner.handle}`);
    await other.getByRole('link', { name: owner.tripName }).click();
    await seesPhoto(other, owner);
  } finally {
    await removeOwner(member);
  }
});
