'use client';
import { useEffect, useRef } from 'react';
import type { UIStore } from '@/store/ui';
import { CITY_META, buildingById } from '@/world/cities';
import { drawNarwhalPortrait } from '@/world/narwhalFace';
import { ORG_LOGO } from '../common';
import { ART_H, ART_W, drawCityArt } from './cityArt';
import { drawPin, poiFor } from '../map/pixelMap';
import type { LocationId } from '@/game/types';

/** Destination loading screen: animated pixel-art scene, title card, pixel progress bar and a tip. */
export function LoadingScreen({ loading, tip }: { loading: UIStore['loading']; tip: string }) {
  const art = useRef<HTMLCanvasElement>(null);
  const face = useRef<HTMLCanvasElement>(null);
  const pin = useRef<HTMLCanvasElement>(null);
  const city = (loading.city ?? 'park') as LocationId;
  const meta = CITY_META[city] ?? CITY_META.park;
  const bld = loading.kind === 'building' && loading.building ? buildingById(loading.building)?.building : null;

  useEffect(() => {
    const c = art.current;
    if (!c) return;
    const g = c.getContext('2d')!;
    let raf = 0;
    let last = 0;
    const t0 = performance.now();
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      if (now - last < 50) return; // ~20 fps is plenty for pixel art
      last = now;
      drawCityArt(g, city, (now - t0) / 1000);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [city]);

  useEffect(() => {
    const g = face.current?.getContext('2d');
    if (g) drawNarwhalPortrait(g, 64, 'talking');
    const pg = pin.current?.getContext('2d');
    if (pg && bld) {
      const poi = poiFor(bld);
      pg.clearRect(0, 0, 48, 48);
      drawPin(pg, poi.glyph, poi.color, 24, 46, 1.6);
    }
  }, [bld]);

  const segments = 20;
  const filled = Math.max(1, Math.round(loading.progress * segments));
  const title = bld ? bld.name : meta.name;
  const subtitle = bld ? `${meta.name} · ${bld.blurb}` : loading.kind === 'world' ? loading.text : meta.theme;

  return (
    <div className="loading loading-art" role="status" aria-live="polite">
      <canvas ref={art} width={ART_W} height={ART_H} className="loading-scene" />
      {loading.kind === 'world' && <img className="loading-brand" src={ORG_LOGO} alt="NextGen Knowledge" />}
      <div className="loading-card">
        <div className="loading-title">
          {bld && <canvas ref={pin} width={48} height={48} className="loading-pin" />}
          <div className="col" style={{ minWidth: 0 }}>
            <div className="pixel loading-name">{title}</div>
            <div className="loading-sub">{subtitle}</div>
          </div>
        </div>
        <div className="pixel-bar" aria-label={`${Math.round(loading.progress * 100)} percent`}>
          {Array.from({ length: segments }, (_, i) => (
            <span key={i} className={i < filled ? 'on' : ''} />
          ))}
        </div>
        <div className="loading-tip">
          <canvas ref={face} width={64} height={64} className="loading-face" />
          <span>
            <b>Narwhal&apos;s money tip</b>
            <br />
            {tip}
          </span>
        </div>
      </div>
    </div>
  );
}
