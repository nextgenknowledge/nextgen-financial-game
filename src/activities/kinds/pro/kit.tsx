'use client';
/** Shared pieces for the Advanced pro desks: header, stat tiles, line and bar charts, tables. */
import type { ReactNode } from 'react';
import { cls } from '@/ui/format';

export const pc = (v: number, d = 1) => `${(v * 100).toFixed(d)}%`;
export const usd = (v: number, d = 0) => `${v < 0 ? '-' : ''}$${Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d })}`;
export const usdK = (v: number) => (Math.abs(v) >= 1e6 ? `${v < 0 ? '-' : ''}$${(Math.abs(v) / 1e6).toFixed(2)}M` : Math.abs(v) >= 1e4 ? `${v < 0 ? '-' : ''}$${(Math.abs(v) / 1e3).toFixed(0)}k` : usd(v));
export const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

export const C = { blue: '#4fb3ff', green: '#22d38f', gold: '#ffd25a', red: '#ff8a7a', violet: '#c77dff', grey: '#8ea0c2' };

export function ProHead({ kicker, title, sub, right }: { kicker: string; title: ReactNode; sub?: ReactNode; right?: ReactNode }) {
  return (
    <div className="pro-head">
      <div>
        <div className="pro-kicker">{kicker}</div>
        <div className="pro-title">{title}</div>
        {sub && <div className="pro-sub">{sub}</div>}
      </div>
      {right}
    </div>
  );
}

export function Big({ label, value, tone }: { label: string; value: ReactNode; tone?: 'good' | 'bad' }) {
  return (
    <div className="pro-price">
      <span className="pro-kicker">{label}</span>
      <b style={{ color: tone === 'good' ? C.green : tone === 'bad' ? C.red : undefined }}>{value}</b>
    </div>
  );
}

export function Stats({ items }: { items: [string, ReactNode, ('good' | 'bad')?][] }) {
  return (
    <div className="pro-stats" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(104px, 1fr))' }}>
      {items.map(([k, v, tone]) => (
        <div key={k}>
          <span className="pro-kicker">{k}</span>
          <b style={{ color: tone === 'good' ? C.green : tone === 'bad' ? C.red : undefined }}>{v}</b>
        </div>
      ))}
    </div>
  );
}

export interface Series {
  pts: number[];
  color: string;
  label?: string;
  dash?: boolean;
}

/** A line chart over evenly spaced points. `hlines` draws labelled reference levels. */
export function LineChart({ series, h = 220, fmt = (v: number) => v.toFixed(0), hlines = [], xLabel, marks = [] }: { series: Series[]; h?: number; fmt?: (v: number) => string; hlines?: { y: number; label: string; color?: string }[]; xLabel?: string; marks?: { i: number; color: string; label?: string }[] }) {
  const all = [...series.flatMap((s) => s.pts), ...hlines.map((l) => l.y)].filter(Number.isFinite);
  let lo = Math.min(...all);
  let hi = Math.max(...all);
  if (hi - lo < 1e-9) (hi += 1), (lo -= 1);
  const pad = (hi - lo) * 0.08;
  lo -= pad;
  hi += pad;
  const n = Math.max(...series.map((s) => s.pts.length), 2);
  const W = 400;
  const X = (i: number) => 52 + (i / (n - 1)) * (W - 62);
  const top = series.some((s) => s.label) ? 18 : 10;
  const Y = (v: number) => h - 26 - ((v - lo) / (hi - lo)) * (h - 26 - top);
  const ticks = [lo + pad, (lo + hi) / 2, hi - pad];
  return (
    <svg viewBox={`0 0 ${W} ${h}`} className="pro-chart">
      {ticks.map((t) => (
        <g key={t}>
          <line x1="52" x2={W - 10} y1={Y(t)} y2={Y(t)} stroke="#1c2a46" />
          <text x="48" y={Y(t) + 3} fontSize="10" fill={C.grey} textAnchor="end">
            {fmt(t)}
          </text>
        </g>
      ))}
      {hlines.map((l) => (
        <g key={l.label}>
          <line x1="52" x2={W - 10} y1={Y(l.y)} y2={Y(l.y)} stroke={l.color ?? C.gold} strokeDasharray="4 4" opacity="0.8" />
          <text x={W - 12} y={Y(l.y) - 4} fontSize="10" fill={l.color ?? C.gold} textAnchor="end">
            {l.label}
          </text>
        </g>
      ))}
      {series.map((s, k) => (
        <polyline key={k} fill="none" stroke={s.color} strokeWidth="2.2" strokeDasharray={s.dash ? '5 4' : undefined} points={s.pts.map((v, i) => `${X(i)},${Y(v)}`).join(' ')} />
      ))}
      {marks.map((m, k) => (
        <g key={k}>
          <line x1={X(m.i)} x2={X(m.i)} y1="10" y2={h - 26} stroke={m.color} strokeDasharray="2 3" />
          {m.label && (
            <text x={X(m.i) + 3} y="18" fontSize="10" fill={m.color}>
              {m.label}
            </text>
          )}
        </g>
      ))}
      {xLabel && (
        <text x={W / 2} y={h - 6} fontSize="10" fill={C.grey} textAnchor="middle">
          {xLabel}
        </text>
      )}
      <g>
        {series
          .filter((s) => s.label)
          .map((s, k) => (
            <text key={k} x={60 + k * 112} y={11} fontSize="10" fill={s.color}>
              ■ {s.label}
            </text>
          ))}
      </g>
    </svg>
  );
}

/** Horizontal bars, one per item. Negative values grow left from the axis. */
export function Bars({ items, fmt = (v: number) => v.toFixed(0) }: { items: { label: string; value: number; color?: string }[]; fmt?: (v: number) => string }) {
  const max = Math.max(...items.map((i) => Math.abs(i.value)), 1e-9);
  const neg = items.some((i) => i.value < 0);
  return (
    <div className="pro-bars">
      {items.map((it) => {
        const w = (Math.abs(it.value) / max) * (neg ? 50 : 100);
        return (
          <div key={it.label} className="pro-bar-row">
            <span className="pro-bar-label">{it.label}</span>
            <span className="pro-bar-track">
              <i style={{ width: `${w}%`, left: neg ? (it.value < 0 ? `${50 - w}%` : '50%') : 0, background: it.color ?? (it.value < 0 ? C.red : C.blue) }} />
            </span>
            <b>{fmt(it.value)}</b>
          </div>
        );
      })}
    </div>
  );
}

export function Table({ head, rows, hl = [], compact }: { head: ReactNode[]; rows: ReactNode[][]; hl?: number[]; compact?: boolean }) {
  return (
    <div style={{ overflowX: 'auto' }}>
      <table className={cls('pro-table', compact && 'compact')}>
        <thead>
          <tr>
            {head.map((h, i) => (
              <th key={i}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className={hl.includes(i) ? 'hl' : undefined}>
              {r.map((c, j) => (
                <td key={j}>{c}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Slider row in the pro style. */
export function Slider({ label, value, min, max, step = 1, onChange, show, disabled, color }: { label: ReactNode; value: number; min: number; max: number; step?: number; onChange: (v: number) => void; show: ReactNode; disabled?: boolean; color?: string }) {
  return (
    <label className="pro-slider">
      <span>
        {color && <i className="dot" style={{ background: color }} />} {label}
      </span>
      <input type="range" min={min} max={max} step={step} value={value} disabled={disabled} onChange={(e) => onChange(Number(e.target.value))} />
      <b>{show}</b>
    </label>
  );
}

export function Verdict({ ok, title, children }: { ok: boolean; title: ReactNode; children?: ReactNode }) {
  return (
    <div className={cls('pro-result', ok ? 'ok' : 'no')}>
      <b>{title}</b>
      {children && <span className="small">{children}</span>}
    </div>
  );
}

/** Seeded normal draw from a uniform source. */
export function gauss(next: () => number) {
  const u = Math.max(1e-9, next());
  const v = next();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}
