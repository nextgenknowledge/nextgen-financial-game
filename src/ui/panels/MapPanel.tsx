'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useUI } from '@/store/ui';
import { useGame } from '@/store/game';
import { useScene } from '@/store/scene';
import { Button, Modal } from '../common';
import { CITIES, CITY_META } from '@/world/cities';
import { rt } from '@/engine/runtime';
import { travelTo } from '../interact';
import { CITY_IDS, type LocationId } from '@/game/types';
import { getCityMap } from '@/world/builders/sceneBuilder';
import { playSfx } from '@/engine/audio';
import { baseMap, buildingsPois, drawPin, worldToMap, type Poi } from '../map/pixelMap';

const ZOOM = 1; // canvas pixels per base-map pixel

/** A pixel glyph pin as a small inline canvas (for the legend list). */
function GlyphIcon({ poi }: { poi: Pick<Poi, 'glyph' | 'color'> }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const g = ref.current?.getContext('2d');
    if (!g) return;
    g.clearRect(0, 0, 32, 34);
    drawPin(g, poi.glyph, poi.color, 16, 33, 1.25);
  }, [poi.glyph, poi.color]);
  return <canvas ref={ref} width={32} height={34} className="glyph-icon" />;
}

export function MapPanel() {
  const close = useUI((s) => s.close);
  const unlocked = useGame((s) => s.world!.progress.unlocked);
  const difficulty = useGame((s) => s.world!.difficulty);
  const location = useScene((s) => s.location);
  const interior = useScene((s) => s.interior);
  const [view, setView] = useState<LocationId>(location);
  const [hover, setHover] = useState<string | null>(null);
  const ref = useRef<HTMLCanvasElement>(null);
  const def = CITIES[view];
  const data = useMemo(() => getCityMap(def, difficulty), [def, difficulty]);
  const pois = useMemo(() => buildingsPois(def), [def]);
  const here = view === location && !interior;

  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const base = baseMap(def, data);
    c.width = c.height = base.size * ZOOM;
    const g = c.getContext('2d')!;
    g.imageSmoothingEnabled = false;
    g.drawImage(base.canvas, 0, 0, c.width, c.height);
    const P = (x: number, z: number) => {
      const m = worldToMap(data, x, z);
      return { x: m.x * ZOOM, y: m.y * ZOOM };
    };
    // Portals
    for (const pt of def.portals) {
      const v = P(pt.pos[0], pt.pos[1]);
      drawPin(g, 'portal', '#6a3fd0', v.x, v.y, 1.5);
    }
    // Points of interest
    for (const poi of pois) {
      const v = P(poi.x, poi.z);
      drawPin(g, poi.glyph, poi.color, v.x, v.y, hover === poi.id ? 2 : 1.5);
    }
    // Labels for the hovered place, in the pixel font on a dark tag
    const hp = pois.find((p) => p.id === hover);
    if (hp) {
      const v = P(hp.x, hp.z);
      g.font = "700 17px 'Pixelify Sans', monospace";
      const tw = g.measureText(hp.name).width;
      const lx = Math.min(c.width - tw - 24, Math.max(8, v.x - tw / 2 - 10));
      const ly = Math.max(8, v.y - 72);
      g.fillStyle = '#14181f';
      g.fillRect(lx, ly, tw + 20, 28);
      g.fillStyle = '#f2c94c';
      g.fillRect(lx, ly + 26, tw + 20, 2);
      g.fillStyle = '#fbf6ea';
      g.textBaseline = 'middle';
      g.textAlign = 'left';
      g.fillText(hp.name, lx + 10, ly + 14);
    }
    if (here) {
      const v = P(rt.player.x, rt.player.z);
      g.save();
      g.translate(v.x, v.y);
      g.scale(0.7, 0.7);
      g.rotate(-rt.playerRotY + Math.PI);
      g.fillStyle = '#14181f';
      g.beginPath();
      g.moveTo(0, -20);
      g.lineTo(15, 15);
      g.lineTo(0, 8);
      g.lineTo(-15, 15);
      g.closePath();
      g.fill();
      g.fillStyle = '#e1553f';
      g.beginPath();
      g.moveTo(0, -14);
      g.lineTo(10, 10);
      g.lineTo(0, 4);
      g.lineTo(-10, 10);
      g.closePath();
      g.fill();
      g.restore();
      if (rt.goal) {
        const gv = P(rt.goal.x, rt.goal.z);
        g.fillStyle = '#14181f';
        g.fillRect(gv.x - 8, gv.y - 8, 16, 16);
        g.fillStyle = '#f2c94c';
        g.fillRect(gv.x - 6, gv.y - 6, 12, 12);
      }
    }
  }, [def, data, pois, hover, here]);

  const poiAt = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const c = ref.current!;
    const rect = c.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * c.width;
    const py = ((e.clientY - rect.top) / rect.height) * c.height;
    let best: Poi | null = null;
    let bd = 22;
    for (const p of pois) {
      const m = worldToMap(data, p.x, p.z);
      const d = Math.hypot(m.x * ZOOM - px, m.y * ZOOM - py);
      if (d < bd) {
        bd = d;
        best = p;
      }
    }
    return best;
  };

  const goTo = (id: string) => {
    if (!here) return;
    const t = rt.triggers.find((x) => x.id === `door:${id}`);
    if (t) {
      playSfx('whoosh');
      rt.teleport(t.x, t.z);
      close();
    }
  };

  return (
    <Modal onClose={close} title="🗺️ City Map" size="full">
      <div className="row wrap" style={{ gap: '0.4rem', marginBottom: '0.6rem' }}>
        {(['park', ...CITY_IDS] as LocationId[]).map((id) => {
          const ok = unlocked.includes(id);
          return (
            <Button key={id} size="small" variant={view === id ? 'primary' : undefined} onClick={() => setView(id)}>
              {ok ? CITY_META[id].icon : '🔒'} {CITY_META[id].name}
            </Button>
          );
        })}
      </div>
      <div className="map-layout">
        <div className="map-frame">
          <canvas
            ref={ref}
            className="pixel-map"
            onMouseMove={(e) => setHover(poiAt(e)?.id ?? null)}
            onMouseLeave={() => setHover(null)}
            onClick={(e) => {
              const p = poiAt(e);
              if (p) goTo(p.id);
            }}
            style={{ cursor: here && hover ? 'pointer' : 'default' }}
          />
          <div className="map-compass pixel">N ▲</div>
        </div>
        <div className="col grow map-side">
          <h3 style={{ margin: 0 }} className="pixel">
            {def.name}
          </h3>
          <span className="muted small">{CITY_META[view].theme}</span>
          {here && <span className="small">Click a place on the map, or in the list, to walk straight to its door.</span>}
          <div className="col" style={{ gap: '0.3rem' }}>
            {pois.map((p) => {
              const b = def.buildings.find((x) => x.id === p.id)!;
              return (
                <button key={p.id} className={`map-place ${hover === p.id ? 'on' : ''}`} onMouseEnter={() => setHover(p.id)} onMouseLeave={() => setHover(null)} onClick={() => goTo(p.id)} disabled={!here}>
                  <GlyphIcon poi={p} />
                  <span className="col" style={{ alignItems: 'flex-start', minWidth: 0 }}>
                    <b className="small">{p.name}</b>
                    <span className="muted tiny">{b.blurb}</span>
                  </span>
                </button>
              );
            })}
          </div>
          {view !== location && (
            <Button variant="gold" size="big" disabled={!unlocked.includes(view)} onClick={() => travelTo(view)}>
              {unlocked.includes(view) ? `🌀 Travel to ${CITY_META[view].name}` : '🔒 Locked, follow Narwhal’s quests'}
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
}
