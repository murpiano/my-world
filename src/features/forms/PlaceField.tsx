import { useEffect, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import type { Archive } from '@/data/archive';
import { loadCities } from '@/data/cities';
import { browsePlaces, searchPlaces } from '@/data/places';
import type { Listed, PickedPlace } from '@/data/places';
import { placeLabel } from './fields';
import { Field } from './Sheet';
import styles from './PlaceField.module.css';

/** Height of one row, and how many rows past the edge are drawn so a fast scroll shows no gap. */
const ROW = 46;
const SPARE = 4;
/** A search shows this many of the best matches; the list to scroll is the whole world. */
const FOUND = 400;

/** The cities of the world, once they have come in; before that the field uses a short list. */
const useCities = (): Listed[] | undefined => {
  const [cities, setCities] = useState<Listed[]>();
  useEffect(() => {
    let live = true;
    loadCities().then(
      (list) => live && setCities(list),
      () => undefined,
    );
    return () => {
      live = false;
    };
  }, []);
  return cities;
};

/** What the home row stands for: the field can offer the home base as its first choice. */
export interface HomeChoice {
  label: string;
  onPick: () => void;
}

/**
 * A city field. Open, it lists every city of the world in alphabetical order (the ones on the
 * map first) to scroll through; typing narrows it to the matches, in English or in Russian.
 */
export function PlaceField({
  id,
  label,
  archive,
  value,
  onPick,
  text: shown,
  home,
}: {
  id: string;
  label: string;
  archive: Archive;
  value: PickedPlace | null;
  onPick: (place: PickedPlace | null) => void;
  /** What the box says when nothing was typed and nothing is picked (a home choice, say). */
  text?: string;
  home?: HomeChoice;
}) {
  const [typed, setTyped] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [top, setTop] = useState(0);
  const cities = useCities();
  const list = useRef<HTMLDivElement>(null);
  const listBox = useRef<HTMLDivElement>(null);
  const box = typeof typed === 'string' ? typed : value ? placeLabel(value) : (shown ?? '');
  // a place that is already picked, or a box nobody typed in, shows the whole list, not a search
  const query = typed ?? '';
  const places = useMemo(
    () =>
      query.trim() ? searchPlaces(archive, query, cities, FOUND) : browsePlaces(archive, cities),
    [archive, cities, query],
  );
  const rows = home && !query.trim() ? 1 + places.length : places.length;
  const placeAt = (index: number): PickedPlace | null =>
    home && !query.trim() ? (places[index - 1] ?? null) : (places[index] ?? null);

  useEffect(() => {
    if (open) list.current?.scrollIntoView({ block: 'nearest' });
  }, [open]);

  const choose = (index: number) => {
    if (home && !query.trim() && index === 0) {
      setTyped(null);
      setOpen(false);
      home.onPick();
      return;
    }
    const place = placeAt(index);
    if (!place) return;
    setTyped(null);
    setOpen(false);
    onPick(place);
  };

  const move = (to: number) => {
    const next = Math.max(0, Math.min(rows - 1, to));
    setActive(next);
    const box = listBox.current;
    if (!box) return;
    if (next * ROW < box.scrollTop) box.scrollTop = next * ROW;
    else if ((next + 1) * ROW > box.scrollTop + box.clientHeight) {
      box.scrollTop = (next + 1) * ROW - box.clientHeight;
    }
  };

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setOpen(true);
      move(active + 1);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      move(active - 1);
    } else if (event.key === 'Enter' && open && rows > 0) {
      event.preventDefault();
      choose(active);
    } else if (event.key === 'Escape' && open) {
      // closes the list; the sheet stays
      event.stopPropagation();
      setOpen(false);
    }
  };

  const first = Math.max(0, Math.floor(top / ROW) - SPARE);
  const last = Math.min(rows, Math.ceil((top + 300) / ROW) + SPARE);
  const visible = Array.from({ length: Math.max(0, last - first) }, (_, k) => first + k);

  return (
    <Field label={label} htmlFor={id}>
      <input
        id={id}
        autoComplete="off"
        role="combobox"
        aria-expanded={open}
        aria-controls={`${id}-list`}
        placeholder="Pick from the list or start typing a city"
        value={box}
        onChange={(event) => {
          setTyped(event.target.value);
          setOpen(true);
          setActive(0);
          setTop(0);
          listBox.current?.scrollTo({ top: 0 });
          onPick(null);
        }}
        onFocus={(event) => {
          setOpen(true);
          event.target.select();
        }}
        onClick={() => setOpen(true)}
        onBlur={() => {
          setTimeout(() => setOpen(false), 150);
          setTyped(null);
        }}
        onKeyDown={onKeyDown}
      />
      <span className={styles.chev} aria-hidden="true" />
      {open && rows > 0 && (
        <div className={styles.dropWrap} ref={list}>
          <div
            id={`${id}-list`}
            className={styles.list}
            ref={listBox}
            role="listbox"
            onScroll={(event) => setTop(event.currentTarget.scrollTop)}
          >
            <div style={{ height: rows * ROW }}>
              {visible.map((index) => {
                const isHome = home && !query.trim() && index === 0;
                const place = isHome ? null : placeAt(index);
                return (
                  <button
                    key={index}
                    type="button"
                    role="option"
                    aria-selected={index === active}
                    className={index === active ? styles.isActive : undefined}
                    style={{ top: index * ROW, height: ROW }}
                    // pointerdown, not click: the field's blur would take the list away first
                    onPointerDown={(event) => {
                      event.preventDefault();
                      choose(index);
                    }}
                    onPointerEnter={() => setActive(index)}
                  >
                    {isHome && home ? (
                      <>
                        {home.label}
                        <small>your home base</small>
                      </>
                    ) : (
                      place && (
                        <>
                          {place.name}
                          <small>
                            {place.ru ? `${place.ru} · ` : ''}
                            {place.country}
                            {place.cityKey ? ' · on your map' : ''}
                          </small>
                        </>
                      )
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </Field>
  );
}
