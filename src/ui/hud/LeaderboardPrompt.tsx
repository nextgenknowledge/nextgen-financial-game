'use client';
/**
 * Asks each world once whether to share its score on the online leaderboard, with what that
 * means. Nothing is sent until the player says yes. Closing it without answering asks again next
 * session; the answer can be changed any time in the FinPhone Leaderboard app.
 */
import { useEffect } from 'react';
import { useUI } from '@/store/ui';
import { useGame } from '@/store/game';
import { playSfx } from '@/engine/audio';
import { Button, Modal } from '../common';
import { narwhalFace } from '../narwhalArt';
import { nicknameProblem } from '@/game/leaderboard';
import { LEADERBOARD_URL, setScoreShared } from '../leaderboard';

/** Seconds of actual play before asking, so a new player gets to look around first. */
const ASK_AFTER = 300;

/** Worlds already asked this browser session. */
const asked = new Set<string>();

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
    let last = performance.now();
    const id = setInterval(() => {
      const now = performance.now();
      const dt = Math.min(5, (now - last) / 1000);
      last = now;
      const ui = useUI.getState();
      const w = useGame.getState().world;
      if (!w || ui.leaderboardAsk || asked.has(w.id) || w.progress.flags.leaderboardShare !== undefined || nicknameProblem(w.nickname)) return;
      if (ui.screen !== 'game' || ui.loading.active || document.visibilityState !== 'visible') return;
      played += dt;
      // Wait for a calm moment: no menu, tour, activity, Narwhal speech, furniture moving or rating card
      if (played < ASK_AFTER || ui.panel || ui.tour || ui.run || ui.decor || ui.narwhal.length || ui.worldActivity || ui.streakShow || ui.streakCal || ui.rating) return;
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
