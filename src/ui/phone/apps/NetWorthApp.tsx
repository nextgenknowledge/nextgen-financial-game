'use client';
import { useMemo } from 'react';
import { useGame } from '@/store/game';
import { netWorth, netWorthPoint } from '@/game/finance/netWorth';
import { BarList, LineChart, Section, Explain, COLORS, Pie } from '../../kit';
import { money } from '../../format';
import { ReadAloud } from '../../common';
import { MONTH_NAMES } from '@/game/world';

export function NetWorthApp() {
  const w = useGame((s) => s.world!);
  const b = useMemo(() => netWorth(w), [w]);
  const entry = w.difficulty === 'entry';
  const history = useMemo(() => [...w.progress.netWorth, netWorthPoint(w)], [w]);
  const last = w.progress.netWorth[w.progress.netWorth.length - 1];
  const prev = w.progress.netWorth[w.progress.netWorth.length - 2];
  const change = last && prev ? last.total - prev.total : null;
  const assets = [
    { label: 'FinBucks (cash)', value: b.cash, color: COLORS.cash, icon: '💵' },
    { label: 'Checking', value: b.checking, color: COLORS.bank, icon: '🏦' },
    { label: 'Savings', value: b.savings, color: COLORS.bank, icon: '🐷' },
    { label: 'CDs', value: b.cds, color: COLORS.bank, icon: '🔒' },
    { label: 'Investments', value: b.investments, color: COLORS.investments, icon: '💹' },
    { label: 'Retirement', value: b.retirement, color: COLORS.retirement, icon: '🏖️' },
    { label: 'Startups', value: b.startups, color: COLORS.investments, icon: '🚀' },
    { label: 'Businesses', value: b.businesses, color: COLORS.property, icon: '🏢' },
    { label: 'Land & homes', value: b.property, color: COLORS.property, icon: '🏡' },
    { label: 'Vehicles', value: b.vehicles, color: COLORS.other, icon: '🚗' },
    { label: 'Stuff & collectibles', value: b.items, color: COLORS.other, icon: '🖼️' },
  ].filter((x) => Math.abs(x.value) > 0.004);
  const debts = [
    { label: 'Loans', value: b.loans, color: COLORS.debt, icon: '📝' },
    { label: 'Mortgage', value: b.mortgage, color: COLORS.debt, icon: '🏠' },
    { label: 'Credit card', value: b.card, color: COLORS.debt, icon: '💳' },
    { label: 'Unpaid bills', value: b.bills, color: COLORS.debt, icon: '🧾' },
    { label: 'Taxes owed', value: b.taxes, color: COLORS.debt, icon: '🏛️' },
  ].filter((x) => x.value > 0.004);
  const total = Math.max(b.assets, b.liabilities, 1);
  const speech = `Your net worth is ${money(b.total, { cents: false })}. That's everything you own, ${money(b.assets, { cents: false })}, minus everything you owe, ${money(b.liabilities, { cents: false })}.`;

  return (
    <div>
      <div className="networth-hero">
        <div className="tiny bold muted">NET WORTH</div>
        <div className={`networth-big mono ${b.total < 0 ? 'bad' : ''}`}>{money(b.total, { cents: false })}</div>
        <div className="small">
          <span className="good">Own {money(b.assets, { cents: false })}</span> − <span className="bad">Owe {money(b.liabilities, { cents: false })}</span>
          <ReadAloud text={speech} />
        </div>
        {change !== null && (
          <div className={`small bold ${change >= 0 ? 'good' : 'bad'}`}>
            {change >= 0 ? '▲' : '▼'} {money(Math.abs(change), { cents: false })} last month
          </div>
        )}
      </div>
      <Explain title={entry ? 'What is net worth?' : 'How is this calculated?'}>
        {entry ? (
          <>Net worth = all the things you own (money, stuff, investments) <b>minus</b> anything you owe (loans). It&apos;s like your money &quot;score&quot;! Pets are loved but aren&apos;t counted, because you wouldn&apos;t sell them.</>
        ) : (
          <>
            Net worth = total assets − total liabilities. Assets are valued at today&apos;s market value: investments at current prices, vehicles after depreciation, homes at appraised value, businesses at 3× trailing annual profit, furniture at 40% resale. Leased cars and pets are not assets.
          </>
        )}
      </Explain>
      <div className="row wrap" style={{ gap: 16, alignItems: 'flex-start' }}>
        <div className="grow" style={{ minWidth: 260 }}>
          <Section title="What you own">{assets.length ? <BarList items={assets} total={total} /> : <span className="muted small">Nothing yet!</span>}</Section>
          <Section title="What you owe">{debts.length ? <BarList items={debts} total={total} /> : <span className="good small bold">No debt! 🕊️</span>}</Section>
        </div>
        <div style={{ minWidth: 160 }} className="col center">
          <Pie
            slices={[
              { label: 'FinBucks & bank', value: b.cash + b.checking + b.savings + b.cds, color: COLORS.bank },
              { label: 'Investments', value: b.investments + b.retirement + b.startups, color: COLORS.investments },
              { label: 'Property & business', value: b.property + b.businesses, color: COLORS.property },
              { label: 'Stuff', value: b.vehicles + b.items, color: COLORS.other },
            ]}
          />
          <div className="tiny">
            <div>
              <span style={{ color: COLORS.bank }}>■</span> FinBucks & bank
            </div>
            <div>
              <span style={{ color: COLORS.investments }}>■</span> Investments
            </div>
            <div>
              <span style={{ color: COLORS.property }}>■</span> Property & business
            </div>
            <div>
              <span style={{ color: COLORS.other }}>■</span> Stuff
            </div>
          </div>
        </div>
      </div>
      <Section title="Net worth over time">
        <LineChart
          series={[
            { values: history.map((p) => p.total), color: '#2f6bdb', label: 'Net worth' },
            { values: history.map((p) => -p.debt), color: '#e1553f', label: 'Debt', dashed: true },
          ]}
          labels={history.map((p) => `${MONTH_NAMES[p.month % 12]} Y${Math.floor(p.month / 12) + 1}`)}
        />
        <div className="tiny muted">Blue = net worth, red dashed = debt. A point is added at the end of every month.</div>
      </Section>
    </div>
  );
}
