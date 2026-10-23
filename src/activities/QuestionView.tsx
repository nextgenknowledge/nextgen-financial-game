'use client';
import { useEffect, useMemo, useState } from 'react';
import type { RuntimeQuestion, Response } from '@/game/questions/engine';
import { grade, correctAnswerText } from '@/game/questions/engine';
import { Button, ReadAloud } from '@/ui/common';
import { Calculator } from '@/ui/phone/apps/CalculatorApp';
import { NarwhalPortrait } from '@/ui/hud/HUD';
import { playSfx } from '@/engine/audio';
import { useActivityPaused } from './paused';
import { useSettings } from '@/store/settings';
import { speak } from '@/ui/speech';
import { TOPIC_INFO } from '@/game/topics';
import { cls } from '@/ui/format';
import type { QuestionMedia } from '@/game/content';
import { LineChart } from '@/ui/kit';
import { LESSONS } from '@/game/progress/lessons';

export interface AnswerOutcome {
  correct: boolean;
  /** 1 = first try, 0.5 = second try (Entry retry), 0 = wrong */
  credit: number;
  hintUsed: boolean;
}

export function MediaView({ m }: { m: QuestionMedia }) {
  if (m.type === 'table' && m.rows)
    return (
      <table className="kit-table" style={{ margin: '6px 0' }}>
        {m.title && <caption className="bold small">{m.title}</caption>}
        <tbody>
          {m.rows.map((r, i) => (
            <tr key={i}>
              {r.map((c, j) => (i === 0 ? <th key={j}>{c}</th> : <td key={j}>{c}</td>))}
            </tr>
          ))}
        </tbody>
      </table>
    );
  if (m.type === 'chart' && m.series) return <LineChart series={[{ values: m.series, color: '#2f6bdb' }]} labels={m.labels} height={140} money={false} />;
  if (m.type === 'document' && m.lines)
    return (
      <div className="doc-media">
        {m.title && <div className="bold">{m.title}</div>}
        {m.lines.map((l, i) => (
          <div key={i} className="mono small">
            {l}
          </div>
        ))}
      </div>
    );
  if (m.type === 'coins' && m.coins)
    return (
      <div className="row wrap" style={{ gap: 6, margin: '6px 0' }}>
        {Object.entries(m.coins).flatMap(([k, n]) => Array.from({ length: n }, (_, i) => <CoinIcon key={`${k}${i}`} kind={k} />))}
      </div>
    );
  if (m.type === 'image' && m.emoji) return <div style={{ fontSize: '3rem', textAlign: 'center' }}>{m.emoji}</div>;
  return null;
}

const COIN_STYLE: Record<string, { label: string; size: number; bg: string; bill?: boolean }> = {
  p: { label: '1¢', size: 40, bg: '#d08a4a' },
  n: { label: '5¢', size: 46, bg: '#b9bec9' },
  d: { label: '10¢', size: 36, bg: '#d9dde6' },
  q: { label: '25¢', size: 52, bg: '#c9ced8' },
  '1': { label: '$1', size: 0, bg: '#9fd49a', bill: true },
  '5': { label: '$5', size: 0, bg: '#a9c9ec', bill: true },
  '10': { label: '$10', size: 0, bg: '#f0c98a', bill: true },
  '20': { label: '$20', size: 0, bg: '#b8e0c8', bill: true },
};

export function CoinIcon({ kind, onClick }: { kind: string; onClick?: () => void }) {
  const s = COIN_STYLE[kind] ?? COIN_STYLE.p;
  if (s.bill)
    return (
      <button type="button" className="bill-icon" style={{ background: s.bg, cursor: onClick ? 'pointer' : 'default' }} onClick={onClick} aria-label={s.label}>
        {s.label}
      </button>
    );
  return (
    <button type="button" className="coin-icon" style={{ width: s.size, height: s.size, background: s.bg, cursor: onClick ? 'pointer' : 'default' }} onClick={onClick} aria-label={s.label}>
      {s.label}
    </button>
  );
}

export function QuestionView({
  q,
  entry,
  onAnswered,
  allowRetry,
  timer,
  index,
  total,
}: {
  q: RuntimeQuestion;
  entry: boolean;
  onAnswered: (o: AnswerOutcome) => void;
  allowRetry?: boolean;
  timer?: number;
  index?: number;
  total?: number;
}) {
  const [picked, setPicked] = useState<number[]>([]);
  const [numeric, setNumeric] = useState('');
  const [order, setOrder] = useState<number[]>([]);
  const [removed, setRemoved] = useState<number[]>([]);
  const [tries, setTries] = useState(0);
  const [done, setDone] = useState<null | AnswerOutcome>(null);
  const [hint, setHint] = useState(false);
  const [calc, setCalc] = useState(false);
  const [left, setLeft] = useState(timer ?? 0);
  const readAloud = useSettings((s) => s.readAloud);
  const paused = useActivityPaused();

  useEffect(() => {
    if (readAloud) speak(`${q.prompt} ${q.type === 'mc' || q.type === 'tf' ? q.choices.join('. ') : ''}`);
  }, [q, readAloud]);

  useEffect(() => {
    if (!timer || done || paused) return;
    const id = setInterval(() => setLeft((l) => Math.max(0, l - 0.1)), 100);
    return () => clearInterval(id);
  }, [timer, done, paused]);
  useEffect(() => {
    if (timer && left <= 0 && !done) finish(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [left]);

  const finish = (ok: boolean) => {
    const credit = ok ? (tries === 0 ? 1 : 0.5) : 0;
    const o = { correct: ok, credit: timer && ok ? credit * (0.6 + 0.4 * (left / timer)) : credit, hintUsed: hint };
    setDone(o);
    playSfx(ok ? 'correct' : 'wrong');
  };

  const submit = (r: Response) => {
    if (done) return;
    const ok = grade(q, r);
    if (!ok && allowRetry && tries === 0 && (q.type === 'mc' || q.type === 'tf')) {
      // Entry: kindly remove the wrong answer and let them try again
      setTries(1);
      if (r.kind === 'choice') setRemoved([...removed, r.index]);
      playSfx('wrong');
      setPicked([]);
      return;
    }
    if (!ok && allowRetry && tries === 0 && q.type === 'numeric') {
      setTries(1);
      setHint(true);
      playSfx('wrong');
      return;
    }
    finish(ok);
  };

  const topic = TOPIC_INFO[q.topic];
  const showCalc = !entry && (q.type === 'numeric' || q.computed);
  const correctText = useMemo(() => correctAnswerText(q), [q]);
  // The big idea behind this topic, from its first lesson: every question doubles as a mini-lesson
  const keyIdea = useMemo(() => {
    const l = LESSONS.find((x) => x.topic === q.topic);
    return l ? (entry ? l.slides[0].entry : l.slides[0].advanced) : null;
  }, [q.topic, entry]);

  return (
    <div className={cls('question', entry && 'entry')}>
      <div className="q-top">
        <span className="q-topic">
          <span className="q-topic-icon">{topic?.icon}</span>
          {topic?.name}
        </span>
        {index !== undefined && total ? (
          <div className="q-progress" aria-label={`Question ${index + 1} of ${total}`}>
            <span className="tiny bold muted">
              {index + 1} / {total}
            </span>
            <div className="q-progress-track">
              {Array.from({ length: total }, (_, k) => (
                <span key={k} className={k < index ? 'past' : k === index ? 'now' : ''} />
              ))}
            </div>
          </div>
        ) : (
          <span className="grow" />
        )}
        <div className="row" style={{ gap: 6 }}>
          {timer ? (
            <div className="timer-bar" title="Time bonus">
              <div style={{ width: `${(left / timer) * 100}%`, background: left < timer * 0.25 ? 'var(--bad)' : 'var(--teal)' }} />
            </div>
          ) : null}
          {q.hint && !done && (
            <Button size="small" variant="ghost" onClick={() => (setHint(true), playSfx('pop'))}>
              💡 Hint
            </Button>
          )}
          {showCalc && !done && (
            <Button size="small" variant={calc ? 'gold' : undefined} onClick={() => setCalc(!calc)} title="Calculator">
              🧮 Calculator
            </Button>
          )}
        </div>
      </div>
      <div className="q-card">
        <div className="q-prompt">
          {q.icon && <span className="q-icon">{q.icon}</span>}
          <span className="grow">{q.prompt}</span>
          <ReadAloud text={`${q.prompt} ${q.type === 'mc' || q.type === 'tf' ? q.choices.join('. ') : ''}`} />
        </div>
        {q.media && <MediaView m={q.media} />}
      </div>
      {hint && q.hint && !done && <div className="card tint-gold small">💡 {q.hint}</div>}
      {tries > 0 && !done && <div className="card tint-gold small">🦄 {entry ? 'Not quite, try again! I took away one wrong answer.' : 'Not quite. Check your work and try once more.'}</div>}

      {(q.type === 'mc' || q.type === 'tf') && (
        <div className={cls('choices', q.choices.length <= 2 && 'two')}>
          {q.choices.map((c, i) =>
            removed.includes(i) ? (
              <div key={i} className="choice removed">
                {c}
              </div>
            ) : (
              <button
                key={i}
                className={cls('choice', done && i === q.correct && 'right', done && picked[0] === i && i !== q.correct && 'wrong')}
                disabled={!!done}
                onClick={() => {
                  setPicked([i]);
                  submit({ kind: 'choice', index: i });
                }}
              >
                <span className="choice-letter">{String.fromCharCode(65 + i)}</span>
                {c}
              </button>
            ),
          )}
        </div>
      )}

      {q.type === 'multi' && (
        <>
          <div className="choices">
            {q.choices.map((c, i) => {
              const on = picked.includes(i);
              const right = (q.correct as number[]).includes(i);
              return (
                <button key={i} className={cls('choice', on && 'on', done && right && 'right', done && on && !right && 'wrong')} disabled={!!done} onClick={() => setPicked(on ? picked.filter((x) => x !== i) : [...picked, i])}>
                  <span className="choice-letter">{on ? '☑' : '☐'}</span>
                  {c}
                </button>
              );
            })}
          </div>
          {!done && (
            <Button variant="primary" disabled={!picked.length} onClick={() => submit({ kind: 'multi', indices: picked })}>
              Check answer
            </Button>
          )}
        </>
      )}

      {q.type === 'order' && (
        <div className="col" style={{ gap: 8 }}>
          <div className="small muted">Tap the items in the right order.</div>
          <div className="choices">
            {q.choices.map((c, i) => (
              <button key={i} className={cls('choice', order.includes(i) && 'on')} disabled={!!done || order.includes(i)} onClick={() => setOrder([...order, i])}>
                <span className="choice-letter">{order.includes(i) ? order.indexOf(i) + 1 : '·'}</span>
                {c}
              </button>
            ))}
          </div>
          {!done && (
            <div className="row">
              <Button size="small" onClick={() => setOrder([])}>
                Reset
              </Button>
              <Button variant="primary" disabled={order.length !== q.choices.length} onClick={() => submit({ kind: 'order', order })}>
                Check order
              </Button>
            </div>
          )}
        </div>
      )}

      {q.type === 'numeric' && (
        <form
          className="row wrap"
          style={{ gap: 8 }}
          onSubmit={(e) => {
            e.preventDefault();
            const v = Number(numeric.replace(/[$,%\s]/g, ''));
            if (numeric.trim() && Number.isFinite(v)) submit({ kind: 'numeric', value: v });
          }}
        >
          {q.format === 'money' && <span className="big bold">$</span>}
          <input
            className="input mono numeric-input"
            inputMode="decimal"
            value={numeric}
            disabled={!!done}
            autoFocus
            onChange={(e) => setNumeric(e.target.value)}
            placeholder={q.format === 'money' ? '0.00' : '0'}
            aria-label="Your answer"
          />
          {q.format === 'pct' && <span className="big bold">%</span>}
          {q.unit && q.format !== 'money' && q.format !== 'pct' && <span className="bold">{q.unit}</span>}
          {!done && (
            <Button variant="primary" type="submit" disabled={!numeric.trim()}>
              Check
            </Button>
          )}
          {!entry && <span className="tiny muted">Round to cents. Small rounding differences are OK.</span>}
        </form>
      )}

      {calc && !done && (
        <div className="card flat" style={{ marginTop: 8 }}>
          <Calculator
            onUse={(v) => {
              setNumeric(String(v));
              setCalc(false);
            }}
          />
        </div>
      )}

      {done && (
        <div className={cls('q-feedback', done.correct ? 'ok' : 'no')}>
          <div className="q-feedback-head">
            <div className="dialog-portrait" style={{ width: 56, height: 56 }}>
              <NarwhalPortrait mood={done.correct ? 'hyped' : 'talking'} size={52} />
            </div>
            <div className="col grow" style={{ gap: 2 }}>
              <b className="q-verdict">{done.correct ? (entry ? 'Yes! Great job!' : 'Correct') : entry ? 'Good try!' : 'Not quite'}</b>
              {!done.correct && (
                <span>
                  The answer is <b>{correctText}</b>
                </span>
              )}
            </div>
            <Button variant="primary" size="big" onClick={() => onAnswered(done)}>
              Next ▶
            </Button>
          </div>
          <div className="q-why">
            <span className="q-why-label">Why</span>
            <span>
              {q.explanation} <ReadAloud text={q.explanation} />
            </span>
          </div>
          {keyIdea && (
            <div className="q-why key">
              <span className="q-why-label">Key idea</span>
              <span>{keyIdea}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
