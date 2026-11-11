import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import type { World } from '@/app/boot';
import { creditLine, photoUrl } from '@/data/photos';
import { describeAlbum, photoKey, photoNote } from '@/data/social';
import type { Album } from '@/data/types';
import { goArchive } from '@/features/archive/links';
import { wheelSteps } from '@/features/panel';
import { monthYear } from '@/lib/dates';
import { useInterval } from '@/lib/useInterval';
import { appStore } from '@/state/app-state';
import type { PhotoView, Rect } from '@/state/app-state';
import { closePhoto, finishPhoto, stepPhoto, toggleSlideshow } from '@/state/layers';
import { SETTING_LIMITS, settingsStore } from '@/state/settings';
import { commentPhoto, likePhoto, socialFor, socialStore } from '@/state/social';
import { useStore } from '@/state/store';
import { indexAt, slidePositions, stepDelta } from './carousel';
import { flyTransform } from './fit';
import styles from './Lightbox.module.css';

const ZOOM_MS = 800;
const SWIPE_PX = 40;
/** A press that moves this far is a swipe, not a click. */
const SWIPE_START_PX = 6;
const EASE = 'cubic-bezier(0.2, 0.8, 0.2, 1)';

/** The photo window: the photo large, its story on the left, likes and comments on the right. */
export function Lightbox({ world }: { world: World }) {
  const photo = useStore(appStore, (s) => s.photo);
  const album = photo ? world.archive.albumById.get(photo.albumId) : undefined;
  if (!photo || !album) return null;
  return <PhotoWindow key={photo.albumId} world={world} photo={photo} album={album} />;
}

function PhotoWindow({ world, photo, album }: { world: World; photo: PhotoView; album: Album }) {
  const { t: tr, i18n } = useTranslation();
  const stage = useRef<HTMLDivElement>(null);
  const swipe = useRef<{ x: number; used: boolean; touch: boolean } | null>(null);
  // how far a finger has pulled the row, while it is down
  const [pull, setPull] = useState<number | null>(null);
  // the slide in front, counted on for ever round the loop, so the row only ever moves along
  const [position, setPosition] = useState(photo.index);
  const [seen, setSeen] = useState(photo.index);
  if (photo.index !== seen) {
    setSeen(photo.index);
    setPosition(position + stepDelta(seen, photo.index, album.photos.length, photo.dir));
  }
  const slideSeconds = useStore(settingsStore, (s) => s.slideSeconds);
  const [shown, setShown] = useState(false);
  const count = album.photos.length;
  const current = album.photos[photo.index];
  const key = current ? photoKey(current) : '';
  const kept = useStore(socialStore, (s) => s.byKey.get(key));
  const social = kept ?? socialFor(key);

  // the window fades in over the world
  useEffect(() => {
    const id = requestAnimationFrame(() => setShown(true));
    return () => cancelAnimationFrame(id);
  }, []);

  // the photos on either side are loaded before they are wanted, so turning to one is not a wait
  useEffect(() => {
    for (const step of [-1, 1]) {
      const near = album.photos[(photo.index + step + count) % count];
      const url = near ? photoUrl(near) : null;
      if (url) new Image().src = url;
    }
  }, [album, photo.index, count]);

  useInterval(
    () => stepPhoto(appStore, count, 1),
    slideSeconds * 1000,
    photo.slideshow && !photo.closing,
    photo.index,
    'real',
  );

  // the wheel over the photo turns the photos
  useEffect(() => {
    const element = stage.current;
    if (!element) return;
    let acc = 0;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const delta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
      const [next, steps] = wheelSteps(acc, delta, event.deltaMode);
      acc = next;
      if (steps !== 0) stepPhoto(appStore, count, steps);
    };
    element.addEventListener('wheel', onWheel, { passive: false });
    return () => element.removeEventListener('wheel', onWheel);
  }, [count]);

  // closing: the photo flies back into the tile now showing it, or fades if there is none
  useEffect(() => {
    if (!photo.closing) return;
    const image = stage.current?.querySelector<HTMLImageElement>('[data-current]');
    // the tile showing this photo now: in the archive when it is open (the panel lies under it)
    const tiles = [
      ...document.querySelectorAll<HTMLElement>(`[data-photo-key="${CSS.escape(key)}"]`),
    ].filter((element) => !element.closest('[data-lightbox-root]'));
    const tile = appStore.get().archive
      ? tiles.find((element) => element.closest('[data-archive-root]'))
      : tiles[0];
    if (!image) {
      finishPhoto(appStore);
      return;
    }
    const box = image.getBoundingClientRect();
    const to = tile?.getBoundingClientRect();
    const animation =
      to && to.width > 0
        ? image.animate(
            [{ transform: 'none' }, { transform: flyTransform(box, to), borderRadius: '14px' }],
            { duration: ZOOM_MS, easing: EASE, fill: 'forwards' },
          )
        : image.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 400, fill: 'forwards' });
    animation.onfinish = () => finishPhoto(appStore);
    return () => {
      animation.onfinish = null;
    };
  }, [photo.closing, key]);

  const close = () => {
    if (swipe.current?.used) {
      swipe.current = null;
      return;
    }
    closePhoto(appStore);
  };

  return (
    <div
      className={`${styles.lightbox}${shown && !photo.closing ? ` ${styles.isOn}` : ''}`}
      data-lightbox-root
      role="dialog"
      aria-label={tr('lightbox.ariaLabel')}
    >
      <button
        type="button"
        className={styles.close}
        aria-label={tr('lightbox.close')}
        onClick={() => closePhoto(appStore)}
      >
        ✕
      </button>

      <div
        ref={stage}
        className={styles.stage}
        onClick={close}
        onPointerDown={(event) => {
          // the arrows and the slideshow bar sit on the stage but are not the photo
          const control =
            event.target instanceof Element &&
            event.target.closest('[data-lightbox-bar], [data-lightbox-nav]');
          swipe.current = control
            ? null
            : { x: event.clientX, used: false, touch: event.pointerType !== 'mouse' };
        }}
        onPointerMove={(event) => {
          const start = swipe.current;
          if (!start) return;
          const distance = event.clientX - start.x;
          if (Math.abs(distance) > SWIPE_START_PX) start.used = true;
          // a finger pulls the row along with it; a mouse only turns the page on letting go
          if (start.touch && start.used) setPull(distance);
        }}
        onPointerUp={(event) => {
          const start = swipe.current;
          if (!start) return;
          const distance = event.clientX - start.x;
          setPull(null);
          if (Math.abs(distance) > SWIPE_PX) {
            start.used = true;
            stepPhoto(appStore, count, distance < 0 ? 1 : -1);
          }
        }}
        onPointerCancel={() => setPull(null)}
      >
        <div
          className={`${styles.row}${pull !== null ? ` ${styles.isPulled}` : ''}`}
          style={pull !== null ? ({ '--pull': `${pull}px` } as CSSProperties) : undefined}
        >
          {slidePositions(position, count).map((at) => {
            const shown = album.photos[indexAt(at, count)];
            if (!shown) return null;
            return (
              <Slide
                key={at}
                src={photoUrl(shown)}
                offset={at - position}
                from={photo.dir === 0 && at === position ? photo.from : null}
              />
            );
          })}
        </div>
        {count > 1 && (
          <>
            <button
              type="button"
              className={`${styles.nav} ${styles.prev}`}
              data-lightbox-nav
              aria-label={tr('lightbox.previousPhoto')}
              onClick={(event) => {
                event.stopPropagation();
                stepPhoto(appStore, count, -1);
              }}
            >
              ←
            </button>
            <button
              type="button"
              className={`${styles.nav} ${styles.next}`}
              data-lightbox-nav
              aria-label={tr('lightbox.nextPhoto')}
              onClick={(event) => {
                event.stopPropagation();
                stepPhoto(appStore, count, 1);
              }}
            >
              →
            </button>
          </>
        )}
        <div
          className={styles.bar}
          data-lightbox-bar
          onClick={(event) => event.stopPropagation()}
        >
          {count > 1 && (
            <button
              type="button"
              className={photo.slideshow ? styles.isOn : undefined}
              onClick={() => toggleSlideshow(appStore)}
            >
              {photo.slideshow ? tr('lightbox.slideshowOn') : tr('lightbox.slideshowOff')}
            </button>
          )}
          {count > 1 && (
            <label>
              <input
                type="range"
                min={SETTING_LIMITS.slideSeconds[0]}
                max={SETTING_LIMITS.slideSeconds[1]}
                step={1}
                value={slideSeconds}
                aria-label={tr('lightbox.slideshowSpeed')}
                onChange={(event) =>
                  settingsStore.set({ slideSeconds: Number(event.target.value) })
                }
              />
              <output>{slideSeconds} s</output>
            </label>
          )}
          <span>
            {photo.index + 1} / {count}
          </span>
        </div>
      </div>

      <div className={styles.scroll}>
        <aside className={styles.info}>
          <button
            type="button"
            className={`${styles.country} ${styles.link}`}
            onClick={() => goArchive({ kind: 'country', id: album.city.country.id })}
          >
            {album.city.country.name}
          </button>
          <button
            type="button"
            className={`${styles.city} ${styles.link}`}
            onClick={() => goArchive({ kind: 'city', key: album.city.key })}
          >
            {album.city.name}
          </button>
          <button
            type="button"
            className={`${styles.album} ${styles.link}`}
            onClick={() => goArchive({ kind: 'album', id: album.id })}
          >
            {album.title}
          </button>
          <div className={styles.date}>
            {monthYear(album)} · {tr('lightbox.photoCount', { count: album.photoCount })}
          </div>
          <p className={styles.note}>{current ? photoNote(current) : ''}</p>
          <p className={styles.desc}>{describeAlbum(album)}</p>
          <p className={styles.credit}>
            {current ? creditLine(current, album.city, world.credits) : ''}
          </p>
        </aside>
        <aside className={styles.social}>
          <button
            type="button"
            className={`${styles.like}${social.liked ? ` ${styles.isOn}` : ''}`}
            aria-pressed={social.liked}
            onClick={() => likePhoto(key)}
          >
            <i>♥</i>
            <span>{social.likes.toLocaleString(i18n.language)}</span>
          </button>
          <h4>{tr('lightbox.comments', { count: social.comments.length })}</h4>
          <div className={styles.comments}>
            {social.comments.map((comment, i) => (
              <div key={i} className={styles.comment}>
                <b>{comment.who}</b>
                <small>{comment.when}</small>
                <p>{comment.text}</p>
              </div>
            ))}
          </div>
          <CommentForm onSend={(text) => commentPhoto(key, text)} />
          <div className={styles.demo}>{tr('lightbox.demoComments')}</div>
        </aside>
      </div>
    </div>
  );
}

function CommentForm({ onSend }: { onSend: (text: string) => void }) {
  const { t: tr } = useTranslation();
  const [text, setText] = useState('');
  const send = () => {
    onSend(text);
    setText('');
  };
  return (
    <form
      className={styles.form}
      onSubmit={(event) => {
        event.preventDefault();
        send();
      }}
    >
      <textarea
        value={text}
        placeholder={tr('lightbox.addComment')}
        onChange={(event) => setText(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            send();
          }
        }}
      />
      <button type="submit">{tr('lightbox.post')}</button>
    </form>
  );
}

/**
 * One slide of the row. Every slide is the same size, so photos of any shape turn without the
 * frame changing: the photo sits whole inside it, and its own blurred self fills what is left.
 * The one that opens the window grows out of the tile it was clicked in.
 */
function Slide({ src, offset, from }: { src: string | null; offset: number; from: Rect | null }) {
  const slide = useRef<HTMLDivElement>(null);
  const played = useRef(false);

  useLayoutEffect(() => {
    const element = slide.current;
    if (!element || !from || played.current) return;
    played.current = true;
    const to = element.getBoundingClientRect();
    element.animate(
      [
        { transform: flyTransform(to, from), borderRadius: '14px' },
        { transform: 'none', borderRadius: '10px' },
      ],
      { duration: ZOOM_MS, easing: EASE },
    );
  }, [from]);

  const distance = Math.abs(offset);
  return (
    <div
      ref={slide}
      className={`${styles.slide}${
        offset === 0 ? ` ${styles.isCurrent}` : distance === 1 ? ` ${styles.isNear}` : ` ${styles.isFar}`
      }`}
      data-current={offset === 0 ? '' : undefined}
      style={{ '--offset': offset } as CSSProperties}
    >
      {src && <div className={styles.backdrop} style={{ backgroundImage: `url("${src}")` }} />}
      {/* alt="": the info panel beside it (city, album, date, description) already says what this is */}
      {src && <img className={styles.photo} src={src} alt="" draggable={false} />}
    </div>
  );
}
