'use client';
import { useMemo, useState } from 'react';
import type { KindProps } from '../types';
import { makeRng } from '@/game/rng';
import { Button, ReadAloud } from '@/ui/common';
import { money } from '@/ui/format';
import { playSfx } from '@/engine/audio';
import { NarwhalPortrait } from '@/ui/hud/HUD';
import { act } from '@/store/game';
import { recordAnswer } from '@/game/progress/activities';
import { futureValueSeries } from '@/game/finance/interest';

/**
 * Advanced: research the market, set a counteroffer, handle the response, and negotiate perks.
 * Entry: a friendly scenario about asking for fair pay for a neighborhood job.
 */
export default function Negotiation({ params, onFinish, addReview, seed }: KindProps<{ mode: 'entry' | 'advanced' }>) {
  return params.mode === 'entry' ? <EntryNegotiation onFinish={onFinish} addReview={addReview} /> : <AdvancedNegotiation seed={seed} onFinish={onFinish} addReview={addReview} />;
}

function EntryNegotiation({ onFinish, addReview }: Pick<KindProps, 'onFinish' | 'addReview'>) {
  const steps = [
    {
      text: 'Mrs. Lee wants you to walk her dog every day this week. She offers $10 for the whole week. Other kids charge $3 per walk. What could you say?',
      choices: [
        { t: '"Other walkers charge $3 a walk. Could we do $15 for five walks?"', p: 10, f: 'Polite, uses facts, and suggests a number. Great asking!' },
        { t: '"$10?! No way! I want $100!"', p: 0, f: 'Asking for way too much and being rude can lose the job.' },
        { t: '"Okay." (even though it feels unfair)', p: 4, f: "It's okay to accept, but it's also okay to ask nicely for fair pay." },
      ],
    },
    {
      text: 'Mrs. Lee says: "I can do $13, and I\'ll add a cookie each day." What do you do?',
      choices: [
        { t: '"Deal! Thank you!"', p: 10, f: 'A fair middle ground plus a bonus, nice compromise!' },
        { t: '"It\'s $15 or nothing."', p: 3, f: "Sometimes being too stubborn means you get nothing. Compromise can be smart." },
      ],
    },
    {
      text: 'You walk the dog on time every day and even brush her fur. Next month Mrs. Lee needs a walker again. Why might she pay you more now?',
      choices: [
        { t: 'Because you did a great, reliable job', p: 10, f: 'Yes! Doing great work is the best reason for a raise.' },
        { t: 'Because you asked loudly', p: 0, f: 'Raises come from showing your value, not from being loud.' },
      ],
    },
  ];
  const [i, setI] = useState(0);
  const [fb, setFb] = useState<null | { f: string; good: boolean }>(null);
  const [pts, setPts] = useState(0);
  const s = steps[i];
  return (
    <div className="col" style={{ gap: 10 }}>
      <div className="card tint-teal" style={{ fontSize: '1.2rem', fontWeight: 700 }}>
        {s.text} <ReadAloud text={s.text} />
      </div>
      {fb ? (
        <div className={`card ${fb.good ? 'tint-green' : 'tint-gold'}`}>
          {fb.f}
          <div className="row" style={{ justifyContent: 'flex-end' }}>
            <Button
              variant="primary"
              onClick={() => {
                setFb(null);
                if (i + 1 >= steps.length) onFinish({ score: (pts / 30) * 100 });
                else setI(i + 1);
              }}
            >
              Next ▶
            </Button>
          </div>
        </div>
      ) : (
        s.choices.map((c) => (
          <Button
            key={c.t}
            size="big"
            block
            onClick={() => {
              setPts(pts + c.p);
              playSfx(c.p >= 8 ? 'correct' : 'pop');
              addReview?.({ q: s.text, ok: c.p >= 8, answer: c.t, explanation: c.f });
              setFb({ f: c.f, good: c.p >= 8 });
            }}
          >
            {c.t}
          </Button>
        ))
      )}
    </div>
  );
}

function AdvancedNegotiation({ seed, onFinish, addReview }: { seed: number } & Pick<KindProps, 'onFinish' | 'addReview'>) {
  const sc = useMemo(() => {
    const r = makeRng(seed);
    const role = r.pick(['Junior Data Analyst', 'Associate Software Engineer', 'Marketing Coordinator', 'Financial Associate']);
    const marketMid = r.int(62, 98) * 1000;
    const offer = Math.round(marketMid * r.range(0.86, 0.94) / 500) * 500;
    const ceiling = Math.round(marketMid * r.range(1.04, 1.1) / 500) * 500; // the most they'd pay
    const batna = Math.round(marketMid * r.range(0.9, 0.98) / 500) * 500;
    return { role, marketMid, offer, ceiling, batna, low: Math.round(marketMid * 0.9), high: Math.round(marketMid * 1.12) };
  }, [seed]);
  const [stage, setStage] = useState<'research' | 'counter' | 'response' | 'perks' | 'done'>('research');
  const [researched, setResearched] = useState(false);
  const [ask, setAsk] = useState(sc.offer);
  const [final, setFinal] = useState(sc.offer);
  const [bonus, setBonus] = useState(0);
  const [lost, setLost] = useState(false);
  const [say, setSay] = useState('');
  const [mood, setMood] = useState<'talking' | 'skeptical' | 'hyped' | 'confident' | 'disappointed'>('talking');

  const respond = (justify: boolean) => {
    // Recruiter accepts asks up to the ceiling; above it, chance of rescinding grows.
    let result = ask;
    let text = '';
    if (ask <= sc.ceiling) {
      result = justify ? ask : Math.round((ask + sc.offer) / 2 / 500) * 500;
      text = justify ? `"That's in line with the market data you shared. We can do ${money(result, { cents: false })}."` : `"We can't go that high without a reason, but we can meet you at ${money(result, { cents: false })}."`;
      setMood('hyped');
    } else if (ask <= sc.high * 1.05) {
      result = sc.ceiling;
      text = `"That's above our budget. Our best is ${money(sc.ceiling, { cents: false })}."`;
      setMood('skeptical');
    } else {
      setLost(true);
      result = 0;
      text = `"That's far beyond the range for this role. I'm afraid we'll move forward with another candidate."`;
      setMood('disappointed');
    }
    setFinal(result);
    setSay(text);
    act((d, fx) => recordAnswer(d, fx, { id: 'negotiation', topic: 'earning' }, !lost && result > sc.offer));
    setStage('response');
  };

  const finish = () => {
    const best = sc.ceiling + 5000;
    const got = lost ? Math.max(0, sc.batna - 8000) : final + bonus;
    const score = lost ? 15 : Math.max(0, Math.min(100, ((got - sc.offer) / (best - sc.offer)) * 85 + (researched ? 15 : 0)));
    const lifetime = (final - sc.offer) * 0 + futureValueSeries(final - sc.offer, 0.03, 40);
    addReview?.({
      q: 'Negotiation result',
      ok: !lost && final > sc.offer,
      answer: lost ? 'Offer withdrawn' : `${money(final, { cents: false })} salary${bonus ? ` + ${money(bonus, { cents: false })} signing bonus` : ''}`,
      explanation: `Research gave a market range of ${money(sc.low, { cents: false })}–${money(sc.high, { cents: false })}. Anchoring near the top of the range with data, staying polite, and knowing your walk-away offer (${money(sc.batna, { cents: false })}) wins. A ${money(Math.max(0, final - sc.offer), { cents: false })} raise now, growing 3%/yr, adds up to about ${money(lifetime, { cents: false })} over a 40-year career.`,
    });
    onFinish({ score, summary: lost ? 'The offer was withdrawn, always keep your ask within the researched range.' : `You negotiated ${money(final - sc.offer, { cents: false })} more than the first offer.` });
  };

  return (
    <div className="col" style={{ gap: 10 }}>
      <div className="row" style={{ gap: 10, alignItems: 'flex-start' }}>
        <div className="dialog-portrait" style={{ width: 80, height: 80 }}>
          <NarwhalPortrait mood={mood} size={76} />
        </div>
        <div className="card grow">
          <b>Offer: {sc.role}</b> at <b>{money(sc.offer, { cents: false })}/year</b>. You also have another offer for {money(sc.batna, { cents: false })} (your BATNA, best alternative).
          {say && <div style={{ marginTop: 6 }}>Recruiter: {say}</div>}
        </div>
      </div>
      {stage === 'research' && (
        <div className="col" style={{ gap: 8 }}>
          <b>Step 1: Do you research salaries first?</b>
          {researched ? (
            <div className="card tint-green">
              📊 Salary data for {sc.role}s in San Francisco: <b>{money(sc.low, { cents: false })} – {money(sc.high, { cents: false })}</b> (median {money(sc.marketMid, { cents: false })}).
            </div>
          ) : (
            <Button variant="blue" onClick={() => (setResearched(true), playSfx('pop'))}>
              📊 Look up market salary data
            </Button>
          )}
          <Button variant="primary" onClick={() => setStage('counter')}>
            Next: make a counteroffer ▶
          </Button>
          <Button size="small" variant="ghost" onClick={() => (setFinal(sc.offer), setStage('perks'))}>
            Just accept the first offer
          </Button>
        </div>
      )}
      {stage === 'counter' && (
        <div className="col" style={{ gap: 8 }}>
          <b>Step 2: Your counteroffer: {money(ask, { cents: false })}</b>
          <input type="range" min={sc.offer} max={Math.round(sc.marketMid * 1.4)} step={500} value={ask} onChange={(e) => setAsk(Number(e.target.value))} />
          <div className="row wrap" style={{ gap: 8 }}>
            <Button variant="green" onClick={() => respond(true)} disabled={!researched}>
              Ask with market data 📊
            </Button>
            <Button onClick={() => respond(false)}>Ask without a reason</Button>
          </div>
          {!researched && <span className="tiny muted">(You skipped research, so you can&apos;t cite data.)</span>}
        </div>
      )}
      {stage === 'response' && (
        <div className="col" style={{ gap: 8 }}>
          {lost ? (
            <>
              <div className="card tint-red">The offer was withdrawn. You fall back to your other offer at {money(sc.batna, { cents: false })}.</div>
              <Button variant="primary" onClick={finish}>
                See results
              </Button>
            </>
          ) : (
            <>
              <b>Step 3: Accept {money(final, { cents: false })}, or ask for something else?</b>
              <div className="row wrap" style={{ gap: 8 }}>
                <Button variant="green" onClick={() => setStage('perks')}>
                  Accept & ask about a signing bonus
                </Button>
                <Button onClick={finish}>Accept as is</Button>
              </div>
            </>
          )}
        </div>
      )}
      {stage === 'perks' && (
        <div className="col" style={{ gap: 8 }}>
          <b>Step 4: The salary is set. Ask for a one-time signing bonus?</b>
          <div className="row wrap" style={{ gap: 8 }}>
            {[0, 2000, 5000, 15000].map((b) => (
              <Button
                key={b}
                onClick={() => {
                  if (b <= 5000) {
                    setBonus(b);
                    setSay(b ? `"We can add a ${money(b, { cents: false })} signing bonus. Welcome aboard!"` : '"Great, welcome aboard!"');
                    setMood('hyped');
                  } else {
                    setBonus(0);
                    setSay('"A bonus that big isn\'t possible, but we\'re thrilled to have you."');
                    setMood('skeptical');
                  }
                  setStage('done');
                }}
              >
                {b ? `Ask for ${money(b, { cents: false })}` : 'No bonus, just accept'}
              </Button>
            ))}
          </div>
        </div>
      )}
      {stage === 'done' && (
        <Button variant="primary" size="big" onClick={finish}>
          See results
        </Button>
      )}
    </div>
  );
}
