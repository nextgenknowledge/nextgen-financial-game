/**
 * Procedural pixel-art textures. Everything is drawn into small canvases at runtime (no files,
 * no network) and sampled with NearestFilter, so surfaces read as crisp retro texels while still
 * carrying real-world material detail (twill, knit, brick, glass…).
 */
import * as THREE from 'three';

type Painter = (ctx: CanvasRenderingContext2D, size: number, c1: THREE.Color, c2: THREE.Color, rnd: () => number) => void;

const texCache = new Map<string, THREE.Texture>();

/** Small deterministic PRNG so textures look identical every session. */
function seeded(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return ((s >>> 0) % 100000) / 100000;
  };
}

function hash(str: string) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** CSS color for a canvas pixel. THREE.Color stores linear values; getHexString converts back to sRGB. */
export const css = (c: THREE.Color, f = 1) => '#' + c.clone().multiplyScalar(f).getHexString();

/** Per-pixel brightness jitter, the base of most cloth/stone looks. */
function noise(ctx: CanvasRenderingContext2D, size: number, c: THREE.Color, amt: number, rnd: () => number) {
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      ctx.fillStyle = css(c, 1 + (rnd() - 0.5) * amt);
      ctx.fillRect(x, y, 1, 1);
    }
}

export const FABRICS: Record<string, Painter> = {
  plain: (ctx, s, c, _c2, r) => noise(ctx, s, c, 0.08, r),
  cotton: (ctx, s, c, _c2, r) => {
    noise(ctx, s, c, 0.1, r);
    ctx.fillStyle = css(c, 0.93);
    for (let y = 0; y < s; y += 2) ctx.fillRect(0, y, s, 1);
  },
  knit: (ctx, s, c, _c2, r) => {
    noise(ctx, s, c, 0.08, r);
    for (let x = 0; x < s; x += 2) {
      ctx.fillStyle = css(c, 0.82);
      ctx.fillRect(x, 0, 1, s);
    }
  },
  denim: (ctx, s, c, _c2, r) => {
    noise(ctx, s, c, 0.16, r);
    for (let y = 0; y < s; y++)
      for (let x = 0; x < s; x++)
        if ((x + y) % 3 === 0) {
          ctx.fillStyle = css(c, 1.25 + r() * 0.15);
          ctx.fillRect(x, y, 1, 1);
        }
  },
  twill: (ctx, s, c, _c2, r) => {
    noise(ctx, s, c, 0.06, r);
    for (let y = 0; y < s; y++)
      for (let x = 0; x < s; x++)
        if ((x + y) % 4 === 0) {
          ctx.fillStyle = css(c, 0.88);
          ctx.fillRect(x, y, 1, 1);
        }
  },
  wool: (ctx, s, c, _c2, r) => {
    noise(ctx, s, c, 0.12, r);
    for (let i = 0; i < s * 2; i++) {
      ctx.fillStyle = css(c, 0.85 + r() * 0.3);
      ctx.fillRect(Math.floor(r() * s), Math.floor(r() * s), 1, 1);
    }
  },
  pinstripe: (ctx, s, c, c2, r) => {
    FABRICS.wool(ctx, s, c, c2, r);
    ctx.fillStyle = css(c2, 0.8);
    for (let x = 3; x < s; x += 6) ctx.fillRect(x, 0, 1, s);
  },
  check: (ctx, s, c, c2, r) => {
    noise(ctx, s, c, 0.08, r);
    // Subtle windowpane check: thin lines, low contrast
    ctx.globalAlpha = 0.35;
    ctx.fillStyle = css(c2);
    for (let i = 2; i < s; i += 8) {
      ctx.fillRect(i, 0, 1, s);
      ctx.fillRect(0, i, s, 1);
    }
    ctx.globalAlpha = 1;
  },
  quilted: (ctx, s, c, _c2, r) => {
    noise(ctx, s, c, 0.06, r);
    for (let y = 0; y < s; y += 8) {
      ctx.fillStyle = css(c, 0.7);
      ctx.fillRect(0, y, s, 1);
      ctx.fillStyle = css(c, 1.18);
      ctx.fillRect(0, y + 3, s, 2);
    }
  },
  fleece: (ctx, s, c, _c2, r) => {
    noise(ctx, s, c, 0.2, r);
  },
  leather: (ctx, s, c, _c2, r) => {
    noise(ctx, s, c, 0.1, r);
    for (let i = 0; i < s; i++) {
      ctx.fillStyle = css(c, 1.35);
      ctx.fillRect(Math.floor(r() * s), Math.floor(r() * s), 1, 1);
    }
  },
  velvet: (ctx, s, c, _c2, r) => {
    for (let y = 0; y < s; y++)
      for (let x = 0; x < s; x++) {
        const v = 0.85 + 0.3 * Math.sin((x + y * 0.5) / 4) * 0.5 + (r() - 0.5) * 0.08;
        ctx.fillStyle = css(c, v);
        ctx.fillRect(x, y, 1, 1);
      }
  },
  gold: (ctx, s, c, _c2, r) => {
    for (let y = 0; y < s; y++)
      for (let x = 0; x < s; x++) {
        const v = 0.85 + 0.35 * Math.sin((x * 0.7 + y) / 3) * 0.5 + (r() - 0.5) * 0.1;
        ctx.fillStyle = css(c, r() < 0.02 ? 1.6 : v);
        ctx.fillRect(x, y, 1, 1);
      }
  },
  satin: (ctx, s, c, _c2, r) => {
    for (let y = 0; y < s; y++) {
      ctx.fillStyle = css(c, 0.9 + 0.25 * Math.max(0, Math.sin(y / 5)) + (r() - 0.5) * 0.03);
      ctx.fillRect(0, y, s, 1);
    }
  },
};

/**
 * Returns a cached NearestFilter canvas texture for a named painter and colors.
 * `size` is in texels; small sizes = chunkier retro look.
 */
export function pixelTexture(painter: string, color: string, color2 = '#ffffff', size = 32, painters: Record<string, Painter> = FABRICS): THREE.Texture {
  const key = `${painter}|${color}|${color2}|${size}`;
  let t = texCache.get(key);
  if (t) return t;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const paint = painters[painter] ?? FABRICS.plain;
  paint(ctx, size, new THREE.Color(color), new THREE.Color(color2), seeded(hash(key)));
  t = new THREE.CanvasTexture(canvas);
  t.magFilter = THREE.NearestFilter;
  t.minFilter = THREE.NearestMipmapNearestFilter;
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  texCache.set(key, t);
  return t;
}

const fabricMatCache = new Map<string, THREE.MeshLambertMaterial>();
/** Lambert material with a pixel fabric texture (and optional glow for metallics). */
export function fabric(pattern: string, color: string, color2?: string, emissive?: string): THREE.MeshLambertMaterial {
  const key = `${pattern}|${color}|${color2 ?? ''}|${emissive ?? ''}`;
  let m = fabricMatCache.get(key);
  if (!m) {
    m = new THREE.MeshLambertMaterial({ map: pixelTexture(pattern, color, color2), emissive: emissive ?? '#000000' });
    fabricMatCache.set(key, m);
  }
  return m;
}
