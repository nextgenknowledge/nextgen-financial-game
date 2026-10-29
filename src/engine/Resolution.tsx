'use client';
/**
 * How many pixels the 3D view draws, fitted to the screen. A fixed ratio is blurry on a phone (its
 * screen is small but very sharp) and wasteful on a big monitor, so Low and Medium aim for a pixel
 * budget instead: phones come out crisp, Chromebooks stay where they were. On Low, if the device
 * still struggles, the resolution steps down a little at a time instead of the game stuttering.
 */
import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import type { Quality } from '@/store/settings';
import { isPaused } from '@/store/ui';

/** Drawn pixels (width × height) that Low and Medium aim for. */
const BUDGET = { low: 0.6e6, medium: 1.3e6 };

export function pickDpr(quality: Quality, width: number, height: number, device: number, scale = 1): number {
  const sharpest = Math.min(2, device);
  if (quality === 'high') return sharpest * scale;
  const fit = Math.sqrt(BUDGET[quality] / Math.max(1, width * height));
  const floor = quality === 'low' ? 0.75 : 1;
  const cap = quality === 'low' ? sharpest : Math.min(1.5, sharpest);
  return Math.max(0.5, Math.min(cap, Math.max(floor, fit)) * scale);
}

/** Lives inside the Canvas (for its size and frame clock); hands the ratio up to the Canvas `dpr` prop. */
export function AdaptiveResolution({ quality, onDpr }: { quality: Quality; onDpr: (dpr: number) => void }) {
  const width = useThree((s) => s.size.width);
  const height = useThree((s) => s.size.height);
  const scale = useRef(1);
  const meter = useRef({ n: 0, t: 0, slow: 0 });

  const apply = () => onDpr(pickDpr(quality, width, height, window.devicePixelRatio || 1, scale.current));
  // Re-fit when the screen turns or the window is resized
  useEffect(apply, [quality, width, height, onDpr]); // eslint-disable-line react-hooks/exhaustive-deps

  useFrame((_, dt) => {
    if (quality !== 'low') return;
    const m = meter.current;
    m.n++;
    m.t += dt;
    if (m.t < 1) return;
    const fps = m.n / m.t;
    m.n = 0;
    m.t = 0;
    // Hidden or unfocused tabs are throttled by the browser, never judge performance there
    if (isPaused() || document.hidden || !document.hasFocus()) return;
    m.slow = fps < 27 ? m.slow + 1 : 0;
    if (m.slow >= 3 && scale.current > 0.65) {
      scale.current = Math.max(0.65, scale.current * 0.85);
      m.slow = 0;
      apply();
    }
  });
  return null;
}
