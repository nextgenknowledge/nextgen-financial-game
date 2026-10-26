'use client';
import { money } from '../format';

/** "Starter deal" badge with the usual price crossed out. */
export function StarterTag({ was, now, note }: { was: number; now: number; note?: string }) {
  return (
    <span className="starter-tag">
      <b>STARTER DEAL</b>
      <s>{money(was, { cents: false })}</s>
      <span className="mono">{money(now, { cents: false })}</span>
      {note && <em>{note}</em>}
    </span>
  );
}
