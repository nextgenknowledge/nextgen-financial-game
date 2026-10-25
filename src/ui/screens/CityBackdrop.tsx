'use client';
import { useMemo } from 'react';
import { makeRng } from '@/game/rng';

/*
 * The animated pixel city behind the title and start screens: a night sky in flat bands,
 * twinkling stars, a big gold coin for a moon, drifting pixel clouds, two scrolling skylines
 * with lit windows, coins floating up, and a road with little cars. Everything is seeded,
 * so the server and the browser draw the same thing.
 */

const SKYLINE_WIDTH = 1600;

type Tower = { x: number; w: number; h: number; windows: { x: number; y: number; lit: boolean }[]; spire: boolean };

function makeSkyline(seed: number, minH: number, maxH: number, withWindows: boolean): Tower[] {
  const r = makeRng(seed);
  const towers: Tower[] = [];
  let x = 0;
  while (x < SKYLINE_WIDTH) {
    const w = 40 + Math.floor(r.next() * 70);
    const h = minH + Math.floor(r.next() * (maxH - minH));
    const windows: Tower['windows'] = [];
    if (withWindows) {
      for (let wy = 14; wy < h - 10; wy += 16) {
        for (let wx = 8; wx < w - 10; wx += 14) windows.push({ x: x + wx, y: wy, lit: r.next() > 0.45 });
      }
    }
    towers.push({ x, w, h, windows, spire: r.next() > 0.8 });
    x += w + Math.floor(r.next() * 8);
  }
  return towers;
}

function Skyline({ towers, colors, height, windowColor, className }: { towers: Tower[]; colors: string[]; height: number; windowColor?: string; className: string }) {
  const copy = (n: number) => (
    <svg key={n} width={SKYLINE_WIDTH} height={height} viewBox={`0 0 ${SKYLINE_WIDTH} ${height}`} shapeRendering="crispEdges" aria-hidden>
      {towers.map((t, i) => (
        <g key={i}>
          <rect x={t.x} y={height - t.h} width={t.w} height={t.h} fill={colors[i % colors.length]} stroke="#061233" strokeWidth={3} />
          <rect x={t.x + 3} y={height - t.h + 3} width={6} height={t.h - 3} fill="#ffffff" opacity={0.12} />
          {t.spire && <rect x={t.x + t.w / 2 - 3} y={height - t.h - 26} width={6} height={26} fill="#ffd23f" stroke="#061233" strokeWidth={2} />}
          {windowColor &&
            t.windows.map((win, j) =>
              win.lit ? (
                <rect
                  key={j}
                  x={win.x}
                  y={height - t.h + win.y}
                  width={6}
                  height={8}
                  fill={windowColor}
                  className={j % 7 === 0 ? 'cb-blink' : undefined}
                  style={j % 7 === 0 ? { animationDelay: `${(i * 0.7 + j * 0.31) % 6}s` } : undefined}
                />
              ) : null,
            )}
        </g>
      ))}
    </svg>
  );
  return <div className={`cb-skyline ${className}`}>{[0, 1, 2].map(copy)}</div>;
}

function Cloud({ top, duration, delay, scale }: { top: string; duration: number; delay: number; scale: number }) {
  return (
    <div className="cb-cloud" style={{ top, animationDuration: `${duration}s`, animationDelay: `-${delay}s`, transform: `scale(${scale})` }} aria-hidden>
      <span style={{ left: 0, bottom: 0, width: 120 }} />
      <span style={{ left: 18, bottom: 12, width: 60 }} />
      <span style={{ left: 40, bottom: 20, width: 32 }} />
    </div>
  );
}

function Car({ color, reverse }: { color: string; reverse: boolean }) {
  return (
    <div className={`cb-car ${reverse ? 'flip' : ''}`}>
      <span style={{ left: 0, bottom: 6, width: 52, height: 10, background: color }} />
      <span style={{ left: 12, bottom: 16, width: 24, height: 8, background: color }} />
      <span style={{ left: 15, bottom: 17, width: 8, height: 5, background: '#cfefff' }} />
      <span style={{ left: 25, bottom: 17, width: 8, height: 5, background: '#cfefff' }} />
      <span className="cb-headlight" style={{ right: 0, bottom: 10, width: 4, height: 4 }} />
      <span style={{ left: 6, bottom: 0, width: 8, height: 8, background: '#111' }} />
      <span style={{ right: 8, bottom: 0, width: 8, height: 8, background: '#111' }} />
    </div>
  );
}

const COINS = [
  { left: 8, delay: 0, duration: 9 },
  { left: 22, delay: 3.5, duration: 11 },
  { left: 37, delay: 6, duration: 10 },
  { left: 63, delay: 1.5, duration: 12 },
  { left: 78, delay: 5, duration: 9.5 },
  { left: 91, delay: 2.5, duration: 10.5 },
];

const CARS = [
  { color: '#ff4d6d', duration: 9, delay: 0, reverse: false },
  { color: '#38bdf8', duration: 13, delay: 4, reverse: true },
  { color: '#facc15', duration: 7, delay: 2, reverse: false },
  { color: '#a78bfa', duration: 11, delay: 7, reverse: true },
];

// Night sky from top to bottom, in flat pixel-art bands.
const SKY_BANDS = ['#030b24', '#051335', '#071a45', '#0a2357', '#0c2c6a', '#0f377d', '#124390', '#155ab8'];

export function CityBackdrop({ coin = true }: { coin?: boolean }) {
  const scene = useMemo(() => {
    const r = makeRng(77);
    return {
      stars: Array.from({ length: 60 }, () => ({ left: r.next() * 100, top: r.next() * 45, size: r.next() > 0.85 ? 3 : 2, delay: r.next() * 4 })),
      far: makeSkyline(11, 60, 170, false),
      near: makeSkyline(29, 70, 220, true),
    };
  }, []);

  return (
    <div className="city-backdrop" aria-hidden>
      <div className="cb-sky">
        {SKY_BANDS.map((c) => (
          <div key={c} style={{ background: c }} />
        ))}
      </div>
      {scene.stars.map((s, i) => (
        <span key={i} className="cb-star" style={{ left: `${s.left}%`, top: `${s.top}%`, width: s.size, height: s.size, animationDelay: `${s.delay}s` }} />
      ))}
      {coin && (
        <div className="cb-moon">
          <span>$</span>
        </div>
      )}
      <Cloud top="14%" duration={70} delay={10} scale={1} />
      <Cloud top="24%" duration={95} delay={55} scale={0.7} />
      <Cloud top="9%" duration={120} delay={80} scale={1.3} />

      <Skyline towers={scene.far} colors={['#123b8f', '#0f4f5f']} height={260} className="far" />
      <Skyline towers={scene.near} colors={['#1d4fd6', '#1f9d4a', '#2563eb', '#22a845', '#1747b8']} height={300} windowColor="#ffd86b" className="near" />

      <div className="cb-road">
        <div className="cb-grass" />
        <div className="cb-lines">
          {Array.from({ length: 80 }, (_, i) => (
            <span key={i} style={{ left: i * 60 }} />
          ))}
        </div>
      </div>
      {CARS.map((c, i) => (
        <div key={i} className={`cb-drive ${c.reverse ? 'left' : 'right'}`} style={{ animationDuration: `${c.duration}s`, animationDelay: `-${c.delay}s` }}>
          <Car color={c.color} reverse={c.reverse} />
        </div>
      ))}
      {COINS.map((c, i) => (
        <span key={i} className="cb-coin" style={{ left: `${c.left}%`, animationDelay: `${c.delay}s`, animationDuration: `${c.duration}s` }}>
          $
        </span>
      ))}
    </div>
  );
}
