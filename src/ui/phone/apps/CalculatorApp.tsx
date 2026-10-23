'use client';
import { useState } from 'react';
import { tryEvaluate } from '@/game/questions/expr';
import { Section } from '../../kit';

const KEYS = ['7', '8', '9', '÷', '(', '4', '5', '6', '×', ')', '1', '2', '3', '−', '^', '0', '.', '%', '+', '⌫'];

/** Calculator with parentheses, powers and finance helpers (shared with Advanced quizzes). */
export function Calculator({ onUse }: { onUse?: (v: number) => void }) {
  const [expr, setExpr] = useState('');
  const [hist, setHist] = useState<string[]>([]);
  const norm = expr.replace(/−/g, '-');
  const val = expr ? tryEvaluate(norm) : null;
  const press = (k: string) => {
    if (k === '⌫') return setExpr(expr.slice(0, -1));
    if (k === '%') return setExpr(expr + '/100');
    setExpr(expr + k);
  };
  const equals = () => {
    if (val === null) return;
    setHist([`${expr} = ${fmt(val)}`, ...hist].slice(0, 6));
    setExpr(String(+val.toFixed(8)));
  };
  return (
    <div className="calc">
      <input
        className="input mono calc-display"
        value={expr}
        onChange={(e) => setExpr(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && equals()}
        placeholder="e.g. 1000*(1+0.05/12)^(12*3)"
        aria-label="Calculator input"
      />
      <div className="calc-result mono">{expr ? (val === null ? '…' : `= ${fmt(val)}`) : ' '}</div>
      <div className="calc-keys">
        {KEYS.map((k) => (
          <button key={k} className="btn small" onClick={() => press(k)}>
            {k}
          </button>
        ))}
        <button className="btn small" onClick={() => setExpr('')}>
          C
        </button>
        <button className="btn small primary" style={{ gridColumn: 'span 2' }} onClick={equals}>
          =
        </button>
        {onUse && (
          <button className="btn small gold" style={{ gridColumn: 'span 2' }} disabled={val === null} onClick={() => val !== null && onUse(+val.toFixed(4))}>
            Use answer
          </button>
        )}
      </div>
      <div className="tiny muted">Functions: pmt(principal, apr, months) · fv(pv, rate, periods) · fvs(payment, rate, periods) · round(x, 2) · sqrt · ln · log</div>
      {hist.map((h, i) => (
        <div key={i} className="tiny mono muted">
          {h}
        </div>
      ))}
    </div>
  );
}

function fmt(v: number) {
  return Math.abs(v) >= 1e9 || (Math.abs(v) < 1e-4 && v !== 0) ? v.toExponential(4) : (+v.toFixed(6)).toLocaleString('en-US', { maximumFractionDigits: 6 });
}

export function CalculatorApp() {
  return (
    <Section title="🧮 Calculator">
      <Calculator />
    </Section>
  );
}
