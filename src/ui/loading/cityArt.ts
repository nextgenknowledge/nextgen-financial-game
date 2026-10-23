/**
 * Loading-screen illustrations: a 320×180 pixel-art scene for each destination, painted in code
 * and animated (drifting clouds, twinkling windows, a passing car or boat). Each city has its own
 * time of day, weather and signature landmarks.
 */
export const ART_W = 320;
export const ART_H = 180;

type G = CanvasRenderingContext2D;
type Rnd = () => number;

function rng(seed: number): Rnd {
  let s = seed;
  return () => ((s = (s * 16807) % 2147483647) / 2147483647);
}

const R = (g: G, x: number, y: number, w: number, h: number, c: string) => {
  g.fillStyle = c;
  g.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
};

interface Scene {
  sky: [string, string, string]; // top, middle, horizon
  sun?: { x: number; y: number; r: number; c: string };
  moon?: boolean;
  stars?: boolean;
  haze: string;
  far: string;
  mid: string;
  near: string;
  win: string[]; // window light colors
  winChance: number;
  water?: string;
  ground: string;
  clouds: string;
  draw: (g: G, t: number, r: Rnd) => void;
}

function gradientSky(g: G, s: Scene) {
  const gr = g.createLinearGradient(0, 0, 0, ART_H * 0.75);
  gr.addColorStop(0, s.sky[0]);
  gr.addColorStop(0.55, s.sky[1]);
  gr.addColorStop(1, s.sky[2]);
  g.fillStyle = gr;
  g.fillRect(0, 0, ART_W, ART_H);
  // Dither bands for a retro look
  for (let y = 0; y < ART_H * 0.75; y += 2) for (let x = (y / 2) % 4; x < ART_W; x += 4) {
    g.fillStyle = 'rgba(255,255,255,0.025)';
    g.fillRect(x, y, 1, 1);
  }
}

function stars(g: G, t: number) {
  const r = rng(9);
  for (let i = 0; i < 70; i++) {
    const x = r() * ART_W;
    const y = r() * ART_H * 0.5;
    const tw = Math.sin(t * 2 + i) > 0.6 ? 0.9 : 0.5;
    g.fillStyle = `rgba(255,255,240,${tw})`;
    g.fillRect(Math.round(x), Math.round(y), 1, 1);
  }
}

function clouds(g: G, t: number, color: string, y0: number, n = 5) {
  const r = rng(4);
  for (let i = 0; i < n; i++) {
    const w = 30 + r() * 40;
    const x = ((r() * ART_W + t * (3 + r() * 4)) % (ART_W + w * 2)) - w;
    const y = y0 + r() * 30;
    g.fillStyle = color;
    for (let k = 0; k < 5; k++) {
      const cx = x + (k / 4) * w;
      const ch = 4 + Math.sin((k / 4) * Math.PI) * 8;
      g.fillRect(Math.round(cx - 6), Math.round(y - ch), 12, Math.round(ch + 3));
    }
    g.fillRect(Math.round(x - 6), Math.round(y), Math.round(w + 12), 3);
  }
}

/** A row of rectangular towers with lit windows. */
function skyline(g: G, r: Rnd, base: number, minH: number, maxH: number, color: string, win: string[], winChance: number, t: number, step = [8, 18], seedT = 0) {
  let x = -4;
  while (x < ART_W) {
    const w = step[0] + Math.floor(r() * (step[1] - step[0]));
    const h = minH + Math.floor(r() * (maxH - minH));
    R(g, x, base - h, w, h, color);
    if (r() < 0.3) R(g, x + Math.floor(w / 2) - 1, base - h - 4, 1, 4, color); // antenna
    if (win.length)
      for (let y = base - h + 3; y < base - 2; y += 3)
        for (let wx = x + 2; wx < x + w - 1; wx += 3) {
          const on = Math.sin(wx * 12.9898 + y * 78.233 + Math.floor((t + seedT) / 4)) * 43758.5453;
          if (on - Math.floor(on) < winChance) R(g, wx, y, 1, 1, win[Math.floor((on * 7) % win.length + win.length) % win.length]);
        }
    x += w + (r() < 0.25 ? 2 : 0);
  }
}

function water(g: G, top: number, color: string, t: number) {
  R(g, 0, top, ART_W, ART_H - top, color);
  for (let y = top + 2; y < ART_H; y += 3)
    for (let x = 0; x < ART_W; x += 1) {
      const v = Math.sin(x * 0.3 + y * 1.7 + t * 2);
      if (v > 0.92) R(g, x, y, 3, 1, 'rgba(255,255,255,0.28)');
    }
}

function lampRow(g: G, base: number, color: string, glow: string | null) {
  for (let x = 14; x < ART_W; x += 46) {
    R(g, x, base - 26, 2, 26, color);
    R(g, x - 2, base - 28, 6, 3, color);
    if (glow) {
      g.fillStyle = glow;
      g.beginPath();
      g.arc(x + 1, base - 24, 6, 0, Math.PI * 2);
      g.fill();
    }
  }
}

function car(g: G, x: number, y: number, body: string, night: boolean) {
  R(g, x, y - 5, 18, 4, body);
  R(g, x + 4, y - 9, 10, 4, body);
  R(g, x + 5, y - 8, 3, 2, '#9fb8c8');
  R(g, x + 10, y - 8, 3, 2, '#9fb8c8');
  R(g, x + 2, y - 1, 3, 2, '#111');
  R(g, x + 13, y - 1, 3, 2, '#111');
  if (night) R(g, x + 17, y - 4, 4, 2, '#ffe9a8');
}

/* ───────── Scenes ───────── */

const SCENES: Record<string, Scene> = {
  park: {
    sky: ['#4f86c6', '#8fbbe0', '#dcebf2'],
    sun: { x: 250, y: 34, r: 12, c: '#fff6cf' },
    haze: '#c9dbe2',
    far: '#9ab2a8',
    mid: '#6f9b6a',
    near: '#4a7a46',
    win: [],
    winChance: 0,
    ground: '#6f9c50',
    clouds: 'rgba(255,255,255,0.9)',
    draw: (g, t, r) => {
      skyline(g, r, 112, 18, 46, '#a9bcc6', ['#e8f0f4'], 0.15, t, [10, 22]);
      // rolling hills and park trees
      for (let x = 0; x < ART_W; x++) R(g, x, 112 - Math.sin(x * 0.03) * 6, 1, 70, '#7aa860');
      for (let i = 0; i < 22; i++) {
        const x = (i * 37) % ART_W;
        const y = 120 + ((i * 13) % 20);
        R(g, x + 3, y, 2, 8, '#5a4030');
        g.fillStyle = i % 3 ? '#3f6e34' : '#4f7f3c';
        g.beginPath();
        g.arc(x + 4, y - 3, 7, 0, Math.PI * 2);
        g.fill();
      }
      // Classical welcome hall with columns and a dome
      R(g, 120, 100, 80, 34, '#e9e2d2');
      R(g, 114, 96, 92, 5, '#d8cdb4');
      for (let k = 0; k < 7; k++) R(g, 126 + k * 11, 102, 3, 30, '#f4f1ea');
      R(g, 150, 84, 20, 12, '#d8cdb4');
      g.fillStyle = '#5f8a7a';
      g.beginPath();
      g.arc(160, 84, 11, Math.PI, 0);
      g.fill();
      // Fountain on the plaza
      R(g, 0, 140, ART_W, 40, '#d9cdb4');
      R(g, 140, 146, 40, 6, '#bdb3a0');
      R(g, 144, 142, 32, 5, '#5aa0c8');
      R(g, 158, 130, 4, 14, '#bdb3a0');
      for (let k = 0; k < 6; k++) R(g, 154 + k * 2, 124 - (Math.sin(t * 4 + k) + 1) * 3, 1, 4, 'rgba(200,230,250,0.9)');
      lampRow(g, 168, '#2a2e2c', null);
    },
  },
  'new-york': {
    sky: ['#2d3a6b', '#c96a5a', '#f4b46a'],
    sun: { x: 64, y: 108, r: 16, c: '#ffd98a' },
    haze: '#e8a070',
    far: '#7a6a80',
    mid: '#4a3f52',
    near: '#2a2430',
    win: ['#ffd98a', '#ffe9b0', '#f2c06a'],
    winChance: 0.45,
    water: '#3a3a5a',
    ground: '#3a3438',
    clouds: 'rgba(255,200,170,0.55)',
    draw: (g, t, r) => {
      skyline(g, r, 132, 30, 80, '#8a6a7a', ['#ffd98a'], 0.18, t, [8, 16]);
      // Art-deco spire
      const x = 220;
      R(g, x, 46, 24, 90, '#3a3044');
      R(g, x + 4, 34, 16, 14, '#3a3044');
      R(g, x + 7, 24, 10, 12, '#3a3044');
      R(g, x + 10, 8, 4, 18, '#3a3044');
      R(g, x + 11, 2, 2, 8, '#c8ccd4');
      for (let y = 50; y < 132; y += 4) for (let wx = x + 3; wx < x + 22; wx += 4) if ((wx + y) % 3) R(g, wx, y, 2, 2, '#ffd98a');
      skyline(g, r, 140, 20, 56, '#2a2430', ['#ffd98a', '#ffe9b0'], 0.4, t, [10, 22], 3);
      water(g, 140, '#3a3a5a', t);
      // Torch statue on its island
      R(g, 30, 136, 26, 4, '#2a2430');
      R(g, 38, 124, 10, 12, '#2a2430');
      R(g, 41, 104, 5, 20, '#2f5a50');
      R(g, 45, 96, 2, 10, '#2f5a50');
      R(g, 44, 92, 4, 4, '#ffcf3f');
      // Yellow cab crossing the pier road
      R(g, 0, 166, ART_W, 14, '#2a2628');
      car(g, ((t * 40) % (ART_W + 40)) - 30, 176, '#e8b923', true);
    },
  },
  london: {
    sky: ['#7a8694', '#a9b2bb', '#d0d3d2'],
    haze: '#c2c6c6',
    far: '#9aa0a6',
    mid: '#6f757c',
    near: '#40454c',
    win: ['#f2d9a0'],
    winChance: 0.18,
    water: '#5a6670',
    ground: '#4a4f55',
    clouds: 'rgba(235,238,240,0.85)',
    draw: (g, t, r) => {
      skyline(g, r, 126, 18, 50, '#8d949b', ['#f2d9a0'], 0.08, t, [8, 18]);
      // Big wheel
      g.strokeStyle = '#d8dce0';
      g.lineWidth = 1;
      g.beginPath();
      g.arc(70, 92, 30, 0, Math.PI * 2);
      g.stroke();
      for (let k = 0; k < 12; k++) {
        const a = (k / 12) * Math.PI * 2 + t * 0.05;
        g.beginPath();
        g.moveTo(70, 92);
        g.lineTo(70 + Math.cos(a) * 30, 92 + Math.sin(a) * 30);
        g.stroke();
        R(g, 70 + Math.cos(a) * 30 - 2, 92 + Math.sin(a) * 30 - 1, 4, 3, '#e8ecf0');
      }
      // Clock tower
      R(g, 150, 46, 14, 86, '#6a604a');
      R(g, 148, 40, 18, 12, '#7a705a');
      R(g, 152, 43, 10, 8, '#f4ecd0');
      R(g, 156, 44, 1, 4, '#222');
      for (let k = 0; k < 6; k++) R(g, 150 + k, 40 - k * 3, 14 - k * 2, 3, '#3d4a52');
      R(g, 156, 18, 2, 6, '#c9a24a');
      // Tower bridge
      water(g, 132, '#5a6670', t);
      for (const bx of [214, 268]) {
        R(g, bx, 84, 16, 50, '#6a604a');
        R(g, bx + 2, 76, 3, 8, '#3d4a52');
        R(g, bx + 11, 76, 3, 8, '#3d4a52');
        R(g, bx + 5, 70, 6, 14, '#3d4a52');
      }
      R(g, 230, 92, 38, 4, '#2f5f9a');
      R(g, 196, 116, 106, 4, '#4a4f55');
      // Red bus
      R(g, 0, 166, ART_W, 14, '#3a3e44');
      const bxp = ((t * 30) % (ART_W + 60)) - 50;
      R(g, bxp, 150, 34, 22, '#b3261e');
      for (let k = 0; k < 4; k++) R(g, bxp + 3 + k * 8, 153, 5, 4, '#d8e4ec');
      for (let k = 0; k < 4; k++) R(g, bxp + 3 + k * 8, 161, 5, 4, '#d8e4ec');
    },
  },
  'san-francisco': {
    sky: ['#8a9ec4', '#e4b8b8', '#f6dcc8'],
    sun: { x: 268, y: 64, r: 12, c: '#fff0d0' },
    haze: '#f2d6cc',
    far: '#b8a8b8',
    mid: '#8a7a8e',
    near: '#5a4e60',
    win: ['#fff0d0'],
    winChance: 0.12,
    water: '#6a86a0',
    ground: '#7a6a6a',
    clouds: 'rgba(255,240,240,0.8)',
    draw: (g, t, r) => {
      skyline(g, r, 112, 16, 44, '#b8a8b8', ['#fff0d0'], 0.08, t, [8, 16]);
      // Pyramid tower
      g.fillStyle = '#e8e2e8';
      g.beginPath();
      g.moveTo(96, 14);
      g.lineTo(110, 112);
      g.lineTo(82, 112);
      g.closePath();
      g.fill();
      water(g, 112, '#6a86a0', t);
      // Golden Gate style bridge
      const orange = '#c0512f';
      for (const bx of [170, 262]) {
        R(g, bx, 52, 5, 74, orange);
        R(g, bx + 9, 52, 5, 74, orange);
        R(g, bx, 64, 14, 3, orange);
        R(g, bx, 86, 14, 3, orange);
      }
      R(g, 140, 112, 180, 4, orange);
      g.strokeStyle = orange;
      g.beginPath();
      g.moveTo(140, 100);
      g.quadraticCurveTo(220, 150, 177, 54);
      g.moveTo(177, 54);
      g.quadraticCurveTo(222, 130, 269, 54);
      g.moveTo(269, 54);
      g.quadraticCurveTo(300, 110, 320, 100);
      g.stroke();
      // Fog bank drifting over the hills
      for (let x = 0; x < ART_W; x += 2) R(g, x, 104 + Math.sin(x * 0.05 + t * 0.4) * 3, 2, 6, 'rgba(255,245,245,0.5)');
      // Painted-lady row on the hill in front
      const pastel = ['#d9b8d6', '#b8dcd0', '#f2d39a', '#f4c1a8', '#b9cde8', '#cfe3b4'];
      R(g, 0, 150, ART_W, 30, '#7a8a5a');
      for (let k = 0; k < 9; k++) {
        const hx = 6 + k * 34;
        const c = pastel[k % pastel.length];
        R(g, hx, 128, 28, 26, c);
        g.fillStyle = c;
        g.beginPath();
        g.moveTo(hx - 1, 128);
        g.lineTo(hx + 14, 116);
        g.lineTo(hx + 29, 128);
        g.closePath();
        g.fill();
        R(g, hx + 3, 132, 8, 14, '#f4f1ea');
        R(g, hx + 4, 133, 6, 12, '#5a6a7a');
        R(g, hx + 16, 134, 8, 8, '#5a6a7a');
        R(g, hx - 1, 127, 30, 1, '#f4f1ea');
      }
    },
  },
  'hong-kong': {
    sky: ['#0b1028', '#1f1f4a', '#4a2f5a'],
    moon: true,
    stars: true,
    haze: '#3a2f5a',
    far: '#2a2a4a',
    mid: '#1f1f36',
    near: '#141424',
    win: ['#ffe9a8', '#bfe8ff', '#ffd0e8', '#c8ffd0'],
    winChance: 0.55,
    water: '#141a36',
    ground: '#141424',
    clouds: 'rgba(80,70,120,0.45)',
    draw: (g, t, r) => {
      // The Peak behind the city
      for (let x = 0; x < ART_W; x++) R(g, x, 70 + Math.abs(Math.sin(x * 0.012 + 0.6)) * 30 + Math.sin(x * 0.07) * 4, 1, 80, '#1a2a2a');
      skyline(g, r, 132, 50, 110, '#24244a', ['#ffe9a8', '#bfe8ff', '#ffd0e8'], 0.55, t, [6, 12]);
      skyline(g, r, 136, 30, 70, '#1a1a30', ['#ffe9a8', '#bfe8ff'], 0.6, t, [8, 14], 5);
      // Neon signs on the near towers
      const neon = ['#ff4a6e', '#3dd6ff', '#ffd54a', '#7dff7a'];
      for (let k = 0; k < 9; k++) {
        const x = 14 + k * 34;
        const on = Math.sin(t * 3 + k) > -0.6;
        if (on) R(g, x, 96 + (k % 3) * 8, 3, 18, neon[k % 4]);
      }
      water(g, 136, '#141a36', t);
      // Reflections of the lights in the harbour
      for (let x = 0; x < ART_W; x += 5) R(g, x, 140 + ((x * 7) % 30), 2, 1, 'rgba(255,220,160,0.35)');
      // Junk boat with red sails
      const jx = ((t * 12) % (ART_W + 60)) - 50;
      R(g, jx, 158, 40, 6, '#4a2e1e');
      R(g, jx + 4, 154, 32, 4, '#5a3a24');
      for (const [sx, sh] of [[8, 26], [20, 30], [31, 22]] as const) {
        R(g, jx + sx, 158 - sh - 4, 1, sh + 4, '#3a2418');
        R(g, jx + sx + 1, 158 - sh - 2, 9, sh - 4, '#b8402e');
        for (let k = 0; k < sh - 6; k += 4) R(g, jx + sx + 1, 158 - sh + k, 9, 1, '#8a2e20');
      }
    },
  },
  singapore: {
    sky: ['#3a2f6a', '#e0708a', '#f8c08a'],
    sun: { x: 160, y: 104, r: 18, c: '#ffd49a' },
    haze: '#f0a888',
    far: '#9a7a9a',
    mid: '#5a4a6a',
    near: '#2a2438',
    win: ['#fff0c8', '#ffe0a0'],
    winChance: 0.3,
    water: '#3a3a6a',
    ground: '#2a2438',
    clouds: 'rgba(255,190,170,0.55)',
    draw: (g, t, r) => {
      skyline(g, r, 124, 24, 64, '#8a6a8a', ['#fff0c8'], 0.2, t, [8, 16]);
      // Three towers + sky deck
      for (const bx of [112, 140, 168]) R(g, bx, 54, 14, 72, '#4a3f5e');
      R(g, 104, 48, 92, 6, '#5a4f6e');
      R(g, 188, 50, 14, 4, '#5a4f6e');
      for (let x = 108; x < 192; x += 6) R(g, x, 46, 3, 2, '#3f6e34');
      // Observation wheel
      g.strokeStyle = '#d8dce8';
      g.beginPath();
      g.arc(262, 92, 26, 0, Math.PI * 2);
      g.stroke();
      for (let k = 0; k < 10; k++) {
        const a = (k / 10) * Math.PI * 2 + t * 0.05;
        R(g, 262 + Math.cos(a) * 26 - 1, 92 + Math.sin(a) * 26 - 1, 3, 3, '#e8ecf4');
      }
      water(g, 126, '#3a3a6a', t);
      // Supertrees glowing on the shore
      for (const [sx, sh] of [[24, 46], [44, 38], [64, 52], [84, 34]] as const) {
        R(g, sx, 172 - sh, 4, sh, '#2a3a2a');
        const glow = ['#c77dff', '#ff8ad0', '#7ad6ff'][Math.floor(t + sx) % 3];
        g.strokeStyle = glow;
        g.beginPath();
        g.moveTo(sx - 10, 172 - sh - 8);
        g.lineTo(sx + 2, 172 - sh + 2);
        g.lineTo(sx + 14, 172 - sh - 8);
        g.stroke();
        R(g, sx - 10, 172 - sh - 9, 24, 1, glow);
      }
      R(g, 0, 172, ART_W, 8, '#2a2438');
    },
  },
};

/** Paints the destination scene for time `t` (seconds). */
export function drawCityArt(g: G, city: string, t: number) {
  const s = SCENES[city] ?? SCENES.park;
  const r = rng(city.length * 131 + 7);
  g.imageSmoothingEnabled = false;
  gradientSky(g, s);
  if (s.stars) stars(g, t);
  if (s.sun) {
    g.fillStyle = s.sun.c;
    g.beginPath();
    g.arc(s.sun.x, s.sun.y, s.sun.r, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = 'rgba(255,240,200,0.18)';
    g.beginPath();
    g.arc(s.sun.x, s.sun.y, s.sun.r * 1.8, 0, Math.PI * 2);
    g.fill();
  }
  if (s.moon) {
    R(g, 270, 22, 12, 12, '#f2ecd8');
    R(g, 274, 22, 8, 8, '#e0d8c0');
  }
  clouds(g, t, s.clouds, 28, 5);
  s.draw(g, t, r);
  // Soft vignette
  const v = g.createRadialGradient(ART_W / 2, ART_H / 2, ART_H * 0.4, ART_W / 2, ART_H / 2, ART_W * 0.75);
  v.addColorStop(0, 'rgba(0,0,0,0)');
  v.addColorStop(1, 'rgba(0,0,0,0.35)');
  g.fillStyle = v;
  g.fillRect(0, 0, ART_W, ART_H);
}
