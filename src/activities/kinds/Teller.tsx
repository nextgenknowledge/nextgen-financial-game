'use client';
import { useMemo, useRef, useState } from 'react';
import type { KindProps } from '../types';
import { makeRng } from '@/game/rng';
import { CoinIcon } from '../QuestionView';
import { Button, ReadAloud } from '@/ui/common';
import { money } from '@/ui/format';
import { playSfx } from '@/engine/audio';
import { act } from '@/store/game';
import { recordAnswer } from '@/game/progress/activities';

const VAL: Record<string, number> = { '20': 20, '10': 10, '5': 5, '1': 1, q: 0.25, d: 0.1, n: 0.05, p: 0.01 };

/** Teller trainee: count deposits (Entry) or reconcile a checkbook against a bank statement (Advanced). */
export default function Teller({ params, difficulty, onFinish, addReview, seed }: KindProps<{ rounds: number; mode: 'count' | 'reconcile' }>) {
  return params.mode === 'reconcile' ? <Reconcile rounds={params.rounds} seed={seed} onFinish={onFinish} addReview={addReview} /> : <Count rounds={params.rounds} seed={seed} entry={difficulty === 'entry'} onFinish={onFinish} addReview={addReview} />;
}

function Count({ rounds, seed, onFinish, addReview }: { rounds: number; seed: number; entry: boolean; onFinish: KindProps['onFinish']; addReview?: KindProps['addReview'] }) {
  const rng = useMemo(() => makeRng(seed), [seed]);
  const make = (r: number) => {
    const kinds = r < 2 ? ['p', 'n', 'd'] : r < 4 ? ['q', 'd', 'n', '1'] : ['q', 'd', '1', '5', '10'];
    const pile: Record<string, number> = {};
    for (let i = 0; i < 3 + r; i++) {
      const k = rng.pick(kinds);
      pile[k] = (pile[k] ?? 0) + 1;
    }
    return pile;
  };
  const [round, setRound] = useState(0);
  const [pile, setPile] = useState(() => make(0));
  const [val, setVal] = useState('');
  const [fb, setFb] = useState<string | null>(null);
  const right = useRef(0);
  const total = Math.round(Object.entries(pile).reduce((s, [k, n]) => s + VAL[k] * n, 0) * 100) / 100;
  const submit = () => {
    const v = Number(val.replace(/[$,]/g, ''));
    const ok = Math.abs(v - total) < 0.005;
    if (ok) right.current++;
    playSfx(ok ? 'correct' : 'wrong');
    act((d, fx) => recordAnswer(d, fx, { id: 'teller-count', topic: 'counting' }, ok));
    addReview?.({ q: `Count the deposit (round ${round + 1})`, ok, answer: money(total), explanation: Object.entries(pile).map(([k, n]) => `${n} × ${money(VAL[k])}`).join(' + ') });
    setFb(ok ? `✅ ${money(total)}, deposited!` : `The deposit was ${money(total)}. Count the big ones first, then the small ones.`);
  };
  const next = () => {
    setFb(null);
    setVal('');
    if (round + 1 >= rounds) onFinish({ score: (right.current / rounds) * 100, correct: right.current, total: rounds });
    else {
      setRound(round + 1);
      setPile(make(round + 1));
    }
  };
  return (
    <div className="col" style={{ gap: 10 }}>
      <div className="row between">
        <b>
          Customer {round + 1}/{rounds}: &quot;I&apos;d like to deposit this!&quot;
        </b>
        <ReadAloud text="Count the money the customer wants to deposit." />
      </div>
      <div className="card flat row wrap" style={{ gap: 6, minHeight: 80 }}>
        {Object.entries(pile).flatMap(([k, n]) => Array.from({ length: n }, (_, i) => <CoinIcon key={`${k}${i}`} kind={k} />))}
      </div>
      {fb ? (
        <div className="card">
          {fb}
          <div className="row" style={{ justifyContent: 'flex-end' }}>
            <Button variant="primary" onClick={next}>
              Next customer ▶
            </Button>
          </div>
        </div>
      ) : (
        <form className="row" onSubmit={(e) => (e.preventDefault(), submit())}>
          <span className="big">$</span>
          <input className="input mono numeric-input" autoFocus inputMode="decimal" value={val} onChange={(e) => setVal(e.target.value)} placeholder="0.00" />
          <Button variant="green" type="submit" disabled={!val}>
            Deposit
          </Button>
        </form>
      )}
    </div>
  );
}

function Reconcile({ rounds, seed, onFinish, addReview }: { rounds: number; seed: number; onFinish: KindProps['onFinish']; addReview?: KindProps['addReview'] }) {
  const rng = useMemo(() => makeRng(seed), [seed]);
  const make = () => {
    const start = rng.int(300, 1500);
    const tx = [
      { d: 'Paycheck deposit', a: rng.int(180, 520) },
      { d: `Check #${rng.int(101, 199)}, rent share`, a: -rng.int(80, 300) },
      { d: 'Grocery (debit)', a: -rng.int(20, 90) + -rng.int(0, 99) / 100 },
      { d: 'Transfer to savings', a: -rng.int(20, 100) },
    ].map((t) => ({ ...t, a: Math.round(t.a * 100) / 100 }));
    const kind = rng.pick(['fee', 'outstanding', 'interest'] as const);
    const fee = rng.pick([5, 10, 12, 15]);
    const interest = Math.round(rng.range(0.4, 3) * 100) / 100;
    const checkbook = Math.round((start + tx.reduce((s, t) => s + t.a, 0)) * 100) / 100;
    // Bank statement differs by: an unrecorded fee, an outstanding check, or unrecorded interest
    let statement = checkbook;
    let correct = checkbook;
    let issue = '';
    if (kind === 'fee') {
      statement = checkbook - fee;
      correct = statement;
      issue = `The statement shows a $${fee} monthly service fee you didn't record. Subtract it from your checkbook.`;
    } else if (kind === 'outstanding') {
      statement = checkbook - tx[1].a; // the check hasn't cleared yet
      correct = checkbook;
      issue = `${tx[1].d} (${money(-tx[1].a)}) hasn't cleared the bank yet (outstanding). Your checkbook is already correct.`;
    } else {
      statement = checkbook + interest;
      correct = statement;
      issue = `The bank paid ${money(interest)} interest you didn't record. Add it to your checkbook.`;
    }
    return { start, tx, checkbook, statement: Math.round(statement * 100) / 100, correct: Math.round(correct * 100) / 100, issue };
  };
  const [round, setRound] = useState(0);
  const [r, setR] = useState(make);
  const [val, setVal] = useState('');
  const [fb, setFb] = useState<string | null>(null);
  const right = useRef(0);
  const submit = () => {
    const v = Number(val.replace(/[$,]/g, ''));
    const ok = Math.abs(v - r.correct) < 0.011;
    if (ok) right.current++;
    playSfx(ok ? 'correct' : 'wrong');
    act((d, fx) => recordAnswer(d, fx, { id: 'teller-reconcile', topic: 'banking' }, ok));
    addReview?.({ q: `Reconcile account (round ${round + 1})`, ok, answer: money(r.correct), explanation: r.issue });
    setFb(`${ok ? '✅ Reconciled!' : `Correct balance: ${money(r.correct)}.`} ${r.issue}`);
  };
  return (
    <div className="col" style={{ gap: 10 }}>
      <b>
        Account {round + 1}/{rounds}: what is the TRUE available balance? (Fix the checkbook to match reality.)
      </b>
      <div className="row wrap" style={{ gap: 12, alignItems: 'flex-start' }}>
        <div className="doc-media grow">
          <div className="bold">📒 Customer&apos;s checkbook</div>
          <div className="mono small row between">
            <span>Starting balance</span>
            <span>{money(r.start)}</span>
          </div>
          {r.tx.map((t, i) => (
            <div key={i} className="mono small row between">
              <span>{t.d}</span>
              <span>{money(t.a, { sign: true })}</span>
            </div>
          ))}
          <div className="mono small row between bold">
            <span>Checkbook balance</span>
            <span>{money(r.checkbook)}</span>
          </div>
        </div>
        <div className="doc-media grow">
          <div className="bold">🏦 Bank statement</div>
          <div className="mono small row between bold">
            <span>Ending balance</span>
            <span>{money(r.statement)}</span>
          </div>
          <div className="tiny muted">Look for fees, interest, or checks that haven&apos;t cleared yet.</div>
        </div>
      </div>
      {fb ? (
        <div className="card">
          {fb}
          <div className="row" style={{ justifyContent: 'flex-end' }}>
            <Button
              variant="primary"
              onClick={() => {
                setFb(null);
                setVal('');
                if (round + 1 >= rounds) onFinish({ score: (right.current / rounds) * 100, correct: right.current, total: rounds });
                else {
                  setRound(round + 1);
                  setR(make());
                }
              }}
            >
              Next ▶
            </Button>
          </div>
        </div>
      ) : (
        <form className="row" onSubmit={(e) => (e.preventDefault(), submit())}>
          <span className="big">$</span>
          <input className="input mono numeric-input" autoFocus inputMode="decimal" value={val} onChange={(e) => setVal(e.target.value)} />
          <Button variant="green" type="submit" disabled={!val}>
            Submit balance
          </Button>
        </form>
      )}
    </div>
  );
}
