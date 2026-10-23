'use client';
import { Component, Suspense, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useUI } from '@/store/ui';
import { useGame, act } from '@/store/game';
import { Button, Modal, ReadAloud, Stars, PixelMeter } from '@/ui/common';
import { ACTIVITY_BY_ID } from '@/game/activities';
import { finishActivity, starsFor, repeatFactor, type ActivityResult, type RewardOutcome } from '@/game/progress/activities';
import { spend } from '@/game/finance/accounts';
import { KINDS } from './registry';
import type { ReviewItem } from './types';
import { money } from '@/ui/format';
import { playMusic, playSfx } from '@/engine/audio';
import { NarwhalPortrait } from '@/ui/hud/HUD';
import { randomSeed } from '@/game/rng';
import { CITIES } from '@/world/cities';
import { useScene } from '@/store/scene';
import { TOPIC_INFO } from '@/game/topics';
import { LESSONS } from '@/game/progress/lessons';
import { FinBucks } from '@/ui/FinBucks';
import { ActivityPaused } from './paused';

type Phase = 'intro' | 'play' | 'done';

/** Keeps a crashing activity from taking down the whole game. */
class ActivityBoundary extends Component<{ children: ReactNode; onClose: () => void }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  componentDidCatch(error: Error) {
    console.error('Activity crashed:', error);
  }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="col" style={{ gap: 10, alignItems: 'center', padding: '1rem' }}>
        <b>Oops, this activity hit a snag.</b>
        <span className="small muted">Your game is safe. Please try another activity.</span>
        <Button variant="primary" onClick={this.props.onClose}>
          Back to the game
        </Button>
      </div>
    );
  }
}

/**
 * Runs one activity: intro, play, results. Closing it mid-play only tucks it away (`hidden`): it
 * stays mounted with its timers paused, and reopening the same activity picks up where it left off.
 */
export function ActivityHost({ id, hidden = false }: { id: string; hidden?: boolean }) {
  const close = useUI((s) => s.close);
  const setRun = useUI((s) => s.setRun);
  const w = useGame((s) => s.world!);
  const def = ACTIVITY_BY_ID.get(id);
  const [phase, setPhase] = useState<Phase>('intro');
  const [result, setResult] = useState<{ r: ActivityResult; out: RewardOutcome } | null>(null);
  const [seed, setSeed] = useState(randomSeed());
  const review = useRef<ReviewItem[]>([]);
  const location = useScene((s) => s.location);
  const interior = useScene((s) => s.interior);

  const finished = useRef(false);
  const onFinish = useCallback(
    (r: ActivityResult) => {
      if (finished.current || !def) return;
      finished.current = true;
      let out: RewardOutcome | null = null;
      act((d, fx) => {
        out = finishActivity(d, fx, def, r);
      });
      playSfx(starsFor(def, r.score) >= 2 ? 'levelup' : 'star');
      setResult({ r, out: out! });
      setPhase('done');
      useUI.getState().setRun(null);
    },
    [def],
  );

  // Coming back to a paused run: bring the activity music back
  const wasHidden = useRef(hidden);
  useEffect(() => {
    if (wasHidden.current && !hidden && phase === 'play') playMusic('activity');
    wasHidden.current = hidden;
  }, [hidden, phase]);

  const leave = () => {
    playMusic(interior ? 'interior' : CITIES[location].music);
    if (phase === 'play' && def) {
      // Keep the run alive; the HUD offers to resume it
      useUI.getState().pushToast({ text: `${def.name} paused. Resume it any time.`, icon: '⏸', tone: 'info' });
    } else setRun(null);
    close();
  };

  if (!def) {
    return (
      <Modal onClose={close} title="Coming soon">
        <p>This activity ({id}) is being built.</p>
      </Modal>
    );
  }
  const params = (w.difficulty === 'entry' ? def.entry : def.advanced) ?? def.entry ?? def.advanced ?? {};
  const kind = (params.kind as string) ?? def.kind;
  const Kind = KINDS[kind];
  const st = w.progress.activities[def.id];
  const entry = w.difficulty === 'entry';
  const blurb = entry && def.entryBlurb ? def.entryBlurb : def.blurb;
  const rf = repeatFactor(w, def.id);
  // A lesson on this activity's topic, preferring one the player hasn't finished
  const lessonFor = LESSONS.filter((l) => def.topics.includes(l.topic as never)).sort((a, b) => Number(w.progress.lessons.includes(a.id)) - Number(w.progress.lessons.includes(b.id)))[0];

  const start = () => {
    if (def.fee) {
      let ok = false;
      act((d, fx) => {
        ok = spend(d, fx, def.fee!, `${def.name} (arcade)`);
      });
      if (!ok) return;
      playSfx('coin');
    }
    review.current = [];
    finished.current = false;
    setSeed(randomSeed());
    setPhase('play');
    setRun({ id: def.id, name: def.name });
    playMusic('activity');
  };


  return (
    <Modal
      hidden={hidden}
      onClose={leave}
      title={`${def.icon} ${def.name}`}
      subtitle={def.topics.map((t) => TOPIC_INFO[t]?.name).filter(Boolean).join(' · ')}
      size="full"
      accent={entry ? 'navy' : 'terminal'}
      className={entry ? 'entry-mode activity-modal' : 'activity-modal adv'}
    >
      {phase === 'intro' && (
        <div className="activity-intro">
          <div className="ai-hero">
            <div className="ai-art">
              <span>{def.icon}</span>
            </div>
            <div className="col grow" style={{ gap: 10, minWidth: 260 }}>
              <div className="row wrap" style={{ gap: 6 }}>
                <span className={`chip ${entry ? 'teal' : 'navy'}`}>{entry ? 'Entry' : 'Advanced'}</span>
                {def.topics.map((t) => (
                  <span key={t} className="chip">
                    {TOPIC_INFO[t]?.icon} {TOPIC_INFO[t]?.name}
                  </span>
                ))}
              </div>
              <p className="ai-blurb">
                {blurb} <ReadAloud text={blurb} />
              </p>
              <div className="row" style={{ gap: 10, alignItems: 'center' }}>
                <div className="dialog-portrait" style={{ width: 54, height: 54 }}>
                  <NarwhalPortrait mood="talking" size={50} />
                </div>
                <span className="small muted">{entry ? 'Take your time. I will explain every answer!' : 'Every answer comes with the reasoning, so you learn as you play.'}</span>
              </div>
            </div>
          </div>
          <div className="ai-stats">
            <div className="ai-stat">
              <span className="ai-stat-label">Your best</span>
              <span className="ai-stat-value">
                <Stars n={st?.stars ?? 0} /> {st ? `${Math.round(st.best)}%` : 'Not played'}
              </span>
            </div>
            <div className="ai-stat">
              <span className="ai-stat-label">{def.tickets ? 'Costs' : 'Reward up to'}</span>
              <span className="ai-stat-value">
                {def.tickets ? (
                  <FinBucks value={def.fee ?? 1} />
                ) : (
                  <FinBucks value={def.rewards.cash[2] * (w.difficulty === 'advanced' ? 1.25 : 1) * rf * w.market.priceIndex} cents={false} />
                )}
              </span>
              {rf < 1 && <span className="tiny muted">Reduced for repeat plays today</span>}
            </div>
            <div className="ai-stat">
              <span className="ai-stat-label">{def.tickets ? 'Wins up to' : 'Experience'}</span>
              <span className="ai-stat-value">{def.tickets ? `🎟️ ${def.tickets[2]}` : `+${def.rewards.xp[2]} XP`}</span>
            </div>
          </div>
          <div className="row wrap" style={{ justifyContent: 'center', marginTop: 18, gap: 12 }}>
            {lessonFor && (
              <Button size="big" onClick={() => useUI.getState().open({ type: 'learn', lesson: lessonFor.id })}>
                📖 Brush up: {lessonFor.title}
              </Button>
            )}
            <Button variant="gold" size="huge" onClick={start}>
              ▶ {st ? 'Play again' : 'Start'}
            </Button>
          </div>
        </div>
      )}
      {phase === 'play' && Kind && (
        <ActivityBoundary onClose={() => (setRun(null), close())}>
          <Suspense fallback={<p>Loading…</p>}>
            <ActivityPaused.Provider value={hidden}>
              <div className="activity-play">
                <Kind key={seed} def={def} params={params} difficulty={w.difficulty} onFinish={onFinish} addReview={(r) => review.current.push(r)} seed={seed} />
              </div>
            </ActivityPaused.Provider>
          </Suspense>
        </ActivityBoundary>
      )}
      {phase === 'play' && !Kind && <p>Unknown activity type: {kind}</p>}
      {phase === 'done' && result && <Results def={def} result={result} review={review.current} onAgain={start} onLeave={leave} />}
    </Modal>
  );
}

function ScoreRing({ score, stars }: { score: number; stars: number }) {
  return <PixelMeter pct={score} label="score" tone={stars >= 3 ? 'green' : stars >= 2 ? 'teal' : stars >= 1 ? 'gold' : 'red'} />;
}

function Results({ def, result, review, onAgain, onLeave }: { def: { name: string; tickets?: number[]; topics: string[] }; result: { r: ActivityResult; out: RewardOutcome }; review: ReviewItem[]; onAgain: () => void; onLeave: () => void }) {
  const { r, out } = result;
  const w = useGame((s) => s.world!);
  const entry = w.difficulty === 'entry';
  const mood = out.stars >= 3 ? 'hyped' : out.stars >= 2 ? 'confident' : out.stars === 1 ? 'talking' : 'disappointed';
  const msg = useMemo(() => {
    if (out.stars >= 3) return entry ? 'WOW! Three stars! You are a money genius!' : 'Three stars, outstanding work!';
    if (out.stars === 2) return entry ? 'Great job! Try again for 3 stars!' : 'Solid! Review the explanations below to go for 3 stars.';
    if (out.stars === 1) return entry ? 'Good try! Every try makes you smarter.' : "You got the basics. Check what went wrong and try again, mistakes are how we learn.";
    return entry ? "That was tricky! Let's look at the answers together and try again." : 'Tough one. Read the explanations, then give it another shot!';
  }, [out.stars, entry]);
  const wrong = review.filter((x) => !x.ok);
  // Point to the lesson that covers what was missed
  const lesson = wrong.length ? LESSONS.find((l) => def.topics.includes(l.topic)) : undefined;
  return (
    <div className="activity-results">
      <div className="ar-hero">
        <ScoreRing score={r.score} stars={out.stars} />
        <div className="col grow" style={{ gap: 8, minWidth: 240 }}>
          <Stars n={out.stars} size="2.2rem" />
          <b className="ar-msg">
            {msg} <ReadAloud text={msg} />
          </b>
          <div className="row wrap" style={{ gap: 8 }}>
            {r.total !== undefined && (
              <span className="chip">
                {r.correct}/{r.total} correct
              </span>
            )}
            {out.newBest && <span className="chip gold">🏆 New best</span>}
            {r.earned !== undefined && r.earned !== 0 && <span className={`chip ${r.earned > 0 ? 'good' : 'bad'}`}>Earned {money(r.earned, { sign: true })}</span>}
          </div>
          {r.summary && <p className="small" style={{ margin: 0 }}>{r.summary}</p>}
        </div>
        <div className="dialog-portrait" style={{ width: 96, height: 96 }}>
          <NarwhalPortrait mood={mood} size={90} />
        </div>
      </div>
      <div className="ar-rewards">
        <div className="ar-reward">
          <span className="ai-stat-label">FinBucks</span>
          <FinBucks value={out.cash} sign />
        </div>
        <div className="ar-reward">
          <span className="ai-stat-label">Experience</span>
          <b>+{out.xp} XP</b>
        </div>
        {out.tickets > 0 && (
          <div className="ar-reward">
            <span className="ai-stat-label">Tickets</span>
            <b>🎟️ +{out.tickets}</b>
          </div>
        )}
      </div>
      {lesson && (
        <div className="card tint-blue row wrap" style={{ gap: 10, marginTop: 12 }}>
          <span style={{ fontSize: '1.6rem' }}>{lesson.icon}</span>
          <div className="col grow" style={{ gap: 2 }}>
            <b>Learn it properly: {lesson.title}</b>
            <span className="small muted">A two-minute lesson on what came up here. Finish it for XP and a perk.</span>
          </div>
          <Button variant="primary" onClick={() => useUI.getState().open({ type: 'learn', lesson: lesson.id })}>
            📖 Open lesson
          </Button>
        </div>
      )}
      {review.length > 0 && (
        <div className="col" style={{ gap: 8, marginTop: 14 }}>
          <b>{wrong.length ? `Review: ${wrong.length} to learn from` : 'Review: all correct!'}</b>
          {[...wrong, ...review.filter((x) => x.ok)].slice(0, 12).map((it, i) => (
            <details key={i} className={`review-item ${it.ok ? 'ok' : 'no'}`} open={!it.ok && i < 3}>
              <summary>
                <span className="review-mark">{it.ok ? '✓' : '!'}</span>
                <span className="grow">{it.q}</span>
              </summary>
              <div className="review-body">
                <div>
                  Answer: <b>{it.answer}</b>
                </div>
                <div className="muted">{it.explanation}</div>
              </div>
            </details>
          ))}
        </div>
      )}
      <div className="row" style={{ justifyContent: 'center', gap: 12, marginTop: 18 }}>
        <Button size="big" onClick={onLeave}>
          Done
        </Button>
        <Button size="big" variant="gold" onClick={onAgain}>
          ↺ Play again{def.tickets ? ' ($1)' : ''}
        </Button>
      </div>
    </div>
  );
}
