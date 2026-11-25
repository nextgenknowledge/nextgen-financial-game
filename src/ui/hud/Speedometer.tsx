'use client';
/**
 * Dashboard while riding: speed in mph on a pixel gauge, the gear and a rev bar for cars, and
 * altitude for the seaplane and the helicopter.
 */
import { useEffect, useState } from 'react';
import { rt } from '@/engine/runtime';
import { vehicleDef } from '@/engine/vehicles';
import { engineRpm } from '@/engine/audio';
import { onLandNag, flies } from '@/engine/vehicles';
import { useScene } from '@/store/scene';
import { useGame } from '@/store/game';
import { useUI } from '@/store/ui';
import { CITY_META } from '@/world/cities';
import { flyTo } from '../interact';
import type { LocationId } from '@/game/types';

const MPH = 2.237;
const FT = 3.281;

type Dash = { mph: number; frac: number; type: string; gear: number | null; rpm: number; alt: number; reverse: boolean };

export function Speedometer() {
  const [d, setD] = useState<Dash | null>(null);
  useEffect(() => {
    const id = setInterval(() => {
      const v = rt.vehicle;
      if (!v) return setD(null);
      const def = vehicleDef(v.itemId);
      const top = def?.topSpeed ?? 20;
      const frac = Math.min(1, Math.abs(v.speed) / (top * 1.15));
      const sf = Math.min(1, Math.abs(v.speed) / top);
      const car = v.type === 'car' || v.type === 'kart';
      setD({
        mph: Math.round(Math.abs(v.speed) * MPH),
        frac,
        type: v.type,
        gear: car ? (v.speed < -0.3 ? 0 : Math.min(6, Math.floor(sf * 6) + 1)) : null,
        rpm: car ? engineRpm(sf) / 9000 : 0,
        alt: Math.round(v.alt * FT),
        reverse: v.speed < -0.3,
      });
    }, 80);
    return () => clearInterval(id);
  }, []);
  if (!d) return null;
  // Needle sweeps 240 degrees across the dial
  const ang = -120 + d.frac * 240;
  const ticks = Array.from({ length: 9 }, (_, i) => -120 + i * 30);
  return (
    <div className="speedo" role="status" aria-label={`${d.mph} miles per hour`}>
      <div className="speedo-dial" aria-hidden="true">
        {ticks.map((t, i) => (
          <span key={t} className={i >= 7 ? 'speedo-tick red' : 'speedo-tick'} style={{ transform: `rotate(${t}deg) translateY(-30px)` }} />
        ))}
        <span className="speedo-needle" style={{ transform: `rotate(${ang}deg)` }} />
        <span className="speedo-hub" />
      </div>
      <div className="speedo-read">
        <b className="speedo-num mono">{d.mph}</b>
        <span className="speedo-unit">MPH</span>
        {d.gear !== null && <span className="speedo-gear">{d.reverse ? 'R' : `Gear ${d.gear}`}</span>}
        {flies(d.type) && <span className="speedo-gear">ALT {d.alt.toLocaleString()} ft</span>}
      </div>
      {d.gear !== null && (
        <div className="speedo-rpm" aria-hidden="true">
          {Array.from({ length: 12 }, (_, i) => (
            <span key={i} className={i / 12 < d.rpm ? (i >= 10 ? 'on red' : i >= 8 ? 'on gold' : 'on') : ''} />
          ))}
        </div>
      )}
    </div>
  );
}

/** In the air in the seaplane or helicopter: pick another city to fly to. */
export function FlightPanel() {
  const [show, setShow] = useState<string | null>(null);
  const here = useScene((s) => s.location);
  const unlocked = useGame((s) => s.world?.progress.unlocked ?? []);
  useEffect(() => {
    onLandNag(() => {
      const heli = rt.vehicle?.type === 'heli';
      useUI.getState().pushToast({
        text: heli ? 'The helicopter can only land at an airfield. Over the city it keeps a little height.' : 'Land at the airfield or on the water. Over the city the plane keeps a little height.',
        icon: heli ? '🚁' : '🛩️',
        tone: 'info',
      });
    });
    const id = setInterval(() => {
      const v = rt.vehicle;
      setShow(v && flies(v.type) && v.alt > 2 && !useScene.getState().interior ? v.type : null);
    }, 200);
    return () => clearInterval(id);
  }, []);
  if (!show) return null;
  const places = ALL_PLACES.filter((p) => p !== here);
  return (
    <div className="flight-panel">
      <span className="flight-title">{show === 'heli' ? '🚁' : '🛩️'} Fly to another city</span>
      <div className="flight-list">
        {places.map((p) => (
          <button key={p} type="button" className="flight-btn" disabled={!unlocked.includes(p)} title={unlocked.includes(p) ? `Fly to ${CITY_META[p].name}` : 'Still locked'} onClick={() => flyTo(p)}>
            {CITY_META[p].icon} {CITY_META[p].name}
          </button>
        ))}
      </div>
    </div>
  );
}

const ALL_PLACES: LocationId[] = ['park', 'new-york', 'london', 'hong-kong', 'san-francisco', 'singapore'];
