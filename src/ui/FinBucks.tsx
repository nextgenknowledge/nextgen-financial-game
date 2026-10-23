'use client';
/**
 * FinBucks: Fin City's currency (1 FinBuck = $1, so lessons still talk in dollars). A gold coin
 * with a bold F and a wave, a teal banknote with guilloché engraving and an F medallion.
 */
import { useId } from 'react';
import { money } from './format';

/** The FinBucks coin mark. */
export function FinBucksCoin({ size = '1.25em', className }: { size?: string | number; className?: string }) {
  const id = useId().replace(/:/g, '');
  return (
    <svg viewBox="0 0 32 32" width={size} height={size} className={className ?? 'finbucks-coin'} aria-hidden="true">
      <defs>
        <radialGradient id={`g${id}`} cx="35%" cy="30%" r="75%">
          <stop offset="0" stopColor="#fff1b0" />
          <stop offset="0.45" stopColor="#f6c63c" />
          <stop offset="1" stopColor="#c98a12" />
        </radialGradient>
      </defs>
      <circle cx="16" cy="16" r="15" fill="#8a5a08" />
      <circle cx="16" cy="16" r="13.6" fill={`url(#g${id})`} />
      <circle cx="16" cy="16" r="10.6" fill="none" stroke="#a8730d" strokeWidth="1.2" strokeDasharray="1.4 1.2" />
      {/* Bold F with a wave through it */}
      <path d="M12 9.5h9v3h-5.6v2.2h4.6v3h-4.6V23H12z" fill="#7a4e05" />
      <path d="M8.5 19.8c2.2-1.6 4.4-1.6 6.6 0s4.4 1.6 6.6 0 2.4-1 2.4-1" fill="none" stroke="#fff6cf" strokeWidth="1.3" strokeLinecap="round" opacity="0.85" />
    </svg>
  );
}

/** An amount in FinBucks: the coin mark followed by the value. */
export function FinBucks({ value, sign, cents = true, className }: { value: number; sign?: boolean; cents?: boolean; className?: string }) {
  return (
    <span className={className ?? 'finbucks'}>
      <FinBucksCoin />
      <span className="mono">{money(value, { sign, cents })}</span>
    </span>
  );
}

/** A FinBucks banknote showing a balance (wallet cards, bank app, payday). */
export function FinBucksNote({ value, label = 'FINBUCKS' }: { value: number; label?: string }) {
  const id = useId().replace(/:/g, '');
  const lines = Array.from({ length: 14 }, (_, i) => i);
  return (
    <div className="fb-note" role="img" aria-label={`${money(value)} in FinBucks`}>
      <svg viewBox="0 0 225 100" preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <linearGradient id={`n${id}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#0f6e70" />
            <stop offset="0.55" stopColor="#139a9b" />
            <stop offset="1" stopColor="#0b4f61" />
          </linearGradient>
        </defs>
        <rect width="225" height="100" fill={`url(#n${id})`} />
        {/* Guilloché: interlaced sine bands like engraved security printing */}
        {lines.map((i) => (
          <path key={i} d={`M0 ${12 + i * 6} ${Array.from({ length: 12 }, (_, k) => `Q ${k * 20 + 10} ${12 + i * 6 + (k % 2 ? 7 : -7)} ${(k + 1) * 20} ${12 + i * 6}`).join(' ')}`} fill="none" stroke="#bff3ee" strokeOpacity="0.12" strokeWidth="0.7" />
        ))}
        <rect x="4" y="4" width="217" height="92" rx="8" fill="none" stroke="#f4cf63" strokeOpacity="0.7" strokeWidth="1.2" />
        <rect x="8" y="8" width="209" height="84" rx="6" fill="none" stroke="#bff3ee" strokeOpacity="0.25" strokeWidth="0.6" strokeDasharray="2 2" />
        {/* Medallion with the F */}
        <circle cx="62" cy="54" r="24" fill="#0b4f61" stroke="#f4cf63" strokeWidth="1.6" />
        <circle cx="62" cy="54" r="19" fill="none" stroke="#f4cf63" strokeOpacity="0.5" strokeWidth="0.8" strokeDasharray="1.5 1.5" />
        <path d="M54 42h17v5.5H60.5v4h8.5V57h-8.5v10H54z" fill="#f4cf63" />
        {/* Serial number and a holographic strip */}
        <text x="120" y="30" fontSize="7" fill="#d9fbf6" fillOpacity="0.8" fontFamily="monospace" letterSpacing="1">FC 0042 7319</text>
        <rect x="102" y="0" width="7" height="100" fill="#f4cf63" fillOpacity="0.22" />
      </svg>
      <span className="fb-label">{label}</span>
      <span className="fb-value">{money(value)}</span>
    </div>
  );
}
