import type { Ref } from 'react';
import { visitYears } from '@/data/archive';
import type { Archive } from '@/data/archive';
import { appStore } from '@/state/app-state';
import { useStore } from '@/state/store';
import styles from './PlaceLabel.module.css';

interface PlaceLabelProps {
  archive: Archive;
  ref: Ref<HTMLDivElement>;
}

/** The label over the light under the cursor. The engine moves and fades it; React fills it in. */
export function PlaceLabel({ archive, ref }: PlaceLabelProps) {
  const key = useStore(appStore, (state) => state.labelCityKey);
  const city = key === null ? undefined : archive.cityByKey.get(key);

  return (
    <div ref={ref} className={styles.label} aria-hidden="true">
      {city && (
        <>
          <b>{city.name}</b>
          <span>
            {city.country.name} · {visitYears(city).join(' · ')}
          </span>
        </>
      )}
    </div>
  );
}
