'use client';
/**
 * Fintech Product Lab (Advanced). Launch a budgeting app with $1.5M of seed money: set the monthly
 * price, the free trial and the marketing budget, run the 24-month model as often as you like,
 * then commit. Scored on monthly recurring revenue at month 24, provided the unit economics work
 * (lifetime value at least 3× the cost to acquire a customer) and the cash never runs out.
 */
import { useMemo, useState } from 'react';
import type { KindProps } from '../types';
import { Button } from '@/ui/common';
import { playSfx } from '@/engine/audio';
import { cls } from '@/ui/format';
import { bestFintech, fintechScore, fintechSim, type FintechPlan } from '@/game/finance/desks';
import { C, LineChart, ProHead, Slider, Stats, Table, Verdict, pc, usd, usdK } from './pro/kit';

export default function FintechLab({ onFinish, addReview }: KindProps) {
  const [p, setP] = useState<FintechPlan>({ price: 6, trial: 0, spend: 30_000 });
  const [runs, setRuns] = useState(0);
  const [done, setDone] = useState(false);
  const s = useMemo(() => fintechSim(p), [p]);
  const best = useMemo(() => bestFintech(), []);
  const bs = useMemo(() => fintechSim(best.p), [best]);

  const commit = () => {
    setDone(true);
    const score = Math.max(0, Math.min(1, fintechScore(p) / best.v));
    playSfx(score > 0.85 ? 'correct' : score > 0.5 ? 'star' : 'wrong');
    addReview?.({ q: 'Your launch plan', ok: score > 0.85, answer: `Best found: $${best.p.price}/month, ${best.p.trial ? `${best.p.trial}-day trial` : 'no trial'}, ${usdK(best.p.spend)}/month marketing`, explanation: `LTV = price × gross margin ÷ monthly churn. CAC = marketing ÷ new paying customers. Your LTV/CAC was ${s.ltvCac.toFixed(1)}×; investors look for 3× or more. ${s.minCash < 0 ? 'You ran out of cash: growth that burns faster than revenue arrives kills startups.' : ''}` });
    setTimeout(() => onFinish({ score: score * 100, summary: `Month-24 revenue ${usd(s.mrr[23])}/month, LTV/CAC ${s.ltvCac.toFixed(1)}×, cash ${usdK(s.cash)}.` }), 2200);
  };

  return (
    <div className="pro">
      <ProHead kicker="Fintech product lab · Unit economics" title="Launch a budgeting app" sub="$1.5M seed. Fixed costs $45k a month. Gross margin 78%. Experiment freely, then commit to one plan." right={<div className="pro-price"><span className="pro-kicker">Month-24 MRR</span><b>{usd(s.mrr[23])}</b></div>} />
      <div className="pro-grid">
        <section className="pro-panel">
          <h4>Your plan</h4>
          <Slider label="Price / month" value={p.price} min={3} max={20} onChange={(v) => (setP({ ...p, price: v }), setRuns((r) => r + 1))} show={`$${p.price}`} disabled={done} />
          <Slider label="Marketing / month" value={p.spend} min={10_000} max={100_000} step={5_000} onChange={(v) => (setP({ ...p, spend: v }), setRuns((r) => r + 1))} show={usdK(p.spend)} disabled={done} />
          <div className="row" style={{ gap: 6, margin: '6px 0' }}>
            <span className="small" style={{ fontWeight: 800, width: '9.5rem' }}>Free trial</span>
            {([0, 7, 30] as const).map((t) => (
              <button key={t} type="button" disabled={done} className={cls('pro-pill', p.trial === t && 'sel')} onClick={() => (setP({ ...p, trial: t }), setRuns((r) => r + 1))}>
                {t ? `${t} days` : 'None'}
              </button>
            ))}
          </div>
          <Stats items={[['CAC', usd(s.cac)], ['Monthly churn', pc(s.churn)], ['LTV', usd(s.ltv)], ['LTV / CAC', `${s.ltvCac.toFixed(1)}×`, s.ltvCac >= 3 ? 'good' : 'bad']]} />
          <p className="tiny muted">Higher prices raise LTV but make customers harder to win and quicker to cancel. Trials bring more sign-ups, but fewer of them pay. Big marketing budgets exhaust the cheap channels.</p>
        </section>
        <section className="pro-panel">
          <h4>24-month model</h4>
          <LineChart series={[{ pts: s.mrr, color: C.green, label: 'Monthly revenue' }, ...(done ? [{ pts: bs.mrr, color: C.gold, label: 'Best plan', dash: true }] : [])]} h={150} fmt={usdK} xLabel="Months →" />
          <LineChart series={[{ pts: s.cashPath, color: s.minCash < 0 ? C.red : C.blue, label: 'Cash in the bank' }]} h={130} fmt={usdK} hlines={[{ y: 0, label: 'Broke', color: C.red }]} />
          <Table compact head={['Subscribers at month 24', 'Lowest cash', 'Cash at month 24']} rows={[[Math.round(s.subs).toLocaleString(), usdK(s.minCash), usdK(s.cash)]]} />
          {done ? (
            <Verdict ok={fintechScore(p) / best.v > 0.85} title={`Plan score ${Math.round(Math.min(1, fintechScore(p) / best.v) * 100)}%`}>
              Best plan found: ${best.p.price}/month, {best.p.trial ? `${best.p.trial}-day trial` : 'no trial'}, {usdK(best.p.spend)} marketing → {usd(bs.mrr[23])} MRR.
            </Verdict>
          ) : (
            <div className="row" style={{ justifyContent: 'space-between', marginTop: 8 }}>
              <span className="tiny muted">{runs} model runs</span>
              <Button variant="gold" size="big" onClick={commit}>
                Commit to this plan
              </Button>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
