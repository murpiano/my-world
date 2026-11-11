import { useEffect, useRef } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import type { World } from '@/app/boot';
import { journeyStats } from '@/data/stats';
import { goArchive } from '@/features/archive/links';
import { currentRoute } from '@/app/route';
import { appStore } from '@/state/app-state';
import { openForm, toggleMenu } from '@/state/layers';
import { ownerStore } from '@/state/owner';
import { LANGUAGES, SETTING_LIMITS, settingsStore } from '@/state/settings';
import type { Language, Settings } from '@/state/settings';
import { useStore } from '@/state/store';
import { signOutAccount } from '@/backend/account';
import { userStore } from '@/state/user';
import { albumTime } from '@/timeline/range';
import { HouseIcon } from './HouseIcon';
import styles from './Header.module.css';

/** The burger and the brand on the left; the stats and the gear on the right. */
export function Header({ world }: { world: World | null }) {
  const { t: tr } = useTranslation();
  const menu = useStore(appStore, (s) => s.menu);
  const help = useStore(settingsStore, (s) => s.help);
  const root = useRef<HTMLElement>(null);

  // a press anywhere outside the header closes the open menu
  useEffect(() => {
    if (!menu) return;
    const onDown = (event: PointerEvent) => {
      if (event.target instanceof Node && root.current?.contains(event.target)) return;
      appStore.set({ menu: null });
    };
    addEventListener('pointerdown', onDown);
    return () => removeEventListener('pointerdown', onDown);
  }, [menu]);

  return (
    <header ref={root} className={styles.header}>
      <div className={styles.lead}>
        <button
          type="button"
          className={`${styles.roundButton} ${styles.burger}${menu === 'nav' ? ` ${styles.isOn}` : ''}`}
          data-splash-burger
          aria-label={tr('header.menu')}
          aria-expanded={menu === 'nav'}
          onClick={() => toggleMenu(appStore, 'nav')}
        >
          <span />
          <span />
          <span />
        </button>
        <div className={styles.brand} data-splash-brand>
          {tr('header.brand')}
          <small>{tr('header.tagline')}</small>
        </div>
      </div>

      {world && (
        <div className={styles.side}>
          <div className={styles.row}>
            <Stats world={world} />
            <button
              type="button"
              className={`${styles.roundButton} ${styles.gear}${menu === 'settings' ? ` ${styles.isOn}` : ''}`}
              aria-label={tr('header.settings')}
              aria-expanded={menu === 'settings'}
              onClick={() => toggleMenu(appStore, 'settings')}
            >
              ⚙
            </button>
          </div>
          <p className={`${styles.help}${help ? '' : ` ${styles.isOff}`}`}>
            <Trans
              i18nKey="header.help"
              components={[<b key="0" />, <b key="1" />, <b key="2" />, <br key="3" />, <b key="4" />, <br key="5" />, <b key="6" />, <b key="7" />]}
            />
          </p>
        </div>
      )}

      <nav
        className={`${styles.menu} ${styles.nav}${menu === 'nav' ? ` ${styles.isOn}` : ''}`}
        inert={menu !== 'nav'}
      >
        <NavMenu world={world} />
      </nav>

      {world && <SettingsMenu open={menu === 'settings'} />}
    </header>
  );
}

function NavMenu({ world }: { world: World | null }) {
  const { t: tr } = useTranslation();
  const user = useStore(userStore, (state) => state.user);
  // the trip count in the menu follows the owner's edits
  useStore(ownerStore, (state) => state.rev);

  if (!user) {
    return (
      <>
        <button
          type="button"
          className={`${styles.item} ${styles.isPrimary}`}
          onClick={() => openForm(appStore, { kind: 'login', why: null })}
        >
          {tr('header.logIn')}
        </button>
        <p>
          {currentRoute().kind === 'shared'
            ? tr('header.guestSharedNote')
            : tr('header.guestDemoNote')}
        </p>
        <hr />
        <AboutItem />
      </>
    );
  }

  return (
    <>
      <div className={styles.who}>
        <b>{user.name}</b>
        <span>
          <HouseIcon />
          <em>{`${user.home.name}, ${user.home.country}`}</em>
        </span>
      </div>
      <button type="button" className={styles.item} onClick={() => goArchive({ kind: 'trips' })}>
        <span>{tr('header.archive')}</span>
        <small>{tr('header.tripCount', { count: world?.archive.trips.length ?? 0 })}</small>
      </button>
      <button
        type="button"
        className={styles.item}
        onClick={() => openForm(appStore, { kind: 'account' })}
      >
        <span>{tr('header.accountSettings')}</span>
        <small>{tr('header.accountSettingsNote')}</small>
      </button>
      <hr />
      <AboutItem />
      <button type="button" className={styles.item} onClick={() => void signOutAccount()}>
        <span>{tr('header.logOut')}</span>
      </button>
    </>
  );
}

function AboutItem() {
  const { t: tr } = useTranslation();
  return (
    <button
      type="button"
      className={styles.item}
      onClick={() => openForm(appStore, { kind: 'about' })}
    >
      <span>{tr('header.about')}</span>
      <small>{tr('header.aboutNote')}</small>
    </button>
  );
}

function Stats({ world }: { world: World }) {
  const { t: tr, i18n } = useTranslation();
  const range = useStore(appStore, (s) => s.range);
  const focus = useStore(appStore, (s) => s.focus);
  // the archive keeps its identity through an edit, so the stats are counted on every render
  useStore(ownerStore, (state) => state.rev);
  const times = world.archive.albums.map(albumTime);
  const stats = journeyStats(world.archive, times, range, focus);
  const note =
    stats.scope === 'range'
      ? tr('header.countriesInRange')
      : stats.scope === 'so far'
        ? tr('header.countriesSoFar')
        : '';
  return (
    <div className={styles.stats}>
      <b>{stats.countries}</b> {tr('header.countriesStat', { total: stats.totalCountries })}
      {note}
      <br />
      <b>{stats.photos.toLocaleString(i18n.language)}</b> {tr('header.photosLabel')} ·{' '}
      <b>{stats.km.toLocaleString(i18n.language)}</b> {tr('header.kmFlownLabel')}
    </div>
  );
}

const SLIDERS: { key: 'photoSeconds' | 'flightSeconds'; labelKey: string; step: number }[] = [
  { key: 'photoSeconds', labelKey: 'header.eachPhoto', step: 1 },
  { key: 'flightSeconds', labelKey: 'header.eachFlight', step: 5 },
];

const LANGUAGE_NAMES: Record<Language, string> = { en: 'English', ru: 'Русский' };

function SettingsMenu({ open }: { open: boolean }) {
  const { t: tr } = useTranslation();
  const settings = useStore(settingsStore, (s) => s);
  const change = (patch: Partial<Settings>) => settingsStore.set(patch);
  return (
    <div
      className={`${styles.menu} ${styles.settings}${open ? ` ${styles.isOn}` : ''}`}
      inert={!open}
    >
      <h4>{tr('header.mainScreenHeading')}</h4>
      {SLIDERS.map(({ key, labelKey, step }) => (
        <label key={key}>
          <div>
            {tr(labelKey)} <output>{settings[key]} s</output>
          </div>
          <input
            type="range"
            min={SETTING_LIMITS[key][0]}
            max={SETTING_LIMITS[key][1]}
            step={step}
            value={settings[key]}
            onChange={(event) => change({ [key]: Number(event.target.value) })}
          />
        </label>
      ))}
      <label className={styles.check}>
        <input
          type="checkbox"
          checked={settings.help}
          onChange={(event) => change({ help: event.target.checked })}
        />{' '}
        {tr('header.showHelp')}
      </label>
      <label>
        <div>{tr('header.language')}</div>
        <select
          value={settings.language}
          onChange={(event) => change({ language: event.target.value as Language })}
        >
          {LANGUAGES.map((code) => (
            <option key={code} value={code}>
              {LANGUAGE_NAMES[code]}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
