import { Fragment, useEffect, useState } from 'react';
import type { World } from '@/app/boot';
import { albumsByYear, coverOf, dateSpan, findPage, folderPhotos, plural, whenLabel } from '@/archive/pages';
import type { Journey, PageData } from '@/archive/pages';
import { visitYears } from '@/data/archive';
import { addPhotos } from '@/data/edits';

import { cityPhotos, photoUrl } from '@/data/photos';
import { describeAlbum, photoKey, photoNote } from '@/data/social';
import type { Album, City, Country, PhotoRef } from '@/data/types';
import { attachPhotos } from '@/features/forms/attach';
import { DropZone } from '@/features/forms/DropZone';
import { MONTHS } from '@/lib/dates';
import { appStore } from '@/state/app-state';
import type { ArchivePage, FormView } from '@/state/app-state';
import { backArchive, closeArchive, openArchive, SECTIONS, sectionOf } from '@/state/archive-nav';
import { openForm, openPhoto } from '@/state/layers';
import { canEdit, editArchive, ownerStore, repository } from '@/state/owner';
import { socialFor, socialStore } from '@/state/social';
import { useStore } from '@/state/store';
import type { Director } from '@/tour/director';
import { showOnMap } from './links';
import styles from './Archive.module.css';

const go = (page: ArchivePage) => openArchive(appStore, page, false);

/** The archive: a full-screen layer over the paused globe. */
export function Archive({ world, director }: { world: World; director: Director }) {
  const view = useStore(appStore, (s) => s.archive);
  // an edit changes the archive in place: this makes the page show it at once
  useStore(ownerStore, (s) => s.rev);
  const owner = canEdit();
  const [shown, setShown] = useState(false);
  const page = view?.stack[view.stack.length - 1];
  const data = page ? findPage(world.archive, page, world.home) : null;

  // fade in after mounting; fade out by dropping the class before the layer goes
  useEffect(() => {
    const id = requestAnimationFrame(() => setShown(view !== null));
    return () => cancelAnimationFrame(id);
  }, [view]);

  // a page whose target is gone steps back
  useEffect(() => {
    if (page && !data) backArchive(appStore);
  }, [page, data]);

  if (!view || !page || !data) return null;

  const header = headerOf(data);
  return (
    <section
      className={`${styles.archive}${shown ? ` ${styles.isOn}` : ''}${view.slow ? ` ${styles.isSlow}` : ''}`}
      data-archive-root
      aria-label="Archive"
    >
      <div className={styles.head}>
        <div className={styles.bar}>
          <button type="button" className={styles.round} aria-label="Close" onClick={() => closeArchive(appStore)}>
            ✕
          </button>
          {view.stack.length > 1 && (
            <button type="button" className={styles.round} aria-label="Back" onClick={() => backArchive(appStore)}>
              ←
            </button>
          )}
          <nav className={styles.tabs}>
            {SECTIONS.map((section) => (
              <button
                key={section.key}
                type="button"
                className={sectionOf(view.stack[0] ?? page) === section.key ? styles.isOn : undefined}
                onClick={() => openArchive(appStore, { kind: section.key }, true)}
              >
                {section.label}
              </button>
            ))}
          </nav>
        </div>
        <div className={styles.text} key={JSON.stringify(page)}>
          {header.crumbs.length > 0 && (
            <div className={styles.crumbs}>
              {header.crumbs.map(([label, to], i) => (
                <span key={label}>
                  {i > 0 && <i>›</i>}
                  <button type="button" onClick={() => go(to)}>
                    {label}
                  </button>
                </span>
              ))}
            </div>
          )}
          <h2>{header.title}</h2>
          {header.sub && <p className={styles.sub}>{header.sub}</p>}
          {(header.map || owner) && (
            <div className={styles.acts}>
              {header.map && (
                <button
                  type="button"
                  className={`${styles.btn} ${styles.isStar}`}
                  onClick={() => header.map && showOnMap(director, header.map)}
                >
                  ◎ Show on map
                </button>
              )}
              {owner &&
                editsOf(data).map((edit) => (
                  <button
                    key={edit.label}
                    type="button"
                    className={styles.btn}
                    onClick={() => openForm(appStore, edit.form)}
                  >
                    {edit.label}
                  </button>
                ))}
            </div>
          )}
        </div>
      </div>
      <div
        className={`${styles.grid}${data.kind === 'album' ? ` ${styles.photosGrid}` : ''}`}
        key={`grid-${JSON.stringify(page)}`}
      >
        <PageBody data={data} world={world} owner={owner} />
      </div>
    </section>
  );
}

interface Header {
  crumbs: [string, ArchivePage][];
  title: string;
  sub: string;
  map: Parameters<typeof showOnMap>[1] | null;
}

const headerOf = (data: PageData): Header => {
  const photos = (albums: Album[]) => albums.reduce((sum, a) => sum + a.photoCount, 0);
  switch (data.kind) {
    case 'trips':
      return { crumbs: [], title: 'Trips', sub: plural(data.journeys.length, 'trip'), map: null };
    case 'trip': {
      const { journey } = data;
      const places = new Set(journey.albums.map((a) => a.city)).size;
      const start = data.route[0]?.place.replace(/^home · .*/, 'home') ?? 'home';
      const end = data.route[data.route.length - 1]?.place.replace(/^home · .*/, 'home') ?? 'home';
      return {
        crumbs: [['Trips', { kind: 'trips' }]],
        title: journey.name,
        sub: `${dateSpan(journey.albums)} · ${plural(places, 'place')} · ${plural(photos(journey.albums), 'photo')} · from ${start} to ${end}`,
        map: journey.albums.length > 0 && journey.real ? { kind: 'trip', id: journey.id } : null,
      };
    }
    case 'albums':
      return {
        crumbs: [],
        title: 'Albums',
        sub: `${plural(data.albums.length, 'album')} · ${plural(photos(data.albums), 'photo')}`,
        map: null,
      };
    case 'album': {
      const { album, journey } = data;
      const crumbs: [string, ArchivePage][] = [
        [album.city.country.name, { kind: 'country', id: album.city.country.id }],
        [album.city.name, { kind: 'city', key: album.city.key }],
      ];
      if (journey?.real) crumbs.push([`Trip: ${journey.name}`, { kind: 'trip', id: journey.id }]);
      return {
        crumbs,
        title: album.title,
        sub: `${whenLabel(album)} · ${describeAlbum(album)}`,
        map: { kind: 'album', id: album.id },
      };
    }
    case 'countries':
      return { crumbs: [], title: 'Countries', sub: plural(data.countries.length, 'country'), map: null };
    case 'country': {
      const albums = data.cities.reduce((n, c) => n + c.albums.length, 0);
      return {
        crumbs: [['Countries', { kind: 'countries' }]],
        title: data.country.name,
        sub: `${plural(data.cities.length, 'city')} · ${plural(albums, 'album')}`,
        map: null,
      };
    }
    case 'cities':
      return { crumbs: [], title: 'Cities', sub: plural(data.cities.length, 'place'), map: null };
    case 'city':
      return {
        crumbs: [
          ['Cities', { kind: 'cities' }],
          [data.city.country.name, { kind: 'country', id: data.city.country.id }],
        ],
        title: data.city.name,
        sub: `${plural(data.city.albums.length, 'album')} · ${plural(photos(data.city.albums), 'photo')}`,
        map: null,
      };
    case 'years':
      return { crumbs: [], title: 'Years', sub: plural(data.years.length, 'year'), map: null };
    case 'year':
      return {
        crumbs: [['Years', { kind: 'years' }]],
        title: `${data.year} · ${plural(data.albums.length, 'album')}`,
        sub: '',
        map: { kind: 'year', year: data.year },
      };
  }
};

/** What the owner can start from this page. */
const editsOf = (data: PageData): { label: string; form: FormView }[] => {
  const newAlbum = (cityKey: string | null, tripId: string | null) => ({
    label: '+ New album',
    form: { kind: 'album', id: null, cityKey, tripId } as FormView,
  });
  switch (data.kind) {
    case 'trips':
      return [{ label: '+ New trip', form: { kind: 'trip', id: null, albumIds: [] } }];
    case 'trip':
      return [
        {
          label: '✎ Edit trip',
          form: { kind: 'trip', id: data.journey.id, albumIds: data.journey.albums.map((a) => a.id) },
        },
        newAlbum(null, data.journey.real ? data.journey.id : null),
      ];
    case 'city':
      return [newAlbum(data.city.key, null)];
    case 'album':
      return [
        { label: '✎ Edit album', form: { kind: 'album', id: data.album.id, cityKey: null, tripId: null } },
      ];
    default:
      return [newAlbum(null, null)];
  }
};

function PageBody({ data, world, owner }: { data: PageData; world: World; owner: boolean }) {
  switch (data.kind) {
    case 'trips':
      return <>{data.journeys.map((journey) => <TripCard key={journey.id} journey={journey} />)}</>;
    case 'trip':
      return (
        <>
          {data.route.map((stop) => (
            <Fragment key={`stop-${stop.n}`}>
              <div className={styles.stop}>
                <i>{String(stop.n).padStart(2, '0')}</i>
                <b>{stop.label}</b>
                <span>{stop.place}</span>
              </div>
              {stop.albums.map((album) => (
                <Folder key={album.id} album={album} showCity={false} />
              ))}
            </Fragment>
          ))}
        </>
      );
    case 'albums':
      return <YearGroups albums={data.albums} showCity />;
    case 'album':
      return <PhotoGrid album={data.album} owner={owner} />;
    case 'countries':
      return <>{data.countries.map((country) => <CountryCard key={country.id} country={country} />)}</>;
    case 'country':
      return <>{data.cities.map((city) => <CityCard key={city.key} city={city} />)}</>;
    case 'cities':
      return <>{data.cities.map((city) => <CityCard key={city.key} city={city} />)}</>;
    case 'city':
      return <YearGroups albums={data.city.albums} showCity={false} />;
    case 'years':
      return <>{data.years.map((year) => <YearCard key={year} year={year} world={world} />)}</>;
    case 'year':
      return (
        <>
          {[...data.albums].map((album) => (
            <Folder key={album.id} album={album} showCity />
          ))}
        </>
      );
  }
}

function YearGroups({ albums, showCity }: { albums: Album[]; showCity: boolean }) {
  return (
    <>
      {albumsByYear(albums).map((group) => (
        <Fragment key={group.year}>
          <div className={styles.year}>{group.year}</div>
          {group.albums.map((album) => (
            <Folder key={album.id} album={album} showCity={showCity} />
          ))}
        </Fragment>
      ))}
    </>
  );
}

function Cover({ photo }: { photo: PhotoRef | undefined }) {
  const url = photo ? photoUrl(photo) : null;
  // alt="": every caller renders this beside the card's own name/date, which says what it is
  return url ? <img src={url} alt="" loading="lazy" /> : null;
}

function TripCard({ journey }: { journey: Journey }) {
  const places = [...new Set(journey.albums.map((a) => a.city.name))];
  return (
    <button type="button" className={styles.card} onClick={() => go({ kind: 'trip', id: journey.id })}>
      <Cover photo={coverOf(journey.albums)} />
      <div>
        <b>{journey.name}</b>
        <span>
          {dateSpan(journey.albums)}
          {places.length > 0 ? ` · ${places.join(', ')}` : ''}
        </span>
      </div>
    </button>
  );
}

function CountryCard({ country }: { country: Country }) {
  const cities = country.cities.filter((c) => c.albums.length > 0);
  const albums = cities.reduce((n, c) => n + c.albums.length, 0);
  return (
    <button type="button" className={styles.card} onClick={() => go({ kind: 'country', id: country.id })}>
      <Cover photo={coverOf(cities.flatMap((c) => c.albums))} />
      <div>
        <b>{country.name}</b>
        <span>
          {plural(cities.length, 'city')} · {plural(albums, 'album')}
        </span>
      </div>
    </button>
  );
}

function CityCard({ city }: { city: City }) {
  const years = visitYears(city);
  const first = years[0];
  const last = years[years.length - 1];
  return (
    <button type="button" className={styles.card} onClick={() => go({ kind: 'city', key: city.key })}>
      <Cover photo={cityPhotos(city)[0]} />
      <div>
        <b>{city.name}</b>
        <span>
          {plural(city.albums.length, 'album')} · {first}
          {last !== undefined && last !== first ? `–${last}` : ''}
        </span>
      </div>
    </button>
  );
}

function YearCard({ year, world }: { year: number; world: World }) {
  const albums = world.archive.albums.filter((a) => a.year === year);
  const places = new Set(albums.map((a) => a.city)).size;
  return (
    <button
      type="button"
      className={`${styles.card} ${styles.yearCard}`}
      onClick={() => go({ kind: 'year', year })}
    >
      <Cover photo={coverOf(albums)} />
      <div>
        <b>{year}</b>
        <span>
          {plural(albums.length, 'album')} · {plural(places, 'place')}
        </span>
      </div>
    </button>
  );
}

/** A stack of three photos in a folder that fans out on hover. */
function Folder({ album, showCity }: { album: Album; showCity: boolean }) {
  const photos = [...folderPhotos(album)].reverse();
  return (
    <button type="button" className={styles.folder} onClick={() => go({ kind: 'album', id: album.id })}>
      <div className={styles.stack}>
        {/* alt="": the title/date below in .front already says what this album is */}
        {photos.map((photo, i) => (
          <img key={i} src={photoUrl(photo) ?? undefined} alt="" loading="lazy" />
        ))}
        <div className={styles.front}>
          <b>{album.title}</b>
          <span>
            {showCity ? `${album.city.name} · ` : ''}
            {album.day} {MONTHS[album.month - 1]} {album.year} · {plural(album.photoCount, 'photo')}
          </span>
        </div>
      </div>
    </button>
  );
}

function PhotoGrid({ album, owner }: { album: Album; owner: boolean }) {
  useStore(socialStore, (s) => s.byKey);
  const [trouble, setTrouble] = useState<string | null>(null);
  const add = async (files: File[]) => {
    const repo = repository();
    if (!repo) return;
    setTrouble(null);
    let kept: { refs: PhotoRef[]; skipped: string[] };
    try {
      // the photos are kept before the album is touched, so a bad file changes nothing
      kept = await attachPhotos(files, repo);
    } catch {
      setTrouble('The photos could not be kept. Your browser may be out of room.');
      return;
    }
    if (kept.refs.length > 0) {
      try {
        await editArchive((data) => addPhotos(data, album.id, kept.refs));
      } catch {
        await repo.dropPhotos(kept.refs);
        setTrouble('The photos could not be kept. Your browser may be out of room.');
        return;
      }
    }
    if (kept.skipped.length > 0) {
      setTrouble(`${kept.skipped.join(', ')} could not be read as an image.`);
    }
  };
  const zone = owner ? (
    <div className={styles.add}>
      <DropZone onFiles={(files) => void add(files)} />
      {trouble && <p className={styles.sub}>{trouble}</p>}
    </div>
  ) : null;
  if (album.photos.length === 0) {
    return (
      <>
        <p className={styles.sub}>No photos yet.</p>
        {zone}
      </>
    );
  }
  return (
    <>
      {album.photos.map((photo, index) => {
        const key = photoKey(photo);
        const social = socialFor(key);
        const open = (element: HTMLElement) => {
          const frame = element.querySelector('[data-photo-frame]');
          if (!frame) return;
          const { x, y, width, height } = frame.getBoundingClientRect();
          openPhoto(appStore, album.id, index, { x, y, width, height });
        };
        return (
          // the tile opens the photo; the owner's pencil is a button of its own beside it
          <div key={key} className={styles.pic}>
            <button type="button" className={styles.open} onClick={(event) => open(event.currentTarget)}>
              <div className={styles.photo} data-photo-frame>
                {/* alt="": the caption paragraph right below is the owner's own note on this photo */}
                <img src={photoUrl(photo) ?? undefined} alt="" loading="lazy" data-photo-key={key} />
                <div className={styles.meta}>
                  <span>
                    {social.liked ? '♥' : '♡'} {social.likes}
                  </span>
                  <span>{plural(social.comments.length, 'comment')}</span>
                </div>
              </div>
              <p className={styles.cap}>{photoNote(photo)}</p>
            </button>
            {owner && (
              <button
                type="button"
                className={styles.pencil}
                aria-label="Edit photo"
                onClick={() => openForm(appStore, { kind: 'photo', albumId: album.id, photoKey: key })}
              >
                ✎
              </button>
            )}
          </div>
        );
      })}
      {zone}
    </>
  );
}
