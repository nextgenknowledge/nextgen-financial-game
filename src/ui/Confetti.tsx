'use client';
import { useEffect, useRef } from 'react';
import { useUI } from '@/store/ui';

const COLORS = ['#ffcf3f', '#2ebaba', '#f06aa8', '#3cc45a', '#2f6bdb', '#ff8a3d'];

/** Lightweight canvas confetti, triggered by useUI.burst(). */
export function Confetti() {
  const n = useUI((s) => s.confetti);
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (!n) return;
    const c = ref.current;
    if (!c) return;
    const g = c.getContext('2d')!;
    c.width = window.innerWidth;
    c.height = window.innerHeight;
    const parts = Array.from({ length: 140 }, () => ({
      x: c.width / 2 + (Math.random() - 0.5) * 200,
      y: c.height * 0.45,
      vx: (Math.random() - 0.5) * 16,
      vy: -Math.random() * 16 - 6,
      r: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 0.4,
      s: 6 + Math.random() * 7,
      c: COLORS[Math.floor(Math.random() * COLORS.length)],
      coin: Math.random() < 0.2,
    }));
    let raf = 0;
    const start = performance.now();
    const tick = (t: number) => {
      g.clearRect(0, 0, c.width, c.height);
      for (const p of parts) {
        p.vy += 0.45;
        p.vx *= 0.99;
        p.x += p.vx;
        p.y += p.vy;
        p.r += p.vr;
        g.save();
        g.translate(p.x, p.y);
        g.rotate(p.r);
        if (p.coin) {
          g.fillStyle = '#ffcf3f';
          g.beginPath();
          g.ellipse(0, 0, p.s * 0.8, p.s * 0.8 * Math.abs(Math.cos(p.r * 2)), 0, 0, Math.PI * 2);
          g.fill();
          g.strokeStyle = '#d99a12';
          g.lineWidth = 2;
          g.stroke();
        } else {
          g.fillStyle = p.c;
          g.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2);
        }
        g.restore();
      }
      if (t - start < 2600) raf = requestAnimationFrame(tick);
      else g.clearRect(0, 0, c.width, c.height);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [n]);
  return <canvas ref={ref} style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 90 }} aria-hidden />;
}
