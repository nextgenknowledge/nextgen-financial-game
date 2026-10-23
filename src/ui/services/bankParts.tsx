'use client';
import { useState } from 'react';
import { useGame, act } from '@/store/game';
import { Button, ReadAloud } from '../common';
import { AmountPicker, Section, Stat, StatGrid, Explain, Empty, LineChart } from '../kit';
import { money, pct } from '../format';
import {
  openChecking,
  openSavings,
  transfer,
  savingsApy,
  savingsMonthlyRate,
  CD_TERMS,
  cdMonthlyRate,
  openCD,
  breakCD,
  loanQuote,
  takeLoan,
  payLoanExtra,
  openCard,
  payCard,
} from '@/game/finance/accounts';
import { monthLabel } from '@/game/world';
import { amortize } from '@/game/finance/loans';
import { creditTier, TIER_LABEL } from '@/game/finance/credit';

export function AccountsSummary() {
  const f = useGame((s) => s.world!.finance);
  const w = useGame((s) => s.world!);
  const entry = w.difficulty === 'entry';
  return (
    <StatGrid>
      <Stat icon="💵" label="Cash (pocket)" value={money(f.cash)} sub="Easy to spend, easy to lose" />
      <Stat icon="🏦" label="Checking" value={f.hasChecking ? money(f.checking) : 'Not open'} sub="Everyday money" />
      <Stat
        icon="🐷"
        label="Savings"
        value={f.hasSavings ? money(f.savings) : 'Not open'}
        sub={entry ? `Earns ${(savingsMonthlyRate(w) * 100).toFixed(1)}% every month` : `${pct(savingsApy(w), 2)} APY`}
        tone="good"
      />
      {f.cds.length > 0 && <Stat icon="🔒" label="CDs" value={money(f.cds.reduce((s, c) => s + c.value, 0))} sub={`${f.cds.length} locked`} />}
    </StatGrid>
  );
}

export function OpenAccounts() {
  const f = useGame((s) => s.world!.finance);
  const entry = useGame((s) => s.world!.difficulty === 'entry');
  if (f.hasChecking && f.hasSavings) return null;
  return (
    <Section title="Open an account">
      <div className="row wrap" style={{ gap: 10 }}>
        {!f.hasChecking && (
          <div className="card tint-teal col grow" style={{ minWidth: 220 }}>
            <b>🏦 Checking account</b>
            <span className="small">
              {entry ? 'A safe place for money you will spend soon. Your pay goes here!' : 'For everyday spending. Paychecks are deposited here; purchases come out. Usually no interest.'}
            </span>
            <Button variant="primary" onClick={() => act((w, fx) => openChecking(w, fx))}>
              Open checking (free)
            </Button>
          </div>
        )}
        {!f.hasSavings && (
          <div className="card tint-green col grow" style={{ minWidth: 220 }}>
            <b>🐷 Savings account</b>
            <span className="small">{entry ? 'Money here grows! The bank adds a little extra every month.' : 'Earns interest, compounded monthly. For goals and emergencies.'}</span>
            <Button variant="green" onClick={() => act((w, fx) => openSavings(w, fx))}>
              Open savings (free)
            </Button>
          </div>
        )}
      </div>
    </Section>
  );
}

type Acct = 'cash' | 'checking' | 'savings';

export function TransferForm({ allowCash = true }: { allowCash?: boolean }) {
  const f = useGame((s) => s.world!.finance);
  const entry = useGame((s) => s.world!.difficulty === 'entry');
  const opts: { id: string; from: Acct; to: Acct; label: string; show: boolean }[] = [
    { id: 'dep', from: 'cash', to: 'checking', label: '💵 → 🏦 Deposit cash', show: allowCash && f.hasChecking },
    { id: 'wd', from: 'checking', to: 'cash', label: '🏦 → 💵 Withdraw cash', show: allowCash && f.hasChecking },
    { id: 'save', from: 'checking', to: 'savings', label: '🏦 → 🐷 Move to savings', show: f.hasChecking && f.hasSavings },
    { id: 'cashsave', from: 'cash', to: 'savings', label: '💵 → 🐷 Deposit to savings', show: allowCash && f.hasSavings },
    { id: 'unsave', from: 'savings', to: 'checking', label: '🐷 → 🏦 Take from savings', show: f.hasChecking && f.hasSavings },
  ];
  const visible = opts.filter((o) => o.show);
  const [sel, setSel] = useState(visible[0]?.id ?? '');
  const [amt, setAmt] = useState(0);
  const o = visible.find((x) => x.id === sel) ?? visible[0];
  if (!o) return <Empty icon="🏦">Open an account at the Fin City Bank teller first.</Empty>;
  const max = f[o.from];
  return (
    <Section title="Move money">
      <div className="row wrap" style={{ gap: 6, marginBottom: 8 }}>
        {visible.map((x) => (
          <Button key={x.id} size="small" variant={o.id === x.id ? 'gold' : undefined} onClick={() => (setSel(x.id), setAmt(0))}>
            {x.label}
          </Button>
        ))}
      </div>
      <AmountPicker max={max} value={amt} onChange={setAmt} />
      <div className="row" style={{ marginTop: 8 }}>
        <Button
          variant="primary"
          disabled={amt <= 0 || amt > max + 0.001}
          onClick={() => {
            act((w, fx) => transfer(w, fx, o.from, o.to, amt));
            setAmt(0);
          }}
        >
          Move {money(amt)}
        </Button>
        {entry && o.to === 'savings' && <span className="small muted">Money in savings grows every month! 🌱</span>}
      </div>
    </Section>
  );
}

export function CDsPanel() {
  const w = useGame((s) => s.world!);
  const f = w.finance;
  const entry = w.difficulty === 'entry';
  const [amt, setAmt] = useState(0);
  const [term, setTerm] = useState(6);
  const max = Math.max(f.savings, f.checking);
  const mr = cdMonthlyRate(w, term);
  const at = amt * Math.pow(1 + mr, term);
  return (
    <Section title="🔒 Certificates of Deposit (CDs)" right={<ReadAloud text="A CD locks your money for a while. In return the bank pays a higher interest rate. If you take it out early you pay a penalty." />}>
      <p className="small">
        {entry
          ? 'Lock your money away for a while and the bank pays you MORE. Each CD plants a money tree in the Singapore Savings Garden!'
          : 'A CD pays a higher rate than savings in exchange for locking your money for a fixed term. Breaking it early costs 3 months of interest.'}
      </p>
      <div className="row wrap" style={{ gap: 6 }}>
        {CD_TERMS.map((t) => (
          <Button key={t} size="small" variant={term === t ? 'gold' : undefined} onClick={() => setTerm(t)}>
            {t} months · {entry ? `${(cdMonthlyRate(w, t) * 100).toFixed(1)}%/mo` : `${pct(Math.pow(1 + cdMonthlyRate(w, t), 12) - 1, 2)} APY`}
          </Button>
        ))}
      </div>
      <AmountPicker max={max} value={amt} onChange={setAmt} quick={[50, 100, 500]} />
      <div className="row wrap" style={{ marginTop: 8 }}>
        <Button variant="green" disabled={amt < 50 || amt > max} onClick={() => (act((wd, fx) => openCD(wd, fx, amt, term)), setAmt(0))}>
          Open CD
        </Button>
        {amt >= 50 && (
          <span className="small">
            In {term} months: <b>{money(at)}</b> (+{money(at - amt)})
          </span>
        )}
      </div>
      {f.cds.length > 0 && (
        <div className="col" style={{ gap: 6, marginTop: 10 }}>
          {f.cds.map((cd) => {
            const left = cd.termMonths - (w.time.month - cd.startMonth);
            return (
              <div key={cd.id} className="card flat row between wrap">
                <span>
                  🌳 <b>{money(cd.value)}</b> <span className="small muted">(from {money(cd.principal)})</span>
                </span>
                <span className="small">{left} month{left === 1 ? '' : 's'} left</span>
                <Button size="small" variant="danger" onClick={() => act((wd, fx) => breakCD(wd, fx, cd.id))}>
                  Break early
                </Button>
              </div>
            );
          })}
        </div>
      )}
    </Section>
  );
}

export function LedgerList({ limit = 30 }: { limit?: number }) {
  const ledger = useGame((s) => s.world!.finance.ledger);
  if (!ledger.length) return <Empty icon="🧾">No transactions yet.</Empty>;
  return (
    <div className="ledger">
      {ledger.slice(0, limit).map((t, i) => (
        <div key={i} className="ledger-row">
          <span className="tiny muted">{monthLabel(t.m).split(' · ')[0]}</span>
          <span className="small grow">{t.d}</span>
          <span className="tiny chip">{t.k}</span>
          <b className={`mono small ${t.a >= 0 ? 'good' : 'bad'}`}>{money(t.a, { sign: true })}</b>
        </div>
      ))}
    </div>
  );
}

export function LoansPanel() {
  const w = useGame((s) => s.world!);
  const f = w.finance;
  const entry = w.difficulty === 'entry';
  const [amount, setAmount] = useState(entry ? 100 : 1000);
  const [months, setMonths] = useState(entry ? 6 : 24);
  const [extra, setExtra] = useState<Record<string, number>>({});
  const q = loanQuote(w, 'personal', amount, months);
  const sched = !entry ? amortize(amount, q.apr, months) : [];
  const maxLoan = entry ? 300 : Math.max(500, Math.min(20000, (w.progress.level + 2) * 1000));
  return (
    <>
      <Section title="📝 Borrow money" right={<ReadAloud text="A loan is money you borrow and pay back later, plus extra called interest." />}>
        <p className="small">
          {entry
            ? 'Borrowing means using money now and paying it back later, plus a little extra. Only borrow if you have a plan to pay it back!'
            : 'Personal loans have a fixed APR and monthly payment. Your credit score sets the rate. Every application is a hard inquiry.'}
        </p>
        <div className="row wrap" style={{ gap: 12 }}>
          <label className="field">
            Amount: {money(amount, { cents: false })}
            <input type="range" min={entry ? 20 : 200} max={maxLoan} step={entry ? 10 : 100} value={amount} onChange={(e) => setAmount(Number(e.target.value))} />
          </label>
          <label className="field">
            Months: {months}
            <input type="range" min={entry ? 3 : 6} max={entry ? 12 : 60} step={entry ? 1 : 6} value={months} onChange={(e) => setMonths(Number(e.target.value))} />
          </label>
        </div>
        <StatGrid>
          {!entry && <Stat label="APR" value={pct(q.apr, 2)} sub={`Credit: ${TIER_LABEL[creditTier(f.credit.score)]}`} />}
          <Stat label="Monthly payment" value={money(q.payment)} />
          <Stat label="Total paid back" value={money(q.total)} />
          <Stat label={entry ? 'Extra you pay' : 'Total interest'} value={money(q.interest)} tone="bad" />
        </StatGrid>
        {!entry && sched.length > 0 && (
          <Explain title="See the amortization">
            <div className="small">Early payments are mostly interest; later ones are mostly principal.</div>
            <LineChart
              money
              series={[
                { values: sched.map((r) => r.interest), color: '#e1553f', label: 'Interest' },
                { values: sched.map((r) => r.principal), color: '#2ebaba', label: 'Principal' },
              ]}
              labels={sched.map((r) => `M${r.month}`)}
              height={130}
            />
            <div className="tiny">
              <span style={{ color: '#e1553f' }}>■</span> interest part · <span style={{ color: '#2ebaba' }}>■</span> principal part
            </div>
          </Explain>
        )}
        <Button variant="blue" onClick={() => act((wd, fx) => void takeLoan(wd, fx, 'personal', amount, months, { name: entry ? 'Kids Bank loan' : 'Personal loan' }))}>
          Borrow {money(amount, { cents: false })}
        </Button>
      </Section>
      <Section title="Your loans">
        {f.loans.length === 0 ? (
          <Empty icon="🕊️">No loans. Debt free!</Empty>
        ) : (
          f.loans.map((l) => (
            <div key={l.id} className="card flat col" style={{ gap: 4, marginBottom: 6 }}>
              <div className="row between wrap">
                <b>{l.name}</b>
                <span className="mono">{money(l.balance)} left</span>
              </div>
              <div className="small muted">
                {money(l.payment)}/month{l.apr > 0 ? ` · ${pct(l.apr, 2)} APR` : ''} · {l.monthsPaid} payments made{l.missed ? ` · ${l.missed} missed` : ''}
              </div>
              <div className="row wrap" style={{ gap: 6 }}>
                {[25, 100, 500].map((x) => (
                  <Button key={x} size="small" onClick={() => setExtra({ ...extra, [l.id]: Math.min(l.balance, (extra[l.id] ?? 0) + x) })}>
                    +${x}
                  </Button>
                ))}
                <Button size="small" variant="green" disabled={!extra[l.id]} onClick={() => (act((wd, fx) => void payLoanExtra(wd, fx, l.id, extra[l.id] ?? 0)), setExtra({ ...extra, [l.id]: 0 }))}>
                  Pay extra {money(extra[l.id] ?? 0)}
                </Button>
                <Button size="small" onClick={() => act((wd, fx) => void payLoanExtra(wd, fx, l.id, l.balance))}>
                  Pay off ({money(l.balance)})
                </Button>
              </div>
            </div>
          ))
        )}
      </Section>
    </>
  );
}

export function CardPanel() {
  const w = useGame((s) => s.world!);
  const c = w.finance.card;
  const [pay, setPay] = useState(0);
  if (w.difficulty !== 'advanced')
    return (
      <Section title="💳 Credit cards">
        <p className="small">Credit cards let grown-ups borrow money to buy things. They must pay it back, often with a lot of extra interest! (Switch to Advanced mode to use one.)</p>
      </Section>
    );
  if (!c.open)
    return (
      <Section title="💳 Credit card">
        <p className="small">
          A credit card is a revolving loan. Pay the full statement each month and you pay <b>no interest</b>. Carry a balance and you pay ~25% APR. Keeping utilization under 30% helps your credit score.
        </p>
        <Button variant="blue" onClick={() => act((wd, fx) => void openCard(wd, fx))}>
          Apply for a card (hard inquiry)
        </Button>
      </Section>
    );
  const util = c.limit ? c.balance / c.limit : 0;
  return (
    <Section title="💳 Your credit card">
      <StatGrid>
        <Stat label="Balance" value={money(c.balance)} tone={c.balance > 0 ? 'bad' : undefined} />
        <Stat label="Limit" value={money(c.limit, { cents: false })} />
        <Stat label="Utilization" value={pct(util, 0)} tone={util > 0.3 ? 'bad' : 'good'} sub="Keep it under 30%" />
        <Stat label="APR" value={pct(c.apr, 2)} sub={`Minimum due: ${money(c.minDue)}`} />
      </StatGrid>
      <div className="row wrap" style={{ gap: 6, margin: '8px 0' }}>
        <span className="small bold">Autopay:</span>
        {(['full', 'minimum', 'none'] as const).map((a) => (
          <Button key={a} size="small" variant={c.autopay === a ? 'gold' : undefined} onClick={() => act((wd) => void (wd.finance.card.autopay = a))}>
            {a === 'full' ? 'Full balance ✅' : a === 'minimum' ? 'Minimum only ⚠️' : 'Off ❌'}
          </Button>
        ))}
      </div>
      <AmountPicker max={Math.min(c.balance, w.finance.cash + w.finance.checking)} value={pay} onChange={setPay} />
      <Button variant="green" disabled={pay <= 0} onClick={() => (act((wd, fx) => void payCard(wd, fx, pay)), setPay(0))}>
        Pay {money(pay)}
      </Button>
    </Section>
  );
}

export function MonthHistory() {
  const sums = useGame((s) => s.world!.finance.summaries);
  if (!sums.length) return <Empty icon="📅">Your first monthly report arrives at the end of this month.</Empty>;
  return (
    <div className="col" style={{ gap: 8 }}>
      {sums.slice(0, 12).map((s) => (
        <div key={s.month} className="card flat">
          <div className="row between">
            <b>{monthLabel(s.month)}</b>
            <span className="small">Net worth {money(s.netWorth, { cents: false })}</span>
          </div>
          <div className="row wrap small" style={{ gap: 12 }}>
            <span className="good">In {money(s.income)}</span>
            <span className="bad">Out {money(s.spending)}</span>
            <span>Interest {money(s.interest)}</span>
          </div>
          {s.notes.map((n, i) => (
            <div key={i} className="tiny muted">
              • {n}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
