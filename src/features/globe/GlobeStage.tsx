import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import type { World } from '@/app/boot';
import { createEngine } from '@/engine/engine';
import type { GlobeEngine } from '@/engine/engine';
import { ownerStore } from '@/state/owner';
import { useStore } from '@/state/store';
import type { Director } from '@/tour/director';
import { PlaceLabel } from './PlaceLabel';
import styles from './GlobeStage.module.css';

/** The three canvases (stars, sky events, globe) and the hover label, driven by the engine. */
export function GlobeStage({ world, director }: { world: World; director: Director }) {
  const { t: tr } = useTranslation();
  const stars = useRef<HTMLCanvasElement>(null);
  const sky = useRef<HTMLCanvasElement>(null);
  const globe = useRef<HTMLCanvasElement>(null);
  const label = useRef<HTMLDivElement>(null);
  const engine = useRef<GlobeEngine | null>(null);
  const rev = useStore(ownerStore, (state) => state.rev);

  // an edit can add a city, move one or take one away: the lights follow
  useEffect(() => {
    if (rev > 0) engine.current?.refresh();
  }, [rev]);

  useEffect(() => {
    if (!stars.current || !sky.current || !globe.current || !label.current) {
      return;
    }
    const live = createEngine({
      stars: stars.current,
      sky: sky.current,
      globe: globe.current,
      label: label.current,
      ...world,
      director,
    });
    engine.current = live;
    return () => {
      engine.current = null;
      live.destroy();
    };
  }, [world, director]);

  return (
    <div className={styles.stage}>
      <canvas ref={stars} className={styles.stars} aria-hidden="true" />
      <canvas ref={sky} className={styles.sky} aria-hidden="true" />
      <canvas
        ref={globe}
        className={styles.globeCanvas}
        role="img"
        aria-label={tr('globe.ariaLabel')}
      />
      <PlaceLabel ref={label} archive={world.archive} />
    </div>
  );
}
