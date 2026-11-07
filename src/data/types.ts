export type Id = string;

/** A place on Earth: a home base, or a city from the place picker. */
export interface Place {
  name: string;
  country: string;
  /** ISO 3166 numeric code, as in the world map. */
  countryId: string;
  lat: number;
  lon: number;
}

export type PhotoRef =
  /** A bundled demo photo in public/demo/photos. */
  | { kind: 'stock'; file: string; caption?: string }
  /** The owner's photo, a blob in IndexedDB. */
  | { kind: 'own'; id: Id; name: string; caption?: string };

export type Endpoint = { home: true } | { cityKey: Id };

/** An album as stored: plain JSON with no links back up. */
export interface AlbumData {
  id: Id;
  title: string;
  year: number;
  month: number;
  day: number;
  /** "HH:MM", local time. */
  time: string;
  /** Demo albums claim more photos than they carry. */
  photoCount: number;
  photos: PhotoRef[];
}

export interface CityData {
  key: Id;
  name: string;
  lat: number;
  lon: number;
  albums: AlbumData[];
}

export interface CountryData {
  /** ISO 3166 numeric code. */
  id: Id;
  name: string;
  cities: CityData[];
}

/** An album belongs to at most one trip. */
export interface Trip {
  id: Id;
  name: string;
  start: Endpoint;
  end: Endpoint;
  albumIds: Id[];
}

/** Everything the owner keeps, as stored. */
export interface ArchiveData {
  countries: CountryData[];
  trips: Trip[];
}

/** The linked graph the UI reads (see `linkArchive`). */
export interface Country {
  id: Id;
  name: string;
  cities: City[];
}

export interface City {
  key: Id;
  name: string;
  lat: number;
  lon: number;
  country: Country;
  albums: Album[];
}

export interface Album extends AlbumData {
  city: City;
}

export interface User {
  name: string;
  email: string;
  home: Place;
  /** The public handle, with a backend; absent when everything stays in this browser. */
  handle?: string;
}

/** One line of public/demo/photos.json. */
export interface Credit {
  city: string;
  file: string;
  author: string;
  lic: string;
}
