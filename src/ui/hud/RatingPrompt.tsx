'use client';
/**
 * "Having fun?" pop-up: after two minutes of play it asks the player to rate and review Fin City
 * in the team's feedback form. The form only opens if the player clicks the button (in a new tab);
 * the game itself sends nothing. Answers are remembered on this device: after "Rate" or "No
 * thanks" it never asks again, and "Maybe later" asks once more in a later session.
 */
import { useEffect, useRef, useState } from 'react';
import { useUI } from '@/store/ui';
import { getGlobal, setGlobal } from '@/save/db';
import { playSfx } from '@/engine/audio';
import { Button, Modal } from '../common';
import { narwhalFace } from '../narwhalArt';

/** The team's feedback form (public view link). */
export const FEEDBACK_FORM = 'https://docs.google.com/forms/d/18FCl_1KyjWwtKg5XQeHWkxbRzoILM13iYH2iRw3qlBM/viewform';

/** Seconds of actual play before the pop-up appears. */
const ASK_AFTER = 120;

type Answer = 'rated' | 'never' | 'later';

/** Asked already this browser session (a "Maybe later" waits for the next visit). */
let askedThisSession = false;

export function RatingPrompt() {
  const [show, setShow] = useState(false);
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
      if (askedThisSession || answer.current === undefined || answer.current === 'rated' || answer.current === 'never') return;
      // Only count time actually playing: not loading, not in another tab
      if (ui.screen !== 'game' || ui.loading.active || document.visibilityState !== 'visible') return;
      played += dt;
      // Wait for a calm moment: no menu, tour, activity, Narwhal speech or furniture moving
      if (played < ASK_AFTER || ui.panel || ui.tour || ui.run || ui.decor || ui.narwhal.length || ui.worldActivity) return;
      askedThisSession = true;
      playSfx('pop');
      setShow(true);
    }, 1000);
    return () => clearInterval(id);
  }, []);

  if (!show) return null;
  const done = (a: Answer) => {
    answer.current = a;
    setGlobal('ratingPrompt', a).catch(() => {});
    setShow(false);
  };
  return (
    <Modal title="Having fun?" accent="gold" onClose={() => done('later')} className="rating-prompt">
      <div className="rating-body">
        <img src={narwhalFace('hyped')} alt="" className="rating-face" />
        <div className="rating-stars" aria-hidden>
          ⭐⭐⭐⭐⭐
        </div>
        <p>If you&apos;re having fun in Fin City, please give us a rating and review! It only takes a minute and helps us make the game even better.</p>
        <div className="rating-actions">
          <a className="btn gold big" href={FEEDBACK_FORM} target="_blank" rel="noopener noreferrer" onClick={() => done('rated')}>
            Rate Fin City
          </a>
          <Button onClick={() => done('later')}>Maybe later</Button>
          <Button variant="ghost" onClick={() => done('never')}>
            No thanks
          </Button>
        </div>
        <span className="tiny muted">The form opens in a new tab, and the game stays right here.</span>
      </div>
    </Modal>
  );
}
