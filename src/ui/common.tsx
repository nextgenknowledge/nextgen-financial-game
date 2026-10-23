'use client';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { playSfx } from '@/engine/audio';
import { speak, speechAvailable } from './speech';
import { cls } from './format';

export const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? '';
export const asset = (p: string) => `${BASE}${p}`;

export const ORG_LOGO = asset('/brand/nextgen-knowledge-logo.jpg');
export const FIN_LOGO = asset('/brand/fin-city-logo.webp');
export const EMBLEM = asset('/brand/nextgen-emblem-crop.png');
export const NARWHAL_SHEET = asset('/brand/nextgen-narwhal-sheet.png');

export function Button({
  children,
  onClick,
  variant,
  size,
  disabled,
  className,
  title,
  sfx = 'click',
  block,
  type = 'button',
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'gold' | 'blue' | 'green' | 'danger' | 'ghost' | 'selected';
  size?: 'small' | 'big' | 'huge';
  disabled?: boolean;
  className?: string;
  title?: string;
  sfx?: 'click' | 'pop' | null;
  block?: boolean;
  type?: 'button' | 'submit';
}) {
  return (
    <button
      type={type}
      title={title}
      aria-label={title}
      disabled={disabled}
      className={cls('btn', variant, size, block && 'block', className)}
      onClick={() => {
        if (sfx) playSfx(sfx);
        onClick?.();
      }}
    >
      {children}
    </button>
  );
}

/** Speaker button that reads text aloud. */
export function ReadAloud({ text, small = true }: { text: string; small?: boolean }) {
  if (!speechAvailable()) return null;
  return (
    <button
      type="button"
      className={cls('btn', 'icon', small && 'small', 'ghost')}
      title="Read aloud"
      aria-label="Read aloud"
      onClick={(e) => {
        e.stopPropagation();
        speak(text);
      }}
    >
      🔊
    </button>
  );
}

/** Splits a leading icon character (e.g. "🗺️ City Map") off a title so it can sit in its own tile. */
function splitIcon(title: ReactNode): [string | null, ReactNode] {
  if (typeof title !== 'string') return [null, title];
  const m = title.match(/^(\p{Extended_Pictographic}\uFE0F?(?:\u200D\p{Extended_Pictographic}\uFE0F?)*)\s+(.*)$/u);
  return m ? [m[1], m[2]] : [null, title];
}

export function Modal({
  children,
  onClose,
  size,
  title,
  subtitle,
  className,
  closeLabel = '✕',
  accent,
}: {
  children: ReactNode;
  onClose?: () => void;
  size?: 'wide' | 'full';
  title?: ReactNode;
  /** A short line under the title. */
  subtitle?: ReactNode;
  className?: string;
  closeLabel?: string;
  /** Header colour theme. */
  accent?: 'navy' | 'teal' | 'gold' | 'terminal';
}) {
  useEffect(() => {
    if (!onClose) return;
    const h = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', h, true);
    return () => window.removeEventListener('keydown', h, true);
  }, [onClose]);
  const [icon, text] = splitIcon(title);
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}>
      <div className={cls('modal', 'panel', size, className)} role="dialog" aria-modal="true">
        {(title || onClose) && (
          <div className={cls('modal-head', accent ?? 'navy')}>
            {icon && <span className="modal-icon">{icon}</span>}
            <div className="modal-titles">
              {title && <h2>{text}</h2>}
              {subtitle && <div className="modal-sub">{subtitle}</div>}
            </div>
            {onClose && (
              <button type="button" className="modal-close" onClick={() => (playSfx('click'), onClose())} title="Close" aria-label="Close">
                {closeLabel}
              </button>
            )}
          </div>
        )}
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}

export function Confirm({
  title,
  text,
  confirmLabel = 'Yes',
  cancelLabel = 'Cancel',
  danger,
  onConfirm,
  onCancel,
}: {
  title: string;
  text: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Modal onClose={onCancel} title={title}>
      <div style={{ fontSize: '1.05rem', margin: '0.5rem 0 1.2rem' }}>{text}</div>
      <div className="row" style={{ justifyContent: 'flex-end' }}>
        <Button onClick={onCancel}>{cancelLabel}</Button>
        <Button variant={danger ? 'danger' : 'primary'} onClick={onConfirm}>
          {confirmLabel}
        </Button>
      </div>
    </Modal>
  );
}

export function Prompt({
  title,
  label,
  initial = '',
  maxLength = 40,
  onSubmit,
  onCancel,
}: {
  title: string;
  label: string;
  initial?: string;
  maxLength?: number;
  onSubmit: (v: string) => void;
  onCancel: () => void;
}) {
  const [v, setV] = useState(initial);
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => ref.current?.select(), []);
  return (
    <Modal onClose={onCancel} title={title}>
      <form
        className="col"
        onSubmit={(e) => {
          e.preventDefault();
          if (v.trim()) onSubmit(v.trim());
        }}
      >
        <label className="field">
          {label}
          <input ref={ref} className="input" value={v} maxLength={maxLength} onChange={(e) => setV(e.target.value)} />
        </label>
        <div className="row" style={{ justifyContent: 'flex-end' }}>
          <Button onClick={onCancel}>Cancel</Button>
          <Button variant="primary" type="submit" disabled={!v.trim()}>
            Save
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export function Stars({ n, max = 3, size = '1.4rem' }: { n: number; max?: number; size?: string }) {
  return (
    <span className="stars" aria-label={`${n} of ${max} stars`} style={{ fontSize: size, letterSpacing: '0.05em' }}>
      {Array.from({ length: max }, (_, i) => (
        <span key={i} style={{ filter: i < n ? 'none' : 'grayscale(1) opacity(0.3)' }}>
          ⭐
        </span>
      ))}
    </span>
  );
}

export function Toggle<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: ReactNode }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="toggle" role="radiogroup">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          className={cls(o.value === value && 'on')}
          onClick={() => {
            playSfx('click');
            onChange(o.value);
          }}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function ProgressBar({ value, max = 1, color = 'var(--teal)', height = 14, label }: { value: number; max?: number; color?: string; height?: number; label?: string }) {
  const pct = Math.max(0, Math.min(1, max ? value / max : 0)) * 100;
  return (
    <div
      role="progressbar"
      aria-valuenow={Math.round(pct)}
      aria-label={label}
      style={{ height, border: '2px solid var(--ink)', borderRadius: 999, background: '#fff', overflow: 'hidden' }}
    >
      <div style={{ width: `${pct}%`, height: '100%', background: color, transition: 'width 0.4s' }} />
    </div>
  );
}

/** Chunky pixel meter: a big percentage over a row of square blocks. */
export function PixelMeter({ pct, label, blocks = 10, tone = 'gold' }: { pct: number; label?: string; blocks?: number; tone?: 'gold' | 'teal' | 'green' | 'red' }) {
  const on = Math.round((Math.max(0, Math.min(100, pct)) / 100) * blocks);
  return (
    <div className={cls('pixel-meter', tone)}>
      <b>{Math.round(pct)}%</b>
      {label && <span className="pixel-meter-label">{label}</span>}
      <div className="pixel-meter-blocks">
        {Array.from({ length: blocks }, (_, i) => (
          <span key={i} className={i < on ? 'on' : ''} />
        ))}
      </div>
    </div>
  );
}
