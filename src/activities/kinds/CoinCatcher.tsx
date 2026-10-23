'use client';
import { useEffect, useRef, useState } from 'react';
import type { KindProps } from '../types';
import { makeRng } from '@/game/rng';
import { playSfx } from '@/engine/audio';
import { money } from '@/ui/format';

interface Drop {
  x: number;
  y: number;
  v: number;
  kind: 'p' | 'n' | 'd' | 'q' | '1' | '5' | 'fee' | 'piggy';
}
const VALUE: Record<Drop['kind'], number> = { p: 0.01, n: 0.05, d: 0.1, q: 0.25, '1': 1, '5': 5, fee: -2, piggy: 3 };

/** Canvas arcade game: move the wallet with mouse/touch/arrow keys to catch money and dodge fees. */
export default function CoinCatcher({ params, onFinish, seed }: KindProps<{ time: number; speed: number; fees?: boolean }>) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [hud, setHud] = useState({ total: 0, left: params.time });
  useEffect(() => {
    const c = ref.current!;
    const g = c.getContext('2d')!;
    const W = (c.width = 720);
    const H = (c.height = 440);
    const rng = makeRng(seed);
    const drops: Drop[] = [];
    let px = W / 2;
    let total = 0;
    let t = 0;
    let spawn = 0;
    let last = performance.now();
    let raf = 0;
    const keys = { l: false, r: false };
    const kd = (e: KeyboardEvent) => {
      if (e.code === 'ArrowLeft' || e.code === 'KeyA') keys.l = true;
      if (e.code === 'ArrowRight' || e.code === 'KeyD') keys.r = true;
    };
    const ku = (e: KeyboardEvent) => {
      if (e.code === 'ArrowLeft' || e.code === 'KeyA') keys.l = false;
      if (e.code === 'ArrowRight' || e.code === 'KeyD') keys.r = false;
    };
    const pm = (e: PointerEvent) => {
      const rect = c.getBoundingClientRect();
      px = ((e.clientX - rect.left) / rect.width) * W;
    };
    window.addEventListener('keydown', kd);
    window.addEventListener('keyup', ku);
    c.addEventListener('pointermove', pm);
    c.addEventListener('pointerdown', pm);
    const kinds: Drop['kind'][] = ['p', 'p', 'n', 'n', 'd', 'd', 'q', 'q', '1', '1', '5', 'piggy', ...(params.fees ? (['fee', 'fee', 'fee'] as const) : (['fee'] as const))];
    const draw = (d: Drop) => {
      const k = d.kind;
      g.save();
      g.translate(d.x, d.y);
      if (k === '1' || k === '5' || k === 'fee') {
        g.fillStyle = k === 'fee' ? '#e1553f' : k === '5' ? '#a9c9ec' : '#9fd49a';
        g.strokeStyle = '#1e2840';
        g.lineWidth = 3;
        g.beginPath();
        g.roundRect(-26, -14, 52, 28, 5);
        g.fill();
        g.stroke();
        g.fillStyle = '#1e2840';
        g.font = '900 15px Nunito';
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        g.fillText(k === 'fee' ? 'FEE' : `$${k}`, 0, 1);
      } else if (k === 'piggy') {
        g.font = '34px serif';
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        g.fillText('🐷', 0, 0);
      } else {
        const r = k === 'q' ? 18 : k === 'n' ? 16 : k === 'p' ? 14 : 12;
        g.fillStyle = k === 'p' ? '#d08a4a' : '#c9ced8';
        g.strokeStyle = '#1e2840';
        g.lineWidth = 3;
        g.beginPath();
        g.arc(0, 0, r, 0, Math.PI * 2);
        g.fill();
        g.stroke();
        g.fillStyle = '#1e2840';
        g.font = '900 11px Nunito';
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        g.fillText(`${Math.round(VALUE[k] * 100)}¢`, 0, 1);
      }
      g.restore();
    };
    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      t += dt;
      spawn -= dt;
      if (spawn <= 0) {
        spawn = 0.45 / params.speed;
        drops.push({ x: rng.range(30, W - 30), y: -20, v: rng.range(120, 220) * params.speed * (1 + t / params.time), kind: rng.pick(kinds) });
      }
      if (keys.l) px -= 480 * dt;
      if (keys.r) px += 480 * dt;
      px = Math.max(40, Math.min(W - 40, px));
      // Background
      const grd = g.createLinearGradient(0, 0, 0, H);
      grd.addColorStop(0, '#1a2a5c');
      grd.addColorStop(1, '#2f6bdb');
      g.fillStyle = grd;
      g.fillRect(0, 0, W, H);
      for (let i = drops.length - 1; i >= 0; i--) {
        const d = drops[i];
        d.y += d.v * dt;
        if (d.y > H - 50 && d.y < H - 10 && Math.abs(d.x - px) < 48) {
          total = Math.round((total + VALUE[d.kind]) * 100) / 100;
          playSfx(d.kind === 'fee' ? 'wrong' : d.kind === 'piggy' || d.kind === '5' ? 'cash' : 'coin');
          drops.splice(i, 1);
          continue;
        }
        if (d.y > H + 30) drops.splice(i, 1);
        else draw(d);
      }
      // Wallet
      g.fillStyle = '#8a5a34';
      g.strokeStyle = '#1e2840';
      g.lineWidth = 4;
      g.beginPath();
      g.roundRect(px - 46, H - 44, 92, 36, 10);
      g.fill();
      g.stroke();
      g.fillStyle = '#ffcf3f';
      g.fillRect(px - 10, H - 34, 20, 10);
      setHud({ total, left: Math.max(0, Math.ceil(params.time - t)) });
      if (t >= params.time) {
        const score = Math.max(0, Math.min(100, (total / (params.fees ? 30 : 25)) * 100));
        onFinish({ score, summary: `You caught ${money(total)}!` });
        return;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('keydown', kd);
      window.removeEventListener('keyup', ku);
      c.removeEventListener('pointermove', pm);
      c.removeEventListener('pointerdown', pm);
    };
  }, [params.time, params.speed, params.fees, seed, onFinish]);
  return (
    <div className="col" style={{ gap: 8 }}>
      <div className="row between">
        <b className="pixel">💰 {money(hud.total)}</b>
        <span className="small">Move with the mouse, a finger, or ← → keys. Dodge the red FEE bills!</span>
        <b className="pixel">⏱️ {hud.left}s</b>
      </div>
      <canvas ref={ref} style={{ width: '100%', maxWidth: 720, alignSelf: 'center', borderRadius: 14, border: '4px solid var(--ink)', touchAction: 'none' }} />
    </div>
  );
}
