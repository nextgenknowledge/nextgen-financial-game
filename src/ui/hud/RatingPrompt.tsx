'use client';
/**
 * "Having fun?" rating and review, done inside the game: tap 1 to 5 stars, optionally write a
 * review, and Submit sends it into the team's Google Form in the background (see
 * src/game/feedback.ts and docs/FEEDBACK-FORM.md). It pops up after two minutes of play and
 * opens any time from Pause > Rate & review. Nothing is sent unless the player taps Submit.
 * Answers are remembered on this device: after Submit or No thanks it never pops up again, and
 * Maybe later asks once more in a later session.
 */
import { useEffect, useRef, useState } from 'react';
import { useUI } from '@/store/ui';
import { useGame } from '@/store/game';
import { getGlobal, setGlobal } from '@/save/db';
import { playSfx } from '@/engine/audio';
import { Button, Modal } from '../common';
import { narwhalFace } from '../narwhalArt';
import config from '@/data/feedbackForm.json';
import { feedbackBody, parsePrefilledLink } from '@/game/feedback';

/** The team's feedback form (public view link), used if the in-game form isn't set up yet. */
export const FEEDBACK_FORM = 'https://docs.google.com/forms/d/18FCl_1KyjWwtKg5XQeHWkxbRzoILM13iYH2iRw3qlBM/viewform';
const FORM = parsePrefilledLink(config.prefilledLink);

/** Seconds of actual play before the pop-up appears. */
const ASK_AFTER = 120;

type Answer = 'rated' | 'never' | 'later';

/** Asked already this browser session (a "Maybe later" waits for the next visit). */
let askedThisSession = false;

export function openRating() {
  useUI.setState({ rating: true });
}

export function RatingPrompt() {
  const show = useUI((s) => s.rating);
  const answer = useRef<Answer | null | undefined>(undefined);

  useEffect(() => {
    getGlobal<Answer>('ratingPrompt')
      .then((a) => (answer.current = a ?? null))
      .catch(() => (answer.current = null));
    let played = 0;
    let last = performance.now();
    const id = setInterval(() => {
      // Real elapsed time (a busy slow device fires fewer ticks), capped so a sleeping laptop doesn't count
      const now = performance.now();
      const dt = Math.min(5, (now - last) / 1000);
      last = now;
      const ui = useUI.getState();
      if (ui.rating || askedThisSession || answer.current === undefined || answer.current === 'rated' || answer.current === 'never') return;
      // Only count time actually playing: not loading, not in another tab
      if (ui.screen !== 'game' || ui.loading.active || document.visibilityState !== 'visible') return;
      played += dt;
      // Wait for a calm moment: no menu, tour, activity, Narwhal speech or furniture moving
      if (played < ASK_AFTER || ui.panel || ui.tour || ui.run || ui.decor || ui.narwhal.length || ui.worldActivity) return;
      askedThisSession = true;
      playSfx('pop');
      openRating();
    }, 1000);
    return () => clearInterval(id);
  }, []);

  if (!show) return null;
  const done = (a: Answer) => {
    askedThisSession = true;
    if (answer.current !== 'rated' || a === 'rated') {
      answer.current = a;
      setGlobal('ratingPrompt', a).catch(() => {});
    }
    useUI.setState({ rating: false });
  };
  return <RatingForm onDone={done} />;
}

function RatingForm({ onDone }: { onDone: (a: Answer) => void }) {
  const [stars, setStars] = useState(0);
  const [hover, setHover] = useState(0);
  const [review, setReview] = useState('');
  const [state, setState] = useState<'edit' | 'sending' | 'sent' | 'error'>('edit');
  const world = useGame((s) => s.world);

  const submit = async () => {
    if (!stars) return;
    if (!FORM) {
      // Not set up yet: fall back to the form itself in a new tab
      window.open(FEEDBACK_FORM, '_blank', 'noopener');
      onDone('rated');
      return;
    }
    setState('sending');
    try {
      // Google Forms doesn't let a page read its reply, so this is a fire-and-forget post
      await fetch(FORM.action, { method: 'POST', mode: 'no-cors', body: feedbackBody(FORM, { stars, review, nickname: world?.nickname ?? '', mode: world?.difficulty ?? '' }) });
      playSfx('coin');
      setState('sent');
      setTimeout(() => onDone('rated'), 2200);
    } catch {
      setState('error');
    }
  };

  const shown = hover || stars;
  return (
    <Modal title="Having fun?" accent="gold" onClose={() => onDone('later')} className="rating-prompt">
      <div className="rating-body">
        <img src={narwhalFace(state === 'sent' ? 'hyped' : 'talking')} alt="" className="rating-face" />
        {state === 'sent' ? (
          <p>Thank you for your rating! It helps us make Fin City even better.</p>
        ) : (
          <>
            <p>If you&apos;re having fun in Fin City, please give us a rating and review!</p>
            <div className="rating-stars" role="radiogroup" aria-label="Your rating" onMouseLeave={() => setHover(0)}>
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  role="radio"
                  aria-checked={stars === n}
                  aria-label={`${n} star${n > 1 ? 's' : ''}`}
                  className={n <= shown ? 'rating-star on' : 'rating-star'}
                  onMouseEnter={() => setHover(n)}
                  onClick={() => {
                    playSfx('click');
                    setStars(n);
                  }}
                >
                  ⭐
                </button>
              ))}
            </div>
            <span className="tiny muted">{stars ? ['', 'Not for me', 'It was okay', 'Pretty good', 'Really fun', 'I love it!'][stars] : 'Tap a star'}</span>
            <label className="rating-review">
              <span className="small">Your review (optional)</span>
              <textarea className="input" rows={3} maxLength={500} value={review} onChange={(e) => setReview(e.target.value)} placeholder="What did you like? What could be better?" />
            </label>
            {state === 'error' && <span className="small">Couldn&apos;t send it. Check your connection and try again.</span>}
            <div className="rating-actions">
              <Button variant="gold" size="big" disabled={!stars || state === 'sending'} onClick={submit}>
                {state === 'sending' ? 'Sending...' : 'Submit'}
              </Button>
              <Button onClick={() => onDone('later')}>Maybe later</Button>
              <Button variant="ghost" onClick={() => onDone('never')}>
                No thanks
              </Button>
            </div>
            <span className="tiny muted">Please don&apos;t write your real name. Your nickname is sent with your rating.</span>
          </>
        )}
      </div>
    </Modal>
  );
}
