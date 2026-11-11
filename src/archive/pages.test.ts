import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { linkArchive } from '@/data/archive';
import { buildDemo, DEMO_HOME } from '@/data/demo';
import type { ArchiveData, Credit } from '@/data/types';
import {
  albumsByYear,
  coverOf,
  dateSpan,
  findPage,
  folderPhotos,
  journeyOfAlbum,
  journeys,
  tripRoute,
  whenLabel,
} from './pages';

const file = fileURLToPath(new URL('../../public/demo/photos.json', import.meta.url));
const demoData = buildDemo(JSON.parse(readFileSync(file, 'utf8')) as Credit[]);
const archive = linkArchive(demoData);
const album = (title: string) => {
  const found = archive.albums.find((a) => a.title === title);
  if (!found) throw new Error(title);
  return found;
};

describe('journeys', () => {
  it('lists the trips newest first', () => {
    const list = journeys(archive);
    expect(list).toHaveLength(10);
    expect(list[0]?.name).toBe('Barcelona in March');
    expect(list[list.length - 1]?.name).toBe('Mediterranean autumn');
    expect(list.every((j) => j.real)).toBe(true);
  });

  it('shows an album in no trip as a trip of its own, and an empty trip on top', () => {
    const data: ArchiveData = {
      countries: demoData.countries,
      trips: [
        { id: 'empty', name: 'Someday', start: { home: true }, end: { home: true }, albumIds: [] },
        ...demoData.trips.slice(1),
      ],
    };
    const list = journeys(linkArchive(data));
    expect(list[0]?.name).toBe('Someday');
    const own = list.find((j) => !j.real && j.name === 'Athens 2016');
    expect(own?.albums.map((a) => a.title)).toEqual(['Acropolis at sunrise']);
    expect(list.filter((j) => !j.real)).toHaveLength(4);
  });

  it('finds the trip of an album', () => {
    expect(journeyOfAlbum(archive, album('Acropolis at sunrise').id)?.name).toBe(
      'Mediterranean autumn',
    );
  });
});

describe('labels', () => {
  it('spans a month, months of a year, or years', () => {
    expect(dateSpan([album('Acropolis at sunrise')])).toBe('Sep 2016');
    expect(dateSpan([album('Acropolis at sunrise'), album('Tram 28 and tiles')])).toBe(
      'Sep – Nov 2016',
    );
    expect(dateSpan([album('Acropolis at sunrise'), album('Amber coast')])).toBe(
      'Sep 2016 – Apr 2020',
    );
    expect(dateSpan([])).toBe('no albums yet');
  });

  it('names a moment and counts', () => {
    const a = album('Tram 28 and tiles');
    expect(whenLabel(a)).toBe(`${a.day} Nov 2016, ${a.time}`);
  });
});

describe('tripRoute', () => {
  it('goes from the start through each place once to the end', () => {
    const south = journeys(archive).find((j) => j.name === 'South America and the ice');
    if (!south) throw new Error('no trip');
    const route = tripRoute(south, archive, DEMO_HOME);
    const home = 'home · Saint Petersburg, Russia';
    expect(route[0]).toEqual({ n: 0, label: 'Start', place: home, albums: [] });
    expect(route.slice(1, -1).map((s) => s.label)).toEqual([
      'Rio de Janeiro',
      'Montevideo',
      'Bellingshausen Station',
      'Buenos Aires',
      'Kaliningrad',
    ]);
    expect(route.slice(1, -1).flatMap((s) => s.albums)).toHaveLength(7);
    expect(route[route.length - 1]).toEqual({ n: 6, label: 'End', place: home, albums: [] });
  });
});

describe('groups and photos', () => {
  it('groups albums by year, latest first, each year by date', () => {
    const groups = albumsByYear(archive.albums);
    expect(groups.map((g) => g.year)).toEqual([
      2026, 2025, 2024, 2023, 2022, 2021, 2020, 2019, 2018, 2017, 2016,
    ]);
    expect(groups.map((g) => g.albums.length)).toEqual([1, 1, 2, 2, 1, 1, 5, 2, 2, 1, 4]);
  });

  it('puts up to three photos in a folder, none for an empty album', () => {
    expect(folderPhotos(album('Tram 28 and tiles')).length).toBeLessThanOrEqual(3);
    expect(folderPhotos({ ...album('Tram 28 and tiles'), photos: [] })).toEqual([]);
    expect(
      coverOf([{ ...album('Tram 28 and tiles'), photos: [] }, album('Acropolis at sunrise')]),
    ).toEqual(album('Acropolis at sunrise').photos[0]);
  });
});

describe('findPage', () => {
  it('builds each page, or nothing when its target is gone', () => {
    expect(findPage(archive, { kind: 'trips' }, DEMO_HOME)?.kind).toBe('trips');
    expect(findPage(archive, { kind: 'city', key: 'athens' }, DEMO_HOME)?.kind).toBe('city');
    expect(findPage(archive, { kind: 'year', year: 2020 }, DEMO_HOME)?.kind).toBe('year');
    expect(findPage(archive, { kind: 'city', key: 'atlantis' }, DEMO_HOME)).toBeNull();
    expect(findPage(archive, { kind: 'trip', id: 'gone' }, DEMO_HOME)).toBeNull();
    expect(findPage(archive, { kind: 'album', id: 'gone' }, DEMO_HOME)).toBeNull();
    expect(findPage(archive, { kind: 'year', year: 1990 }, DEMO_HOME)).toBeNull();
  });

  it('counts what a country holds', () => {
    const page = findPage(archive, { kind: 'country', id: '858' }, DEMO_HOME);
    expect(page?.kind === 'country' && page.cities.map((c) => c.name)).toEqual(['Montevideo']);
  });
});
