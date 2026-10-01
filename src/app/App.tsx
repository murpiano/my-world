import { useCallback, useEffect, useState } from 'react';
import { Header } from '@/features/header/Header';
import { loadWorld } from './boot';
import { currentRoute } from './route';
import type { World } from './boot';
import { Away, SharedView } from './SharedView';
import { Splash } from './Splash';
import { Stage } from './Stage';
import './app.scss';

type Boot = { status: 'loading' } | { status: 'ready'; world: World } | { status: 'failed' };

// read once: the app has no router, and the two shareable paths never change under it
const route = currentRoute();

export function App() {
  const [boot, setBoot] = useState<Boot>({ status: 'loading' });
  // the world is built only once the splash lets it in, so building it cannot make the intro stutter
  const [stageUp, setStageUp] = useState(false);
  const letIn = useCallback(() => setStageUp(true), []);

  useEffect(() => {
    if (route.kind === 'profile') return;
    let live = true;
    loadWorld(route).then(
      (world) => {
        if (live) setBoot({ status: 'ready', world });
      },
      (error: unknown) => {
        console.error(error);
        if (live) setBoot({ status: 'failed' });
      },
    );
    return () => {
      live = false;
    };
  }, []);

  // the profile page is a plain list, not the globe: no world to build, no splash to wait for
  if (route.kind === 'profile') return <SharedView route={route} />;

  // a shared link that is private, revoked, or simply wrong comes back with nothing in it:
  // say so plainly instead of showing an empty globe
  if (route.kind === 'shared' && boot.status === 'ready' && boot.world.archive.albums.length === 0) {
    return <Away />;
  }

  return (
    <>
      {boot.status === 'ready' && stageUp && <Stage world={boot.world} />}
      {boot.status !== 'failed' && <Splash ready={boot.status === 'ready'} onRelease={letIn} />}
      {boot.status === 'failed' && (
        <div className="boot" role="alert">
          <p>The map did not load.</p>
          <button type="button" onClick={() => location.reload()}>
            Try again
          </button>
        </div>
      )}
      <Header world={boot.status === 'ready' ? boot.world : null} />
    </>
  );
}
