'use client';
/**
 * Equity Research Desk (Advanced). Each round is a company: read the tearsheet, play with a live
 * discounted-cash-flow model, then (1) turn enterprise value into a fair value per share, (2) make
 * the Buy / Hold / Sell call against the market price and (3) answer a what-if about the model.
 */
import { useMemo, useState } from 'react';
import type { KindProps } from '../types';
import { Button } from '@/ui/common';
import { makeRng } from '@/game/rng';
import { dcf, rating, type DcfInput } from '@/game/finance/pro';
import { playSfx } from '@/engine/audio';
import { cls } from '@/ui/format';

const NAMES = [
  ['Northwind Robotics', 'Industrial automation'],
  ['Harbor Health', 'Healthcare services'],
  ['Blue Fern Foods', 'Packaged food'],
  ['Quanta Cloud', 'Cloud software'],
  ['Lumen Grid', 'Renewable utilities'],
  ['Atlas Freight', 'Logistics'],
  ['Kestrel Games', 'Video games'],
  ['Solace Pharma', 'Pharmaceuticals'],
  ['Copperline Telecom', 'Telecoms'],
  ['Orchard Retail', 'Retail'],
];

interface Co {
  name: string;
  sector: string;
  base: DcfInput;
  price: number;
  fair: number;
  whatIf: { prompt: string; choices: string[]; correct: number; explain: string };
}

const fm = (v: number) => `$${v.toLocaleString('en-US', { maximumFractionDigits: 1, minimumFractionDigits: 1 })}M`;
const fp = (v: number) => `${(v * 100).toFixed(1)}%`;

function makeCompany(seed: number, k: number): Co {
  const rng = makeRng(seed * 31 + k * 977);
  const [name, sector] = NAMES[(seed + k * 3) % NAMES.length];
  const base: DcfInput = {
    fcf1: Math.round(rng.range(40, 380)),
    growth: Math.round(rng.range(0.02, 0.16) * 200) / 200,
    terminal: Math.round(rng.range(0.015, 0.03) * 400) / 400,
    wacc: Math.round(rng.range(0.075, 0.115) * 200) / 200,
    netDebt: 0,
    shares: Math.round(rng.range(6, 40)),
  };
  const ev = dcf(base).enterpriseValue;
  base.netDebt = Math.round(ev * rng.range(-0.15, 0.45));
  const fair = dcf(base).perShare;
  // Keep the right call clear of the ±15% boundaries
  const upside = rng.pick([-0.4, -0.3, -0.25, -0.05, 0, 0.05, 0.3, 0.45, 0.6]);
  const price = Math.round((fair / (1 + upside)) * 100) / 100;
  // What-if: WACC up one point, or faster growth
  const kind = rng.chance(0.5) ? 'wacc' : 'growth';
  const alt = dcf({ ...base, ...(kind === 'wacc' ? { wacc: base.wacc + 0.01 } : { growth: base.growth + 0.02 }) }).enterpriseValue;
  const ch = alt / ev - 1;
  const opts = [ch, -ch, ch * 0.3, ch * 2.4].map((x) => Math.round(x * 1000) / 10);
  const order = [0, 1, 2, 3].sort(() => rng.next() - 0.5);
  const choices = order.map((i) => `${opts[i] > 0 ? 'Rise' : 'Fall'} about ${Math.abs(opts[i]).toFixed(1)}%`);
  return {
    name,
    sector,
    base,
    price,
    fair,
    whatIf: {
      prompt: kind === 'wacc' ? 'If the discount rate (WACC) were 1 point higher, enterprise value would…' : 'If growth in years 1-5 were 2 points faster, enterprise value would…',
      choices,
      correct: order.indexOf(0),
      explain:
        kind === 'wacc'
          ? 'A higher discount rate shrinks every future cash flow, and hits the terminal value hardest because it is furthest away and divided by (WACC − g).'
          : 'Faster growth raises every year’s cash flow and, through year 5, the terminal value too, so value rises.',
    },
  };
}

export default function ValuationDesk({ params, onFinish, addReview, seed }: KindProps<{ rounds?: number }>) {
  const rounds = params.rounds ?? 4;
  const [k, setK] = useState(0);
  const co = useMemo(() => makeCompany(seed, k), [seed, k]);
  const [g, setG] = useState(co.base.growth);
  const [tg, setTg] = useState(co.base.terminal);
  const [wacc, setWacc] = useState(co.base.wacc);
  const [fair, setFair] = useState('');
  const [call, setCall] = useState<string | null>(null);
  const [what, setWhat] = useState<number | null>(null);
  const [checked, setChecked] = useState<null | { a: boolean; b: boolean; c: boolean }>(null);
  const [score, setScore] = useState(0);
  const model = useMemo(() => dcf({ ...co.base, growth: g, terminal: tg, wacc }), [co, g, tg, wacc]);
  const right = rating(co.fair, co.price);
  const tweaked = g !== co.base.growth || tg !== co.base.terminal || wacc !== co.base.wacc;

  const reset = () => {
    setG(co.base.growth);
    setTg(co.base.terminal);
    setWacc(co.base.wacc);
  };
  const submit = () => {
    const v = Number(fair.replace(/[$,\s]/g, ''));
    const a = Math.abs(v - co.fair) <= Math.abs(co.fair) * 0.05;
    const b = call === right;
    const c = what === co.whatIf.correct;
    setChecked({ a, b, c });
    setScore((s) => s + Number(a) + Number(b) + Number(c));
    playSfx(a && b && c ? 'correct' : a || b || c ? 'star' : 'wrong');
    addReview?.({ q: `${co.name}: fair value per share`, ok: a, answer: `$${co.fair.toFixed(2)}`, explanation: `Equity value = EV − net debt = ${fm(dcf(co.base).enterpriseValue)} − ${fm(co.base.netDebt)}, then ÷ ${co.base.shares}M shares.` });
    addReview?.({ q: `${co.name}: Buy, Hold or Sell at $${co.price.toFixed(2)}?`, ok: b, answer: right, explanation: `Upside = fair ÷ price − 1 = ${fp(co.fair / co.price - 1)}. Above +15% is a Buy, below −15% a Sell.` });
    addReview?.({ q: co.whatIf.prompt, ok: c, answer: co.whatIf.choices[co.whatIf.correct], explanation: co.whatIf.explain });
  };
  const next = () => {
    if (k + 1 >= rounds) {
      onFinish({ score: (score / (rounds * 3)) * 100, correct: score, total: rounds * 3, summary: `${score} of ${rounds * 3} calls right across ${rounds} companies.` });
      return;
    }
    const n = makeCompany(seed, k + 1);
    setK(k + 1);
    setG(n.base.growth);
    setTg(n.base.terminal);
    setWacc(n.base.wacc);
    setFair('');
    setCall(null);
    setWhat(null);
    setChecked(null);
  };

  // Sensitivity of enterprise value to WACC (rows) and terminal growth (columns)
  const waccs = [-0.01, -0.005, 0, 0.005, 0.01].map((d) => co.base.wacc + d);
  const tgs = [-0.005, 0, 0.005].map((d) => co.base.terminal + d);
  const evBase = dcf(co.base).enterpriseValue;

  return (
    <div className="pro">
      <div className="pro-head">
        <div>
          <div className="pro-kicker">Equity research · Company {k + 1} of {rounds}</div>
          <div className="pro-title">{co.name}</div>
          <div className="pro-sub">{co.sector}</div>
        </div>
        <div className="pro-price">
          <span className="pro-kicker">Share price</span>
          <b>${co.price.toFixed(2)}</b>
        </div>
      </div>
      <div className="pro-grid">
        <section className="pro-panel">
          <h4>Tearsheet (consensus)</h4>
          <table className="pro-table">
            <tbody>
              <tr><td>Free cash flow, next year</td><td>{fm(co.base.fcf1)}</td></tr>
              <tr><td>Growth, years 1-5</td><td>{fp(co.base.growth)}</td></tr>
              <tr><td>Terminal growth</td><td>{fp(co.base.terminal)}</td></tr>
              <tr><td>WACC (discount rate)</td><td>{fp(co.base.wacc)}</td></tr>
              <tr><td>Net debt</td><td>{fm(co.base.netDebt)}</td></tr>
              <tr><td>Shares outstanding</td><td>{co.base.shares}M</td></tr>
            </tbody>
          </table>
          <h4 style={{ marginTop: 12 }}>Sensitivity: EV ($M)</h4>
          <table className="pro-table heat">
            <thead>
              <tr>
                <th>WACC ↓ · g →</th>
                {tgs.map((t) => (
                  <th key={t}>{fp(t)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {waccs.map((wv) => (
                <tr key={wv}>
                  <th>{fp(wv)}</th>
                  {tgs.map((t) => {
                    const ev = dcf({ ...co.base, wacc: wv, terminal: t }).enterpriseValue;
                    const d = ev / evBase - 1;
                    return (
                      <td key={t} style={{ background: d >= 0 ? `rgba(34,211,143,${Math.min(0.45, d * 1.5)})` : `rgba(255,107,92,${Math.min(0.45, -d * 1.5)})` }}>
                        {Math.round(ev).toLocaleString()}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </section>
        <section className="pro-panel">
          <div className="row between">
            <h4>Your DCF model</h4>
            {tweaked && (
              <button className="link-btn" onClick={reset}>
                Reset to consensus
              </button>
            )}
          </div>
          {(
            [
              ['Growth 1-5', g, setG, 0, 0.25],
              ['Terminal growth', tg, setTg, 0, 0.04],
              ['WACC', wacc, setWacc, 0.05, 0.15],
            ] as const
          ).map(([label, val, set, lo, hi]) => (
            <label key={label} className="pro-slider">
              <span>{label}</span>
              <input type="range" min={lo} max={hi} step={0.0025} value={val} onChange={(e) => set(Number(e.target.value))} />
              <b>{fp(val)}</b>
            </label>
          ))}
          <table className="pro-table">
            <thead>
              <tr>
                <th>Year</th>
                <th>FCF</th>
                <th>Discount</th>
                <th>Present value</th>
              </tr>
            </thead>
            <tbody>
              {model.years.map((y) => (
                <tr key={y.t}>
                  <td>{y.t}</td>
                  <td>{fm(y.fcf)}</td>
                  <td>{y.df.toFixed(3)}</td>
                  <td>{fm(y.pv)}</td>
                </tr>
              ))}
              <tr>
                <td colSpan={3}>Terminal value {fm(model.terminalValue)} → PV</td>
                <td>{fm(model.pvTerminal)}</td>
              </tr>
              <tr className="hl">
                <td colSpan={3}>Enterprise value (EV)</td>
                <td>{fm(model.enterpriseValue)}</td>
              </tr>
            </tbody>
          </table>
          <p className="tiny muted" style={{ margin: '6px 0 0' }}>
            Terminal value = FCF₅ × (1 + g) ÷ (WACC − g). The model stops at enterprise value: getting to a share price is your job.
          </p>
        </section>
      </div>
      <section className="pro-panel pro-answer">
        <div className="pro-q">
          <span className="pro-qn">1</span>
          <span className="grow">Using the consensus inputs, what is the fair value per share?</span>
          <span className="pro-input">
            $
            <input className="input mono" inputMode="decimal" value={fair} disabled={!!checked} onChange={(e) => setFair(e.target.value)} placeholder="0.00" />
          </span>
          {checked && <span className={cls('pro-mark', checked.a ? 'ok' : 'no')}>{checked.a ? '✓' : `$${co.fair.toFixed(2)}`}</span>}
        </div>
        <div className="pro-q">
          <span className="pro-qn">2</span>
          <span className="grow">Your call at ${co.price.toFixed(2)}?</span>
          <span className="row" style={{ gap: 6 }}>
            {(['Buy', 'Hold', 'Sell'] as const).map((r) => (
              <button key={r} className={cls('pro-pill', call === r && 'on', checked && r === right && 'right', checked && call === r && r !== right && 'wrong')} disabled={!!checked} onClick={() => setCall(r)}>
                {r}
              </button>
            ))}
          </span>
        </div>
        <div className="pro-q col" style={{ alignItems: 'stretch' }}>
          <div className="row">
            <span className="pro-qn">3</span>
            <span className="grow">{co.whatIf.prompt}</span>
          </div>
          <div className="pro-choices">
            {co.whatIf.choices.map((c, i) => (
              <button key={i} className={cls('pro-pill', what === i && 'on', checked && i === co.whatIf.correct && 'right', checked && what === i && i !== co.whatIf.correct && 'wrong')} disabled={!!checked} onClick={() => setWhat(i)}>
                {c}
              </button>
            ))}
          </div>
        </div>
        <div className="row" style={{ justifyContent: 'flex-end' }}>
          {!checked ? (
            <Button variant="gold" size="big" disabled={!fair.trim() || !call || what === null} onClick={submit}>
              Submit research note
            </Button>
          ) : (
            <Button variant="primary" size="big" onClick={next}>
              {k + 1 >= rounds ? 'See results ▶' : 'Next company ▶'}
            </Button>
          )}
        </div>
      </section>
    </div>
  );
}
