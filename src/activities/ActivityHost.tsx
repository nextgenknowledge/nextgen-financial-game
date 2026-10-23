'use client';
import { Component, Suspense, useCallback, useMemo, useRef, useState, type ReactNode } from 'react';
import { useUI } from '@/store/ui';
import { useGame, act } from '@/store/game';
import { Button, Modal, ReadAloud, Stars } from '@/ui/common';
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

export function ActivityHost({ id }: { id: string }) {
  const close = useUI((s) => s.close);
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
    },
    [def],
  );

  const leave = () => {
    playMusic(interior ? 'interior' : CITIES[location].music);
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
    playMusic('activity');
  };


  return (
    <Modal onClose={leave} title={`${def.icon} ${def.name}`} size="full" className={entry ? 'entry-mode activity-modal' : 'activity-modal'}>
      {phase === 'intro' && (
        <div className="activity-intro">
          <div className="row" style={{ gap: 16, alignItems: 'flex-start', flexWrap: 'wrap' }}>
            <div className="dialog-portrait" style={{ width: 110, height: 110 }}>
              <NarwhalPortrait mood="talking" size={104} />
            </div>
            <div className="col grow" style={{ minWidth: 240 }}>
              <p style={{ fontSize: entry ? '1.35rem' : '1.15rem', fontWeight: 800, margin: 0 }}>
                {blurb} <ReadAloud text={blurb} />
              </p>
              <div className="row wrap" style={{ gap: 6 }}>
                {def.topics.map((t) => (
                  <span key={t} className="chip">
                    {TOPIC_INFO[t]?.icon} {TOPIC_INFO[t]?.name}
                  </span>
                ))}
                <span className={`chip ${entry ? 'teal' : 'navy'}`}>{entry ? 'Entry' : 'Advanced'}</span>
              </div>
              <div className="row wrap" style={{ gap: 14 }}>
                <span>
                  Best: <Stars n={st?.stars ?? 0} /> {st ? `(${Math.round(st.best)}%)` : ''}
                </span>
                {def.tickets ? (
                  <span className="small">
                    Costs <b>{money(def.fee ?? 1)}</b> · wins up to 🎟️ {def.tickets[2]}
                  </span>
                ) : (
                  <span className="small">
                    Rewards up to <b>{money(def.rewards.cash[2] * (w.difficulty === 'advanced' ? 1.25 : 1) * rf * w.market.priceIndex, { cents: false })}</b> + {def.rewards.xp[2]} XP
                    {rf < 1 && <span className="muted"> (reduced for repeat plays today)</span>}
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="row" style={{ justifyContent: 'center', marginTop: 24 }}>
            <Button variant="gold" size="huge" onClick={start}>
              ▶ {st ? 'Play again' : 'Start'}
            </Button>
          </div>
        </div>
      )}
      {phase === 'play' && Kind && (
        <ActivityBoundary onClose={leave}>
          <Suspense fallback={<p>Loading…</p>}>
            <div className="activity-play">
              <Kind key={seed} def={def} params={params} difficulty={w.difficulty} onFinish={onFinish} addReview={(r) => review.current.push(r)} seed={seed} />
            </div>
          </Suspense>
        </ActivityBoundary>
      )}
      {phase === 'play' && !Kind && <p>Unknown activity type: {kind}</p>}
      {phase === 'done' && result && <Results def={def} result={result} review={review.current} onAgain={start} onLeave={leave} />}
    </Modal>
  );
}

function Results({ def, result, review, onAgain, onLeave }: { def: { name: string; tickets?: number[] }; result: { r: ActivityResult; out: RewardOutcome }; review: ReviewItem[]; onAgain: () => void; onLeave: () => void }) {
  const { r, out } = result;
  const entry = useGame((s) => s.world!.difficulty === 'entry');
  const mood = out.stars >= 3 ? 'hyped' : out.stars >= 2 ? 'confident' : out.stars === 1 ? 'talking' : 'disappointed';
  const msg = useMemo(() => {
    if (out.stars >= 3) return entry ? 'WOW! Three stars! You are a money genius!' : 'Three stars, outstanding work!';
    if (out.stars === 2) return entry ? 'Great job! Try again for 3 stars!' : 'Solid! Review the explanations below to go for 3 stars.';
    if (out.stars === 1) return entry ? 'Good try! Every try makes you smarter.' : "You got the basics. Check what went wrong and try again, mistakes are how we learn.";
    return entry ? "That was tricky! Let's look at the answers together and try again." : 'Tough one. Read the explanations, then give it another shot!';
  }, [out.stars, entry]);
  const wrong = review.filter((x) => !x.ok);
  return (
    <div className="activity-results">
      <div className="row" style={{ gap: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <div className="dialog-portrait" style={{ width: 110, height: 110 }}>
          <NarwhalPortrait mood={mood} size={104} />
        </div>
        <div className="col grow">
          <Stars n={out.stars} size="2.6rem" />
          <b style={{ fontSize: '1.3rem' }}>
            {msg} <ReadAloud text={msg} />
          </b>
          <div className="row wrap" style={{ gap: 8 }}>
            <span className="chip">Score {Math.round(r.score)}%</span>
            {r.total !== undefined && (
              <span className="chip">
                {r.correct}/{r.total} correct
              </span>
            )}
            {out.newBest && <span className="chip gold">🏆 New best!</span>}
            {r.earned !== undefined && r.earned !== 0 && <span className={`chip ${r.earned > 0 ? 'good' : 'bad'}`}>Earned {money(r.earned, { sign: true })}</span>}
            {out.cash > 0 && <span className="chip good">+{money(out.cash)} reward</span>}
            {out.tickets > 0 && <span className="chip gold">+🎟️ {out.tickets}</span>}
            <span className="chip teal">+{out.xp} XP</span>
          </div>
          {r.summary && <p className="small" style={{ margin: '6px 0 0' }}>{r.summary}</p>}
        </div>
      </div>
      {review.length > 0 && (
        <div className="col" style={{ gap: 8, marginTop: 14 }}>
          <b>{wrong.length ? `Let's review (${wrong.length} to learn from)` : 'Review: all correct!'}</b>
          {[...wrong, ...review.filter((x) => x.ok)].slice(0, 12).map((it, i) => (
            <div key={i} className={`card ${it.ok ? 'tint-green' : 'tint-red'} small`}>
              <div className="bold">
                {it.ok ? '✅' : '💡'} {it.q}
              </div>
              <div>
                Answer: <b>{it.answer}</b>
              </div>
              <div className="muted">{it.explanation}</div>
            </div>
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
