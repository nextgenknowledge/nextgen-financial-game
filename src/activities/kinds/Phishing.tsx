'use client';
import { useMemo, useRef, useState } from 'react';
import type { KindProps } from '../types';
import data from '@/data/scams.json';
import { makeRng } from '@/game/rng';
import { Button, ReadAloud } from '@/ui/common';
import { playSfx } from '@/engine/audio';
import { act } from '@/store/game';
import { recordAnswer } from '@/game/progress/activities';
import { cls } from '@/ui/format';

interface Msg {
  id: string;
  level: string;
  kind: string;
  from: string;
  lines: string[];
  scam: boolean;
  flags: number[];
  why: string;
}

/** Decide SAFE or SCAM; in Advanced also tap the red-flag lines. */
export default function Phishing({ params, difficulty, onFinish, addReview, seed }: KindProps<{ count: number; flags: boolean }>) {
  const entry = difficulty === 'entry';
  const msgs = useMemo(() => {
    const pool = (data.messages as Msg[]).filter((m) => m.level === 'both' || m.level === difficulty);
    return makeRng(seed).shuffle([...pool]).slice(0, params.count);
  }, [seed, difficulty, params.count]);
  const [i, setI] = useState(0);
  const [verdict, setVerdict] = useState<null | boolean>(null);
  const [tapped, setTapped] = useState<number[]>([]);
  const [revealed, setRevealed] = useState(false);
  const pts = useRef(0);
  const caught = useRef(0);
  const m = msgs[i];
  const needFlags = params.flags && m.scam;

  const check = () => {
    const ok = verdict === m.scam;
    let p = ok ? 1 : 0;
    if (ok && needFlags) {
      const hit = tapped.filter((t) => m.flags.includes(t)).length;
      const wrong = tapped.filter((t) => !m.flags.includes(t)).length;
      p = 0.5 + 0.5 * Math.max(0, (hit - wrong) / m.flags.length);
    }
    if (ok && m.scam) caught.current++;
    pts.current += p;
    playSfx(ok ? 'correct' : 'wrong');
    act((d, fx) => recordAnswer(d, fx, { id: `scam:${m.id}`, topic: 'safety' }, ok));
    addReview?.({ q: `${m.from}: "${m.lines[0]}"`, ok, answer: m.scam ? 'SCAM' : 'SAFE', explanation: m.why });
    setRevealed(true);
  };

  return (
    <div className="col" style={{ gap: 10 }}>
      <div className="row between">
        <b>
          Message {i + 1}/{msgs.length}
        </b>
        <span className="small">🛡️ Scams caught: {caught.current}</span>
      </div>
      <div className={cls('scam-msg', m.kind)}>
        <div className="scam-from">
          {m.kind === 'email' ? '✉️' : m.kind === 'text' ? '💬' : m.kind === 'web' ? '🌐' : '🎮'} <b>{m.from}</b>
        </div>
        {m.lines.map((l, k) => (
          <button
            key={k}
            className={cls('scam-line', tapped.includes(k) && 'tapped', revealed && m.flags.includes(k) && 'flag')}
            disabled={!params.flags || revealed}
            onClick={() => setTapped(tapped.includes(k) ? tapped.filter((x) => x !== k) : [...tapped, k])}
          >
            {l}
          </button>
        ))}
        <ReadAloud text={m.lines.join('. ')} />
      </div>
      {params.flags && !revealed && <div className="tiny muted">If you think it&apos;s a scam, tap the lines that are red flags 🚩 before checking.</div>}
      {!revealed ? (
        <div className="row" style={{ gap: 10, justifyContent: 'center' }}>
          <Button size="big" variant={verdict === false ? 'green' : undefined} onClick={() => setVerdict(false)}>
            ✅ Safe
          </Button>
          <Button size="big" variant={verdict === true ? 'danger' : undefined} onClick={() => setVerdict(true)}>
            🚩 Scam
          </Button>
          <Button size="big" variant="primary" disabled={verdict === null} onClick={check}>
            Check
          </Button>
        </div>
      ) : (
        <div className={`card ${verdict === m.scam ? 'tint-green' : 'tint-red'}`}>
          <b>{verdict === m.scam ? (entry ? 'You got it!' : 'Correct!') : 'Careful!'}</b> This was {m.scam ? 'a SCAM' : 'SAFE'}. {m.why}
          <div className="row" style={{ justifyContent: 'flex-end' }}>
            <Button
              variant="primary"
              onClick={() => {
                if (i + 1 >= msgs.length) onFinish({ score: (pts.current / msgs.length) * 100, correct: Math.round(pts.current), total: msgs.length, stats: { scamsCaught: caught.current } });
                else {
                  setI(i + 1);
                  setVerdict(null);
                  setTapped([]);
                  setRevealed(false);
                }
              }}
            >
              Next ▶
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
