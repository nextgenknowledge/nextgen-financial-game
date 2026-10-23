'use client';
import { useEffect, useRef } from 'react';
import { useScene } from '@/store/scene';
import { useUI } from '@/store/ui';
import { useGame } from '@/store/game';
import { rt } from '@/engine/runtime';
import { CITIES } from '@/world/cities';
import { getCityMap } from '@/world/builders/sceneBuilder';
import { baseMap, buildingsPois, drawPin, worldToMap } from '../map/pixelMap';

const VIEW = 198; // base-map pixels shown across the minimap (≈66 m)

/** Pixel-art minimap: a crop of the city's base map around the player, north up. */
export function Minimap() {
  const ref = useRef<HTMLCanvasElement>(null);
  const location = useScene((s) => s.location);
  const interior = useScene((s) => s.interior);
  const difficulty = useGame((s) => s.world?.difficulty ?? 'entry');
  const open = useUI((s) => s.open);
  useEffect(() => {
    if (interior) return;
    const def = CITIES[location];
    const data = getCityMap(def, difficulty);
    const base = baseMap(def, data);
    const pois = buildingsPois(def);
    const id = setInterval(() => {
      const c = ref.current;
      if (!c) return;
      const g = c.getContext('2d')!;
      const W = c.width;
      const k = W / VIEW;
      const p = worldToMap(data, rt.player.x, rt.player.z);
      g.imageSmoothingEnabled = false;
      g.fillStyle = '#2b3138';
      g.fillRect(0, 0, W, W);
      g.drawImage(base.canvas, p.x - VIEW / 2, p.y - VIEW / 2, VIEW, VIEW, 0, 0, W, W);
      const toView = (x: number, z: number) => {
        const m = worldToMap(data, x, z);
        return { x: (m.x - p.x) * k + W / 2, y: (m.y - p.y) * k + W / 2 };
      };
      for (const poi of pois) {
        const v = toView(poi.x, poi.z);
        if (v.x < -10 || v.y < -10 || v.x > W + 10 || v.y > W + 10) continue;
        drawPin(g, poi.glyph, poi.color, v.x, v.y, 0.8);
      }
      for (const pt of def.portals) {
        const v = toView(pt.pos[0], pt.pos[1]);
        if (v.x > 0 && v.y > 0 && v.x < W && v.y < W) drawPin(g, 'portal', '#6a3fd0', v.x, v.y, 0.8);
      }
      if (rt.goal) {
        const v = toView(rt.goal.x, rt.goal.z);
        const gx = Math.max(8, Math.min(W - 8, v.x));
        const gy = Math.max(8, Math.min(W - 8, v.y));
        g.fillStyle = '#14181f';
        g.fillRect(gx - 5, gy - 5, 10, 10);
        g.fillStyle = '#f2c94c';
        g.fillRect(gx - 4, gy - 4, 8, 8);
        g.fillStyle = '#fff6cf';
        g.fillRect(gx - 2, gy - 2, 3, 3);
      }
      // Player arrow (pixel style)
      g.save();
      g.translate(W / 2, W / 2);
      g.rotate(-rt.playerRotY + Math.PI);
      g.fillStyle = '#14181f';
      g.beginPath();
      g.moveTo(0, -10);
      g.lineTo(8, 8);
      g.lineTo(0, 4);
      g.lineTo(-8, 8);
      g.closePath();
      g.fill();
      g.fillStyle = '#e1553f';
      g.beginPath();
      g.moveTo(0, -7);
      g.lineTo(5, 5);
      g.lineTo(0, 2);
      g.lineTo(-5, 5);
      g.closePath();
      g.fill();
      g.restore();
      // North marker
      g.fillStyle = 'rgba(20,24,31,0.75)';
      g.fillRect(W - 18, 4, 14, 14);
      g.fillStyle = '#fbf6ea';
      g.font = "700 11px 'Pixelify Sans', monospace";
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText('N', W - 11, 11.5);
    }, 150);
    return () => clearInterval(id);
  }, [location, interior, difficulty]);
  if (interior) return null;
  return (
    <button className="minimap" onClick={() => open({ type: 'map' })} title="Open map (M)">
      <canvas ref={ref} width={160} height={160} />
    </button>
  );
}
