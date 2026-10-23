'use client';
import { useState } from 'react';
import { useUI } from '@/store/ui';
import { useGame, act } from '@/store/game';
import { Button, Modal, ReadAloud, ProgressBar } from '../common';
import { Section, AmountPicker, Stat, StatGrid, Explain, Empty, LineChart, Tabs } from '../kit';
import { money, pct } from '../format';
import { AccountsSummary, OpenAccounts, TransferForm, CDsPanel, LoansPanel, CardPanel, LedgerList } from './bankParts';
import { CreditReport } from '../phone/apps/CreditApp';
import { HallOfFame } from '../phone/apps/BadgesApp';
import { TradePanel } from './TradePanel';
import { GoalsApp } from '../phone/apps/GoalsApp';
import { LearnPanel } from '../panels/LearnPanel';
import { StyleStudio } from './StyleStudio';
import { donate, redeemPrize, startBusiness, upgradeBusiness, hireStaff, sellBusiness, setInsurance, setRetirement, depositRetirement, withdrawRetirement } from '@/game/finance/purchases';
import { available } from '@/game/finance/accounts';
import { businessValue } from '@/game/finance/netWorth';
import { growthSchedule } from '@/game/finance/interest';
import community from '@/data/community.json';
import furniture from '@/data/shop/furniture.json';
import businesses from '@/data/shop/businesses.json';
import insurance from '@/data/insurance.json';
import { BagApp } from '../phone/apps/BagApp';

const TITLES: Record<string, string> = {
  bank: '🏦 Fin City Bank · Teller',
  atm: '🏧 ATM',
  cds: '🔒 CDs & Goals',
  loans: '💳 Loans & Credit',
  credit: '📊 Credit Bureau',
  style: '🪞 Style Studio',
  townhall: '🏛️ Town Hall · Community Projects',
  'hall-of-fame': '🏆 Hall of Fame',
  'arcade-prizes': '🎟️ Prize Counter',
  garage: '🔑 My Garage',
  brokerage: '💹 Brokerage',
  business: '🏢 Business Registry',
  insurance: '☂️ Insurance Office',
  giving: '💝 Charity & Giving Center',
  retirement: '🏖️ Retirement Account',
};

export function ServicePanel({ id }: { id: string; arg?: string }) {
  const close = useUI((s) => s.close);
  if (id === 'library') return <LearnPanel tab="course" />;
  return (
    <Modal onClose={close} title={TITLES[id] ?? id} size="wide">
      {id === 'bank' && <BankTeller />}
      {id === 'atm' && <Atm />}
      {id === 'cds' && (
        <>
          <CDsPanel />
          <GoalsApp />
        </>
      )}
      {id === 'loans' && (
        <>
          <CardPanel />
          <LoansPanel />
        </>
      )}
      {id === 'credit' && <CreditReport />}
      {id === 'style' && <StyleStudio />}
      {id === 'townhall' && <TownHall />}
      {id === 'hall-of-fame' && <HallOfFame />}
      {id === 'arcade-prizes' && <PrizeCounter />}
      {id === 'garage' && <BagApp tab="vehicles" />}
      {id === 'brokerage' && <TradePanel />}
      {id === 'business' && <BusinessRegistry />}
      {id === 'insurance' && <InsuranceOffice />}
      {id === 'giving' && <GivingCenter />}
      {id === 'retirement' && <RetirementAccount />}
    </Modal>
  );
}

function BankTeller() {
  const f = useGame((s) => s.world!.finance);
  const entry = useGame((s) => s.world!.difficulty === 'entry');
  return (
    <div>
      <div className="card tint-teal row" style={{ marginBottom: 10 }}>
        <span style={{ fontSize: '2rem' }}>👩‍💼</span>
        <span>
          {entry
            ? 'Welcome to Fin City Bank! We keep your money safe, and your savings grow every month.'
            : 'Welcome! Deposits here are insured. Checking is for spending, savings earns interest, and CDs earn more for locking money up.'}
        </span>
        <ReadAloud text="Welcome to Fin City Bank! We keep your money safe, and your savings grow every month." />
      </div>
      <AccountsSummary />
      <OpenAccounts />
      {(f.hasChecking || f.hasSavings) && <TransferForm />}
      <Section title="Recent activity">
        <LedgerList limit={8} />
      </Section>
    </div>
  );
}

function Atm() {
  const f = useGame((s) => s.world!.finance);
  if (!f.hasChecking) return <Empty icon="🏧">You need a checking account to use the ATM. Talk to the bank teller first!</Empty>;
  return (
    <div>
      <AccountsSummary />
      <TransferForm />
      <p className="tiny muted">ATM tip: Never share your PIN, and cover the keypad when you type it.</p>
    </div>
  );
}

function TownHall() {
  const w = useGame((s) => s.world!);
  const [amt, setAmt] = useState<Record<string, number>>({});
  const entry = w.difficulty === 'entry';
  return (
    <div>
      <Section title="Community projects" right={<ReadAloud text="When people in a town put money together, they can build things for everyone, like playgrounds and gardens." />}>
        <p className="small">
          {entry
            ? 'When everyone chips in, we can build things for the whole town! Funded projects appear in the park.'
            : 'Public goods are funded by taxes and donations. Fund a project and it gets built in Fin-City Park with a bonus for everyone.'}
        </p>
        <div className="col" style={{ gap: 8 }}>
          {community.projects.map((p) => {
            const have = w.progress.community[p.id] ?? 0;
            const done = have >= p.cost;
            return (
              <div key={p.id} className={`card ${done ? 'tint-green' : 'flat'}`}>
                <div className="row between wrap">
                  <b>
                    {p.icon} {p.name}
                  </b>
                  <span className="small mono">
                    {money(Math.min(have, p.cost), { cents: false })} / {money(p.cost, { cents: false })}
                  </span>
                </div>
                <div className="small muted">
                  {p.blurb} Bonus: {p.bonus}
                </div>
                <ProgressBar value={have} max={p.cost} color={done ? 'var(--good)' : 'var(--gold)'} />
                {!done && (
                  <div className="row wrap" style={{ gap: 6, marginTop: 6 }}>
                    {[5, 25, 100, 500].map((x) => (
                      <Button key={x} size="small" onClick={() => setAmt({ ...amt, [p.id]: Math.min(available(w), (amt[p.id] ?? 0) + x) })}>
                        +${x}
                      </Button>
                    ))}
                    <Button size="small" variant="green" disabled={!(amt[p.id] > 0)} onClick={() => (act((d, fx) => void donate(d, fx, p.id, amt[p.id])), setAmt({ ...amt, [p.id]: 0 }))}>
                      Donate {money(amt[p.id] ?? 0)}
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Section>
      <Section title="Where do taxes go?">
        <p className="small">
          {entry
            ? 'Taxes are money everyone pays to the town. The town uses it for schools, roads, parks, firefighters and libraries!'
            : 'Fin City collects income tax (progressive brackets), payroll taxes, sales tax and property tax. They fund schools, roads, public safety, parks and programs like Social Security.'}
        </p>
      </Section>
    </div>
  );
}

function PrizeCounter() {
  const w = useGame((s) => s.world!);
  return (
    <div>
      <div className="networth-hero">
        <div className="tiny bold muted">YOUR TICKETS</div>
        <div className="networth-big">🎟️ {w.progress.tickets}</div>
        <div className="small">Win tickets by playing arcade games ($1 per game).</div>
      </div>
      <div className="item-grid">
        {furniture.prizes.map((p) => (
          <div key={p.id} className="item-card">
            <span style={{ fontSize: '2rem' }}>{p.icon}</span>
            <b className="small">{p.name}</b>
            <span className="tiny">🎟️ {p.tickets}</span>
            <Button size="small" variant="gold" disabled={w.progress.tickets < p.tickets} onClick={() => act((d, fx) => void redeemPrize(d, fx, p.id))}>
              Redeem
            </Button>
          </div>
        ))}
      </div>
      <p className="tiny muted">Fun fact: a ticket costs about 4–5¢ in game money. The arcade is spending for fun, totally fine when you budget for it!</p>
    </div>
  );
}

function BusinessRegistry() {
  const w = useGame((s) => s.world!);
  const [tab, setTab] = useState<'mine' | 'start'>(w.assets.businesses.length ? 'mine' : 'start');
  const [name, setName] = useState('');
  const entry = w.difficulty === 'entry';
  return (
    <div>
      <Tabs value={tab} onChange={setTab} tabs={[{ id: 'mine', label: `🏢 My businesses (${w.assets.businesses.length})` }, { id: 'start', label: '✨ Start a business' }]} />
      {tab === 'start' && (
        <>
          <label className="field" style={{ marginBottom: 8 }}>
            Business name (optional)
            <input className="input" value={name} maxLength={24} onChange={(e) => setName(e.target.value)} placeholder="e.g. Sunny Lemonade Co." />
          </label>
          <div className="col" style={{ gap: 8 }}>
            {businesses.types.map((t) => {
              const cost = t.cost * w.market.priceIndex;
              const profit = t.revenue - t.expenses;
              const locked = !!(t as { unlockLevel?: number }).unlockLevel && w.progress.level < (t as { unlockLevel?: number }).unlockLevel!;
              return (
                <div key={t.id} className="card flat">
                  <div className="row between wrap">
                    <b>
                      {t.icon} {t.name}
                    </b>
                    <span className="mono">{money(cost, { cents: false })} to start</span>
                  </div>
                  <div className="small muted">{t.blurb}</div>
                  <div className="small">
                    {entry ? (
                      <>Earns about {money(profit, { cents: false })} profit each month.</>
                    ) : (
                      <>
                        Revenue ~{money(t.revenue, { cents: false })}/mo · costs ~{money(t.expenses, { cents: false })}/mo · margin {pct(profit / t.revenue, 0)} · risk ±{Math.round(t.risk * 100)}% · payback ≈ {Math.ceil(t.cost / profit)} months
                      </>
                    )}
                  </div>
                  <Button size="small" variant="primary" disabled={locked} onClick={() => act((d, fx) => void startBusiness(d, fx, t.id, name))}>
                    {locked ? `🔒 Level ${(t as { unlockLevel?: number }).unlockLevel}` : 'Start it'}
                  </Button>
                </div>
              );
            })}
          </div>
        </>
      )}
      {tab === 'mine' &&
        (w.assets.businesses.length === 0 ? (
          <Empty icon="🏢">You don&apos;t own a business yet.</Empty>
        ) : (
          w.assets.businesses.map((b) => {
            const t = businesses.types.find((x) => x.id === b.typeId)!;
            const last = b.profits[b.profits.length - 1];
            return (
              <div key={b.uid} className="card" style={{ marginBottom: 10 }}>
                <div className="row between wrap">
                  <b style={{ fontSize: '1.1rem' }}>
                    {t.icon} {b.name}
                  </b>
                  <span className="small">
                    Level {b.level}/{t.maxLevel} · {b.staff}/{t.maxStaff} staff
                  </span>
                </div>
                <StatGrid>
                  <Stat label="Last month" value={last === undefined ? '-' : money(last, { sign: true })} tone={last !== undefined && last < 0 ? 'bad' : 'good'} />
                  <Stat label="Value" value={money(businessValue(b), { cents: false })} sub={entry ? undefined : '3× yearly profit'} />
                  <Stat label="Invested" value={money(b.invested, { cents: false })} />
                </StatGrid>
                {b.profits.length > 1 && <LineChart height={100} series={[{ values: b.profits, color: '#3cc45a' }]} />}
                <div className="row wrap" style={{ gap: 6 }}>
                  <Button size="small" variant="primary" disabled={b.level >= t.maxLevel} onClick={() => act((d, fx) => void upgradeBusiness(d, fx, b.uid))}>
                    ⬆️ Upgrade ({money(t.upgradeCost * b.level * w.market.priceIndex, { cents: false })})
                  </Button>
                  <Button size="small" disabled={b.staff >= t.maxStaff} onClick={() => act((d, fx) => hireStaff(d, fx, b.uid, 1))}>
                    🧑‍🍳 Hire (+{money(t.wage, { cents: false })}/mo)
                  </Button>
                  <Button size="small" disabled={b.staff <= 0} onClick={() => act((d, fx) => hireStaff(d, fx, b.uid, -1))}>
                    Reduce staff
                  </Button>
                  <Button size="small" variant="danger" onClick={() => act((d, fx) => sellBusiness(d, fx, b.uid))}>
                    Sell business
                  </Button>
                </div>
                {!entry && <Explain>Upgrades raise revenue by {Math.round(t.levelBoost * 100)}% per level but also raise running costs. Each worker adds {Math.round(t.staffBoost * 100)}% revenue and costs {money(t.wage, { cents: false })}/month, hire only if the extra revenue beats the wage!</Explain>}
              </div>
            );
          })
        ))}
    </div>
  );
}

function InsuranceOffice() {
  const w = useGame((s) => s.world!);
  const entry = w.difficulty === 'entry';
  const has = (req?: string) => !req || (req === 'vehicle' && w.assets.vehicles.length > 0) || (req === 'pet' && w.assets.pets.length > 0) || (req === 'property' && w.assets.properties.length > 0);
  return (
    <div>
      <p className="small">
        {entry
          ? 'Insurance is like a safety net. You pay a little each month, and if something big goes wrong, insurance helps pay!'
          : 'Premium = what you pay monthly. Deductible = what you pay first when something happens. Coverage = the share insurance pays after the deductible.'}
      </p>
      {insurance.categories.map((c) => (
        <Section key={c.id} title={`${c.icon} ${c.name}`}>
          <div className="small muted">{c.blurb}</div>
          {!has((c as { requires?: string }).requires) ? (
            <div className="small">You don&apos;t own anything this covers yet.</div>
          ) : (
            <div className="row wrap" style={{ gap: 8, marginTop: 6 }}>
              {c.plans.map((p) => {
                const on = w.finance.insurance[c.id] === p.id;
                const ok = has((p as { requires?: string }).requires);
                return (
                  <div key={p.id} className={`card ${on ? 'tint-green' : 'flat'} col`} style={{ minWidth: 170, gap: 2 }}>
                    <b>{p.name}</b>
                    <span className="small">{money(p.premium)}/month</span>
                    <span className="small">Deductible {money(p.deductible, { cents: false })}</span>
                    <span className="tiny muted">Pays {Math.round(p.coverage * 100)}% after deductible</span>
                    <Button size="small" variant={on ? 'danger' : 'primary'} disabled={!ok} onClick={() => act((d, fx) => setInsurance(d, fx, c.id, on ? null : p.id))}>
                      {on ? 'Cancel' : 'Choose'}
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </Section>
      ))}
    </div>
  );
}

function GivingCenter() {
  const w = useGame((s) => s.world!);
  const [amt, setAmt] = useState<Record<string, number>>({});
  const entry = w.difficulty === 'entry';
  return (
    <div>
      <p className="small">
        {entry ? 'Giving helps others! But always check that a charity is real.' : 'Before donating, check the charity: transparent reports, reasonable overhead, no pressure tactics.'} You&apos;ve donated{' '}
        <b>{money(w.progress.stats.donated ?? 0)}</b> in total.
      </p>
      {community.causes.map((c) => (
        <div key={c.id} className="card flat" style={{ marginBottom: 8 }}>
          <div className="row between wrap">
            <b>
              {c.icon} {c.name}
            </b>
            {!entry && <span className={`chip ${c.overhead > 0.5 ? 'bad' : 'good'}`}>Overhead {Math.round(c.overhead * 100)}%</span>}
          </div>
          <div className="small muted">{c.blurb}</div>
          <div className="row wrap" style={{ gap: 6, marginTop: 6 }}>
            {[5, 20, 100].map((x) => (
              <Button key={x} size="small" onClick={() => setAmt({ ...amt, [c.id]: Math.min(available(w), (amt[c.id] ?? 0) + x) })}>
                +${x}
              </Button>
            ))}
            <Button
              size="small"
              variant={c.legit ? 'green' : 'danger'}
              disabled={!(amt[c.id] > 0)}
              onClick={() => {
                const a = amt[c.id];
                setAmt({ ...amt, [c.id]: 0 });
                act((d, fx) => {
                  if (!c.legit) {
                    fx.push({ type: 'narwhal', text: `Hmm… "${c.name}" had no address, no reports and lots of pressure. That's a scam pattern! I stopped the donation. Real charities don't rush you.`, mood: 'skeptical' });
                    d.progress.stats.scamsCaught = (d.progress.stats.scamsCaught ?? 0) + 1;
                    return;
                  }
                  donate(d, fx, c.id, a);
                });
              }}
            >
              Donate {money(amt[c.id] ?? 0)}
            </Button>
          </div>
        </div>
      ))}
      <Explain title="How to check a charity">Look for: a clear mission, yearly reports showing how money is spent, a real address, and how much goes to the cause vs. overhead. Be careful with prizes, countdowns and &quot;cash only&quot;.</Explain>
      <TownHall />
    </div>
  );
}

function RetirementAccount() {
  const w = useGame((s) => s.world!);
  const r = w.finance.retirement;
  const entry = w.difficulty === 'entry';
  const [pct2, setPct] = useState(Math.round(r.pct * 100) || 5);
  const [roth, setRoth] = useState(r.roth);
  const [dep, setDep] = useState(0);
  const early = growthSchedule({ start: 0, monthly: 100, annualRate: 0.07, years: 49 });
  const late = growthSchedule({ start: 0, monthly: 100, annualRate: 0.07, years: 49, startDelayYears: 19 });
  return (
    <div>
      <StatGrid>
        <Stat icon="🏖️" label={entry ? 'Future Fund' : 'Retirement balance'} value={money(r.balance)} />
        <Stat label="You put in" value={money(r.contributed)} />
        <Stat label="Employer match" value={money(r.matched)} tone="good" sub="Free money from jobs!" />
        <Stat label="Growth" value={money(r.balance - r.contributed - r.matched, { sign: true })} />
      </StatGrid>
      <Section title="Save part of every paycheck">
        <label className="field">
          {pct2}% of each paycheck
          <input type="range" min={0} max={20} value={pct2} onChange={(e) => setPct(Number(e.target.value))} />
        </label>
        {!entry && (
          <div className="row wrap" style={{ gap: 6, margin: '6px 0' }}>
            <Button size="small" variant={roth ? 'gold' : undefined} onClick={() => setRoth(true)}>
              Roth (pay tax now, tax-free later)
            </Button>
            <Button size="small" variant={!roth ? 'gold' : undefined} onClick={() => setRoth(false)}>
              Traditional (tax break now, taxed later)
            </Button>
          </div>
        )}
        <Button variant="primary" onClick={() => act((d, fx) => setRetirement(d, fx, pct2 / 100, roth))}>
          Save settings
        </Button>
        <p className="tiny muted">Jobs in San Francisco match 50% of what you save, up to 6% of your pay.</p>
      </Section>
      <Section title="Add money now">
        <AmountPicker max={available(w)} value={dep} onChange={setDep} />
        <div className="row" style={{ marginTop: 6 }}>
          <Button variant="green" disabled={dep <= 0} onClick={() => (act((d, fx) => void depositRetirement(d, fx, dep)), setDep(0))}>
            Deposit {money(dep)}
          </Button>
          <Button size="small" variant="danger" disabled={r.balance <= 0} onClick={() => act((d, fx) => withdrawRetirement(d, fx, Math.min(100, r.balance)))}>
            Withdraw $100 early (penalty!)
          </Button>
        </div>
      </Section>
      <Section title="Why start early?">
        <LineChart
          series={[
            { values: early, color: '#3cc45a', label: 'Start at 16' },
            { values: late, color: '#e1553f', label: 'Start at 35' },
          ]}
          labels={early.map((_, i) => `${16 + i}`)}
        />
        <div className="small">
          $100/month at 7%: starting at 16 → <b className="good">{money(early[49], { cents: false })}</b> at 65. Starting at 35 → <b className="bad">{money(late[49], { cents: false })}</b>.
        </div>
      </Section>
    </div>
  );
}
