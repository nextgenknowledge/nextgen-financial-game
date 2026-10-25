'use client';
import { useEffect, useRef, useState } from 'react';
import type { UIStore } from '@/store/ui';
import { useGame } from '@/store/game';
import { CITY_META, buildingById } from '@/world/cities';
import type { LocationId } from '@/game/types';
import type { Mood } from '@/game/effects';
import { FIN_LOGO } from '../common';
import tips from '@/data/tips.json';
import { CityBackdrop } from '../screens/CityBackdrop';
import { NARWHAL_ART, narwhalFace } from '../narwhalArt';

/*
 * Loading screen: the Fin City logo, a bar that fills up with dollar bills, and NextGen
 * Narwhal in the bottom left sharing money tips that change every few seconds.
 * Loading a saved game just says "Downloading assets" (no spoilers about where you'll be),
 * then "Almost done!" near the end.
 */

const BILLS = 20;
const TIP_MS = 4200;
const FACES: Mood[] = ['talking', 'confident', 'hyped', 'talking', 'skeptical', 'confident'];

export function LoadingScreen({ loading }: { loading: UIStore['loading']; tip?: string }) {
  const advanced = useGame((s) => s.world?.difficulty === 'advanced');
  const shown = useSmoothProgress(loading.progress);
  const [tip, setTip] = useState(() => Math.floor(Math.random() * tips.tips.length));

  useEffect(() => {
    const id = window.setInterval(() => setTip((i) => (i + 1) % tips.tips.length), TIP_MS);
    return () => window.clearInterval(id);
  }, []);

  const city = (loading.city ?? 'park') as LocationId;
  const meta = CITY_META[city] ?? CITY_META.park;
  const bld = loading.kind === 'building' && loading.building ? buildingById(loading.building)?.building : null;
  const label =
    loading.kind === 'building' && bld
      ? `Heading into ${bld.name}`
      : loading.kind === 'city'
        ? `Traveling to ${meta.name}`
        : shown >= 0.88
          ? 'Almost done!'
          : 'Downloading assets';
  const done = label === 'Almost done!';

  const percent = Math.round(shown * 100);
  const filled = Math.max(0, Math.min(BILLS, Math.round(shown * BILLS)));
  const current = tips.tips[tip];
  const text = advanced && 'advanced' in current && current.advanced ? `${current.text} ${current.advanced}` : current.text;
  const face = FACES[tip % FACES.length];

  return (
    <div className="loading loading-cash" role="status" aria-live="polite">
      <CityBackdrop coin={false} />
      <div className="lc-center">
        <img className="lc-logo" src={FIN_LOGO} alt="Fin City" draggable={false} />
        <div className="lc-bar-wrap">
          <div className="lc-bar-top">
            <span className="lc-label">
              {label}
              {!done && <span className="lc-dots" aria-hidden />}
            </span>
            <span className="lc-amount pixel">${percent}</span>
          </div>
          <div className="lc-bar" aria-label={`${percent} percent loaded`}>
            {Array.from({ length: BILLS }, (_, i) => (
              <span key={i} className={i < filled ? 'on' : ''}>
                {i < filled ? '$' : ''}
              </span>
            ))}
          </div>
          <div className="lc-scale">
            <span>$0</span>
            <span>$100</span>
          </div>
        </div>
      </div>

      <div className="lc-narwhal">
        <img className="lc-narwhal-body" src={NARWHAL_ART} alt="NextGen Narwhal" draggable={false} />
        <div key={tip} className="narwhal-bubble lc-bubble">
          <div className="narwhal-bubble-head">
            <img src={narwhalFace(face)} alt="" />
            <span>Narwhal&apos;s money tip</span>
          </div>
          <p>{text}</p>
        </div>
      </div>
    </div>
  );
}

/** Eases toward the real progress, and creeps forward while waiting so the bar never looks stuck. */
function useSmoothProgress(target: number) {
  const [value, setValue] = useState(0);
  const ref = useRef(0);
  const goal = useRef(target);
  goal.current = target;
  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      const g = Math.max(goal.current, Math.min(0.92, ref.current + dt * 0.06));
      ref.current += (g - ref.current) * Math.min(1, dt * 6);
      setValue(ref.current);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);
  return Math.min(1, value);
}
