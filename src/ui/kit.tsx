'use client';
/** Small reusable UI pieces for FinPhone apps, services and activities. */
import { useMemo, useState, type ReactNode } from 'react';
import { Button } from './common';
import { money, cls } from './format';
import { playSfx } from '@/engine/audio';

export function Section({ title, children, right }: { title: ReactNode; children: ReactNode; right?: ReactNode }) {
  return (
    <section className="kit-section">
      <div className="row between">
        <h3>{title}</h3>
        {right}
      </div>
      {children}
    </section>
  );
}

export function Stat({ label, value, sub, tone, icon }: { label: string; value: ReactNode; sub?: ReactNode; tone?: 'good' | 'bad' | 'gold'; icon?: string }) {
  return (
    <div className={cls('kit-stat', tone)}>
      <div className="tiny muted bold">
        {icon} {label}
      </div>
      <div className="kit-stat-value mono">{value}</div>
      {sub && <div className="tiny muted">{sub}</div>}
    </div>
  );
}

export function StatGrid({ children }: { children: ReactNode }) {
  return <div className="kit-stat-grid">{children}</div>;
}

/** Amount chooser with quick buttons, friendly for young kids. */
export function AmountPicker({
  max,
  value,
  onChange,
  quick = [5, 10, 25, 100],
  step = 1,
  label = 'Amount',
}: {
  max: number;
  value: number;
  onChange: (v: number) => void;
  quick?: number[];
  step?: number;
  label?: string;
}) {
  const clamp = (v: number) => Math.max(0, Math.min(Math.floor(max * 100) / 100, Math.round(v / step) * step));
  return (
    <div className="kit-amount">
      <div className="row between">
        <b>{label}</b>
        <span className="tiny muted">max {money(max)}</span>
      </div>
      <div className="row wrap" style={{ gap: 6 }}>
        <Button size="small" onClick={() => onChange(clamp(value - step * 10))}>
          −
        </Button>
        <input
          className="input mono"
          style={{ width: 130, textAlign: 'center' }}
          inputMode="decimal"
          value={value === 0 ? '' : String(value)}
          placeholder="0"
          onChange={(e) => {
            const v = Number(e.target.value.replace(/[^0-9.]/g, ''));
            onChange(Number.isFinite(v) ? Math.min(v, max) : 0);
          }}
        />
        <Button size="small" onClick={() => onChange(clamp(value + step * 10))}>
          +
        </Button>
        {quick
          .filter((q) => q <= max)
          .map((q) => (
            <Button key={q} size="small" onClick={() => onChange(clamp(value + q))}>
              +${q}
            </Button>
          ))}
        <Button size="small" variant="gold" onClick={() => onChange(clamp(max))}>
          All
        </Button>
      </div>
    </div>
  );
}

/** Simple responsive SVG line chart (one or more series). */
export function LineChart({
  series,
  height = 160,
  labels,
  money: isMoney = true,
  zero = false,
}: {
  series: { values: number[]; color: string; label?: string; dashed?: boolean }[];
  height?: number;
  labels?: string[];
  money?: boolean;
  zero?: boolean;
}) {
  const W = 600;
  const H = height;
  const pad = { l: 56, r: 10, t: 10, b: 22 };
  const all = series.flatMap((s) => s.values).filter((v) => Number.isFinite(v));
  if (!all.length) return <div className="muted small">No data yet, check back after a month or two.</div>;
  let lo = Math.min(...all, zero ? 0 : Infinity);
  let hi = Math.max(...all);
  if (hi === lo) {
    hi += 1;
    lo -= 1;
  }
  const n = Math.max(...series.map((s) => s.values.length));
  const x = (i: number) => pad.l + (n <= 1 ? 0 : (i / (n - 1)) * (W - pad.l - pad.r));
  const y = (v: number) => pad.t + (1 - (v - lo) / (hi - lo)) * (H - pad.t - pad.b);
  const ticks = [lo, (lo + hi) / 2, hi];
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="kit-chart" role="img" aria-label="Line chart">
      {ticks.map((t, i) => (
        <g key={i}>
          <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} stroke="#e3d9c3" strokeDasharray="4 4" />
          <text x={pad.l - 6} y={y(t) + 4} textAnchor="end" fontSize="12" fill="#4a5672">
            {isMoney ? compact(t) : t.toFixed(t < 10 ? 1 : 0)}
          </text>
        </g>
      ))}
      {lo < 0 && hi > 0 && <line x1={pad.l} x2={W - pad.r} y1={y(0)} y2={y(0)} stroke="#4a5672" />}
      {series.map((s, k) => (
        <polyline
          key={k}
          fill="none"
          stroke={s.color}
          strokeWidth={3}
          strokeLinejoin="round"
          strokeDasharray={s.dashed ? '6 5' : undefined}
          points={s.values.map((v, i) => `${x(i)},${y(v)}`).join(' ')}
        />
      ))}
      {labels &&
        labels.map((l, i) =>
          i % Math.max(1, Math.ceil(labels.length / 8)) === 0 ? (
            <text key={i} x={x(i)} y={H - 4} fontSize="11" textAnchor="middle" fill="#4a5672">
              {l}
            </text>
          ) : null,
        )}
    </svg>
  );
}

function compact(v: number) {
  const a = Math.abs(v);
  const s = v < 0 ? '−' : '';
  if (a >= 1e6) return `${s}$${(a / 1e6).toFixed(1)}M`;
  if (a >= 1e3) return `${s}$${(a / 1e3).toFixed(a >= 1e4 ? 0 : 1)}k`;
  return `${s}$${a.toFixed(0)}`;
}

/** Horizontal stacked bars (net worth breakdown, budgets). */
export function BarList({ items, total }: { items: { label: string; value: number; color: string; icon?: string }[]; total?: number }) {
  const t = total ?? Math.max(1, ...items.map((i) => Math.abs(i.value)));
  return (
    <div className="col" style={{ gap: 6 }}>
      {items.map((i) => (
        <div key={i.label} className="kit-bar-row">
          <span className="small bold kit-bar-label">
            {i.icon} {i.label}
          </span>
          <div className="kit-bar">
            <div style={{ width: `${Math.min(100, (Math.abs(i.value) / t) * 100)}%`, background: i.color }} />
          </div>
          <span className="small mono kit-bar-value">{money(i.value, { cents: false })}</span>
        </div>
      ))}
    </div>
  );
}

export function Pie({ slices, size = 140 }: { slices: { label: string; value: number; color: string }[]; size?: number }) {
  const total = slices.reduce((s, x) => s + Math.max(0, x.value), 0);
  const paths = useMemo(() => {
    let a = -Math.PI / 2;
    return slices
      .filter((s) => s.value > 0)
      .map((s) => {
        const frac = s.value / (total || 1);
        const a2 = a + frac * Math.PI * 2;
        const large = frac > 0.5 ? 1 : 0;
        const r = size / 2 - 4;
        const c = size / 2;
        const d =
          frac >= 0.999
            ? `M ${c} ${c - r} A ${r} ${r} 0 1 1 ${c - 0.01} ${c - r} Z`
            : `M ${c} ${c} L ${c + r * Math.cos(a)} ${c + r * Math.sin(a)} A ${r} ${r} 0 ${large} 1 ${c + r * Math.cos(a2)} ${c + r * Math.sin(a2)} Z`;
        a = a2;
        return { d, color: s.color, label: s.label };
      });
  }, [slices, total, size]);
  if (!total) return null;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label="Pie chart">
      {paths.map((p, i) => (
        <path key={i} d={p.d} fill={p.color} stroke="#fff" strokeWidth={2} />
      ))}
    </svg>
  );
}

export function Tabs<T extends string>({ tabs, value, onChange }: { tabs: { id: T; label: ReactNode }[]; value: T; onChange: (t: T) => void }) {
  return (
    <div className="row wrap" style={{ gap: 6, marginBottom: 10 }}>
      {tabs.map((t) => (
        <Button key={t.id} size="small" variant={value === t.id ? 'primary' : undefined} onClick={() => onChange(t.id)}>
          {t.label}
        </Button>
      ))}
    </div>
  );
}

export function Empty({ icon, children }: { icon: string; children: ReactNode }) {
  return (
    <div className="kit-empty">
      <div style={{ fontSize: '2.4rem' }}>{icon}</div>
      <div className="muted">{children}</div>
    </div>
  );
}

/** Tooltip-ish "What does this mean?" explainer. */
export function Explain({ title = 'What does this mean?', children }: { title?: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="kit-explain">
      <button
        className="btn small ghost"
        onClick={() => {
          playSfx('pop');
          setOpen(!open);
        }}
      >
        💡 {title}
      </button>
      {open && <div className="card tint-gold small">{children}</div>}
    </div>
  );
}

export const COLORS = {
  cash: '#3cc45a',
  bank: '#2ebaba',
  investments: '#2f6bdb',
  property: '#8a5cf6',
  other: '#ffcf3f',
  debt: '#e1553f',
  retirement: '#f06aa8',
};
