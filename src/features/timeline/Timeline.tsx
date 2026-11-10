import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, PointerEvent as ReactPointerEvent, ReactNode } from 'react';
import { useDirector } from '@/app/director-context';
import { goArchive } from '@/features/archive/links';
import type { Archive } from '@/data/archive';
import { monthYear } from '@/lib/dates';
import { useMobile } from '@/lib/useMedia';
import { appStore } from '@/state/app-state';
import { ownerStore } from '@/state/owner';
import { useStore } from '@/state/store';
import {
  albumTime,
  edgeSpeed,
  isReached,
  nearestIndex,
  rangeLabel,
  span,
  stamp,
  timeAt,
  within,
} from '@/timeline/range';
import styles from './Timeline.module.css';

const NOTE_MS = 1800;
/** A press moves this far before it counts as a drag. */
const PICK_DRAG_PX = 4;

/** ▶ plays; press and drag picks a range; a click picks up to a point; a year picks the year. */
export function Timeline({ archive }: { archive: Archive }) {
  const director = useDirector();
  const range = useStore(appStore, (s) => s.range);
  const picking = useStore(appStore, (s) => s.picking);
  const focus = useStore(appStore, (s) => s.focus);
  const flying = useStore(appStore, (s) => s.flying);
  const endCard = useStore(appStore, (s) => s.endCard);
  const progress = useStore(appStore, (s) => s.progress);
  const playing = useStore(appStore, (s) => s.playing);

  // the archive keeps its identity through an edit, so these are worked out on every render
  useStore(ownerStore, (state) => state.rev);
  const times = archive.albums.map(albumTime);
  const bounds = span(times);
  const [y0, y1] = bounds;
  const years = useMemo(() => Array.from({ length: y1 - y0 }, (_, i) => y0 + i), [y0, y1]);
  const pos = (t: number) => ((t - y0) / (y1 - y0)) * 100;

  const track = useRef<HTMLDivElement>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const pick = useRef<{ x: number; moved: boolean } | null>(null);
  // on a phone the track is too short to aim at: a tap grows it into a strip that scrolls, and
  // the ends of a range are then stretched and narrowed by their handles
  const mobile = useMobile();
  const [grown, setGrown] = useState(false);
  const zoomed = mobile && grown;
  const grownAt = useRef(0.5);
  const [drag, setDrag] = useState<{
    which: 'a' | 'b';
    anchor: number;
    t: number;
    x: number;
  } | null>(null);
  const finger = useRef<number | null>(null);
  const noteTimer = useRef(0);
  const [note, setNote] = useState<string | null>(null);
  const [tip, setTip] = useState<{ left: number; text: string } | null>(null);

  const flash = (text: string) => {
    setNote(text);
    clearTimeout(noteTimer.current);
    noteTimer.current = window.setTimeout(() => setNote(null), NOTE_MS);
  };

  const timeFor = (clientX: number): number => {
    const rect = track.current?.getBoundingClientRect();
    return rect ? timeAt(clientX - rect.left, rect.width, times, bounds) : y0;
  };

  // the strip opens with the tapped year in the middle of the screen
  useLayoutEffect(() => {
    const box = scroller.current;
    if (!zoomed || !box) return;
    box.scrollLeft = grownAt.current * box.scrollWidth - box.clientWidth / 2;
  }, [zoomed]);

  // a handle held near an edge of the strip carries the strip along, so a range can be stretched
  // past what is on the screen
  const holding = drag !== null;
  const fingerAt = drag?.x ?? null;
  useEffect(() => {
    finger.current = fingerAt;
  }, [fingerAt]);
  useEffect(() => {
    if (!holding) return;
    let frame = 0;
    const tick = () => {
      const box = scroller.current;
      const rect = track.current?.getBoundingClientRect();
      const x = finger.current;
      if (box && rect && x !== null) {
        const edge = box.getBoundingClientRect();
        const speed = edgeSpeed(x, edge.left, edge.right);
        if (speed !== 0) {
          box.scrollLeft += speed;
          const t = timeAt(x - rect.left, rect.width, times, bounds);
          setDrag((current) => (current ? { ...current, t } : current));
          director.movePick(t);
        }
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [holding, director, times, bounds]);

  // the strip opens with the picked place in the middle of the screen
  const grow = (t: number) => {
    grownAt.current = (t - y0) / (y1 - y0);
    setGrown(true);
  };

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    if (zoomed) {
      // a drag on the strip scrolls it, so a range is picked by a tap and its handles
      pick.current = { x: event.clientX, moved: false };
      return;
    }
    event.currentTarget.setPointerCapture(event.pointerId);
    pick.current = { x: event.clientX, moved: false };
    director.beginPick(timeFor(event.clientX));
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const rect = track.current?.getBoundingClientRect();
    if (rect) {
      const t = y0 + ((event.clientX - rect.left) / rect.width) * (y1 - y0);
      const index = nearestIndex(t, times);
      const album = archive.albums[index];
      if (album)
        setTip({ left: pos(times[index] ?? y0), text: `${album.city.name} · ${monthYear(album)}` });
    }
    const current = pick.current;
    if (!current) return;
    if (Math.abs(event.clientX - current.x) > PICK_DRAG_PX) current.moved = true;
    if (!zoomed) director.movePick(timeFor(event.clientX));
  };

  const onPointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    const current = pick.current;
    if (!current) return;
    pick.current = null;
    if (zoomed) {
      if (current.moved) return;
      const t = timeFor(event.clientX);
      director.beginPick(t);
      if (director.endPick(t, false) === 'empty') flash('No albums in that stretch');
      return;
    }
    const t = timeFor(event.clientX);
    if (director.endPick(t, current.moved) === 'empty') flash('No albums in that stretch');
    // on a phone the first touch also grows the strip around what it picked
    if (mobile) grow(t);
  };

  const onPointerCancel = () => {
    pick.current = null;
    // a scroll of the strip is not a pick: it must not throw away the range
    if (!zoomed) director.cancelPick();
  };

  const startHandle = (event: ReactPointerEvent<HTMLDivElement>, which: 'a' | 'b') => {
    const at = range ?? picking;
    if (!at) return;
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    const anchor = which === 'a' ? at.hi : at.lo;
    const t = which === 'a' ? at.lo : at.hi;
    setDrag({ which, anchor, t, x: event.clientX });
    director.beginPick(anchor);
    director.movePick(t);
  };

  const moveHandle = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!drag) return;
    const t = timeFor(event.clientX);
    setDrag({ ...drag, t, x: event.clientX });
    director.movePick(t);
  };

  const endHandle = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!drag) return;
    setDrag(null);
    if (director.endPick(timeFor(event.clientX), true) === 'empty')
      flash('No albums in that stretch');
  };

  const onYear = (year: number) => {
    // on a phone the first tap grows the strip and picks the year; it never opens the archive
    const first = mobile && !grown;
    const result = director.clickYear(year, !first);
    if (result === 'empty') flash('No albums that year');
    else if (result === 'open') goArchive({ kind: 'year', year });
    else if (first) grow(year + 0.5);
  };

  const live = picking ?? range;
  const progressState = { on: progress, focus, ahead: flying && endCard === null, range };
  const focusTime = focus >= 0 ? times[focus] : undefined;
  const from = range ? pos(range.lo) : 0;
  const done = progress && focusTime !== undefined ? Math.max(0, pos(focusTime) - from) : 0;
  const count = range ? times.filter((t) => within(t, range)).length : 0;
  const focusYear = archive.albums[focus]?.year;

  let chip: ReactNode = null;
  if (range) {
    chip = (
      <>
        <b>{rangeLabel(range)}</b> {count} album{count === 1 ? '' : 's'} <i>✕</i>
      </>
    );
  } else if (picking) {
    chip = (
      <>
        <b>
          {stamp(picking.lo)} – {stamp(picking.hi)}
        </b>{' '}
        <i>release to pick</i>
      </>
    );
  } else if (note) {
    chip = <i>{note}</i>;
  }

  // while a handle is dragged the two ends are the anchor and the finger, in a fixed order
  const ends: { id: 'a' | 'b'; t: number }[] = drag
    ? [
        { id: 'a', t: drag.which === 'a' ? drag.t : drag.anchor },
        { id: 'b', t: drag.which === 'b' ? drag.t : drag.anchor },
      ]
    : live
      ? [
          { id: 'a', t: live.lo },
          { id: 'b', t: live.hi },
        ]
      : [];

  return (
    <div className={`${styles.timeline}${zoomed ? ` ${styles.zoom}` : ''}`}>
      <div className={styles.chips}>
        {zoomed && (
          <button type="button" className={styles.shrink} onClick={() => setGrown(false)}>
            Done
          </button>
        )}
        <button
          type="button"
          className={`${styles.chip}${chip ? ` ${styles.isOn}` : ''}`}
          onClick={() => director.clearRange()}
          tabIndex={range ? 0 : -1}
          aria-label={range ? `Clear the range ${rangeLabel(range)}` : undefined}
        >
          {chip}
        </button>
      </div>
      <div className={styles.row}>
        <button
          type="button"
          className={styles.play}
          // while the strip is grown the range is being chosen: Done gives play back
          disabled={zoomed}
          onClick={() => director.play()}
          aria-label={playing ? 'Pause' : 'Play'}
        >
          {playing ? '❚❚' : '▶'}
        </button>
        <div ref={scroller} className={styles.scroll}>
          <div
            ref={track}
            className={styles.track}
            style={{ '--years': years.length } as CSSProperties}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerCancel}
            onPointerLeave={() => setTip(null)}
          >
            <div
              className={`${styles.band}${live ? ` ${styles.isOn}` : ''}${picking ? ` ${styles.isPending}` : ''}`}
              style={
                live
                  ? {
                      left: `calc(${pos(live.lo)}% - 9px)`,
                      width: `calc(${pos(live.hi) - pos(live.lo)}% + 18px)`,
                    }
                  : undefined
              }
            />
            <div className={styles.base} />
            <div className={styles.done} style={{ left: `${from}%`, width: `${done}%` }} />
            {years.slice(1).map((year) => (
              <div key={`sep-${year}`} className={styles.sep} style={{ left: `${pos(year)}%` }} />
            ))}
            {times.map((t, k) => {
              const past = isReached(k, t, progressState);
              const inLive = live !== null && within(t, live);
              const classes = [
                styles.dot,
                past ? styles.isPast : '',
                !past && inLive ? styles.isAhead : '',
                live && !inLive && !past ? styles.isOut : '',
              ].join(' ');
              return <div key={k} className={classes} style={{ left: `${pos(t)}%` }} />;
            })}
            {years.map((year) => (
              <button
                key={year}
                type="button"
                className={[
                  styles.year,
                  year === focusYear ? styles.isCurrent : '',
                  range && range.lo < year + 1 && range.hi >= year ? styles.isIn : '',
                ].join(' ')}
                style={{ left: `${pos(year + 0.5)}%` }}
                onPointerDown={(event) => event.stopPropagation()}
                onClick={() => onYear(year)}
              >
                <span className={styles.full}>{year}</span>
                <span className={styles.short}>’{String(year).slice(2)}</span>
              </button>
            ))}
            <div
              className={styles.knob}
              style={{
                left: `${focusTime === undefined ? 0 : pos(focusTime)}%`,
                opacity: focusTime === undefined ? 0 : 1,
              }}
            />
            {zoomed &&
              ends.map((end) => (
                <div
                  key={end.id}
                  className={styles.handle}
                  style={{ left: `${pos(end.t)}%` }}
                  onPointerDown={(event) => startHandle(event, end.id)}
                  onPointerMove={moveHandle}
                  onPointerUp={endHandle}
                  onPointerCancel={() => {
                    setDrag(null);
                    director.cancelPick();
                  }}
                />
              ))}
            {tip && (
              <div className={styles.tip} style={{ left: `${tip.left}%` }}>
                {tip.text}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
