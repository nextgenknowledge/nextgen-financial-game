/**
 * NextGen Narwhal's face, drawn to a canvas. Used for the 3D model's face texture and for the
 * dialog portrait so both always match. Colors sampled from the official character sheet.
 */
import type { Mood } from '@/game/effects';

export const NARWHAL_COLORS = {
  body: '#80bcde',
  top: '#629cc6',
  spot: '#5d95c0',
  shine: '#b6def4',
  outline: '#182236',
  horn: '#fceecc',
  hornStripe: '#d9b867',
  suit: '#1e2840',
  lapel: '#2b3754',
  shirt: '#f4f6fa',
  tie: '#2ebaba',
  mouth: '#c0392b',
  tongue: '#f08080',
};

const C = NARWHAL_COLORS;

function eye(g: CanvasRenderingContext2D, x: number, y: number, r: number, mood: Mood, side: -1 | 1) {
  g.lineWidth = r * 0.16;
  g.strokeStyle = C.outline;
  if (mood === 'hyped') {
    // Happy closed eyes: ^ arcs
    g.lineWidth = r * 0.28;
    g.lineCap = 'round';
    g.beginPath();
    g.arc(x, y + r * 0.35, r * 0.75, Math.PI * 1.1, Math.PI * 1.9);
    g.stroke();
    return;
  }
  g.fillStyle = '#ffffff';
  g.beginPath();
  g.ellipse(x, y, r, r * 1.05, 0, 0, Math.PI * 2);
  g.fill();
  g.stroke();
  const pupilR = mood === 'shocked' ? r * 0.32 : r * 0.55;
  const px = x + (mood === 'skeptical' ? side * r * 0.12 : r * 0.08);
  const py = y + (mood === 'disappointed' ? r * 0.25 : r * 0.05);
  g.fillStyle = C.outline;
  g.beginPath();
  g.arc(px, py, pupilR, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#ffffff';
  g.beginPath();
  g.arc(px - pupilR * 0.35, py - pupilR * 0.4, pupilR * 0.3, 0, Math.PI * 2);
  g.fill();
  g.beginPath();
  g.arc(px + pupilR * 0.3, py + pupilR * 0.35, pupilR * 0.14, 0, Math.PI * 2);
  g.fill();
  // Eyelids
  if (mood === 'confident' || mood === 'disappointed') {
    g.fillStyle = C.body;
    g.beginPath();
    g.ellipse(x, y - r * 0.45, r * 1.08, r * 0.62, 0, Math.PI, Math.PI * 2);
    g.fill();
    g.beginPath();
    g.moveTo(x - r * 1.05, y - r * 0.42);
    g.lineTo(x + r * 1.05, y - r * 0.42);
    g.stroke();
  }
}

function brow(g: CanvasRenderingContext2D, x: number, y: number, w: number, angle: number) {
  g.save();
  g.translate(x, y);
  g.rotate(angle);
  g.fillStyle = C.outline;
  g.beginPath();
  g.roundRect(-w / 2, -w * 0.11, w, w * 0.22, w * 0.11);
  g.fill();
  g.restore();
}

function mouth(g: CanvasRenderingContext2D, x: number, y: number, s: number, mood: Mood) {
  g.strokeStyle = C.outline;
  g.lineCap = 'round';
  g.lineWidth = s * 0.07;
  switch (mood) {
    case 'confident':
      g.beginPath();
      g.moveTo(x - s * 0.45, y);
      g.quadraticCurveTo(x - s * 0.05, y + s * 0.32, x + s * 0.4, y - s * 0.12);
      g.stroke();
      break;
    case 'talking':
    case 'hyped': {
      const big = mood === 'hyped' ? 1.25 : 1;
      g.fillStyle = C.mouth;
      g.beginPath();
      g.moveTo(x - s * 0.42 * big, y - s * 0.08);
      g.lineTo(x + s * 0.42 * big, y - s * 0.08);
      g.quadraticCurveTo(x + s * 0.38 * big, y + s * 0.42 * big, x, y + s * 0.42 * big);
      g.quadraticCurveTo(x - s * 0.38 * big, y + s * 0.42 * big, x - s * 0.42 * big, y - s * 0.08);
      g.closePath();
      g.fill();
      g.stroke();
      g.fillStyle = C.tongue;
      g.beginPath();
      g.ellipse(x, y + s * 0.26 * big, s * 0.2 * big, s * 0.1 * big, 0, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = '#ffffff';
      g.fillRect(x - s * 0.3 * big, y - s * 0.06, s * 0.6 * big, s * 0.08);
      break;
    }
    case 'skeptical':
      g.beginPath();
      g.moveTo(x - s * 0.22, y + s * 0.05);
      g.lineTo(x + s * 0.22, y + s * 0.05);
      g.stroke();
      break;
    case 'shocked':
      g.fillStyle = '#7a1f2b';
      g.beginPath();
      g.ellipse(x, y + s * 0.1, s * 0.13, s * 0.18, 0, 0, Math.PI * 2);
      g.fill();
      g.stroke();
      break;
    case 'disappointed':
      g.beginPath();
      g.moveTo(x - s * 0.28, y + s * 0.18);
      g.quadraticCurveTo(x, y - s * 0.12, x + s * 0.28, y + s * 0.18);
      g.stroke();
      break;
  }
}

/** Draws just the face features (transparent background) into a square region. */
export function drawNarwhalFace(g: CanvasRenderingContext2D, size: number, mood: Mood, ox = 0, oy = 0, decor = true) {
  const s = size;
  if (decor) {
    // Spots on the forehead and the glossy shine (as on the character sheet)
    g.fillStyle = C.spot;
    for (const [sx, sy, r] of [[0.28, 0.06, 0.026], [0.56, 0.04, 0.02], [0.74, 0.1, 0.018], [0.42, 0.11, 0.014]]) {
      g.beginPath();
      g.arc(ox + s * sx, oy + s * sy, s * r, 0, Math.PI * 2);
      g.fill();
    }
    g.fillStyle = C.shine;
    g.beginPath();
    g.ellipse(ox + s * 0.07, oy + s * 0.36, s * 0.035, s * 0.09, 0.35, 0, Math.PI * 2);
    g.fill();
  }
  const ey = oy + s * 0.44;
  const er = s * 0.13;
  const lx = ox + s * 0.33;
  const rx = ox + s * 0.67;
  eye(g, lx, ey, er, mood, -1);
  eye(g, rx, ey, er, mood, 1);
  const by = oy + s * 0.25;
  const bw = s * 0.2;
  const angles: Record<Mood, [number, number, number, number]> = {
    confident: [0.05, 0, -0.05, 0],
    talking: [0.06, 0, -0.06, 0],
    skeptical: [0.08, 0.01, -0.18, -0.05],
    shocked: [-0.05, -0.04, 0.05, -0.04],
    hyped: [-0.04, -0.03, 0.04, -0.03],
    disappointed: [-0.32, 0.02, 0.32, 0.02],
  };
  const [la, ly, ra, ry] = angles[mood];
  brow(g, lx, by + ly * s, bw, la);
  brow(g, rx, by + ry * s, bw, ra);
  mouth(g, ox + s * 0.5, oy + s * 0.74, s * 0.42, mood);
}

/** Full dialog portrait: blocky head with darker top, spots, shine, horn and suit collar. */
export function drawNarwhalPortrait(g: CanvasRenderingContext2D, size: number, mood: Mood) {
  const s = size;
  g.clearRect(0, 0, s, s);
  // Horn
  const hx = s * 0.5;
  g.fillStyle = C.horn;
  g.strokeStyle = C.outline;
  g.lineWidth = s * 0.018;
  g.beginPath();
  g.moveTo(hx - s * 0.07, s * 0.22);
  g.lineTo(hx + s * 0.07, s * 0.22);
  g.lineTo(hx + s * 0.015, s * 0.0);
  g.lineTo(hx - s * 0.015, s * 0.0);
  g.closePath();
  g.fill();
  g.stroke();
  g.strokeStyle = C.hornStripe;
  g.lineWidth = s * 0.016;
  for (let i = 1; i < 5; i++) {
    const y = s * (0.035 + i * 0.042);
    const w = s * (0.02 + i * 0.012);
    g.beginPath();
    g.moveTo(hx - w, y + s * 0.012);
    g.lineTo(hx + w, y - s * 0.012);
    g.stroke();
  }
  // Head
  const x0 = s * 0.12;
  const y0 = s * 0.18;
  const w = s * 0.76;
  const h = s * 0.82;
  g.lineWidth = s * 0.025;
  g.strokeStyle = C.outline;
  g.fillStyle = C.body;
  g.beginPath();
  g.roundRect(x0, y0, w, h, s * 0.2);
  g.fill();
  g.save();
  g.clip();
  g.fillStyle = C.top;
  g.beginPath();
  g.ellipse(s * 0.5, y0 + s * 0.02, w * 0.62, s * 0.16, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = C.spot;
  for (const [sx, sy, r] of [[0.32, 0.24, 0.025], [0.62, 0.22, 0.02], [0.75, 0.29, 0.018], [0.46, 0.27, 0.015]]) {
    g.beginPath();
    g.arc(s * sx, s * sy, s * r, 0, Math.PI * 2);
    g.fill();
  }
  g.fillStyle = C.shine;
  g.beginPath();
  g.ellipse(s * 0.2, s * 0.43, s * 0.035, s * 0.07, 0.4, 0, Math.PI * 2);
  g.fill();
  // Collar
  g.fillStyle = C.suit;
  g.fillRect(x0, s * 0.9, w, s * 0.12);
  g.fillStyle = C.shirt;
  g.beginPath();
  g.moveTo(s * 0.4, s * 0.9);
  g.lineTo(s * 0.6, s * 0.9);
  g.lineTo(s * 0.5, s * 1.0);
  g.closePath();
  g.fill();
  g.fillStyle = C.tie;
  g.fillRect(s * 0.47, s * 0.9, s * 0.06, s * 0.1);
  g.restore();
  g.strokeStyle = C.outline;
  g.lineWidth = s * 0.025;
  g.beginPath();
  g.roundRect(x0, y0, w, h, s * 0.2);
  g.stroke();
  drawNarwhalFace(g, s * 0.62, mood, s * 0.19, s * 0.3, false);
}
