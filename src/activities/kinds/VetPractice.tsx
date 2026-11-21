'use client';
/**
 * Run the Practice (Advanced). Six months running a veterinary clinic: price check-ups and
 * surgeries against demand, hire vets for capacity, and decide whether to bill pet insurers
 * directly (more clients, but the money arrives a month late and 8% short). Scored on profit
 * against the best plan each month, with cash flow tracked separately from profit.
 */
import { useMemo, useState } from 'react';
import type { KindProps } from '../types';
import { Button } from '@/ui/common';
import { playSfx } from '@/engine/audio';
import { VET_FIXED, VET_SALARY, bestVetMonth, vetMonth, type VetMonth } from '@/game/finance/desks';
import { C, LineChart, ProHead, Slider, Stats, Table, Verdict, usd } from './pro/kit';
import { variantIndex } from '../variant';

// Four different half-years to run the clinic through, so demand never moves the same way twice
const RUNS = [
  {
    cash: 40_000,
    months: [
      { name: 'January', season: 0.85, note: 'Quiet after the holidays.' },
      { name: 'February', season: 0.9, note: 'Still slow.' },
      { name: 'March', season: 1.05, note: 'Spring: vaccinations pick up.' },
      { name: 'April', season: 1.15, note: 'Puppy and kitten season.' },
      { name: 'May', season: 1.2, note: 'Busiest month of the year.' },
      { name: 'June', season: 1.1, note: 'Summer travel boarding checks.' },
    ],
  },
  {
    cash: 35_000,
    months: [
      { name: 'July', season: 1.05, note: 'Boarding checks before summer trips.' },
      { name: 'August', season: 0.9, note: 'Many families are away.' },
      { name: 'September', season: 1.0, note: 'Back to routine visits.' },
      { name: 'October', season: 1.1, note: 'Autumn vaccination reminders go out.' },
      { name: 'November', season: 0.9, note: 'Quieter as the weather turns.' },
      { name: 'December', season: 0.8, note: 'Holidays: very quiet, except emergencies.' },
    ],
  },
  {
    cash: 30_000,
    months: [
      { name: 'March', season: 0.7, note: 'You just opened in a new neighbourhood. Few people know you yet.' },
      { name: 'April', season: 0.8, note: 'Word of mouth is starting to spread.' },
      { name: 'May', season: 0.95, note: 'New homes nearby are filling up with families and pets.' },
      { name: 'June', season: 1.05, note: 'Reviews online are bringing in new clients.' },
      { name: 'July', season: 1.15, note: 'You are now the local clinic of choice.' },
      { name: 'August', season: 1.2, note: 'Fully known in the area. Busiest month yet.' },
    ],
  },
  {
    cash: 45_000,
    months: [
      { name: 'February', season: 1.1, note: 'Steady and busy. You are the only clinic in town.' },
      { name: 'March', season: 1.15, note: 'Spring vaccinations. A rival clinic announces it will open next month.' },
      { name: 'April', season: 0.85, note: 'The rival opens with discount check-ups. Some clients try it.' },
      { name: 'May', season: 0.8, note: 'The rival is busy. Your diary has gaps.' },
      { name: 'June', season: 0.9, note: 'Some clients come back, missing your service.' },
      { name: 'July', season: 1.0, note: 'The town has settled into two clinics.' },
    ],
  },
];

export default function VetPractice({ seed, onFinish, addReview }: KindProps) {
  const [run0] = useState(() => RUNS[variantIndex('vet-practice', RUNS.length, seed)]);
  const MONTHS = run0.months;
  const [m, setM] = useState(0);
  const [d, setD] = useState<VetMonth>({ checkup: 60, surgery: 1100, vets: 1, insurance: false });
  const [log, setLog] = useState<{ profit: number; best: number; cash: number }[]>([]);
  const [cash, setCash] = useState(run0.cash);
  const [owed, setOwed] = useState(0);
  const [shown, setShown] = useState<null | ReturnType<typeof vetMonth>>(null);
  const mo = MONTHS[m];
  const best = useMemo(() => bestVetMonth(mo.season), [mo.season]);
  const preview = vetMonth(d, mo.season);

  const run = () => {
    const r = vetMonth(d, mo.season);
    const newCash = cash + r.cashIn + owed - r.costs;
    setCash(newCash);
    setOwed(r.receivable);
    setShown(r);
    setLog((l) => [...l, { profit: r.profit, best: best.profit, cash: newCash }]);
    playSfx(r.profit >= best.profit * 0.9 ? 'correct' : r.profit > 0 ? 'star' : 'wrong');
    if (m === 0 || r.profit < best.profit * 0.7)
      addReview?.({ q: `${mo.name}: your plan made ${usd(r.profit)}`, ok: r.profit >= best.profit * 0.9, answer: `Best: check-ups ${usd(best.d.checkup)}, surgery ${usd(best.d.surgery)}, ${best.d.vets} vet${best.d.vets > 1 ? 's' : ''}${best.d.insurance ? ', bill insurers' : ''} → ${usd(best.profit)}`, explanation: r.turnedAway > 40 ? 'You turned clients away: more vets or higher prices would have used the demand better.' : 'Price too low fills the diary but leaves money on the table; too high and clients go elsewhere. Profit peaks in between.' });
  };
  const next = () => {
    if (m + 1 >= MONTHS.length) {
      const got = log.reduce((a, b) => a + b.profit, 0);
      const opt = log.reduce((a, b) => a + b.best, 0);
      onFinish({ score: Math.max(0, Math.min(100, (got / opt) * 100)), summary: `Six-month profit ${usd(got)} (best plan ${usd(opt)}). Cash at the end ${usd(cash)}.` });
      return;
    }
    setM(m + 1);
    setShown(null);
  };

  return (
    <div className="pro">
      <ProHead kicker={`Veterinary clinic · ${mo.name} (month ${m + 1} of 6)`} title="Run the practice" sub={`${mo.note} Rent and staff cost ${usd(VET_FIXED)} a month, each vet ${usd(VET_SALARY)}.`} right={<div className="pro-price"><span className="pro-kicker">Cash in the bank</span><b style={{ color: cash < 0 ? C.red : undefined }}>{usd(cash)}</b></div>} />
      <div className="pro-grid">
        <section className="pro-panel">
          <h4>This month’s plan</h4>
          <Slider label="Check-up price" value={d.checkup} min={40} max={120} step={5} onChange={(v) => setD({ ...d, checkup: v })} show={usd(d.checkup)} disabled={!!shown} />
          <Slider label="Surgery price" value={d.surgery} min={600} max={2000} step={100} onChange={(v) => setD({ ...d, surgery: v })} show={usd(d.surgery)} disabled={!!shown} />
          <Slider label="Vets on staff" value={d.vets} min={1} max={3} onChange={(v) => setD({ ...d, vets: v })} show={d.vets} disabled={!!shown} />
          <label className="row" style={{ gap: 8, fontWeight: 800, margin: '6px 0' }}>
            <input type="checkbox" checked={d.insurance} disabled={!!shown} onChange={(e) => setD({ ...d, insurance: e.target.checked })} /> Bill pet insurers directly (+20% clients, paid next month at 92%)
          </label>
          <p className="tiny muted">Each vet can see 260 check-ups and 12 surgeries a month. Supplies cost $14 per check-up and $280 per surgery.</p>
          {!shown && (
            <Stats items={[['Expected visits', Math.round(preview.visits)], ['Surgeries', Math.round(preview.surgeries)], ['Turned away', Math.round(Math.max(0, preview.turnedAway)), preview.turnedAway > 30 ? 'bad' : undefined]]} />
          )}
        </section>
        <section className="pro-panel">
          <h4>Results</h4>
          {shown ? (
            <>
              <Table
                head={['', 'This month']}
                rows={[
                  ['Check-ups', Math.round(shown.visits)],
                  ['Surgeries', Math.round(shown.surgeries)],
                  ['Revenue', usd(shown.revenue)],
                  ['Costs', usd(-shown.costs)],
                  ['Profit', usd(shown.profit)],
                  ['Cash collected now', usd(shown.cashIn)],
                  ['Owed by insurers (next month)', usd(shown.receivable)],
                ]}
                hl={[4]}
              />
              <Verdict ok={shown.profit >= best.profit * 0.9} title={`Efficiency ${Math.round((shown.profit / best.profit) * 100)}% of the best plan`}>
                {shown.profit >= best.profit * 0.9 ? 'Excellent pricing and staffing.' : `The best plan this month earned ${usd(best.profit)}.`} Profit is not cash: insurer bills arrive a month later.
              </Verdict>
            </>
          ) : (
            <p className="small muted">Set your prices and staffing, then open the doors.</p>
          )}
          {log.length > 1 && <LineChart series={[{ pts: log.map((l) => l.profit), color: C.green, label: 'Your profit' }, { pts: log.map((l) => l.best), color: C.gold, label: 'Best plan', dash: true }]} h={150} fmt={(v) => usd(v)} />}
          <div className="row" style={{ justifyContent: 'flex-end', marginTop: 8 }}>
            {!shown ? (
              <Button variant="gold" size="big" onClick={run}>
                Open for {mo.name}
              </Button>
            ) : (
              <Button variant="primary" size="big" onClick={next}>
                {m + 1 >= MONTHS.length ? 'See results ▶' : 'Next month ▶'}
              </Button>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
