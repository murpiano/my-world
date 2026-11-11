import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { World } from '@/app/boot';
import { addTrip, deleteTrip, freshId, updateTrip } from '@/data/edits';

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
  const { t: tr, i18n } = useTranslation();
  const { archive } = world;
  const trip = id ? (archive.trips.find((one) => one.id === id) ?? null) : null;
  const homeLabel = tr('forms.homeLabel', { name: world.home.name });
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
      title={trip ? tr('forms.editTripTitle') : tr('forms.newTripTitle')}
      lead={tr('forms.tripLead')}
      onClose={onClose}
    >
      <Field label={tr('forms.name')} htmlFor="fName">
        <input
          id="fName"
          placeholder={tr('forms.namePlaceholder')}
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
      </Field>
      <PlaceField
        id="fStart"
        label={tr('forms.startsFrom')}
        archive={archive}
        value={start === 'home' ? null : start}
        text={homeLabel}
        home={{ label: homeLabel, onPick: () => setStart('home') }}
        onPick={(place) => place && setStart(place)}
      />
      <PlaceField
        id="fEnd"
        label={tr('forms.endsAt')}
        archive={archive}
        value={end === 'home' ? null : end}
        text={homeLabel}
        home={{ label: homeLabel, onPick: () => setEnd('home') }}
        onPick={(place) => place && setEnd(place)}
      />
      <Field>
        {tr('forms.albums')}
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
                {new Date(album.year, album.month - 1, album.day).toLocaleDateString(
                  i18n.language,
                  { day: 'numeric', month: 'short', year: 'numeric' },
                )}
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
            label={tr('forms.deleteTrip')}
            ask={tr('forms.deleteTripAsk')}
            onConfirm={() => {
              run((data) => deleteTrip(data, trip.id));
            }}
          />
        )}
        <Btn onClick={onClose}>{tr('forms.cancel')}</Btn>
        <Btn variant="main" disabled={!name.trim()} onClick={submit}>
          {trip ? tr('forms.save') : tr('forms.createTrip')}
        </Btn>
      </Acts>
      {trouble && <Note>{trouble}</Note>}
    </Sheet>
  );
}
