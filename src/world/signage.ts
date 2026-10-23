/**
 * Real-world signage, painted procedurally at a low resolution (crisp pixel look) and lit by the
 * scene like any other surface. Each kind imitates a real sign type instead of a UI label:
 *
 *   carved     – letters engraved into a stone frieze (banks, libraries, civic halls)
 *   letters    – individual brushed-metal channel letters on a facade (offices, towers)
 *   fascia     – painted shop board with a moulded frame (shops, cafés, markets)
 *   marquee    – theatre/arcade marquee with a border of bulbs (glows at night)
 *   wayfinding – hanging interior direction sign (bank halls, offices)
 *   transit    – station-style destination sign (portals between cities)
 *   realty     – estate agent's yard sign (FOR SALE / SOLD)
 *   hoarding   – stencilled plywood construction hoarding
 *   notice     – wooden noticeboard header
 *   barrier    – yellow/black "closed" barrier board
 *   poster     – backlit bus-shelter ad (portrait)
 *   billboard  – rooftop billboard ad (landscape), printed vinyl look
 */
import * as THREE from 'three';

export type SignKind = 'carved' | 'letters' | 'fascia' | 'marquee' | 'wayfinding' | 'transit' | 'realty' | 'hoarding' | 'notice' | 'barrier' | 'poster' | 'billboard' | 'neon' | 'panel' | 'raised' | 'street';

export interface SignStyle {
  kind: SignKind;
  text: string;
  /** Second, smaller line (e.g. "Fin City Realty"). */
  sub?: string;
  /** Size in meters (sets the pixel resolution). */
  w: number;
  h: number;
  /** Board / letter colors where the kind uses them. */
  bg?: string;
  fg?: string;
  /** Typeface for 'raised' lettering. */
  font?: 'roman' | 'serif' | 'sans' | 'corp' | 'cond';
  /** Set letters in capitals. */
  upper?: boolean;
}

/** Fictional ads for in-game companies. */
export const AD_COPY = [
  { name: 'Byte Burger', tag: 'Flame-grilled since 1998', bg: '#b3261e', fg: '#ffd36b' },
  { name: 'Sparkle Soda', tag: 'Ice cold. Zero regrets.', bg: '#1f6fb2', fg: '#ffffff' },
  { name: 'ZoomRail', tag: 'Downtown in 9 minutes', bg: '#1d2b3f', fg: '#7fd3c9' },
  { name: 'CloudKite', tag: 'Your files, everywhere', bg: '#f2f2ee', fg: '#1f6fb2' },
  { name: 'Greenleaf Grocers', tag: 'Fresh. Local. Fair prices.', bg: '#2f5f3a', fg: '#f2e7c9' },
  { name: 'PixelPlay', tag: 'New season out now', bg: '#2a1f3d', fg: '#ff9ad5' },
  { name: 'Fin City Bank', tag: 'Save smarter today', bg: '#14243d', fg: '#d9b95c' },
  { name: 'Orbit Outfitters', tag: 'Gear for every trail', bg: '#d36b2a', fg: '#1b1b1b' },
  { name: 'Healio', tag: 'Care that comes to you', bg: '#e9f2f1', fg: '#1d6b63' },
  { name: 'Starlight Studios', tag: 'Now showing', bg: '#0f0f14', fg: '#f2d27a' },
];


const PX_PER_M = 96;
const MAX_PX = 2048;
/** Real signage typefaces, bundled with the game (see CREDITS.md). */
const ROMAN = "'Cinzel', Georgia, serif"; // inscriptional capitals cut into stone
const SERIF = "'Playfair Display', Georgia, serif"; // painted shop boards, noticeboards
const SANS = "'Inter', 'Helvetica Neue', Arial, sans-serif"; // transit and wayfinding
const CORP = "'Montserrat', 'Helvetica Neue', Arial, sans-serif"; // channel letters on offices
const COND = "'Oswald', 'Arial Narrow', Arial, sans-serif"; // marquees, hoardings, barriers, neon
const DISPLAY = "'Bebas Neue', 'Oswald', Arial, sans-serif"; // ad headlines

/** Faces to load before painting signs; canvas text never triggers a font download on its own. */
const SIGN_FONTS = [`700 32px ${ROMAN}`, `700 32px ${SERIF}`, `500 32px ${SANS}`, `700 32px ${SANS}`, `600 32px ${CORP}`, `800 32px ${CORP}`, `600 32px ${COND}`, `400 32px ${DISPLAY}`];
let fontsReady = false;
let fontsPromise: Promise<void> | null = null;
const repaint: (() => void)[] = [];
export function loadSignFonts(): Promise<void> {
  if (typeof document === 'undefined' || !document.fonts) return Promise.resolve();
  fontsPromise ??= Promise.all(SIGN_FONTS.map((f) => document.fonts.load(f).catch(() => [])))
    .then(() => {
      fontsReady = true;
      repaint.splice(0).forEach((f) => f());
    });
  return fontsPromise;
}

/** Signs never carry emoji, real signs don't. */
export function signText(s: string) {
  return s.replace(/[\p{Extended_Pictographic}\u{FE0F}\u{200D}]/gu, '').replace(/\s+/g, ' ').trim();
}

function rnd(seed: number) {
  let s = seed || 1;
  return () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };
}

function hash(str: string) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** Largest font size (px) at which `text` fits inside maxW×maxH. */
function fit(g: CanvasRenderingContext2D, text: string, family: string, weight: string, maxW: number, maxH: number, spacing = 0) {
  let size = Math.floor(maxH);
  for (; size > 6; size--) {
    g.font = `${weight} ${size}px ${family}`;
    (g as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = `${Math.round(size * spacing)}px`;
    if (g.measureText(text).width <= maxW) break;
  }
  return size;
}

/** Sprinkle of dirt/fade so boards look weathered rather than freshly printed. */
function weather(g: CanvasRenderingContext2D, w: number, h: number, r: () => number, amount = 0.05) {
  const n = Math.round(w * h * amount);
  for (let i = 0; i < n; i++) {
    g.fillStyle = r() < 0.5 ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.06)';
    g.fillRect(Math.floor(r() * w), Math.floor(r() * h), 1, 1);
  }
}

function grain(g: CanvasRenderingContext2D, w: number, h: number, base: string, r: () => number, vertical = true) {
  g.fillStyle = base;
  g.fillRect(0, 0, w, h);
  const n = vertical ? w : h;
  for (let i = 0; i < n; i++) {
    g.fillStyle = `rgba(${r() < 0.5 ? '0,0,0' : '255,240,210'},${0.03 + r() * 0.07})`;
    if (vertical) g.fillRect(i, 0, 1, h);
    else g.fillRect(0, i, w, 1);
  }
}

function paint(st: SignStyle, W: number, H: number, g: CanvasRenderingContext2D) {
  const text = signText(st.text);
  const r = rnd(hash(st.kind + text));
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  const ls = (v: number) => ((g as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = `${v}px`);
  switch (st.kind) {
    case 'street': {
      // Street-name blade: enamel plate in the city's colours, white rim, clean sans lettering.
      // London's plates are white with a red rule under the name.
      g.fillStyle = st.bg ?? '#1f6b3a';
      g.fillRect(0, 0, W, H);
      g.strokeStyle = st.bg === '#f4f2ec' ? '#1b1c1f' : 'rgba(255,255,255,0.9)';
      g.lineWidth = 1.2;
      g.strokeRect(2, 2, W - 4, H - 4);
      const size = fit(g, text, SANS, '700', W - 14, H * 0.6, 0.02);
      ls(Math.round(size * 0.02));
      g.font = `700 ${size}px ${SANS}`;
      g.fillStyle = st.fg ?? '#ffffff';
      g.fillText(text, W / 2, H / 2 + 0.5);
      if (st.bg === '#f4f2ec') {
        g.fillStyle = '#c23b2e';
        g.fillRect(6, H - 5, W - 12, 1.5);
      }
      weather(g, W, H, r, 0.02);
      break;
    }
    case 'panel': {
      // Sign board face: painted panel with a bevelled edge and a fine inset line, no lettering
      const bg = new THREE.Color(st.bg ?? '#1f2a3a');
      const grad = g.createLinearGradient(0, 0, 0, H);
      grad.addColorStop(0, bg.clone().multiplyScalar(1.18).getStyle());
      grad.addColorStop(1, bg.clone().multiplyScalar(0.82).getStyle());
      g.fillStyle = grad;
      g.fillRect(0, 0, W, H);
      g.fillStyle = 'rgba(255,255,255,0.22)';
      g.fillRect(0, 0, W, 1.5);
      g.fillRect(0, 0, 1.5, H);
      g.fillStyle = 'rgba(0,0,0,0.35)';
      g.fillRect(0, H - 1.5, W, 1.5);
      g.fillRect(W - 1.5, 0, 1.5, H);
      if (st.fg) {
        g.strokeStyle = st.fg;
        g.globalAlpha = 0.55;
        g.lineWidth = 0.75;
        g.strokeRect(3.5, 3.5, W - 7, H - 7);
        g.globalAlpha = 1;
      }
      weather(g, W, H, r, 0.025);
      break;
    }
    case 'raised': {
      // Lettering only (transparent elsewhere): stands proud of a panel as separate 3D layers
      const family = { roman: ROMAN, serif: SERIF, sans: SANS, corp: CORP, cond: COND }[st.font ?? 'corp'];
      const weight = st.font === 'sans' ? '700' : st.font === 'cond' ? '600' : st.font === 'corp' ? '800' : '700';
      const t = st.upper ? text.toUpperCase() : text;
      const sp = st.upper ? 0.08 : 0.02;
      const size = fit(g, t, family, weight, W * 0.9, H * (st.sub ? 0.5 : 0.66), sp);
      ls(Math.round(size * sp));
      g.font = `${weight} ${size}px ${family}`;
      const y = st.sub ? H * 0.4 : H / 2 + size * 0.04;
      g.fillStyle = st.fg ?? '#ffffff';
      g.fillText(t, W / 2, y);
      // Light catching the top edge of each letter
      g.globalCompositeOperation = 'source-atop';
      g.fillStyle = 'rgba(255,255,255,0.28)';
      g.fillRect(0, 0, W, y - size * 0.22);
      g.globalCompositeOperation = 'source-over';
      if (st.sub) {
        ls(Math.round(size * 0.04));
        const s2 = Math.max(6, Math.round(size * 0.36));
        g.font = `600 ${s2}px ${SANS}`;
        g.fillStyle = st.fg ?? '#ffffff';
        g.globalAlpha = 0.85;
        g.fillText(signText(st.sub).toUpperCase(), W / 2, H * 0.78);
        g.globalAlpha = 1;
      }
      break;
    }
    case 'carved': {
      const t = text.toUpperCase();
      const size = fit(g, t, ROMAN, '700', W * 0.94, H * 0.72, 0.12);
      ls(Math.round(size * 0.12));
      g.font = `700 ${size}px ${ROMAN}`;
      // Recessed V-cut: dark upper wall of the groove, light lower lip
      g.fillStyle = 'rgba(20,16,12,0.55)';
      g.fillText(t, W / 2, H / 2 - 1.5);
      g.fillStyle = 'rgba(255,250,235,0.6)'; // lit lower lip of the cut
      g.fillText(t, W / 2, H / 2 + 2.5);
      g.fillStyle = 'rgba(52,46,38,0.92)';
      g.fillText(t, W / 2, H / 2);
      break;
    }
    case 'letters': {
      const t = text;
      const size = fit(g, t, CORP, '600', W * 0.96, H * 0.8, 0.03);
      ls(Math.round(size * 0.03));
      g.font = `600 ${size}px ${CORP}`;
      g.fillStyle = 'rgba(0,0,0,0.4)'; // soft cast shadow of letters standing off the wall
      g.fillText(t, W / 2 + 3, H / 2 + 5);
      g.fillStyle = 'rgba(0,0,0,0.2)';
      g.fillText(t, W / 2 + 5, H / 2 + 8);
      const grad = g.createLinearGradient(0, H / 2 - size / 2, 0, H / 2 + size / 2);
      const c = st.fg ?? '#e6e8eb';
      grad.addColorStop(0, '#ffffff');
      grad.addColorStop(0.45, c);
      grad.addColorStop(1, new THREE.Color(c).multiplyScalar(0.7).getStyle());
      g.fillStyle = grad;
      g.fillText(t, W / 2, H / 2);
      break;
    }
    case 'fascia': {
      const bg = st.bg ?? '#1f3a2e';
      grain(g, W, H, bg, r, false);
      // Moulded frame: light top bevel, dark bottom, inner gold/cream line
      g.fillStyle = 'rgba(255,255,255,0.18)';
      g.fillRect(0, 0, W, 2);
      g.fillStyle = 'rgba(0,0,0,0.35)';
      g.fillRect(0, H - 2, W, 2);
      g.strokeStyle = st.fg ? `${st.fg}99` : 'rgba(232,217,168,0.6)';
      g.lineWidth = 1;
      g.strokeRect(4.5, 4.5, W - 9, H - 9);
      const size = fit(g, text, SERIF, '700', W - 24, H * 0.62, 0.06);
      ls(Math.round(size * 0.06));
      g.font = `700 ${size}px ${SERIF}`;
      g.fillStyle = 'rgba(0,0,0,0.4)';
      g.fillText(text, W / 2 + 1, H / 2 + 2);
      g.fillStyle = st.fg ?? '#eadcae';
      g.fillText(text, W / 2, H / 2 + 1);
      weather(g, W, H, r, 0.04);
      break;
    }
    case 'marquee': {
      g.fillStyle = st.bg ?? '#17131c';
      g.fillRect(0, 0, W, H);
      g.fillStyle = '#3a2c1c';
      g.fillRect(0, 0, W, 3);
      g.fillRect(0, H - 3, W, 3);
      // Bulb border
      for (let x = 6; x < W - 3; x += 8) {
        g.fillStyle = (x / 8) % 2 < 1 ? '#fff1b8' : '#ffd36b';
        g.fillRect(x - 1, 4, 3, 3);
        g.fillRect(x - 1, H - 7, 3, 3);
      }
      const t = text.toUpperCase();
      const size = fit(g, t, COND, '600', W - 20, H * 0.56, 0.06);
      ls(Math.round(size * 0.06));
      g.font = `600 ${size}px ${COND}`;
      g.fillStyle = st.fg ?? '#ffe7a3';
      g.fillText(t, W / 2, H / 2 + 1);
      break;
    }
    case 'wayfinding': {
      g.fillStyle = st.bg ?? '#23272f';
      g.fillRect(0, 0, W, H);
      g.fillStyle = 'rgba(255,255,255,0.08)';
      g.fillRect(0, 0, W, 2);
      g.fillStyle = st.fg ?? '#c9a24a';
      g.fillRect(8, H - 6, W - 16, 2); // accent rule
      const size = fit(g, text, SANS, '500', W - 24, H * 0.5, 0.01);
      ls(Math.round(size * 0.01));
      g.font = `500 ${size}px ${SANS}`;
      g.fillStyle = '#f2f2ee';
      g.fillText(text, W / 2, H / 2 - 1);
      break;
    }
    case 'transit': {
      g.fillStyle = st.bg ?? '#1c2b45';
      g.fillRect(0, 0, W, H);
      g.strokeStyle = 'rgba(255,255,255,0.85)';
      g.lineWidth = 2;
      g.strokeRect(4, 4, W - 8, H - 8);
      // Arrow on the left
      const a = H * 0.32;
      g.fillStyle = '#ffffff';
      g.beginPath();
      g.moveTo(14, H / 2 - a / 2);
      g.lineTo(14 + a, H / 2);
      g.lineTo(14, H / 2 + a / 2);
      g.fill();
      const tx = 20 + a;
      g.textAlign = 'left';
      const size = fit(g, text, SANS, '700', W - tx - 14, H * (st.sub ? 0.4 : 0.55));
      g.font = `700 ${size}px ${SANS}`;
      g.fillText(text, tx, st.sub ? H * 0.42 : H / 2);
      if (st.sub) {
        g.font = `500 ${Math.round(size * 0.55)}px ${SANS}`;
        g.fillStyle = 'rgba(255,255,255,0.75)';
        g.fillText(signText(st.sub), tx, H * 0.74);
      }
      break;
    }
    case 'realty': {
      g.fillStyle = '#f4f1ea';
      g.fillRect(0, 0, W, H);
      g.fillStyle = st.bg ?? '#b3261e';
      g.fillRect(0, 0, W, Math.round(H * 0.5));
      const t = text.toUpperCase();
      const size = fit(g, t, CORP, '800', W - 16, H * 0.36, 0.05);
      ls(Math.round(size * 0.05));
      g.font = `800 ${size}px ${CORP}`;
      g.fillStyle = '#ffffff';
      g.fillText(t, W / 2, H * 0.25);
      ls(0);
      g.font = `600 ${Math.round(size * 0.5)}px ${SANS}`;
      g.fillStyle = '#2a2a2a';
      g.fillText(signText(st.sub ?? 'Fin City Realty'), W / 2, H * 0.74);
      g.strokeStyle = '#2a2a2a';
      g.strokeRect(0.5, 0.5, W - 1, H - 1);
      weather(g, W, H, r, 0.03);
      break;
    }
    case 'hoarding': {
      grain(g, W, H, '#b08a5a', r, true);
      for (let x = Math.round(W / 4); x < W; x += Math.round(W / 4)) {
        g.fillStyle = 'rgba(0,0,0,0.25)';
        g.fillRect(x, 0, 1, H);
      }
      const t = text.toUpperCase();
      const size = fit(g, t, COND, '600', W * 0.9, H * (st.sub ? 0.42 : 0.6), 0.08);
      ls(Math.round(size * 0.08));
      g.font = `600 ${size}px ${COND}`;
      g.fillStyle = 'rgba(28,24,20,0.88)';
      g.fillText(t, W / 2, st.sub ? H * 0.38 : H / 2);
      if (st.sub) {
        ls(0);
        g.font = `600 ${Math.round(size * 0.48)}px ${SANS}`;
        g.fillText(signText(st.sub), W / 2, H * 0.76);
      }
      weather(g, W, H, r, 0.06);
      break;
    }
    case 'notice': {
      grain(g, W, H, '#4a3324', r, false);
      g.fillStyle = 'rgba(0,0,0,0.3)';
      g.fillRect(0, H - 2, W, 2);
      const size = fit(g, text, SERIF, '700', W - 16, H * 0.6, 0.05);
      ls(Math.round(size * 0.05));
      g.font = `700 ${size}px ${SERIF}`;
      g.fillStyle = '#efe2c0';
      g.fillText(text, W / 2, H / 2 + 1);
      weather(g, W, H, r, 0.05);
      break;
    }
    case 'poster':
    case 'billboard': {
      const bg = new THREE.Color(st.bg ?? '#1d2b3f');
      const grad = g.createLinearGradient(0, 0, W, H);
      grad.addColorStop(0, bg.clone().multiplyScalar(1.15).getStyle());
      grad.addColorStop(1, bg.clone().multiplyScalar(0.7).getStyle());
      g.fillStyle = grad;
      g.fillRect(0, 0, W, H);
      const fg = st.fg ?? '#ffffff';
      // Big abstract product shape, the way real ads lead with an image
      g.globalAlpha = 0.22;
      g.fillStyle = fg;
      g.beginPath();
      g.arc(W * (st.kind === 'poster' ? 0.5 : 0.82), H * (st.kind === 'poster' ? 0.32 : 0.5), Math.min(W, H) * 0.38, 0, Math.PI * 2);
      g.fill();
      g.globalAlpha = 1;
      const portrait = st.kind === 'poster';
      g.textAlign = portrait ? 'center' : 'left';
      const tx = portrait ? W / 2 : W * 0.06;
      const head = text.toUpperCase();
      const size = fit(g, head, DISPLAY, '400', portrait ? W * 0.86 : W * 0.6, portrait ? H * 0.16 : H * 0.4, 0.02);
      ls(Math.round(size * 0.02));
      g.font = `400 ${size}px ${DISPLAY}`;
      g.fillStyle = fg;
      g.fillText(head, tx, portrait ? H * 0.66 : H * 0.42);
      ls(0);
      if (st.sub) {
        const sub = signText(st.sub);
        const s2 = fit(g, sub, SANS, '500', portrait ? W * 0.86 : W * 0.6, portrait ? H * 0.06 : H * 0.14);
        g.font = `500 ${s2}px ${SANS}`;
        g.globalAlpha = 0.85;
        g.fillText(sub, tx, portrait ? H * 0.76 : H * 0.68);
        g.globalAlpha = 1;
      }
      weather(g, W, H, r, 0.02);
      break;
    }
    case 'neon': {
      // Vertical neon blade: letters stacked top to bottom, glowing tubes with a halo
      g.fillStyle = st.bg ?? '#120f16';
      g.fillRect(0, 0, W, H);
      const fg = st.fg ?? '#ff4a6e';
      g.strokeStyle = fg;
      g.lineWidth = 2;
      g.strokeRect(3, 3, W - 6, H - 6);
      const letters = text.replace(/\s+/g, '').toUpperCase().split('');
      const cell = (H - 10) / Math.max(1, letters.length);
      const size = Math.min(W * 0.78, cell * 0.86);
      g.font = `600 ${Math.floor(size)}px ${COND}`;
      g.textAlign = 'center';
      letters.forEach((ch, i) => {
        const y = 5 + cell * (i + 0.5);
        g.shadowColor = fg;
        g.shadowBlur = 6;
        g.fillStyle = fg;
        g.fillText(ch, W / 2, y);
        g.shadowBlur = 0;
        g.fillStyle = 'rgba(255,255,255,0.75)';
        g.fillText(ch, W / 2, y);
      });
      break;
    }
    case 'barrier': {
      g.fillStyle = '#f2c230';
      g.fillRect(0, 0, W, H);
      const band = Math.round(H * 0.2);
      for (let x = -H; x < W + H; x += 12) {
        g.fillStyle = '#1b1b1b';
        g.beginPath();
        for (const y0 of [0, H - band]) {
          g.moveTo(x, y0 + band);
          g.lineTo(x + 6, y0 + band);
          g.lineTo(x + 6 + band, y0);
          g.lineTo(x + band, y0);
        }
        g.fill();
      }
      const t = text.toUpperCase();
      const size = fit(g, t, COND, '600', W - 12, H * 0.42, 0.08);
      ls(Math.round(size * 0.08));
      g.font = `600 ${size}px ${COND}`;
      g.fillStyle = '#1b1b1b';
      g.fillText(t, W / 2, H / 2 + 1);
      weather(g, W, H, r, 0.04);
      break;
    }
  }
}

const cache = new Map<string, THREE.MeshLambertMaterial>();

/** Lit material for a sign (cached). Cut-out kinds use alpha-tested transparency. */
export function signMaterial(st: SignStyle): THREE.MeshLambertMaterial {
  const key = JSON.stringify(st);
  const hit = cache.get(key);
  if (hit) return hit;
  const k = Math.min(1, MAX_PX / Math.max(st.w, st.h) / PX_PER_M);
  const W = Math.max(64, Math.round(st.w * PX_PER_M * k));
  const H = Math.max(36, Math.round(st.h * PX_PER_M * k));
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d')!;
  // Paint at half resolution in "board pixels" so details (bevels, bulbs, grain) keep their size
  g.scale(2, 2);
  const draw = () => {
    g.clearRect(0, 0, W, H);
    paint(st, W / 2, H / 2, g);
  };
  draw();
  const tex = new THREE.CanvasTexture(c);
  if (!fontsReady) {
    loadSignFonts();
    repaint.push(() => {
      draw();
      tex.needsUpdate = true;
    });
  }
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.anisotropy = 4;
  const cutout = st.kind === 'carved' || st.kind === 'letters' || st.kind === 'raised';
  // Lit boards keep a little self-light so they stay readable at dusk; marquees glow fully.
  const glow = st.kind === 'street' ? 0.3 : st.kind === 'raised' ? 0.22 : st.kind === 'panel' ? 0.06 : st.kind === 'marquee' || st.kind === 'neon' ? 0.95 : st.kind === 'poster' ? 0.55 : st.kind === 'transit' || st.kind === 'wayfinding' ? 0.35 : st.kind === 'billboard' ? 0.18 : st.kind === 'letters' ? 0.12 : 0.08;
  const m = new THREE.MeshLambertMaterial({
    map: tex,
    transparent: cutout,
    alphaTest: cutout ? 0.35 : 0,
    emissive: new THREE.Color('#ffffff'),
    emissiveMap: tex,
    emissiveIntensity: glow,
    side: THREE.FrontSide,
  });
  cache.set(key, m);
  return m;
}
