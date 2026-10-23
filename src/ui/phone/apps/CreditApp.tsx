'use client';
import { useGame } from '@/store/game';
import { creditFactors, creditTier, TIER_LABEL, TIER_SPREAD, CREDIT_WEIGHTS } from '@/game/finance/credit';
import { creditInputs } from '@/game/finance/accounts';
import { Section, LineChart, Stat, StatGrid, Explain } from '../../kit';
import { ProgressBar } from '../../common';
import { pct } from '../../format';
import { MONTH_NAMES } from '@/game/world';

export function CreditReport() {
  const w = useGame((s) => s.world!);
  const c = w.finance.credit;
  if (w.difficulty !== 'advanced')
    return (
      <Section title="Being trustworthy with money">
        <p>
          When you borrow money and pay it back on time, people learn they can trust you. Grown-ups have a <b>credit score</b> that shows how trustworthy they are with borrowing. A good score means cheaper loans! (Switch to Advanced mode to see a real credit report.)
        </p>
      </Section>
    );
  const inputs = creditInputs(w);
  const f = creditFactors(inputs);
  const tier = creditTier(c.score);
  const factors: { name: string; key: keyof typeof f; help: string }[] = [
    { name: 'Payment history', key: 'payment', help: `${c.onTime} on-time, ${c.late} late payments` },
    { name: 'Credit utilization', key: 'utilization', help: inputs.utilization === null ? 'No credit card yet' : `Using ${pct(inputs.utilization, 0)} of your limit` },
    { name: 'Length of history', key: 'age', help: `${inputs.oldestAccountMonths} months` },
    { name: 'New credit', key: 'newCredit', help: `${inputs.hardInquiriesLast12} hard inquiries in the last 12 months` },
    { name: 'Credit mix', key: 'mix', help: `${inputs.hasRevolving ? 'Card ✓' : 'No card'} · ${inputs.hasInstallment ? 'Loan ✓' : 'No loan'}` },
  ];
  return (
    <div>
      <div className="networth-hero">
        <div className="tiny bold muted">CREDIT SCORE</div>
        <div className="networth-big mono">{c.score ?? '-'}</div>
        <div className="bold">{TIER_LABEL[tier]}</div>
        <div className="credit-gauge">
          <div style={{ left: `${c.score ? ((c.score - 300) / 550) * 100 : 0}%` }} />
        </div>
        <div className="tiny muted">300 ←→ 850</div>
      </div>
      {c.score === null && (
        <p className="card tint-gold small">
          You don&apos;t have a credit history yet. Your score starts when you open a credit card or take a loan. Paying on time is the #1 way to build it.
        </p>
      )}
      <Section title="What makes up your score">
        {factors.map((x) => (
          <div key={x.key} style={{ marginBottom: 8 }}>
            <div className="row between small">
              <b>
                {x.name} <span className="muted">({Math.round(CREDIT_WEIGHTS[x.key] * 100)}%)</span>
              </b>
              <span>{x.help}</span>
            </div>
            <ProgressBar value={f[x.key]} max={1} color={f[x.key] > 0.75 ? 'var(--good)' : f[x.key] > 0.5 ? 'var(--gold)' : 'var(--bad)'} />
          </div>
        ))}
      </Section>
      <StatGrid>
        <Stat label="Your loan rate today" value={pct(w.market.reserveRate + TIER_SPREAD[tier], 2)} sub="Reserve rate + your tier's spread" />
        <Stat label="Excellent-credit rate" value={pct(w.market.reserveRate + TIER_SPREAD.excellent, 2)} tone="good" />
        <Stat label="Poor-credit rate" value={pct(w.market.reserveRate + TIER_SPREAD.poor, 2)} tone="bad" />
      </StatGrid>
      {c.history.length > 1 && (
        <Section title="Score history">
          <LineChart money={false} series={[{ values: c.history.map((h) => h.score), color: '#2f6bdb' }]} labels={c.history.map((h) => `${MONTH_NAMES[h.month % 12]}`)} />
        </Section>
      )}
      <Explain title="How to raise your score">
        Pay every bill on time (turn on autopay). Keep card balances under 30% of your limit, under 10% is best. Don&apos;t apply for lots of credit at once. Keep old accounts open so your history grows longer.
      </Explain>
    </div>
  );
}

export function CreditApp() {
  return <CreditReport />;
}
