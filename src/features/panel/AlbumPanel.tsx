import { useEffect, useRef, useState } from 'react';
import type { World } from '@/app/boot';
import { useDirector } from '@/app/director-context';
import type { Archive } from '@/data/archive';
import { cityPhotos, creditLine, photoUrl } from '@/data/photos';
import { photoKey } from '@/data/social';
import { tripOfAlbum } from '@/data/trips';
import type { Album, Credit } from '@/data/types';
import { monthYear } from '@/lib/dates';
import { useInterval } from '@/lib/useInterval';
import { goArchive } from '@/features/archive';
import { appStore } from '@/state/app-state';
import { openPhoto } from '@/state/layers';
import { settingsStore } from '@/state/settings';
import { useStore } from '@/state/store';
import { cityAlbums, scopedAlbums } from '@/tour/tour';
import type { Tour } from '@/tour/tour';
import cozyRoom from './cozy-room.svg?raw';
import { cardRole, wheelSteps } from './stack';
import type { CardRole } from './stack';
import styles from './AlbumPanel.module.css';

/** Each photo dissolves into the next over this time. */
const DISSOLVE_MS = 1400;
/** The cards fade out this long before they move. */
const AWAY_MS = 450;
/** A vertical swipe this long turns the albums on a phone. */
const SWIPE_PX = 30;

/**
 * Where the cards stand on a phone. When it changes they fade out, move while they cannot be seen,
 * and fade back in: never a jump.
 */
function useCardsPlace(low: boolean): { low: boolean; away: boolean } {
  const [placed, setPlaced] = useState(low);
  useEffect(() => {
    if (placed === low) return;
    const timer = setTimeout(() => setPlaced(low), AWAY_MS);
    return () => clearTimeout(timer);
  }, [low, placed]);
  return { low: placed, away: placed !== low };
}

/** The left column: the place in focus, its albums and its caption; hidden with nothing in focus. */
export function AlbumPanel({ world }: { world: World }) {
  const { archive } = world;
  const focus = useStore(appStore, (s) => s.focus);
  const endCard = useStore(appStore, (s) => s.endCard);
  const tour = useStore(appStore, (s) => s.tour);
  const low = useStore(appStore, (s) => s.albumsLow);
  const placed = useCardsPlace(low);
  const album = archive.albums[focus];
  const scope = tour ?? endCard?.tour ?? null;
  const list = album ? scopedAlbums(cityAlbums(archive, album.city.key), tour) : [];

  return (
    <section
      className={`${styles.panel}${album ? '' : ` ${styles.isHidden}`}${placed.low ? ` ${styles.isLow}` : ''}${placed.away ? ` ${styles.isAway}` : ''}`}
      aria-label="The place in focus"
    >
      {album && <LetGo />}
      <div className={styles.media}>
        {album && <PanelHead archive={archive} list={list} focus={focus} scope={scope} />}
        {album && endCard && <EndSlot world={world} />}
        {album && !endCard && <AlbumStack world={world} list={list} focus={focus} />}
      </div>
      {album && <Caption world={world} />}
    </section>
  );
}

/** A cross that lets go of the place in focus: on a phone there is no Esc key. */
function LetGo() {
  const director = useDirector();
  return (
    <button
      type="button"
      className={styles.close}
      aria-label="Let go of this place"
      onClick={() => director.escape()}
    >
      ✕
    </button>
  );
}

/** The years of this place's albums, or in a tour only the trip's name or the year. */
function PanelHead({
  archive,
  list,
  focus,
  scope,
}: {
  archive: Archive;
  list: number[];
  focus: number;
  scope: Tour | null;
}) {
  const director = useDirector();
  if (scope) {
    return (
      <div className={styles.years}>
        <button
          type="button"
          className={styles.current}
          onClick={() =>
            goArchive(
              scope.kind === 'year' && scope.year !== null
                ? { kind: 'year', year: scope.year }
                : scope.tripId
                  ? { kind: 'trip', id: scope.tripId }
                  : { kind: 'trips' },
            )
          }
        >
          {scope.kind === 'year' ? scope.name : `Trip · ${scope.name}`}
        </button>
      </div>
    );
  }
  const current = archive.albums[focus]?.year;
  const years = [
    ...new Set(list.map((i) => archive.albums[i]?.year).filter((y): y is number => y !== undefined)),
  ];
  return (
    <div className={styles.years}>
      {years.map((year) => (
        <button
          key={year}
          type="button"
          className={year === current ? styles.current : undefined}
          onClick={() => {
            // a second click on the current year opens the city in the archive
            const album = archive.albums[focus];
            if (year === current && album) {
              goArchive({ kind: 'city', key: album.city.key });
              return;
            }
            const index = list.find((i) => archive.albums[i]?.year === year);
            if (index !== undefined) director.selectAlbum(index);
          }}
        >
          {year}
        </button>
      ))}
    </div>
  );
}

/** The stack of albums: the current one in front, its photos in turn. */
function AlbumStack({ world, list, focus }: { world: World; list: number[]; focus: number }) {
  const director = useDirector();
  const photoSeconds = useStore(settingsStore, (s) => s.photoSeconds);
  const stack = useRef<HTMLDivElement>(null);
  const swipe = useRef<{ y: number; used: boolean } | null>(null);
  const [hover, setHover] = useState(false);
  const [shown, setShown] = useState<ReadonlyMap<number, number>>(() => new Map());
  const n = list.length;
  const cur = Math.max(0, list.indexOf(focus));
  const current = list[cur];

  const turnBy = (by: number) => {
    if (n < 2) return;
    const index = list[(((cur + by) % n) + n) % n];
    if (index !== undefined) director.selectAlbum(index);
  };

  useInterval(
    () => {
      if (current === undefined) return;
      setShown((map) => new Map(map).set(current, (map.get(current) ?? 0) + 1));
    },
    photoSeconds * 1000 + DISSOLVE_MS,
    !hover && current !== undefined,
    current,
  );

  // the wheel turns the albums; it needs a non-passive listener to keep the page still
  useEffect(() => {
    const element = stack.current;
    if (!element) return;
    let acc = 0;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      if (n < 2) return;
      const [next, steps] = wheelSteps(acc, event.deltaY, event.deltaMode);
      acc = next;
      if (steps === 0) return;
      const index = list[(((cur + steps) % n) + n) % n];
      if (index !== undefined) director.selectAlbum(index);
    };
    element.addEventListener('wheel', onWheel, { passive: false });
    return () => element.removeEventListener('wheel', onWheel);
  }, [director, list, cur, n]);

  const drift = (x: string, y: string) => {
    stack.current?.style.setProperty('--px', x);
    stack.current?.style.setProperty('--py', y);
  };

  return (
    <div
      ref={stack}
      className={`${styles.stack}${n > 1 ? ` ${styles.isMulti}` : ''}`}
      onPointerEnter={(event) => {
        if (event.pointerType === 'mouse') setHover(true);
      }}
      onPointerLeave={() => {
        setHover(false);
        drift('0px', '0px');
      }}
      onPointerDown={(event) => {
        swipe.current = { y: event.clientY, used: false };
      }}
      onPointerMove={(event) => {
        if (event.pointerType === 'mouse') {
          const rect = event.currentTarget.getBoundingClientRect();
          drift(
            `${(0.5 - (event.clientX - rect.left) / rect.width) * 16}px`,
            `${(0.5 - (event.clientY - rect.top) / rect.height) * 12}px`,
          );
          return;
        }
        const start = swipe.current;
        if (!start || start.used) return;
        const distance = event.clientY - start.y;
        if (Math.abs(distance) > SWIPE_PX) {
          start.used = true;
          turnBy(distance < 0 ? 1 : -1);
        }
      }}
      onClickCapture={(event) => {
        if (swipe.current?.used) event.stopPropagation();
        swipe.current = null;
      }}
    >
      {list.map((index, k) => {
        const album = world.archive.albums[index];
        if (!album) return null;
        const role = cardRole(k, cur, n);
        return (
          <AlbumCard
            key={album.id}
            album={album}
            role={role}
            step={shown.get(index) ?? 0}
            position={`${k + 1} / ${n}`}
            credits={world.credits}
            onSelect={role === 'cur' ? undefined : () => director.selectAlbum(index)}
            onOpen={
              role === 'cur'
                ? (photoIndex: number, element: HTMLElement) => {
                    const { x, y, width, height } = element.getBoundingClientRect();
                    openPhoto(appStore, album.id, photoIndex, { x, y, width, height });
                  }
                : undefined
            }
          />
        );
      })}
    </div>
  );
}

function AlbumCard({
  album,
  role,
  step,
  position,
  credits,
  onSelect,
  onOpen,
}: {
  album: Album;
  role: CardRole;
  step: number;
  position: string;
  credits: ReadonlyMap<string, Credit>;
  onSelect: (() => void) | undefined;
  onOpen: ((photoIndex: number, element: HTMLElement) => void) | undefined;
}) {
  const photos = album.photos;
  const count = photos.length;
  const on = count > 0 ? step % count : -1;
  // the old picture stays under the new one until it is covered
  const under = count > 1 && step > 0 ? (step - 1) % count : -1;
  const photo = photos[on];
  return (
    <div
      className={`${styles.card} ${styles[role]}`}
      onClick={(event) => {
        if (onOpen && on >= 0) onOpen(on, event.currentTarget);
        else onSelect?.();
      }}
    >
      <div className={styles.pan}>
        {/* alt="": the card's title/date/credit below already says what this album is */}
        {photos.map((ref, i) => (
          <img
            key={i}
            src={photoUrl(ref) ?? undefined}
            alt=""
            draggable={false}
            data-photo-key={i === on ? photoKey(ref) : undefined}
            className={i === on ? styles.isOn : i === under ? styles.isUnder : undefined}
          />
        ))}
      </div>
      <div
        className={styles.title}
        onClick={(event) => {
          if (role !== 'cur') return;
          event.stopPropagation();
          goArchive({ kind: 'album', id: album.id });
        }}
      >
        {album.title}
        <small>
          {monthYear(album)} · {album.photoCount} photos
        </small>
      </div>
      <div className={styles.name}>
        {monthYear(album)} · {album.title}
      </div>
      <div className={styles.count}>{position}</div>
      <div className={styles.credit}>{photo ? creditLine(photo, album.city, credits) : ''}</div>
    </div>
  );
}

/** A trip's end: the cozy room at home, or a photo of the city it ended in. */
function EndSlot({ world }: { world: World }) {
  const endCard = useStore(appStore, (s) => s.endCard);
  const city = endCard?.cityKey ? world.archive.cityByKey.get(endCard.cityKey) : undefined;
  const photo = city ? cityPhotos(city)[0] : undefined;
  const url = photo ? photoUrl(photo) : null;
  return (
    <div className={styles.stack}>
      <div className={`${styles.card} ${styles.cur} ${styles.end}`}>
        {url ? (
          <div className={styles.pan}>
            {/* alt="": the Caption right after this card says where this is */}
            <img className={styles.isOn} src={url} alt="" />
          </div>
        ) : (
          <div className={styles.cozy} dangerouslySetInnerHTML={{ __html: cozyRoom }} />
        )}
      </div>
    </div>
  );
}

function Caption({ world }: { world: World }) {
  const { archive, home } = world;
  const focus = useStore(appStore, (s) => s.focus);
  const endCard = useStore(appStore, (s) => s.endCard);
  const flightKm = useStore(appStore, (s) => s.flightKm);
  const album = archive.albums[focus];
  if (!album) return null;
  const status = flightKm === null ? '' : `in flight · ${Math.round(flightKm).toLocaleString('en')} km`;

  if (endCard) {
    const city = endCard.cityKey ? archive.cityByKey.get(endCard.cityKey) : undefined;
    const from = archive.albumById.get(endCard.fromAlbumId) ?? album;
    const tripId = endCard.tour?.kind === 'trip' ? endCard.tour.tripId : null;
    return (
      <div className={styles.caption} key={`end-${endCard.fromAlbumId}`}>
        <div className={styles.when}>{endCard.home ? 'Back home' : 'The end of the road'}</div>
        <div className={styles.place}>{city ? city.name : home.name}</div>
        <div className={styles.route}>
          {city ? city.country.name : home.country} · from{' '}
          <button
            type="button"
            className={styles.link}
            onClick={() => goArchive({ kind: 'city', key: from.city.key })}
          >
            {from.city.name}
          </button>{' '}
          ·{' '}
          <button
            type="button"
            className={styles.link}
            onClick={() => goArchive({ kind: 'album', id: from.id })}
          >
            {from.title}
          </button>
        </div>
        <div className={styles.trip}>
          {endCard.tour && tripId && (
            <>
              Trip ·{' '}
              <button
                type="button"
                className={styles.link}
                onClick={() => goArchive({ kind: 'trip', id: tripId })}
              >
                {endCard.tour.name}
              </button>
            </>
          )}
        </div>
        <div className={styles.status}>{status}</div>
      </div>
    );
  }

  const trip = tripOfAlbum(archive, album.id);
  return (
    <div className={styles.caption} key={album.id}>
      <div className={styles.when}>
        {monthYear(album)} · album {focus + 1} of {archive.albums.length}
      </div>
      <button
        type="button"
        className={styles.place}
        onClick={() => goArchive({ kind: 'city', key: album.city.key })}
      >
        {album.city.name}
      </button>
      <div className={styles.route}>
        <button
          type="button"
          className={`${styles.link} ${styles.strong}`}
          onClick={() => goArchive({ kind: 'country', id: album.city.country.id })}
        >
          {album.city.country.name}
        </button>{' '}
        ·{' '}
        <button
          type="button"
          className={styles.link}
          onClick={() => goArchive({ kind: 'album', id: album.id })}
        >
          {album.title}
        </button>{' '}
        · {album.photoCount} photos
      </div>
      <div className={styles.trip}>
        {trip && (
          <>
            Trip ·{' '}
            <button
              type="button"
              className={styles.link}
              onClick={() => goArchive({ kind: 'trip', id: trip.id })}
            >
              {trip.name}
            </button>
          </>
        )}
      </div>
      <div className={styles.status}>{status}</div>
    </div>
  );
}
