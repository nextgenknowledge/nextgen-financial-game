'use client';
import { useState } from 'react';
import { useUI } from '@/store/ui';
import { useGame, act } from '@/store/game';
import { Button, Modal, ReadAloud, NARWHAL_SHEET } from '../common';
import { Tabs, Section } from '../kit';
import { LESSONS, completeLesson, type LessonDef } from '@/game/progress/lessons';
import { QUESTS } from '@/game/progress/quests';
import { TOPIC_INFO } from '@/game/topics';
import tips from '@/data/tips.json';
import { playSfx } from '@/engine/audio';
import { cls } from '../format';

type Tab = 'lessons' | 'tips' | 'tutorials' | 'formulas' | 'narwhal';

export function LearnPanel({ topic, tab: initial }: { topic?: string; tab?: Tab }) {
  const close = useUI((s) => s.close);
  const w = useGame((s) => s.world!);
  const [tab, setTab] = useState<Tab>(initial ?? 'lessons');
  const [lesson, setLesson] = useState<LessonDef | null>(null);
  const entry = w.difficulty === 'entry';
  return (
    <Modal onClose={close} title="📚 Learn" size="wide">
      {lesson ? (
        <LessonReader lesson={lesson} onDone={() => setLesson(null)} />
      ) : (
        <>
          <Tabs
            value={tab}
            onChange={setTab}
            tabs={[
              { id: 'lessons', label: `📖 Lessons (${w.progress.lessons.length}/${LESSONS.length})` },
              { id: 'tips', label: "🦄 Narwhal's Money Tips" },
              { id: 'tutorials', label: '🔁 Replay tutorials' },
              ...(entry ? [] : [{ id: 'formulas' as Tab, label: '📐 Formula sheet' }]),
              { id: 'narwhal', label: '💙 Meet Narwhal' },
            ]}
          />
          {tab === 'lessons' && (
            <div className="lesson-grid">
              {LESSONS.filter((l) => !topic || l.topic === topic).map((l) => {
                const done = w.progress.lessons.includes(l.id);
                return (
                  <button key={l.id} className={cls('lesson-card', done && 'done')} onClick={() => (playSfx('pop'), setLesson(l))}>
                    <span style={{ fontSize: '2rem' }}>{l.icon}</span>
                    <b>{l.title}</b>
                    <span className="tiny muted">{TOPIC_INFO[l.topic as keyof typeof TOPIC_INFO]?.name}</span>
                    {l.perk && <span className="tiny chip gold">✨ {l.perk.name}</span>}
                    {done && <span className="tiny good bold">✓ Done</span>}
                  </button>
                );
              })}
            </div>
          )}
          {tab === 'tips' && (
            <div className="col" style={{ gap: 6 }}>
              {tips.tips.map((t) => (
                <div key={t.id} className="card flat row" style={{ alignItems: 'flex-start' }}>
                  <span style={{ fontSize: '1.4rem' }}>{TOPIC_INFO[t.topic as keyof typeof TOPIC_INFO]?.icon ?? '💡'}</span>
                  <div className="grow">
                    <b>{t.text}</b>
                    {!entry && <div className="small muted">{t.advanced}</div>}
                  </div>
                  <ReadAloud text={entry ? t.text : `${t.text} ${t.advanced}`} />
                </div>
              ))}
            </div>
          )}
          {tab === 'tutorials' && <Tutorials />}
          {tab === 'formulas' && <FormulaSheet />}
          {tab === 'narwhal' && (
            <div className="row wrap" style={{ gap: 16, alignItems: 'flex-start' }}>
              <img src={NARWHAL_SHEET} alt="NextGen Narwhal character sheet" style={{ width: 'min(520px, 100%)', borderRadius: 14, border: '3px solid var(--ink)' }} />
              <div className="col grow" style={{ minWidth: 220 }}>
                <h3 style={{ margin: 0 }}>NextGen Narwhal</h3>
                <p>The money guide of Fin City and the mascot of NextGen Knowledge. Confident, curious and a little bit skeptical of anything that sounds too good to be true.</p>
                <p className="small muted">Narwhal&apos;s moods in the game: confident, talking, skeptical, shocked, hyped and disappointed, come straight from this character sheet.</p>
              </div>
            </div>
          )}
        </>
      )}
    </Modal>
  );
}

function LessonReader({ lesson, onDone }: { lesson: LessonDef; onDone: () => void }) {
  const entry = useGame((s) => s.world!.difficulty === 'entry');
  const [i, setI] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const slides = lesson.slides;
  const atCheck = i >= slides.length;
  const text = atCheck ? lesson.check.prompt : entry ? slides[i].entry : slides[i].advanced;
  return (
    <div className="col" style={{ gap: 12 }}>
      <div className="row between">
        <h3 style={{ margin: 0 }}>
          {lesson.icon} {lesson.title}
        </h3>
        <span className="small muted">
          {Math.min(i + 1, slides.length + 1)}/{slides.length + 1}
        </span>
      </div>
      <div className="card lesson-slide">
        <p style={{ fontSize: entry ? '1.35rem' : '1.15rem', fontWeight: 700, margin: 0 }}>{text}</p>
        <ReadAloud text={text} />
      </div>
      {atCheck ? (
        <>
          <div className="col" style={{ gap: 8 }}>
            {lesson.check.choices.map((c, k) => (
              <Button
                key={k}
                size="big"
                block
                variant={picked === null ? undefined : k === lesson.check.answer ? 'green' : k === picked ? 'danger' : undefined}
                disabled={picked !== null}
                onClick={() => {
                  setPicked(k);
                  const ok = k === lesson.check.answer;
                  playSfx(ok ? 'correct' : 'wrong');
                  act((w, fx) => completeLesson(w, fx, lesson.id, ok));
                }}
              >
                {c}
              </Button>
            ))}
          </div>
          {picked !== null && (
            <div className={`card ${picked === lesson.check.answer ? 'tint-green' : 'tint-red'}`}>
              <b>{picked === lesson.check.answer ? '✅ Correct!' : '💡 Not quite.'}</b> {lesson.check.explanation}
            </div>
          )}
          <div className="row">
            {picked !== null && picked !== lesson.check.answer && (
              <Button onClick={() => (setPicked(null), setI(0))}>↺ Read it again</Button>
            )}
            <Button variant="primary" onClick={onDone}>
              Back to lessons
            </Button>
          </div>
        </>
      ) : (
        <div className="row">
          <Button onClick={onDone}>Back</Button>
          {i > 0 && <Button onClick={() => setI(i - 1)}>◀ Previous</Button>}
          <Button variant="primary" onClick={() => (playSfx('click'), setI(i + 1))}>
            {i === slides.length - 1 ? 'Quiz time! ▶' : 'Next ▶'}
          </Button>
        </div>
      )}
    </div>
  );
}

function Tutorials() {
  const w = useGame((s) => s.world!);
  const say = useUI((s) => s.sayNarwhal);
  const closeAll = useUI((s) => s.closeAll);
  const entry = w.difficulty === 'entry';
  const onboarding = QUESTS.filter((q) => q.onboarding);
  return (
    <div className="col" style={{ gap: 6 }}>
      <p className="small muted">Replay any of Narwhal&apos;s tutorial lessons. Narwhal will say them again.</p>
      {onboarding.map((q) => (
        <div key={q.id} className="card flat row between wrap">
          <b>
            {q.icon} {q.title}
          </b>
          <Button
            size="small"
            onClick={() => {
              closeAll();
              for (const s of q.steps) for (const line of (entry && s.entrySay) || s.say || []) say(line, 'talking');
            }}
          >
            ▶ Replay
          </Button>
        </div>
      ))}
      <Section title="Controls">
        <ul className="small">
          <li>Move: W A S D or arrow keys · Sprint: Shift · Jump: Space · Interact: E</li>
          <li>Look around: drag with the mouse (or one finger). Zoom: mouse wheel. Click the ground to walk there.</li>
          <li>FinPhone: P · Map: M · Bag: I · Pause: Esc. Every button can also be clicked.</li>
          <li>Vehicles: W/S gas & reverse, A/D steer, Space brake (fly up in a plane), Shift boost (fly down), E get off.</li>
        </ul>
      </Section>
    </div>
  );
}

export function FormulaSheet() {
  const rows: [string, string][] = [
    ['Simple interest', 'I = P × r × t'],
    ['Compound amount', 'A = P(1 + r/n)^(n·t)'],
    ['APY from APR', 'APY = (1 + APR/n)^n − 1'],
    ['Rule of 72', 'years to double ≈ 72 ÷ rate%'],
    ['Loan payment', 'PMT = P·i / (1 − (1 + i)^−N), i = APR/12'],
    ['Future value of savings', 'FV = C·((1 + i)^N − 1) / i'],
    ['Real return', '(1 + nominal) / (1 + inflation) − 1'],
    ['Unit price', 'price ÷ quantity'],
    ['Profit / margin', 'revenue − costs; profit ÷ revenue'],
    ['Break-even units', 'fixed costs ÷ (price − variable cost)'],
    ['P/E ratio', 'price ÷ earnings per share'],
    ['Dividend yield', 'annual dividend ÷ price'],
    ['Bond price change', 'ΔP/P ≈ −duration × Δyield'],
    ['Net pay', 'gross − taxes − deductions'],
    ['Effective tax rate', 'total tax ÷ total income'],
    ['Credit utilization', 'card balance ÷ credit limit'],
    ['Net worth', 'assets − liabilities'],
  ];
  return (
    <table className="kit-table">
      <tbody>
        {rows.map(([a, b]) => (
          <tr key={a}>
            <td className="bold">{a}</td>
            <td className="mono">{b}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
