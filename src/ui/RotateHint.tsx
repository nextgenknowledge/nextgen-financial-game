'use client';
/**
 * Phones are played sideways. While a world loads, and any time the phone is held upright in
 * game, this card asks the player to turn it. It only shows on small touch screens held upright
 * (CSS decides that, so it reacts the moment the phone turns); tablets play either way.
 *
 * Browsers that allow it (Android, once installed or full screen) are also asked to stay in
 * landscape. iPhone Safari does not let a page lock the screen, so there the card does the job.
 */
import { useEffect } from 'react';

export function RotateHint() {
  useEffect(() => {
    const o = (typeof screen !== 'undefined' ? screen.orientation : undefined) as (ScreenOrientation & { lock?: (o: string) => Promise<void> }) | undefined;
    o?.lock?.('landscape').catch(() => {});
  }, []);
  return (
    <div className="rotate-hint" role="alert" aria-live="polite">
      <div className="rotate-phone" aria-hidden="true">
        <span className="rotate-screen" />
      </div>
      <b className="rotate-title">Turn your phone sideways</b>
      <p className="rotate-text">Fin City plays in landscape, so you can see the city and use both thumbs.</p>
    </div>
  );
}
