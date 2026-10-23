'use client';
import { useGame, act } from '@/store/game';
import { monthlyBills, totalMonthlyBills } from '@/game/sim/catalog';
import { toggleSubscription } from '@/game/finance/purchases';
import { Section, Stat, StatGrid, Empty } from '../../kit';
import { Button, ReadAloud } from '../../common';
import { money } from '../../format';
import subscriptions from '@/data/subscriptions.json';

export function BillsApp() {
  const w = useGame((s) => s.world!);
  const bills = monthlyBills(w);
  const total = totalMonthlyBills(w);
  const loans = w.finance.loans.reduce((s, l) => s + l.payment, 0);
  const avgIncome = w.finance.summaries.slice(0, 3).reduce((s, x) => s + x.income, 0) / Math.max(1, Math.min(3, w.finance.summaries.length));
  return (
    <div>
      <StatGrid>
        <Stat icon="🧾" label="Monthly bills" value={money(total)} tone="bad" />
        <Stat icon="📝" label="Loan payments" value={money(loans)} />
        <Stat icon="💰" label="Avg monthly income" value={money(avgIncome)} tone="good" sub="last 3 months" />
      </StatGrid>
      <Section title="Charged at the end of every month" right={<ReadAloud text="Bills are things you pay every month. They come out of your checking account automatically." />}>
        {bills.length === 0 ? (
          <Empty icon="🎉">No bills right now. Everything you own adds upkeep, so keep an eye on this list!</Empty>
        ) : (
          <div className="col" style={{ gap: 4 }}>
            {bills.map((b, i) => (
              <div key={i} className="row between small card flat" style={{ padding: '0.35rem 0.6rem' }}>
                <span>
                  {b.icon} {b.name}
                </span>
                <b className="mono">{money(b.amount * (b.inflates ? w.market.priceIndex : 1))}</b>
              </div>
            ))}
          </div>
        )}
        <p className="tiny muted">Bills are paid from checking first, then cash, then savings{w.difficulty === 'advanced' ? ', then your credit card' : ''}. Prices slowly rise with inflation.</p>
      </Section>
      <Section title="Subscriptions (optional wants)">
        <p className="small">Small monthly charges feel tiny, but they add up! Each one makes you a little happier every month.</p>
        <div className="col" style={{ gap: 6 }}>
          {subscriptions.items.map((s) => {
            const on = w.finance.subscriptions.includes(s.id);
            return (
              <div key={s.id} className="row between card flat" style={{ padding: '0.4rem 0.6rem' }}>
                <span>
                  {s.icon} <b>{s.name}</b> <span className="small muted">{money(s.monthly)}/mo · {money(s.monthly * 12)}/yr</span>
                  {(s as { need?: boolean }).need && <span className="chip teal" style={{ marginLeft: 6 }}>need</span>}
                </span>
                <Button size="small" variant={on ? 'danger' : 'primary'} onClick={() => act((d, fx) => toggleSubscription(d, fx, s.id))}>
                  {on ? 'Cancel' : 'Subscribe'}
                </Button>
              </div>
            );
          })}
        </div>
      </Section>
    </div>
  );
}
