'use client';
/**
 * Asks each world once whether to share its score on the online leaderboard, with what that
 * means. It comes up right after the player's first odd job in the tutorial (or after a few
 * minutes of play for anyone who skips it), at the first calm moment. Nothing is sent until the player says yes.
 * Closing it without answering asks again next session; the answer can be changed any time in
 * the FinPhone Leaderboard app.
 */
import { useEffect } from 'react';
import { useUI } from '@/store/ui';
import { useGame } from '@/store/game';
import { playSfx } from '@/engine/audio';
import { Button, Modal } from '../common';
import { narwhalFace } from '../narwhalArt';
import { nicknameProblem } from '@/game/leaderboard';
import { LEADERBOARD_URL, setScoreShared } from '../leaderboard';
import type { WorldState } from '@/game/types';
import { QUESTS } from '@/game/progress/quests';

/** The tutorial quest, and its odd-jobs step: right after the first paycheck is when we ask. */
export const TUTORIAL_QUEST = 'q1-welcome';
const ODD_JOB_STEP = Math.max(0, QUESTS.find((q) => q.id === TUTORIAL_QUEST)?.steps.findIndex((st) => st.id === 'odd-job') ?? 0);

/** True once the tutorial's odd job is done (or the whole tutorial is). */
export function didFirstOddJob(w: WorldState): boolean {
  if (w.progress.quests.completed.includes(TUTORIAL_QUEST)) return true;
  const q = w.progress.quests.active.find((a) => a.id === TUTORIAL_QUEST);
  return !!q && q.step > ODD_JOB_STEP;
}
/** Seconds of play before asking someone who hasn't finished the tutorial. */
const ASK_AFTER = 300;
/** Seconds of calm (nothing else on screen) before the card appears. */
const SETTLE = 2;

/** Worlds already asked this browser session. */
const asked = new Set<string>();

/** True while this world still has the leaderboard question coming, so other cards can wait for it. */
export function leaderboardAskPending(w: WorldState): boolean {
  return !!LEADERBOARD_URL && !asked.has(w.id) && w.progress.flags.leaderboardShare === undefined && !nicknameProblem(w.nickname) && didFirstOddJob(w);
}

/** What sharing means, shown wherever a player makes the choice. */
export function ShareDisclaimer() {
  return (
    <p className="small" style={{ margin: 0 }}>
      If you share, your nickname, level and net worth appear on a public leaderboard that anyone playing Fin City can see, and they update by themselves as you play. Nothing else is shared. Never use
      your real name as a nickname. If you&apos;re under 13, ask a parent or guardian first. You can change your mind any time in the FinPhone Leaderboard app.
    </p>
  );
}

export function LeaderboardPrompt() {
  const show = useUI((s) => s.leaderboardAsk);

  useEffect(() => {
    if (!LEADERBOARD_URL) return;
    let played = 0;
    let calm = 0;
    let last = performance.now();
    const id = setInterval(() => {
      const now = performance.now();
      const dt = Math.min(5, (now - last) / 1000);
      last = now;
      const ui = useUI.getState();
      const w = useGame.getState().world;
      if (!w || ui.leaderboardAsk || asked.has(w.id) || w.progress.flags.leaderboardShare !== undefined || nicknameProblem(w.nickname)) return;
      if (!LEADERBOARD_URL) return;
      if (ui.screen !== 'game' || ui.loading.active || document.visibilityState !== 'visible') {
        calm = 0;
        return;
      }
      played += dt;
      const ready = didFirstOddJob(w) || played >= ASK_AFTER;
      // Wait for a calm moment: no menu, tour, activity, Narwhal speech, furniture moving or other card
      const busy = ui.panel || ui.tour || ui.run || ui.decor || ui.narwhal.length || ui.worldActivity || ui.streakShow || ui.streakCal || ui.rating || ui.costSummary;
      if (!ready || busy) {
        calm = 0;
        return;
      }
      if ((calm += dt) < SETTLE) return;
      asked.add(w.id);
      playSfx('pop');
      useUI.setState({ leaderboardAsk: true });
    }, 1000);
    return () => clearInterval(id);
  }, []);

  if (!show) return null;
  const close = () => useUI.setState({ leaderboardAsk: false });
  const answer = (share: boolean) => {
    setScoreShared(share);
    close();
  };
  return (
    <Modal title="Join the leaderboard?" accent="gold" onClose={close} className="rating-prompt">
      <div className="rating-body">
        <img src={narwhalFace('talking')} alt="" className="rating-face" />
        <p>Want to share your score with other players?</p>
        <ShareDisclaimer />
        <div className="rating-actions">
          <Button variant="gold" size="big" onClick={() => answer(true)}>
            Yes, share my score
          </Button>
          <Button onClick={() => answer(false)}>No thanks</Button>
        </div>
      </div>
    </Modal>
  );
}
