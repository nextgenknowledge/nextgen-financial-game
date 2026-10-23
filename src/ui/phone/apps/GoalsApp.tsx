'use client';
import { useState } from 'react';
import { useGame, act } from '@/store/game';
import { addGoal, fundGoal, deleteGoal, available } from '@/game/finance/accounts';
import { Button, ProgressBar, ReadAloud } from '../../common';
import { AmountPicker, Section, Empty } from '../../kit';
import { money } from '../../format';
import { savingsMonthlyRate } from '@/game/finance/accounts';

const PRESETS = [
  { name: 'New bike', icon: '🚲', target: 120 },
  { name: 'Pet friend', icon: '🐶', target: 150 },
  { name: 'Video game', icon: '🎮', target: 60 },
  { name: 'Emergency fund', icon: '☔', target: 500 },
  { name: 'Scooter', icon: '🛴', target: 420 },
  { name: 'First car', icon: '🚗', target: 4200 },
  { name: 'Land for a home', icon: '🏡', target: 6000 },
  { name: 'Start a business', icon: '🏢', target: 1800 },
];

export function GoalsApp() {
  const w = useGame((s) => s.world!);
  const goals = w.finance.goals;
  const [adding, setAdding] = useState(goals.length === 0);
  const [name, setName] = useState('');
  const [icon, setIcon] = useState('🎯');
  const [target, setTarget] = useState(100);
  const [fund, setFund] = useState<Record<string, number>>({});
  const avail = available(w);
  const rate = savingsMonthlyRate(w);

  return (
    <div>
      <Section title="🎯 Savings goals" right={<ReadAloud text="A savings goal is something you save up for. Money you add to a goal goes into your savings account, where it grows." />}>
        <p className="small">Saving is easier when it&apos;s for something! Money you add goes into savings, where it earns interest while you wait.</p>
        {goals.length === 0 && !adding && <Empty icon="🎯">No goals yet.</Empty>}
        <div className="col" style={{ gap: 10 }}>
          {goals.map((g) => {
            const left = Math.max(0, g.target - g.saved);
            const monthsAt = (per: number) => (per <= 0 ? Infinity : Math.ceil(Math.log(1 + (left * rate) / per) / Math.log(1 + rate) || left / per));
            return (
              <div key={g.id} className={`card ${g.done ? 'tint-green' : ''}`}>
                <div className="row between">
                  <b style={{ fontSize: '1.1rem' }}>
                    {g.icon} {g.name}
                  </b>
                  <span className="mono">
                    {money(g.saved)} / {money(g.target)}
                  </span>
                </div>
                <ProgressBar value={g.saved} max={g.target} color={g.done ? 'var(--good)' : 'var(--gold)'} />
                {g.done ? (
                  <div className="row between" style={{ marginTop: 6 }}>
                    <span className="good bold">Goal reached! 🎉 The money is in your savings.</span>
                    <Button size="small" onClick={() => act((d) => deleteGoal(d, g.id))}>
                      Clear
                    </Button>
                  </div>
                ) : (
                  <>
                    <div className="tiny muted" style={{ margin: '4px 0' }}>
                      Saving $20 a month, you&apos;d get there in about {monthsAt(20)} months. $50/month: {monthsAt(50)} months.
                    </div>
                    <AmountPicker max={Math.min(avail, left)} value={fund[g.id] ?? 0} onChange={(v) => setFund({ ...fund, [g.id]: v })} quick={[5, 10, 25]} label="Add money" />
                    <div className="row" style={{ marginTop: 6 }}>
                      <Button
                        variant="green"
                        disabled={!(fund[g.id] > 0)}
                        onClick={() => {
                          act((d, fx) => void fundGoal(d, fx, g.id, fund[g.id]));
                          setFund({ ...fund, [g.id]: 0 });
                        }}
                      >
                        Save {money(fund[g.id] ?? 0)}
                      </Button>
                      <Button size="small" variant="ghost" onClick={() => act((d) => deleteGoal(d, g.id))}>
                        Remove goal
                      </Button>
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </Section>
      {adding ? (
        <Section title="New goal">
          <div className="row wrap" style={{ gap: 6 }}>
            {PRESETS.map((p) => (
              <Button
                key={p.name}
                size="small"
                variant={name === p.name ? 'gold' : undefined}
                onClick={() => {
                  setName(p.name);
                  setIcon(p.icon);
                  setTarget(p.target);
                }}
              >
                {p.icon} {p.name}
              </Button>
            ))}
          </div>
          <div className="row wrap" style={{ gap: 10, marginTop: 8 }}>
            <label className="field grow">
              Goal name
              <input className="input" value={name} maxLength={30} onChange={(e) => setName(e.target.value)} placeholder="e.g. New skateboard" />
            </label>
            <label className="field">
              Target ($)
              <input className="input mono" inputMode="numeric" value={target} onChange={(e) => setTarget(Number(e.target.value.replace(/\D/g, '')) || 0)} style={{ width: 120 }} />
            </label>
          </div>
          <div className="row" style={{ marginTop: 8 }}>
            <Button
              variant="primary"
              disabled={!name.trim() || target < 5}
              onClick={() => {
                act((d, fx) => addGoal(d, fx, name, icon, target));
                setAdding(false);
                setName('');
              }}
            >
              Create goal
            </Button>
            {goals.length > 0 && <Button onClick={() => setAdding(false)}>Cancel</Button>}
          </div>
        </Section>
      ) : (
        <Button variant="gold" onClick={() => setAdding(true)}>
          ＋ New goal
        </Button>
      )}
    </div>
  );
}
