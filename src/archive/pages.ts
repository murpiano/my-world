import type { Archive } from '@/data/archive';
import { byDate } from '@/data/order';
import { endpointPlace } from '@/data/trips';
import type { Album, City, Country, Endpoint, PhotoRef, Place } from '@/data/types';
import { MONTHS } from '@/lib/dates';
import type { ArchivePage } from '@/state/app-state';

/** A trip as the archive lists it; an album in no trip is a trip of its own (`real: false`). */
export interface Journey {
  id: string;
  name: string;
  start: Endpoint;
  end: Endpoint;
  /** Oldest first. */
  albums: Album[];
  real: boolean;
}

const HOME: Endpoint = { home: true };

/** Every trip, newest first; a trip with no albums yet stays on top. */
export const journeys = (archive: Archive): Journey[] => {
  const used = new Set<string>();
  const list: Journey[] = archive.trips.map((trip) => {
    const albums = trip.albumIds
      .map((id) => archive.albumById.get(id))
      .filter((a): a is Album => a !== undefined)
      .sort(byDate);
    for (const album of albums) used.add(album.id);
    return { id: trip.id, name: trip.name, start: trip.start, end: trip.end, albums, real: true };
  });
  for (const album of archive.albums) {
    if (used.has(album.id)) continue;
    list.push({
      id: `a:${album.id}`,
      name: `${album.city.name} ${album.year}`,
      start: HOME,
      end: HOME,
      albums: [album],
      real: false,
    });
  }
  return list.sort((a, b) => {
    const first = a.albums[0];
    const second = b.albums[0];
    if (!first) return -1;
    if (!second) return 1;
    return byDate(second, first);
  });
};

export const journeyOfAlbum = (archive: Archive, albumId: string): Journey | undefined =>
  journeys(archive).find((journey) => journey.albums.some((album) => album.id === albumId));

const month = (album: Album) => MONTHS[album.month - 1] ?? '';

/** "Apr 2022", "Mar – Apr 2019" or "Oct 2017 – Jun 2020". */
export const dateSpan = (albums: Album[]): string => {
  const sorted = [...albums].sort(byDate);
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  if (!first || !last) return 'no albums yet';
  if (first.year === last.year) {
    return first.month === last.month
      ? `${month(first)} ${first.year}`
      : `${month(first)} – ${month(last)} ${first.year}`;
  }
  return `${month(first)} ${first.year} – ${month(last)} ${last.year}`;
};

/** "3 Apr 2022, 10:00". */
export const whenLabel = (album: Album): string =>
  `${album.day} ${month(album)} ${album.year}, ${album.time}`;

export interface RouteStop {
  n: number;
  label: string;
  place: string;
  albums: Album[];
}

const endpointLabel = (end: Endpoint, archive: Archive, home: Place): string => {
  const place = endpointPlace(end, archive, home);
  return place.cityKey === null
    ? `home · ${place.name}, ${place.country}`
    : `${place.name}, ${place.country}`;
};

/** A trip as a route: its start, each place once in the order first reached, its end. */
export const tripRoute = (journey: Journey, archive: Archive, home: Place): RouteStop[] => {
  const cities: City[] = [];
  for (const album of journey.albums) if (!cities.includes(album.city)) cities.push(album.city);
  return [
    { n: 0, label: 'Start', place: endpointLabel(journey.start, archive, home), albums: [] },
    ...cities.map((city, i) => ({
      n: i + 1,
      label: city.name,
      place: city.country.name,
      albums: journey.albums.filter((album) => album.city === city),
    })),
    {
      n: cities.length + 1,
      label: 'End',
      place: endpointLabel(journey.end, archive, home),
      albums: [],
    },
  ];
};

/** Albums grouped by year, the latest year first, each year in date order. */
export const albumsByYear = (albums: Album[]): { year: number; albums: Album[] }[] => {
  const years = [...new Set(albums.map((album) => album.year))].sort((a, b) => b - a);
  return years.map((year) => ({
    year,
    albums: albums.filter((album) => album.year === year).sort(byDate),
  }));
};

/** The three photos a folder holds. */
export const folderPhotos = (album: Album): PhotoRef[] => album.photos.slice(0, 3);

/** The first photo among these albums, for a card's cover. */
export const coverOf = (albums: Album[]): PhotoRef | undefined =>
  albums.find((album) => album.photos.length > 0)?.photos[0];

export type PageData =
  | { kind: 'trips'; journeys: Journey[] }
  | { kind: 'trip'; journey: Journey; route: RouteStop[] }
  | { kind: 'albums'; albums: Album[] }
  | { kind: 'album'; album: Album; journey: Journey | undefined }
  | { kind: 'countries'; countries: Country[] }
  | { kind: 'country'; country: Country; cities: City[] }
  | { kind: 'cities'; cities: City[] }
  | { kind: 'city'; city: City }
  | { kind: 'years'; years: number[] }
  | { kind: 'year'; year: number; albums: Album[] };

const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name);

/** What a page shows, or null when what it points at is gone. */
export const findPage = (archive: Archive, page: ArchivePage, home: Place): PageData | null => {
  switch (page.kind) {
    case 'trips':
      return { kind: 'trips', journeys: journeys(archive) };
    case 'trip': {
      const journey = journeys(archive).find((j) => j.id === page.id);
      return journey ? { kind: 'trip', journey, route: tripRoute(journey, archive, home) } : null;
    }
    case 'albums':
      return { kind: 'albums', albums: archive.albums };
    case 'album': {
      const album = archive.albumById.get(page.id);
      return album ? { kind: 'album', album, journey: journeyOfAlbum(archive, album.id) } : null;
    }
    case 'countries':
      return {
        kind: 'countries',
        countries: archive.countries.filter((c) => c.cities.some((city) => city.albums.length > 0)).sort(byName),
      };
    case 'country': {
      const country = archive.countries.find((c) => c.id === page.id);
      const cities = country?.cities.filter((city) => city.albums.length > 0) ?? [];
      return country && cities.length > 0 ? { kind: 'country', country, cities } : null;
    }
    case 'cities':
      return { kind: 'cities', cities: [...archive.cities].sort(byName) };
    case 'city': {
      const city = archive.cityByKey.get(page.key);
      return city && city.albums.length > 0 ? { kind: 'city', city } : null;
    }
    case 'years':
      return {
        kind: 'years',
        years: [...new Set(archive.albums.map((album) => album.year))].sort((a, b) => b - a),
      };
    case 'year': {
      const albums = archive.albums.filter((album) => album.year === page.year);
      return albums.length > 0 ? { kind: 'year', year: page.year, albums } : null;
    }
  }
};
