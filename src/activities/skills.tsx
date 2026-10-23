'use client';
/** Skill mini-games used by jobs (and reused by other activities). Each calls onDone(score 0..100). */
import { useEffect, useMemo, useRef, useState } from 'react';
import { makeRng } from '@/game/rng';
import { useActivityPaused, usePausedRef } from './paused';
import { Button } from '@/ui/common';
import { CoinIcon } from './QuestionView';
import { playSfx } from '@/engine/audio';
import { money, cls } from '@/ui/format';

export interface SkillProps {
  entry: boolean;
  tier: number; // job level (harder as you get promoted)
  seed: number;
  onDone: (score: number) => void;
}

const DENOMS: { k: string; v: number }[] = [
  { k: '20', v: 20 },
  { k: '10', v: 10 },
  { k: '5', v: 5 },
  { k: '1', v: 1 },
  { k: 'q', v: 0.25 },
  { k: 'd', v: 0.1 },
  { k: 'n', v: 0.05 },
  { k: 'p', v: 0.01 },
];

/** Make change: tap coins/bills to give the right change. Bonus for fewest pieces in Advanced. */
export function MakeChange({ entry, tier, seed, onDone, rounds = 5, timed = true }: SkillProps & { rounds?: number; timed?: boolean }) {
  const rng = useMemo(() => makeRng(seed), [seed]);
  const make = () => {
    const priceCents = entry && tier <= 1 ? rng.int(1, 19) * 5 + 100 * rng.int(0, 3) : rng.int(101, 1899);
    const price = priceCents / 100;
    const paid = price < 5 ? 5 : price < 10 ? 10 : 20;
    return { price, paid, change: Math.round((paid - price) * 100) / 100 };
  };
  const [round, setRound] = useState(0);
  const [cust, setCust] = useState(make);
  const [given, setGiven] = useState<string[]>([]);
  const [fb, setFb] = useState<string | null>(null);
  const [time, setTime] = useState(timed ? (entry ? 120 : 75) : 0);
  const pts = useRef(0);
  const total = Math.round(given.reduce((s, k) => s + DENOMS.find((d) => d.k === k)!.v, 0) * 100) / 100;
  const paused = useActivityPaused();
  useEffect(() => {
    if (!timed || paused) return;
    const id = setInterval(() => setTime((t) => Math.max(0, t - 1)), 1000);
    return () => clearInterval(id);
  }, [timed, paused]);
  useEffect(() => {
    if (timed && time <= 0) onDone((pts.current / rounds) * 100);
  }, [time, timed, onDone, rounds]);
  const optimal = (c: number) => {
    let left = Math.round(c * 100);
    let n = 0;
    for (const d of DENOMS) {
      const v = Math.round(d.v * 100);
      n += Math.floor(left / v);
      left %= v;
    }
    return n;
  };
  const submit = () => {
    const ok = Math.abs(total - cust.change) < 0.001;
    let p = ok ? 1 : 0;
    if (ok && !entry && given.length > optimal(cust.change)) p = 0.75;
    pts.current += p;
    playSfx(ok ? 'cash' : 'wrong');
    setFb(ok ? (p < 1 ? `Correct change! (Could use fewer pieces: ${optimal(cust.change)}.)` : 'Perfect change! 😀') : `Oops, change should be ${money(cust.change)}, you gave ${money(total)}.`);
    setTimeout(() => {
      setFb(null);
      setGiven([]);
      if (round + 1 >= rounds) onDone((pts.current / rounds) * 100);
      else {
        setRound(round + 1);
        setCust(make());
      }
    }, 1300);
  };
  return (
    <div className="col" style={{ gap: 10 }}>
      <div className="row between">
        <b>
          Customer {round + 1}/{rounds}
        </b>
        {timed && <b className={time < 15 ? 'bad' : ''}>⏱️ {time}s</b>}
      </div>
      <div className="card tint-gold big">
        🧾 Price <b>{money(cust.price)}</b> · Paid with <b>{money(cust.paid, { cents: false })}</b>
        {entry && <span className="small"> → change to give: count up from {money(cust.price)} to {money(cust.paid, { cents: false })}</span>}
      </div>
      <div className="row wrap" style={{ gap: 8, alignItems: 'center' }}>
        {DENOMS.filter((d) => d.v < cust.paid).map((d) => (
          <CoinIcon key={d.k} kind={d.k} onClick={() => !fb && (playSfx('coin'), setGiven([...given, d.k]))} />
        ))}
      </div>
      <div className="card flat row wrap" style={{ minHeight: 64, gap: 4 }}>
        <span className="small bold">Your change: {money(total)}</span>
        {given.map((k, i) => (
          <CoinIcon key={i} kind={k} onClick={() => !fb && setGiven(given.filter((_, j) => j !== i))} />
        ))}
      </div>
      {fb ? (
        <div className="card">{fb}</div>
      ) : (
        <div className="row">
          <Button onClick={() => setGiven([])}>Clear</Button>
          <Button variant="green" size="big" onClick={submit}>
            Give change
          </Button>
        </div>
      )}
    </div>
  );
}

/** Barista: memorize an order, then build it. */
export function OrderMemory({ entry, tier, seed, onDone }: SkillProps) {
  const rng = useMemo(() => makeRng(seed), [seed]);
  const MENU = ['☕ Coffee', '🍵 Tea', '🥛 Milk', '🧊 Ice', '🍫 Chocolate', '🍯 Honey', '🍦 Whip', '🥐 Croissant', '🍪 Cookie', '🧁 Muffin'];
  const rounds = 4;
  const size = (entry ? 2 : 3) + Math.min(2, tier - 1);
  const make = () => rng.shuffle([...MENU]).slice(0, size);
  const [round, setRound] = useState(0);
  const [order, setOrder] = useState(make);
  const [show, setShow] = useState(true);
  const [picked, setPicked] = useState<string[]>([]);
  const pts = useRef(0);
  useEffect(() => {
    setShow(true);
    const t = setTimeout(() => setShow(false), (entry ? 4000 : 3000) + size * 300);
    return () => clearTimeout(t);
  }, [order, entry, size]);
  const check = () => {
    const right = picked.filter((p) => order.includes(p)).length;
    const wrong = picked.length - right;
    const p = Math.max(0, (right - wrong) / order.length);
    pts.current += p;
    playSfx(p === 1 ? 'correct' : 'wrong');
    if (round + 1 >= rounds) onDone((pts.current / rounds) * 100);
    else {
      setRound(round + 1);
      setPicked([]);
      setOrder(make());
    }
  };
  return (
    <div className="col" style={{ gap: 10 }}>
      <b>
        Order {round + 1}/{rounds}
      </b>
      {show ? (
        <div className="card tint-gold center big">
          📝 Remember: <b>{order.join('  ·  ')}</b>
        </div>
      ) : (
        <>
          <div className="small">Tap everything in the order (in any order), then serve!</div>
          <div className="row wrap" style={{ gap: 6 }}>
            {MENU.map((m) => (
              <Button key={m} variant={picked.includes(m) ? 'gold' : undefined} onClick={() => setPicked(picked.includes(m) ? picked.filter((x) => x !== m) : [...picked, m])}>
                {m}
              </Button>
            ))}
          </div>
          <Button variant="green" size="big" onClick={check} disabled={!picked.length}>
            Serve ☕
          </Button>
        </>
      )}
    </div>
  );
}

/** Stock clerk / gardener: sort items onto shelves quickly. */
export function ShelfSort({ entry, seed, onDone }: SkillProps) {
  const SHELVES = [
    { label: 'Fruit', icon: '🍎', items: ['🍎 Apple', '🍌 Banana', '🍇 Grapes', '🍐 Pear', '🍊 Orange'] },
    { label: 'Veggies', icon: '🥕', items: ['🥕 Carrot', '🥦 Broccoli', '🌽 Corn', '🥒 Cucumber', '🍆 Eggplant'] },
    { label: 'Dairy', icon: '🧀', items: ['🧀 Cheese', '🥛 Milk', '🧈 Butter', '🍦 Yogurt'] },
    { label: 'Bakery', icon: '🍞', items: ['🍞 Bread', '🥐 Croissant', '🥯 Bagel', '🧁 Muffin'] },
  ];
  const rng = useMemo(() => makeRng(seed), [seed]);
  const items = useMemo(() => rng.shuffle(SHELVES.flatMap((s, i) => s.items.map((t) => ({ t, bin: i })))).slice(0, entry ? 10 : 14), [rng, entry]); // eslint-disable-line react-hooks/exhaustive-deps
  const [i, setI] = useState(0);
  const [time, setTime] = useState(entry ? 60 : 40);
  const pts = useRef(0);
  const ended = useRef(false);
  const paused = useActivityPaused();
  useEffect(() => {
    if (paused) return;
    const id = setInterval(() => setTime((t) => t - 1), 1000);
    return () => clearInterval(id);
  }, [paused]);
  useEffect(() => {
    if (!ended.current && (time <= 0 || i >= items.length)) {
      ended.current = true;
      onDone((pts.current / items.length) * 100);
    }
  }, [time, i, items.length, onDone]);
  const it = items[i];
  return (
    <div className="col" style={{ gap: 10 }}>
      <div className="row between">
        <b>
          Item {Math.min(i + 1, items.length)}/{items.length}
        </b>
        <b>⏱️ {Math.max(0, time)}s</b>
      </div>
      {it && <div className="sort-card">{it.t}</div>}
      <div className="sort-bins" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
        {SHELVES.map((s, k) => (
          <button
            key={k}
            className="sort-bin"
            onClick={() => {
              if (!it) return;
              const ok = it.bin === k;
              if (ok) pts.current++;
              playSfx(ok ? 'coin' : 'wrong');
              setI(i + 1);
            }}
          >
            <span style={{ fontSize: '2rem' }}>{s.icon}</span>
            <b>{s.label}</b>
          </button>
        ))}
      </div>
    </div>
  );
}

/** Bookkeeper: add up receipts. */
export function ReceiptSums({ entry, tier, seed, onDone }: SkillProps) {
  const rng = useMemo(() => makeRng(seed), [seed]);
  const rounds = 5;
  const make = () => Array.from({ length: (entry ? 2 : 3) + Math.min(2, tier - 1) }, () => (entry ? rng.int(1, 20) : rng.int(105, 9999) / 100));
  const [round, setRound] = useState(0);
  const [nums, setNums] = useState(make);
  const [val, setVal] = useState('');
  const [fb, setFb] = useState<string | null>(null);
  const pts = useRef(0);
  const total = Math.round(nums.reduce((a, b) => a + b, 0) * 100) / 100;
  const submit = () => {
    const v = Number(val.replace(/[$,]/g, ''));
    const ok = Math.abs(v - total) < 0.011;
    if (ok) pts.current++;
    playSfx(ok ? 'correct' : 'wrong');
    setFb(ok ? '✅ Balanced!' : `The total was ${money(total)}.`);
    setTimeout(() => {
      setFb(null);
      setVal('');
      if (round + 1 >= rounds) onDone((pts.current / rounds) * 100);
      else {
        setRound(round + 1);
        setNums(make());
      }
    }, 1100);
  };
  return (
    <div className="col" style={{ gap: 10 }}>
      <b>
        Receipt batch {round + 1}/{rounds}
      </b>
      <div className="doc-media">
        {nums.map((n, i) => (
          <div key={i} className="mono row between">
            <span>Receipt #{1000 + i * 7 + round}</span>
            <span>{money(n)}</span>
          </div>
        ))}
        <div className="mono row between bold" style={{ borderTop: '2px dashed #999' }}>
          <span>TOTAL</span>
          <span>?</span>
        </div>
      </div>
      {fb ? (
        <div className="card">{fb}</div>
      ) : (
        <form className="row" onSubmit={(e) => (e.preventDefault(), submit())}>
          <span className="big">$</span>
          <input className="input mono numeric-input" autoFocus inputMode="decimal" value={val} onChange={(e) => setVal(e.target.value)} />
          <Button variant="primary" type="submit" disabled={!val}>
            Enter
          </Button>
        </form>
      )}
    </div>
  );
}

/** Data entry: type the code exactly. */
export function Typing({ entry, tier, seed, onDone }: SkillProps) {
  const rng = useMemo(() => makeRng(seed), [seed]);
  const rounds = 5;
  const make = () => {
    if (entry) return rng.pick(['SAVE', 'BANK', 'COIN', 'GOAL', 'MONEY', 'SHARE', 'BUDGET', 'PIGGY']) + rng.int(1, 9);
    const len = 8 + Math.min(4, tier * 2);
    return Array.from({ length: len }, () => rng.pick('ABCDEFGHJKLMNPQRSTUVWXYZ23456789'.split(''))).join('');
  };
  const [round, setRound] = useState(0);
  const [code, setCode] = useState(make);
  const [val, setVal] = useState('');
  const start = useRef(Date.now());
  const pts = useRef(0);
  const submit = () => {
    const ok = val.trim().toUpperCase() === code;
    const secs = (Date.now() - start.current) / 1000;
    const speed = Math.max(0.4, Math.min(1, (code.length * 0.9) / secs));
    if (ok) pts.current += speed;
    playSfx(ok ? 'correct' : 'wrong');
    setVal('');
    start.current = Date.now();
    if (round + 1 >= rounds) onDone((pts.current / rounds) * 100);
    else {
      setRound(round + 1);
      setCode(make());
    }
  };
  return (
    <div className="col" style={{ gap: 10 }}>
      <b>
        Record {round + 1}/{rounds}, type it exactly (speed matters!)
      </b>
      <div className="card tint-gold center mono" style={{ fontSize: '1.8rem', letterSpacing: '0.15em' }}>
        {code}
      </div>
      <form className="row" onSubmit={(e) => (e.preventDefault(), submit())}>
        <input className="input mono grow" autoFocus value={val} onChange={(e) => setVal(e.target.value)} style={{ fontSize: '1.4rem', letterSpacing: '0.1em' }} />
        <Button variant="primary" type="submit">
          Save
        </Button>
      </form>
    </div>
  );
}

/** App tester: find the line that differs from the spec. */
export function BugHunt({ entry, tier, seed, onDone }: SkillProps) {
  const rng = useMemo(() => makeRng(seed), [seed]);
  const rounds = 5;
  const make = () => {
    const base = [
      ['Balance', money(rng.int(100, 999))],
      ['Savings rate', `${rng.pick([3.5, 4, 4.25])}% APY`],
      ['Last deposit', money(rng.int(10, 99))],
      ['Card ending', String(rng.int(1000, 9999))],
      ['Bills due', String(rng.int(1, 5))],
      ['Goal: Bike', `${rng.int(20, 90)}%`],
    ].slice(0, entry ? 4 : 6);
    const bug = rng.int(0, base.length - 1);
    const shown = base.map((r, i) => (i === bug ? [r[0], mutate(r[1])] : r));
    return { base, shown, bug };
  };
  function mutate(s: string) {
    if (s.includes('%')) return s.replace(/\d/, (d) => String((Number(d) + 1) % 10));
    return s.replace(/\d(?=\D*$)/, (d) => String((Number(d) + rng.int(1, 8)) % 10));
  }
  const [round, setRound] = useState(0);
  const [r, setR] = useState(make);
  const [time, setTime] = useState(entry ? 90 : 60 - tier * 5);
  const pts = useRef(0);
  const done = useRef(false);
  const paused = useActivityPaused();
  useEffect(() => {
    if (paused) return;
    const id = setInterval(() => setTime((t) => t - 1), 1000);
    return () => clearInterval(id);
  }, [paused]);
  useEffect(() => {
    if (time <= 0 && !done.current) {
      done.current = true;
      onDone((pts.current / rounds) * 100);
    }
  }, [time, onDone]);
  const pick = (i: number) => {
    const ok = i === r.bug;
    if (ok) pts.current++;
    playSfx(ok ? 'correct' : 'wrong');
    if (round + 1 >= rounds) {
      done.current = true;
      onDone((pts.current / rounds) * 100);
    } else {
      setRound(round + 1);
      setR(make());
    }
  };
  return (
    <div className="col" style={{ gap: 10 }}>
      <div className="row between">
        <b>
          Screen {round + 1}/{rounds}: tap the line that doesn&apos;t match the spec
        </b>
        <b>⏱️ {Math.max(0, time)}s</b>
      </div>
      <div className="row wrap" style={{ gap: 12, alignItems: 'flex-start' }}>
        <div className="doc-media grow">
          <div className="bold">📋 Spec</div>
          {r.base.map((x, i) => (
            <div key={i} className="mono row between small">
              <span>{x[0]}</span>
              <span>{x[1]}</span>
            </div>
          ))}
        </div>
        <div className="phone-mock grow">
          <div className="bold">📱 App screen</div>
          {r.shown.map((x, i) => (
            <button key={i} className="bug-line" onClick={() => pick(i)}>
              <span>{x[0]}</span>
              <span>{x[1]}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Timing: tap when the marker is in the green zone. */
export function Timing({ entry, tier, seed, onDone }: SkillProps) {
  const rng = useMemo(() => makeRng(seed), [seed]);
  const rounds = 8;
  const [round, setRound] = useState(0);
  const [pos, setPos] = useState(0);
  const [zone, setZone] = useState(() => ({ at: rng.range(0.3, 0.7), w: entry ? 0.22 : 0.15 - tier * 0.015 }));
  const [fb, setFb] = useState<string | null>(null);
  const pts = useRef(0);
  const speed = (entry ? 0.55 : 0.8) + tier * 0.1;
  const pausedRef = usePausedRef();
  useEffect(() => {
    let raf = 0;
    let t0 = performance.now();
    let last = t0;
    const loop = (t: number) => {
      if (pausedRef.current) t0 += t - last;
      last = t;
      const p = ((t - t0) / 1000) * speed;
      setPos(Math.abs(((p % 2) + 2) % 2 - 1));
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      t0 = 0;
    };
  }, [round, speed]);
  const tap = () => {
    if (fb) return;
    const d = Math.abs(pos - zone.at);
    const ok = d < zone.w / 2;
    const p = ok ? 1 - (d / (zone.w / 2)) * 0.3 : 0;
    pts.current += p;
    playSfx(ok ? 'coin' : 'wrong');
    setFb(ok ? (p > 0.9 ? 'Perfect! 🐾' : 'Nice!') : 'Missed!');
    setTimeout(() => {
      setFb(null);
      if (round + 1 >= rounds) onDone((pts.current / rounds) * 100);
      else {
        setRound(round + 1);
        setZone({ at: rng.range(0.25, 0.75), w: zone.w });
      }
    }, 600);
  };
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.code === 'Enter') {
        e.preventDefault();
        tap();
      }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  });
  return (
    <div className="col" style={{ gap: 12 }}>
      <b>
        Turn {round + 1}/{rounds}, tap (or press Space) when the 🐾 is in the green!
      </b>
      <div className="timing-track" onClick={tap}>
        <div className="timing-zone" style={{ left: `${(zone.at - zone.w / 2) * 100}%`, width: `${zone.w * 100}%` }} />
        <div className="timing-marker" style={{ left: `${pos * 100}%` }}>
          🐾
        </div>
      </div>
      <div className={cls('center big bold', fb === 'Missed!' ? 'bad' : 'good')} style={{ minHeight: '1.6em' }}>
        {fb}
      </div>
      <Button variant="gold" size="huge" onClick={tap}>
        TAP!
      </Button>
    </div>
  );
}

export const SKILLS: Record<string, (p: SkillProps) => React.JSX.Element> = {
  change: (p) => <MakeChange {...p} />,
  order: (p) => <OrderMemory {...p} />,
  shelf: (p) => <ShelfSort {...p} />,
  sums: (p) => <ReceiptSums {...p} />,
  typing: (p) => <Typing {...p} />,
  bugs: (p) => <BugHunt {...p} />,
  timing: (p) => <Timing {...p} />,
};
