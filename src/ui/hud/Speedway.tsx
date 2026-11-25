'use client';
/**
 * Lap timer for Fin City Motor Stadium (src/game/speedway.ts). Drive any car, kart, bike or scooter over
 * the start line, through the three gold arches in order and back over the line. Each lap pays a
 * little XP (a few laps a day) and a new best time pays more.
 */
import { useEffect, useState } from 'react';
import { act, useGame } from '@/store/game';
import { useScene } from '@/store/scene';
import { useUI } from '@/store/ui';
import { rt } from '@/engine/runtime';
import { playSfx } from '@/engine/audio';
import { grantXp } from '@/game/progress/xp';
import { dayKey } from '@/game/progress/streak';
import { CHECKPOINTS, LAP_XP, RECORD_XP, XP_LAPS_PER_DAY, lapClock, onTrack, stepLap, type Lap } from '@/game/speedway';

let lap: Lap = null;
let offTrackSince = 0;

export function SpeedwayHud() {
  const [view, setView] = useState<{ time: number; next: number; best: number | null; last: number | null } | null>(null);
  const best = useGame((s) => (typeof s.world?.progress.flags.speedwayBest === 'number' ? (s.world.progress.flags.speedwayBest as number) : null));

  useEffect(() => {
    let last: number | null = null;
    const id = setInterval(() => {
      const v = rt.vehicle;
      const sc = useScene.getState();
      const now = performance.now() / 1000;
      if (!v || v.type === 'boat' || v.type === 'plane' || v.type === 'heli' || sc.location !== 'park' || sc.interior || useUI.getState().loading.active) {
        lap = null;
        setView(null);
        return;
      }
      // Wander well off the track for a while and the lap is called off
      if (!onTrack(v.pos.x, v.pos.z, 12)) {
        if (!offTrackSince) offTrackSince = now;
        if (now - offTrackSince > 8) lap = null;
      } else offTrackSince = 0;
      const r = stepLap(lap, v.pos.x, v.pos.z, now);
      lap = r.lap;
      const ev = r.ev;
      if (ev?.type === 'start') {
        playSfx('tick');
        useUI.getState().pushToast({ text: 'Lap started! Drive through every gold arch, then back over the line.', icon: '🏁', tone: 'gold' });
      } else if (ev?.type === 'check') {
        playSfx('coin');
      } else if (ev?.type === 'lap') {
        last = ev.time;
        const time = Math.round(ev.time * 10) / 10;
        act((d, fx) => {
          const prev = d.progress.flags.speedwayBest;
          const record = typeof prev !== 'number' || time < prev;
          if (record) d.progress.flags.speedwayBest = time;
          const today = dayKey();
          if (d.progress.flags.speedwayDay !== today) {
            d.progress.flags.speedwayDay = today;
            d.progress.flags.speedwayLaps = 0;
          }
          const laps = Number(d.progress.flags.speedwayLaps ?? 0) + 1;
          d.progress.flags.speedwayLaps = laps;
          const xp = (laps <= XP_LAPS_PER_DAY ? LAP_XP : 0) + (record && typeof prev === 'number' ? RECORD_XP : 0);
          if (xp) grantXp(d, fx, xp);
          fx.push({
            type: 'toast',
            text: record ? `New best lap: ${lapClock(time)}!${xp ? ` +${xp} XP` : ''}` : `Lap: ${lapClock(time)}${xp ? ` · +${xp} XP` : ''}`,
            icon: '🏁',
            tone: record ? 'gold' : 'good',
          });
          if (record && typeof prev === 'number') fx.push({ type: 'confetti' });
          fx.push({ type: 'sfx', name: record ? 'levelup' : 'star' });
        });
      }
      if (lap) setView({ time: now - lap.start, next: lap.next, best: null, last });
      else if (onTrack(v.pos.x, v.pos.z, 6)) setView({ time: 0, next: 0, best: null, last });
      else setView(null);
    }, 100);
    return () => clearInterval(id);
  }, []);

  if (!view) return null;
  const started = !!lap;
  return (
    <div className="speedway-hud" role="status">
      <span className="sw-title">🏁 Fin City Motor Stadium</span>
      <span className="sw-time mono">{started ? lapClock(view.time) : 'Cross the start line'}</span>
      <span className="sw-meta">
        {started && <>Next: {view.next === 0 ? 'Finish line' : CHECKPOINTS[view.next].name} · </>}
        Best {best !== null ? lapClock(best) : 'none yet'}
        {view.last !== null && <> · Last {lapClock(view.last)}</>}
      </span>
    </div>
  );
}
