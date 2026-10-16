import { useEffect, useRef } from 'react';
import type { World } from '@/app/boot';
import { plural } from '@/archive/pages';
import { journeyStats } from '@/data/stats';
import { goArchive } from '@/features/archive/links';
import { currentRoute } from '@/app/route';
import { appStore } from '@/state/app-state';
import { openForm, toggleMenu } from '@/state/layers';
import { ownerStore } from '@/state/owner';
import { SETTING_LIMITS, settingsStore } from '@/state/settings';
import type { Settings } from '@/state/settings';
import { useStore } from '@/state/store';
import { signOutAccount } from '@/backend/account';
import { userStore } from '@/state/user';
import { albumTime } from '@/timeline/range';
import { HouseIcon } from './HouseIcon';
import './header.scss';

/** The burger and the brand on the left; the stats and the gear on the right. */
export function Header({ world }: { world: World | null }) {
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
    <header ref={root} className="header">
      <div className="header__lead">
        <button
          type="button"
          className={`header__round header__burger${menu === 'nav' ? ' is-on' : ''}`}
          aria-label="Menu"
          aria-expanded={menu === 'nav'}
          onClick={() => toggleMenu(appStore, 'nav')}
        >
          <span />
          <span />
          <span />
        </button>
        <div className="header__brand">
          My World<small>Memories of the places I&apos;ve been.</small>
        </div>
      </div>

      {world && (
        <div className="header__side">
          <div className="header__row">
            <Stats world={world} />
            <button
              type="button"
              className={`header__round header__gear${menu === 'settings' ? ' is-on' : ''}`}
              aria-label="Settings"
              aria-expanded={menu === 'settings'}
              onClick={() => toggleMenu(appStore, 'settings')}
            >
              ⚙
            </button>
          </div>
          <p className={`header__help${help ? '' : ' is-off'}`}>
            <b>Drag</b> and let go to spin · <b>scroll</b> to zoom · <b>click</b> a light
            <br />
            <b>Timeline:</b> drag for a range · click for all up to a point
            <br />a <b>year</b> picks the year, again opens it · <b>Esc</b> lets go
          </p>
        </div>
      )}

      <nav
        className={`header__menu header__nav${menu === 'nav' ? ' is-on' : ''}`}
        inert={menu !== 'nav'}
      >
        <NavMenu world={world} />
      </nav>

      {world && <SettingsMenu open={menu === 'settings'} />}
    </header>
  );
}

function NavMenu({ world }: { world: World | null }) {
  const user = useStore(userStore, (state) => state.user);
  // the trip count in the menu follows the owner's edits
  useStore(ownerStore, (state) => state.rev);

  if (!user) {
    return (
      <>
        <button
          type="button"
          className="header__item is-primary"
          onClick={() => openForm(appStore, { kind: 'login', why: null })}
        >
          Log in
        </button>
        <p>
          {currentRoute().kind === 'shared'
            ? 'Someone shared this with you. Log in to keep trips, albums and photos of your own.'
            : 'You are watching a demo traveller. Log in to keep your own trips, albums and photos.'}
        </p>
        <hr />
        <AboutItem />
      </>
    );
  }

  return (
    <>
      <div className="header__who">
        <b>{user.name}</b>
        <span>
          <HouseIcon />
          <em>{`${user.home.name}, ${user.home.country}`}</em>
        </span>
      </div>
      <button type="button" className="header__item" onClick={() => goArchive({ kind: 'trips' })}>
        <span>Archive</span>
        <small>{plural(world?.archive.trips.length ?? 0, 'trip')}</small>
      </button>
      <button
        type="button"
        className="header__item"
        onClick={() => openForm(appStore, { kind: 'account' })}
      >
        <span>Account settings</span>
        <small>email, password, home</small>
      </button>
      <hr />
      <AboutItem />
      <button type="button" className="header__item" onClick={() => void signOutAccount()}>
        <span>Log out</span>
      </button>
    </>
  );
}

function AboutItem() {
  return (
    <button
      type="button"
      className="header__item"
      onClick={() => openForm(appStore, { kind: 'about' })}
    >
      <span>About</span>
      <small>author, license, privacy</small>
    </button>
  );
}

function Stats({ world }: { world: World }) {
  const range = useStore(appStore, (s) => s.range);
  const focus = useStore(appStore, (s) => s.focus);
  // the archive keeps its identity through an edit, so the stats are counted on every render
  useStore(ownerStore, (state) => state.rev);
  const times = world.archive.albums.map(albumTime);
  const stats = journeyStats(world.archive, times, range, focus);
  const note = stats.scope === 'range' ? ' in range' : stats.scope === 'so far' ? ' so far' : '';
  return (
    <div className="header__stats">
      <b>{stats.countries}</b> of {stats.totalCountries} countries{note}
      <br />
      <b>{stats.photos.toLocaleString('en')}</b> photos · <b>{stats.km.toLocaleString('en')}</b> km
      flown
    </div>
  );
}

const SLIDERS: { key: 'photoSeconds' | 'flightSeconds'; label: string; step: number }[] = [
  { key: 'photoSeconds', label: 'Each photo', step: 1 },
  { key: 'flightSeconds', label: 'Each flight', step: 5 },
];

function SettingsMenu({ open }: { open: boolean }) {
  const settings = useStore(settingsStore, (s) => s);
  const change = (patch: Partial<Settings>) => settingsStore.set(patch);
  return (
    <div className={`header__menu header__settings${open ? ' is-on' : ''}`} inert={!open}>
      <h4>On the main screen</h4>
      {SLIDERS.map(({ key, label, step }) => (
        <label key={key}>
          <div>
            {label} <output>{settings[key]} s</output>
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
      <label className="header__check">
        <input
          type="checkbox"
          checked={settings.help}
          onChange={(event) => change({ help: event.target.checked })}
        />{' '}
        Show how to use it
      </label>
    </div>
  );
}
