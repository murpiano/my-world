import { useState } from 'react';
import type { World } from '@/app/boot';
import { addAlbum, addPhotos, deleteAlbum, freshId, updateAlbum } from '@/data/edits';

import type { PickedPlace } from '@/data/places';
import type { PhotoRef } from '@/data/types';
import { editArchive, repository } from '@/state/owner';
import { attachPhotos } from './attach';
import { ConfirmButton } from './ConfirmButton';
import { DropZone } from './DropZone';
import { dateInput, parseDate } from './fields';
import { PlaceField } from './PlaceField';
import { PrivacyField } from './PrivacyField';
import { Acts, Sheet } from './Sheet';

const today = (): string => {
  const now = new Date();
  return dateInput({ year: now.getFullYear(), month: now.getMonth() + 1, day: now.getDate() });
};

/** New or edit: a title, a place, a day and a trip. A new place becomes a new light. */
export function AlbumForm({
  world,
  id,
  cityKey,
  tripId,
  onClose,
}: {
  world: World;
  id: string | null;
  cityKey: string | null;
  tripId: string | null;
  onClose: () => void;
}) {
  const { archive } = world;
  const album = id ? (archive.albumById.get(id) ?? null) : null;
  const city = album?.city ?? (cityKey ? (archive.cityByKey.get(cityKey) ?? null) : null);
  const [title, setTitle] = useState(album?.title ?? '');
  const [date, setDate] = useState(album ? dateInput(album) : today());
  const [time, setTime] = useState(album?.time ?? '12:00');
  const [trip, setTrip] = useState(
    album
      ? (archive.trips.find((one) => one.albumIds.includes(album.id))?.id ?? '')
      : (tripId ?? ''),
  );
  const [place, setPlace] = useState<PickedPlace | null>(
    city
      ? {
          name: city.name,
          country: city.country.name,
          countryId: city.country.id,
          lat: city.lat,
          lon: city.lon,
          cityKey: city.key,
        }
      : null,
  );
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [trouble, setTrouble] = useState<string | null>(null);

  const when = parseDate(date);
  const ready = Boolean(title.trim() && place && when) && !busy;

  const submit = async () => {
    if (!place || !when) return;
    setBusy(true);
    setTrouble(null);
    const fields = {
      title: title.trim(),
      ...when,
      time: time || '12:00',
      place,
      tripId: trip || null,
    };

    if (album) {
      try {
        await editArchive((data) => updateAlbum(data, album.id, fields));
      } catch {
        setBusy(false);
        setTrouble('The album could not be saved. Your browser may be out of room.');
        return;
      }
      onClose();
      return;
    }

    // the photos are made smaller and kept first: the album is added only once they are all in,
    // so a file that cannot be read, or a browser out of room, leaves nothing half made
    const repo = repository();
    let refs: PhotoRef[] = [];
    if (repo && files.length > 0) {
      let skipped: string[] = [];
      try {
        ({ refs, skipped } = await attachPhotos(files, repo));
      } catch {
        setBusy(false);
        setTrouble('The photos could not be kept. Your browser may be out of room.');
        return;
      }
      if (skipped.length > 0) {
        setFiles(files.filter((file) => !skipped.includes(file.name)));
        setBusy(false);
        setTrouble(
          `${skipped.join(', ')} could not be read as an image. Nothing was saved; press "Create album" again for the rest.`,
        );
        return;
      }
    }

    try {
      await editArchive((data) => {
        const made = addAlbum(data, freshId('a'), fields);
        addPhotos(data, made.id, refs);
      });
    } catch {
      await repo?.dropPhotos(refs);
      setBusy(false);
      setTrouble('The album could not be saved. Your browser may be out of room.');
      return;
    }
    onClose();
  };

  return (
    <Sheet
      title={album ? 'Edit album' : 'New album'}
      lead={
        album
          ? 'Change its name, place, date or trip.'
          : 'A place, a day, and the photos from it. A new place becomes a new light on the globe.'
      }
      onClose={onClose}
    >
      <label className="sheet__field" htmlFor="fName">
        Title
        <input
          id="fName"
          placeholder="Rooftops at sunset"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
        />
      </label>
      <PlaceField id="fPlace" label="Place" archive={archive} value={place} onPick={setPlace} />
      <div className="sheet__row">
        <label className="sheet__field" htmlFor="fDate">
          Date
          <input
            id="fDate"
            type="date"
            value={date}
            onChange={(event) => setDate(event.target.value)}
          />
        </label>
        <label className="sheet__field" htmlFor="fTime">
          Time
          <input
            id="fTime"
            type="time"
            value={time}
            onChange={(event) => setTime(event.target.value)}
          />
        </label>
      </div>
      <label className="sheet__field" htmlFor="fTrip">
        Trip
        <select id="fTrip" value={trip} onChange={(event) => setTrip(event.target.value)}>
          <option value="">Not part of a trip</option>
          {archive.trips.map((one) => (
            <option key={one.id} value={one.id}>
              {one.name}
            </option>
          ))}
        </select>
      </label>
      {album && world.accountId && (
        <PrivacyField kind="album" itemId={album.id} accountId={world.accountId} />
      )}
      {!album && (
        <>
          <DropZone onFiles={(added) => setFiles([...files, ...added])} />
          {files.length > 0 && (
            <p className="sheet__note">
              {files.length} photo{files.length === 1 ? '' : 's'} ready.
            </p>
          )}
        </>
      )}
      <Acts>
        {album && (
          <ConfirmButton
            label="Delete album"
            ask="Delete it and its photos?"
            onConfirm={() => {
              void editArchive(async (data, repo) => {
                await repo.dropPhotos(deleteAlbum(data, album.id));
              }).then(onClose, () =>
                setTrouble('The album could not be deleted. Try again in a moment.'),
              );
            }}
          />
        )}
        <button type="button" className="sheet__btn" onClick={onClose}>
          Cancel
        </button>
        <button
          type="button"
          className="sheet__btn is-main"
          disabled={!ready}
          onClick={() => void submit()}
        >
          {busy ? 'Saving…' : album ? 'Save' : 'Create album'}
        </button>
      </Acts>
      {trouble && <p className="sheet__note">{trouble}</p>}
    </Sheet>
  );
}
