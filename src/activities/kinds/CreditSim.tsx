'use client';
import { useMemo, useState } from 'react';
import type { KindProps } from '../types';
import { creditScore, creditTier, TIER_LABEL } from '@/game/finance/credit';
import { makeRng } from '@/game/rng';
import { Button } from '@/ui/common';
import { LineChart, Stat, StatGrid } from '@/ui/kit';
import { money, pct } from '@/ui/format';
import { playSfx } from '@/engine/audio';

interface SimState {
  month: number;
  onTime: number;
  late: number;
  lateMonths: number[];
  balance: number;
  limit: number;
  inquiries: number[];
  hasLoan: boolean;
  interestPaid: number;
  history: number[];
  cash: number;
}

const APR = 0.2499;

/** 24 months of credit decisions; score must reach the target while keeping interest low. */
export default function CreditSim({ params, onFinish, addReview, seed }: KindProps<{ months: number; target: number }>) {
  const rng = useMemo(() => makeRng(seed), [seed]);
  const [s, setS] = useState<SimState>({ month: 0, onTime: 0, late: 0, lateMonths: [], balance: 0, limit: 1000, inquiries: [0], hasLoan: false, interestPaid: 0, history: [], cash: 600 });
  const [spend, setSpend] = useState<'low' | 'mid' | 'high'>('low');
  const [event, setEvent] = useState<string | null>(null);

  const score = (st: SimState) =>
    creditScore({
      onTime: st.onTime,
      late: st.late,
      lateMonthsAgo: st.lateMonths.map((m) => st.month - m),
      utilization: st.balance / st.limit,
      oldestAccountMonths: st.month,
      hardInquiriesLast12: st.inquiries.filter((m) => st.month - m < 12).length,
      hasRevolving: true,
      hasInstallment: st.hasLoan,
    });

  const choose = (pay: 'full' | 'min' | 'skip', extra?: 'card' | 'loan') => {
    const st = { ...s, inquiries: [...s.inquiries], lateMonths: [...s.lateMonths] };
    const charge = spend === 'low' ? rng.int(60, 120) : spend === 'mid' ? rng.int(250, 400) : rng.int(600, 900);
    st.balance += charge;
    st.cash += 450 - charge * 0.2; // income minus other costs
    const min = Math.min(st.balance, Math.max(25, st.balance * 0.01 + (st.balance * APR) / 12));
    let paid = 0;
    if (pay === 'full') paid = Math.min(st.balance, st.cash);
    else if (pay === 'min') paid = Math.min(min, st.cash);
    st.cash -= paid;
    st.balance -= paid;
    if (paid + 0.01 >= min) st.onTime++;
    else {
      st.late++;
      st.lateMonths.push(st.month);
      st.balance += 30;
    }
    if (st.balance > 0.01) {
      const i = (st.balance * APR) / 12;
      st.balance += i;
      st.interestPaid += i;
    }
    if (extra === 'card') {
      st.inquiries.push(st.month);
      st.limit += 1500;
    }
    if (extra === 'loan') {
      st.inquiries.push(st.month);
      st.hasLoan = true;
    }
    st.month++;
    const sc = score(st);
    st.history.push(sc);
    // Occasional event
    const ev = st.month % 6 === 3 ? rng.pick(['A store offers 15% off if you open its card today.', 'A friend says carrying a balance builds credit faster.', 'Your car needs a $400 repair this month.']) : null;
    if (ev?.startsWith('Your car')) st.cash -= 400;
    setEvent(ev);
    setS(st);
    playSfx(pay === 'skip' ? 'wrong' : 'coin');
    if (st.month >= params.months) {
      const finalScore = sc;
      const hit = finalScore >= params.target;
      const pts = Math.max(0, Math.min(100, (finalScore - 580) / (params.target - 580) * 70 + (hit ? 10 : 0) + Math.max(0, 20 - st.interestPaid / 15)));
      addReview?.({ q: 'Final credit score', ok: hit, answer: `${finalScore}`, explanation: `You paid ${money(st.interestPaid)} in interest with ${st.late} late payments and ${st.inquiries.length} hard inquiries. Paying in full every month and keeping utilization low builds the best score at zero cost.` });
      onFinish({ score: pts, summary: `Final score ${finalScore} (${TIER_LABEL[creditTier(finalScore)]}). Interest paid: ${money(st.interestPaid)}.` });
    }
  };

  const cur = s.history[s.history.length - 1] ?? null;
  const util = s.balance / s.limit;
  return (
    <div className="col" style={{ gap: 10 }}>
      <div className="card tint-teal small">
        Goal: reach <b>{params.target}+</b> by month {params.months} while paying as little interest as possible. Each month you choose how much to spend on the card and how to pay the bill. You earn $450/month.
      </div>
      <StatGrid>
        <Stat label="Month" value={`${s.month}/${params.months}`} />
        <Stat label="Score" value={cur ?? '-'} sub={cur ? TIER_LABEL[creditTier(cur)] : 'No history yet'} />
        <Stat label="Card balance" value={money(s.balance)} sub={`Utilization ${pct(util, 0)}`} tone={util > 0.3 ? 'bad' : undefined} />
        <Stat label="Interest paid" value={money(s.interestPaid)} tone={s.interestPaid > 0 ? 'bad' : 'good'} />
        <Stat label="Your cash" value={money(s.cash)} />
      </StatGrid>
      {s.history.length > 1 && <LineChart money={false} height={120} series={[{ values: s.history, color: '#2f6bdb' }]} />}
      {event && <div className="card tint-gold">📣 {event}</div>}
      <div className="row wrap" style={{ gap: 6 }}>
        <b>This month&apos;s card spending:</b>
        {(['low', 'mid', 'high'] as const).map((k) => (
          <Button key={k} size="small" variant={spend === k ? 'gold' : undefined} onClick={() => setSpend(k)}>
            {k === 'low' ? 'Low (~$90)' : k === 'mid' ? 'Medium (~$325)' : 'High (~$750)'}
          </Button>
        ))}
      </div>
      <div className="row wrap" style={{ gap: 8 }}>
        <Button variant="green" onClick={() => choose('full')}>
          Pay full balance
        </Button>
        <Button onClick={() => choose('min')}>Pay minimum</Button>
        <Button variant="danger" onClick={() => choose('skip')}>
          Skip payment
        </Button>
        <Button variant="blue" onClick={() => choose('full', 'card')}>
          Pay full + open another card
        </Button>
        {!s.hasLoan && (
          <Button variant="blue" onClick={() => choose('full', 'loan')}>
            Pay full + take a small loan
          </Button>
        )}
      </div>
    </div>
  );
}
