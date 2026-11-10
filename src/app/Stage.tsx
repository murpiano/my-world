import { useEffect, useState } from 'react';
import { Archive, useArchiveReturn } from '@/features/archive';
import { GlobeStage } from '@/features/globe';
import { Forms } from '@/features/forms';
import { useKeys } from '@/features/keys';
import { Lightbox } from '@/features/lightbox';
import { AlbumPanel } from '@/features/panel';
import { Timeline } from '@/features/timeline';
import { appStore } from '@/state/app-state';
import { ownerStore } from '@/state/owner';
import { useStore } from '@/state/store';
import { settingsStore } from '@/state/settings';
import { createDirector } from '@/tour/director';
import type { World } from './boot';
import { DirectorContext } from './director-context';

/** The main screen once the world is loaded: one director for the globe, the panel, the timeline. */
export function Stage({ world }: { world: World }) {
  const [director] = useState(() =>
    createDirector({
      archive: world.archive,
      home: world.home,
      store: appStore,
      pace: () => {
        const { photoSeconds, flightSeconds } = settingsStore.get();
        return { photoMs: photoSeconds * 1000, flightMs: flightSeconds * 1000 };
      },
    }),
  );
  const rev = useStore(ownerStore, (state) => state.rev);
  // an edit can move or remove the album in focus: the director lets go and the tour stops
  useEffect(() => {
    if (rev === 0) return;
    director.refresh();
    director.deselect();
    director.stop();
    appStore.set({ tour: null, lastTour: null });
  }, [rev, director]);
  useKeys(director, world.archive);
  useArchiveReturn();

  return (
    <DirectorContext value={director}>
      <GlobeStage world={world} director={director} />
      <AlbumPanel world={world} />
      <Timeline archive={world.archive} />
      <Archive world={world} director={director} />
      <Lightbox world={world} />
      <Forms world={world} />
    </DirectorContext>
  );
}
