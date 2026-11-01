'use client';
/**
 * Leaderboard: the richest Fin City players, read from the team's Google Sheet. Players choose
 * whether to share (here or in the pop-up); after a yes their score updates by itself as they play.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useGame } from '@/store/game';
import { Section, Tabs, Empty } from '../../kit';
import { Button } from '../../common';
import { money } from '../../format';
import { nicknameProblem, scoreEntry, type BoardRow } from '@/game/leaderboard';
import { fetchBoard, LEADERBOARD_URL, sendScore, setScoreShared } from '../../leaderboard';
import { ShareDisclaimer } from '../../hud/LeaderboardPrompt';
import type { Difficulty } from '@/game/types';

type Load = { state: 'loading' } | { state: 'ok'; rows: BoardRow[] } | { state: 'error' };

export function LeaderboardApp() {
  const w = useGame((s) => s.world!);
  const [tab, setTab] = useState<Difficulty>(w.difficulty);
  const [load, setLoad] = useState<Load>({ state: 'loading' });
  const mine = useMemo(() => scoreEntry(w), [w]);
  // Checks the name as posted: scoreEntry shortens long nicknames (the game allows 20) to fit the board
  const problem = nicknameProblem(mine.nickname);
  const share = w.progress.flags.leaderboardShare;

  const refresh = useCallback(() => {
    if (!LEADERBOARD_URL) return;
    setLoad({ state: 'loading' });
    fetchBoard(tab)
      .then((rows) => setLoad({ state: 'ok', rows }))
      .catch(() => setLoad({ state: 'error' }));
  }, [tab]);
  useEffect(refresh, [refresh]);
  /** The sheet takes a moment to save before a change shows up. */
  const refreshSoon = useCallback(() => setTimeout(refresh, 2500), [refresh]);
  // Opening the app is a good moment to bring your own row up to date
  useEffect(() => {
    if (sendScore(true)) refreshSoon();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!LEADERBOARD_URL)
    return (
      <Section title="Leaderboard">
        <Empty icon="🏆">The Fin City leaderboard is coming soon. Keep growing your net worth!</Empty>
      </Section>
    );

  const choose = (yes: boolean) => {
    setScoreShared(yes);
    refreshSoon();
  };

  const myRow = load.state === 'ok' ? load.rows.find((r) => r.id === w.id) : undefined;
  return (
    <div>
      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { id: 'entry', label: '🌱 Entry' },
          { id: 'advanced', label: '🚀 Advanced' },
        ]}
      />
      <Section title="Top players by net worth" right={<Button size="small" onClick={refresh}>Refresh</Button>}>
        {load.state === 'loading' && <p className="small muted">Loading the leaderboard...</p>}
        {load.state === 'error' && (
          <p className="small">Couldn&apos;t reach the leaderboard. You might be offline, or the school network may block it. Try again later.</p>
        )}
        {load.state === 'ok' && load.rows.length === 0 && <Empty icon="🏆">No scores yet. Be the first!</Empty>}
        {load.state === 'ok' && load.rows.length > 0 && (
          <ol className="lb-list">
            {load.rows.map((r) => (
              <li key={r.id} className={r.id === w.id ? 'lb-row me' : 'lb-row'}>
                <span className={`lb-rank r${Math.min(r.rank, 4)}`}>{r.rank}</span>
                <span className="lb-name">{r.nickname}</span>
                <span className="lb-level">Lv {r.level}</span>
                <span className="lb-nw mono">{money(r.netWorth, { cents: false })}</span>
              </li>
            ))}
          </ol>
        )}
      </Section>
      {tab === w.difficulty && (
        <Section title="Your spot">
          <p className="small" style={{ marginTop: 0 }}>
            <b>{mine.nickname}</b> · Lv {mine.level} · {money(mine.netWorth, { cents: false })}
            {myRow && <> · now <b>#{myRow.rank}</b></>}
          </p>
          {problem ? (
            <p className="small">{problem} Start a new game with a different nickname to join the leaderboard.</p>
          ) : share === true ? (
            <>
              <p className="small">You&apos;re sharing your score. It updates by itself as you play.</p>
              <Button size="small" onClick={() => choose(false)}>
                Stop sharing my score
              </Button>
            </>
          ) : (
            <>
              <p className="small" style={{ marginTop: 0 }}>
                <b>{share === false ? "You're not sharing your score." : 'Want to share your score?'}</b>
              </p>
              <ShareDisclaimer />
              <div className="row wrap" style={{ gap: 8, marginTop: 8 }}>
                <Button variant="gold" onClick={() => choose(true)}>
                  Yes, share my score
                </Button>
                {share === undefined && <Button onClick={() => choose(false)}>No thanks</Button>}
              </div>
            </>
          )}
        </Section>
      )}
    </div>
  );
}
