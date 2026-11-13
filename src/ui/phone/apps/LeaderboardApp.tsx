'use client';
/**
 * Leaderboard: the richest Fin City players, read from the team's Google Sheet. Every world shares
 * its nickname, level and net worth by itself as it plays; players can turn that off here.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useGame } from '@/store/game';
import { Section, Tabs, Empty } from '../../kit';
import { Button } from '../../common';
import { money } from '../../format';
import { BOARD_SIZE, nicknameProblem, scoreEntry, type BoardRow } from '@/game/leaderboard';
import { fetchBoard, LEADERBOARD_URL, sendScore, setScoreShared } from '../../leaderboard';
import type { Difficulty } from '@/game/types';

type Load = { state: 'loading' } | { state: 'ok'; rows: BoardRow[] } | { state: 'error' };

export function LeaderboardApp() {
  const w = useGame((s) => s.world!);
  const [tab, setTab] = useState<Difficulty>(w.difficulty);
  const [load, setLoad] = useState<Load>({ state: 'loading' });
  const mine = useMemo(() => scoreEntry(w), [w]);
  // Checks the name as posted: scoreEntry shortens long nicknames (the game allows 20) to fit the board
  const problem = nicknameProblem(mine.nickname);
  const share = w.progress.flags.leaderboardShare !== false;

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
      <Section title={`Top ${BOARD_SIZE} players by net worth`} right={<Button size="small" onClick={refresh}>Refresh</Button>}>
        <p className="small muted" style={{ marginTop: 0 }}>The leaderboard only shows the top {BOARD_SIZE} players for Entry and for Advanced.</p>
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
            {!myRow && share && load.state === 'ok' && <> · not in the top {BOARD_SIZE} yet</>}
          </p>
          {problem ? (
            <p className="small">{problem} Start a new game with a different nickname to join the leaderboard.</p>
          ) : share ? (
            <>
              <p className="small">You&apos;re on the leaderboard as <b>{mine.nickname}</b>. Your level and net worth update by themselves as you play. Nothing else is shared.</p>
              <Button size="small" onClick={() => choose(false)}>
                Take me off the leaderboard
              </Button>
            </>
          ) : (
            <>
              <p className="small">You&apos;re not on the leaderboard. Join to show your nickname, level and net worth to other players.</p>
              <Button variant="gold" size="small" onClick={() => choose(true)}>
                Put me on the leaderboard
              </Button>
            </>
          )}
        </Section>
      )}
    </div>
  );
}
