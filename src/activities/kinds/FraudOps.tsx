'use client';
/**
 * Fraud & Risk Ops (Advanced). A queue of card transactions. Approve or block each one from the
 * risk signals. Missed fraud costs the full amount, blocking a real customer costs friction. At
 * the end: the confusion matrix, precision and recall, and your cost against simple policies and
 * the expected-value rule (block when chance × amount beats the friction cost).
 */
import { useMemo, useState } from 'react';
import type { KindProps } from '../types';
import { makeRng } from '@/game/rng';
import { Button } from '@/ui/common';
import { playSfx } from '@/engine/audio';
import { cls } from '@/ui/format';
import { FRICTION, fraudCost, fraudProb, type Txn } from '@/game/finance/desks';
import { Bars, C, ProHead, Table, Verdict, pc, usd } from './pro/kit';

const MERCHANTS: [string, string, number][] = [
  ['Corner Grocer', 'Groceries', 60],
  ['MetroRail', 'Transport', 20],
  ['StreamFlix', 'Subscriptions', 15],
  ['BigBox Electronics', 'Electronics', 120],
  ['GiftHub', 'Gift cards', 50],
  ['CoinVault', 'Crypto exchange', 80],
  ['Café Aroma', 'Restaurants', 18],
  ['FlyNow', 'Airlines', 400],
  ['FuelStop', 'Fuel', 55],
  ['LuxeWatch', 'Jewellery', 300],
];

function queue(seed: number): Txn[] {
  const rng = makeRng(seed * 19 + 3);
  return Array.from({ length: 14 }, (_, id) => {
    const [merchant, category, usual] = rng.pick(MERCHANTS);
    const sus = rng.chance(0.35);
    const amount = Math.round(usual * (sus ? rng.range(2, 14) : rng.range(0.4, 1.6)));
    const t = {
      merchant,
      category,
      amount,
      usual,
      km: sus && rng.chance(0.6) ? Math.round(rng.range(300, 9000)) : Math.round(rng.range(0, 25)),
      hour: sus && rng.chance(0.5) ? rng.int(1, 4) : rng.int(8, 22),
      newDevice: sus ? rng.chance(0.6) : rng.chance(0.08),
      velocity: sus ? rng.int(1, 6) : rng.int(0, 2),
    };
    const p = fraudProb(t);
    return { ...t, id, p, fraud: rng.next() < p };
  });
}

export default function FraudOps({ onFinish, addReview, seed }: KindProps) {
  const txns = useMemo(() => queue(seed), [seed]);
  const [flags, setFlags] = useState<(boolean | null)[]>(txns.map(() => null));
  const [done, setDone] = useState(false);
  const cur = flags.findIndex((f) => f === null);
  const t = cur >= 0 ? txns[cur] : null;

  const decide = (block: boolean) => {
    if (cur < 0) return;
    setFlags(flags.map((f, i) => (i === cur ? block : f)));
    playSfx('click');
  };

  if (cur < 0 || done) {
    const f = flags as boolean[];
    const me = fraudCost(txns, f);
    const ev = fraudCost(txns, txns.map((x) => x.p * x.amount > FRICTION * (1 - x.p)));
    const none = fraudCost(txns, txns.map(() => false));
    const all = fraudCost(txns, txns.map(() => true));
    const worst = Math.max(none.cost, all.cost);
    const score = Math.max(0, Math.min(1, (worst - me.cost) / (worst - ev.cost || 1)));
    return (
      <div className="pro">
        <ProHead kicker="Fraud & risk ops · Shift report" title={`Total cost ${usd(me.cost)}`} sub={`Missed fraud costs the amount; blocking a genuine customer costs about ${usd(FRICTION)} in support time and lost goodwill.`} />
        <div className="pro-grid">
          <section className="pro-panel">
            <h4>Confusion matrix</h4>
            <Table head={['', 'Was fraud', 'Was genuine']} rows={[['You blocked', `${me.tp} caught`, `${me.fp} false alarms`], ['You approved', `${me.fn} missed`, `${me.tn} fine`]]} />
            <Table compact head={['Metric', 'You']} rows={[['Precision (blocks that were fraud)', pc(me.precision, 0)], ['Recall (fraud you caught)', pc(me.recall, 0)]]} />
          </section>
          <section className="pro-panel">
            <h4>Cost of each policy</h4>
            <Bars items={[{ label: 'You', value: me.cost, color: C.blue }, { label: 'Expected-value rule', value: ev.cost, color: C.green }, { label: 'Approve everything', value: none.cost, color: C.red }, { label: 'Block everything', value: all.cost, color: C.gold }]} fmt={(v) => usd(v)} />
            <Verdict ok={score > 0.8} title={`Score ${Math.round(score * 100)}%`}>
              The best rule blocks when (chance of fraud × amount) is more than the cost of annoying a good customer. Small, odd-looking purchases are often not worth blocking.
            </Verdict>
            <div className="row" style={{ justifyContent: 'flex-end', marginTop: 8 }}>
              <Button
                variant="gold"
                size="big"
                onClick={() => {
                  txns.forEach((x, i) => {
                    const should = x.p * x.amount > FRICTION * (1 - x.p);
                    if (f[i] !== should) addReview?.({ q: `${x.merchant} ${usd(x.amount)} (${x.km} km from home, ${x.hour}:00${x.newDevice ? ', new device' : ''})`, ok: false, answer: should ? 'Block' : 'Approve', explanation: `Fraud chance about ${pc(x.p, 0)}: expected loss ${usd(x.p * x.amount)} vs ${usd(FRICTION * (1 - x.p))} of friction. It ${x.fraud ? 'was' : 'was not'} fraud.` });
                  });
                  onFinish({ score: score * 100, summary: `Cost ${usd(me.cost)} vs ${usd(ev.cost)} for the expected-value rule. Precision ${pc(me.precision, 0)}, recall ${pc(me.recall, 0)}.` });
                }}
              >
                Finish ▶
              </Button>
            </div>
          </section>
        </div>
      </div>
    );
  }

  const sig = (bad: boolean, text: string) => <span className={cls('fr-sig', bad && 'bad')}>{text}</span>;
  return (
    <div className="pro">
      <ProHead kicker={`Fraud & risk ops · Transaction ${cur + 1} of ${txns.length}`} title={`${t!.merchant} · ${usd(t!.amount)}`} sub={`Category: ${t!.category}. This customer usually spends about ${usd(t!.usual)} here.`} />
      <section className="pro-panel">
        <h4>Risk signals</h4>
        <div className="row wrap" style={{ gap: 8 }}>
          {sig(t!.amount > t!.usual * 3, `${(t!.amount / t!.usual).toFixed(1)}× usual amount`)}
          {sig(t!.km > 50, `${t!.km.toLocaleString()} km from home`)}
          {sig(t!.hour < 5, `${String(t!.hour).padStart(2, '0')}:00 local time`)}
          {sig(t!.newDevice, t!.newDevice ? 'New device' : 'Known device')}
          {sig(t!.velocity > 2, `${t!.velocity} card uses in the last hour`)}
          {sig(['Gift cards', 'Crypto exchange', 'Electronics'].includes(t!.category), ['Gift cards', 'Crypto exchange', 'Electronics'].includes(t!.category) ? 'High-risk category' : 'Normal category')}
        </div>
        <div className="row" style={{ gap: 10, marginTop: 14 }}>
          <Button variant="green" size="big" onClick={() => decide(false)}>
            Approve
          </Button>
          <Button variant="danger" size="big" onClick={() => decide(true)}>
            Block & call customer
          </Button>
        </div>
        <p className="tiny muted" style={{ marginBottom: 0 }}>
          Decided {cur} of {txns.length}. Fraudsters test stolen cards with small purchases, then go big on things easy to resell.
        </p>
      </section>
    </div>
  );
}
