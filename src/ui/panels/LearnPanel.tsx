'use client';
import { useState } from 'react';
import { useUI } from '@/store/ui';
import { useGame, act } from '@/store/game';
import { Button, Modal, ReadAloud, NARWHAL_SHEET, PixelMeter } from '../common';
import { Tabs, Section } from '../kit';
import { LESSONS, completeLesson, type LessonDef } from '@/game/progress/lessons';
import { QUESTS } from '@/game/progress/quests';
import { TOPIC_INFO } from '@/game/topics';
import tips from '@/data/tips.json';
import { playSfx } from '@/engine/audio';
import { cls } from '../format';
import { FinBucks } from '../FinBucks';

type Tab = 'course' | 'tips' | 'tutorials' | 'formulas' | 'narwhal';

/** Lessons grouped into course units by topic, in course order. */
function units(topic?: string) {
  const out: { topic: string; lessons: LessonDef[] }[] = [];
  for (const l of LESSONS) {
    if (topic && l.topic !== topic) continue;
    const u = out.find((x) => x.topic === l.topic);
    if (u) u.lessons.push(l);
    else out.push({ topic: l.topic, lessons: [l] });
  }
  return out;
}

export function LearnPanel({ topic, tab: initial, lessonId }: { topic?: string; tab?: Tab; lessonId?: string }) {
  const close = useUI((s) => s.close);
  const w = useGame((s) => s.world!);
  const [tab, setTab] = useState<Tab>(initial ?? 'course');
  const [lesson, setLesson] = useState<LessonDef | null>(() => LESSONS.find((l) => l.id === lessonId) ?? null);
  const entry = w.difficulty === 'entry';
  const done = w.progress.lessons;
  const next = LESSONS.find((l) => !done.includes(l.id));
  const pctDone = Math.round((done.length / LESSONS.length) * 100);
  return (
    <Modal
      onClose={close}
      title="📚 Learn"
      subtitle={`Your money course · ${done.length} of ${LESSONS.length} lessons complete`}
      size="wide"
      accent="teal"
      className={entry ? 'entry-mode learn-modal' : 'learn-modal'}
    >
      {lesson ? (
        <LessonReader lesson={lesson} onDone={() => setLesson(null)} onNext={(l) => setLesson(l)} />
      ) : (
        <>
          <div className="learn-hero">
            <PixelMeter pct={pctDone} label="course" />
            <div className="col grow" style={{ gap: 6, minWidth: 220 }}>
              <span className="learn-kicker">{next ? 'Up next in your course' : 'Course complete'}</span>
              <b className="learn-next-title">
                {next ? (
                  <>
                    {next.icon} {next.title}
                  </>
                ) : (
                  'You finished every lesson. Legend!'
                )}
              </b>
              {next && (
                <span className="small" style={{ opacity: 0.85 }}>
                  {TOPIC_INFO[next.topic as keyof typeof TOPIC_INFO]?.name} · {next.slides.length + 1} steps · +{next.reward.xp} XP
                  {next.reward.cash ? ` · +$${next.reward.cash} FinBucks` : ''}
                  {next.perk ? ` · unlocks ${next.perk.name}` : ''}
                </span>
              )}
            </div>
            {next && (
              <Button variant="gold" size="big" onClick={() => (playSfx('pop'), setLesson(next))}>
                ▶ {done.length ? 'Continue' : 'Start learning'}
              </Button>
            )}
          </div>
          <Tabs
            value={tab}
            onChange={setTab}
            tabs={[
              { id: 'course', label: '📖 Course' },
              { id: 'tips', label: "💡 Narwhal's tips" },
              ...(entry ? [] : [{ id: 'formulas' as Tab, label: '📐 Formula sheet' }]),
              { id: 'tutorials', label: '🔁 Tutorials' },
              { id: 'narwhal', label: '💙 Meet Narwhal' },
            ]}
          />
          {tab === 'course' && (
            <div className="course">
              {units(topic).map((u) => {
                const info = TOPIC_INFO[u.topic as keyof typeof TOPIC_INFO];
                const n = u.lessons.filter((l) => done.includes(l.id)).length;
                return (
                  <section key={u.topic} className="unit">
                    <div className="unit-head">
                      <span className="unit-icon">{info?.icon}</span>
                      <div className="col grow" style={{ gap: 0 }}>
                        <b>{info?.name}</b>
                        <span className="tiny muted">{info?.blurb}</span>
                      </div>
                      <span className={cls('chip', n === u.lessons.length ? 'good' : undefined)}>
                        {n}/{u.lessons.length}
                      </span>
                    </div>
                    <div className="unit-lessons">
                      {u.lessons.map((l) => {
                        const isDone = done.includes(l.id);
                        const isNext = next?.id === l.id;
                        return (
                          <button key={l.id} className={cls('lesson-row', isDone && 'done', isNext && 'next')} onClick={() => (playSfx('pop'), setLesson(l))}>
                            <span className="lesson-node">{isDone ? '✓' : l.icon}</span>
                            <span className="col grow" style={{ gap: 1, alignItems: 'flex-start' }}>
                              <b>{l.title}</b>
                              <span className="tiny muted">
                                {l.slides.length + 1} steps · +{l.reward.xp} XP{l.reward.cash ? ` · +$${l.reward.cash}` : ''}
                              </span>
                            </span>
                            {l.perk && <span className="chip gold tiny">✨ {l.perk.name}</span>}
                            {isNext && <span className="chip teal tiny">Next</span>}
                          </button>
                        );
                      })}
                    </div>
                  </section>
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
              <img src={NARWHAL_SHEET} alt="NextGen Narwhal character sheet" style={{ width: 'min(520px, 100%)', borderRadius: 14, border: '1px solid var(--border)' }} />
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

function LessonReader({ lesson, onDone, onNext }: { lesson: LessonDef; onDone: () => void; onNext: (l: LessonDef) => void }) {
  const w = useGame((s) => s.world!);
  const entry = w.difficulty === 'entry';
  const [i, setI] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [wasFirst] = useState(() => !w.progress.lessons.includes(lesson.id));
  const slides = lesson.slides;
  const atCheck = i >= slides.length;
  const steps = slides.length + 1;
  const text = atCheck ? lesson.check.prompt : entry ? slides[i].entry : slides[i].advanced;
  const ok = picked === lesson.check.answer;
  const after = LESSONS[LESSONS.findIndex((l) => l.id === lesson.id) + 1];
  const info = TOPIC_INFO[lesson.topic as keyof typeof TOPIC_INFO];
  return (
    <div className="lesson-reader">
      <div className="row between wrap">
        <button className="link-btn" onClick={onDone}>
          ◀ Course
        </button>
        <span className="q-topic">
          <span className="q-topic-icon">{info?.icon}</span>
          {info?.name}
        </span>
      </div>
      <div className="q-progress-track lesson-track">
        {Array.from({ length: steps }, (_, k) => (
          <span key={k} className={k < i ? 'past' : k === i ? 'now' : ''} />
        ))}
      </div>
      <div className="lesson-card2">
        <div className="lesson-art">{lesson.icon}</div>
        <div className="col grow" style={{ gap: 6 }}>
          <span className="learn-kicker dark">{atCheck ? 'Check your understanding' : `${lesson.title} · ${i + 1} of ${slides.length}`}</span>
          <p className="lesson-text">
            {text} <ReadAloud text={text} />
          </p>
        </div>
      </div>
      {atCheck ? (
        <div className="question">
          <div className={cls('choices', lesson.check.choices.length <= 2 && 'two')}>
            {lesson.check.choices.map((c, k) => (
              <button
                key={k}
                className={cls('choice', picked !== null && k === lesson.check.answer && 'right', picked === k && k !== lesson.check.answer && 'wrong')}
                disabled={picked !== null}
                onClick={() => {
                  setPicked(k);
                  const right = k === lesson.check.answer;
                  playSfx(right ? 'correct' : 'wrong');
                  act((d, fx) => completeLesson(d, fx, lesson.id, right));
                }}
              >
                <span className="choice-letter">{String.fromCharCode(65 + k)}</span>
                {c}
              </button>
            ))}
          </div>
          {picked !== null && (
            <div className={cls('q-feedback', ok ? 'ok' : 'no')}>
              <div className="q-feedback-head">
                <b className="q-verdict grow">{ok ? (wasFirst ? 'Lesson complete!' : 'Correct!') : 'Not quite'}</b>
                {ok && wasFirst && (
                  <span className="row wrap" style={{ gap: 6 }}>
                    <span className="chip teal">+{lesson.reward.xp} XP</span>
                    {lesson.reward.cash ? <FinBucks value={lesson.reward.cash} className="chip gold finbucks" /> : null}
                    {lesson.perk && <span className="chip gold">✨ {lesson.perk.name}</span>}
                  </span>
                )}
              </div>
              <div className="q-why">
                <span className="q-why-label">Why</span>
                <span>{lesson.check.explanation}</span>
              </div>
              {ok && lesson.perk && wasFirst && (
                <div className="q-why key">
                  <span className="q-why-label">Perk</span>
                  <span>
                    <b>{lesson.perk.name}:</b> {lesson.perk.desc}
                  </span>
                </div>
              )}
            </div>
          )}
          <div className="row" style={{ justifyContent: 'flex-end', marginTop: 4 }}>
            {picked !== null && !ok && <Button onClick={() => (setPicked(null), setI(0))}>↺ Read it again</Button>}
            {picked !== null && ok && after && (
              <Button variant="primary" size="big" onClick={() => onNext(after)}>
                Next lesson: {after.title} ▶
              </Button>
            )}
            {picked !== null && <Button onClick={onDone}>Back to course</Button>}
          </div>
        </div>
      ) : (
        <div className="row" style={{ justifyContent: 'flex-end' }}>
          {i > 0 && <Button onClick={() => setI(i - 1)}>◀ Back</Button>}
          <Button variant="primary" size="big" onClick={() => (playSfx('click'), setI(i + 1))}>
            {i === slides.length - 1 ? 'Check yourself ▶' : 'Continue ▶'}
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
              for (const s of q.steps) for (const line of (entry ? s.entrySay : s.proSay) ?? s.say ?? []) say(line, 'talking');
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
