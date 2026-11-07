import { useState } from 'react';
import type { World } from '@/app/boot';
import { addTrip, deleteTrip, freshId, updateTrip } from '@/data/edits';
import { MONTHS } from '@/lib/dates';

import { ConfirmButton } from './ConfirmButton';
import { endChoiceOf, endpointFor } from './endpoints';
import type { EndChoice } from './endpoints';
import { PlaceField } from './PlaceField';
import { PrivacyField } from './PrivacyField';
import { Acts, Btn, Field, Note, Sheet } from './Sheet';
import styles from './TripForm.module.css';
import { useEdit } from './useEdit';

/** New or edit: a name, where it starts and ends, and the albums that belong to it. */
export function TripForm({
  world,
  id,
  albumIds,
  onClose,
}: {
  world: World;
  id: string | null;
  albumIds: string[];
  onClose: () => void;
}) {
  const { archive } = world;
  const trip = id ? (archive.trips.find((one) => one.id === id) ?? null) : null;
  const homeLabel = `Home · ${world.home.name}`;
  const [name, setName] = useState(trip?.name ?? '');
  const [start, setStart] = useState<EndChoice>(
    endChoiceOf(trip?.start ?? { home: true }, archive),
  );
  const [end, setEnd] = useState<EndChoice>(endChoiceOf(trip?.end ?? { home: true }, archive));
  const [picked, setPicked] = useState<string[]>(trip ? [...trip.albumIds] : albumIds);
  const newest = [...archive.albums].reverse();
  const { trouble, run } = useEdit(onClose);

  const toggle = (albumId: string) =>
    setPicked(
      picked.includes(albumId) ? picked.filter((one) => one !== albumId) : [...picked, albumId],
    );

  const submit = () => {
    run((data) => {
      const fields = {
        name: name.trim(),
        start: endpointFor(data, start),
        end: endpointFor(data, end),
        albumIds: picked,
      };
      if (trip) updateTrip(data, trip.id, fields);
      else addTrip(data, freshId('t'), fields);
    });
  };

  return (
    <Sheet
      title={trip ? 'Edit trip' : 'New trip'}
      lead="A name, where it starts and ends, and the albums that belong to it."
      onClose={onClose}
    >
      <Field label="Name" htmlFor="fName">
        <input
          id="fName"
          placeholder="Summer holiday 2023"
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
      </Field>
      <PlaceField
        id="fStart"
        label="Starts from"
        archive={archive}
        value={start === 'home' ? null : start}
        text={homeLabel}
        home={{ label: homeLabel, onPick: () => setStart('home') }}
        onPick={(place) => place && setStart(place)}
      />
      <PlaceField
        id="fEnd"
        label="Ends at"
        archive={archive}
        value={end === 'home' ? null : end}
        text={homeLabel}
        home={{ label: homeLabel, onPick: () => setEnd('home') }}
        onPick={(place) => place && setEnd(place)}
      />
      <Field>
        Albums
        <div className={styles.checks}>
          {newest.map((album) => (
            <label key={album.id}>
              <input
                type="checkbox"
                checked={picked.includes(album.id)}
                onChange={() => toggle(album.id)}
              />
              <span>
                {album.title} · {album.city.name}
              </span>
              <small>
                {album.day} {MONTHS[album.month - 1]} {album.year}
              </small>
            </label>
          ))}
        </div>
      </Field>
      {trip && world.accountId && (
        <PrivacyField kind="trip" itemId={trip.id} accountId={world.accountId} />
      )}
      <Acts>
        {trip && (
          <ConfirmButton
            label="Delete trip"
            ask="Delete this trip? Its albums stay."
            onConfirm={() => {
              run((data) => deleteTrip(data, trip.id));
            }}
          />
        )}
        <Btn onClick={onClose}>Cancel</Btn>
        <Btn variant="main" disabled={!name.trim()} onClick={submit}>
          {trip ? 'Save' : 'Create trip'}
        </Btn>
      </Acts>
      {trouble && <Note>{trouble}</Note>}
    </Sheet>
  );
}
