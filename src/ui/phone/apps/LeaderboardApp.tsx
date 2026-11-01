'use client';
/**
 * Leaderboard: the richest Fin City players, read from the team's Google Sheet. Posting is
 * opt-in (Post my score) and sends only the nickname, level, net worth and Entry/Advanced.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useGame, act } from '@/store/game';
import { Section, Tabs, Empty } from '../../kit';
import { Button } from '../../common';
import { money } from '../../format';
import { nicknameProblem, scoreEntry, type BoardRow } from '@/game/leaderboard';
import { fetchBoard, LEADERBOARD_URL, postScore } from '../../leaderboard';
import type { Difficulty } from '@/game/types';

type Load = { state: 'loading' } | { state: 'ok'; rows: BoardRow[] } | { state: 'error' };

export function LeaderboardApp() {
  const w = useGame((s) => s.world!);
  const [tab, setTab] = useState<Difficulty>(w.difficulty);
  const [load, setLoad] = useState<Load>({ state: 'loading' });
  const [posting, setPosting] = useState(false);
  const mine = useMemo(() => scoreEntry(w), [w]);
  const problem = nicknameProblem(w.nickname);
  const posted = !!w.progress.flags.leaderboardPosted;

  const refresh = useCallback(() => {
    if (!LEADERBOARD_URL) return;
    setLoad({ state: 'loading' });
    fetchBoard(tab)
      .then((rows) => setLoad({ state: 'ok', rows }))
      .catch(() => setLoad({ state: 'error' }));
  }, [tab]);
  useEffect(refresh, [refresh]);

  if (!LEADERBOARD_URL)
    return (
      <Section title="Leaderboard">
        <Empty icon="🏆">The Fin City leaderboard is coming soon. Keep growing your net worth!</Empty>
      </Section>
    );

  const post = async () => {
    setPosting(true);
    try {
      await postScore(mine);
      act((d) => void (d.progress.flags.leaderboardPosted = true));
      // The sheet takes a moment to save before it shows up
      setTimeout(() => {
        setPosting(false);
        refresh();
      }, 2500);
    } catch {
      setPosting(false);
      setLoad({ state: 'error' });
    }
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
        <Section title={posted ? 'Update your score' : 'Join the leaderboard'}>
          <p className="small" style={{ marginTop: 0 }}>
            <b>{mine.nickname}</b> · Lv {mine.level} · {money(mine.netWorth, { cents: false })}
            {myRow && <> · now <b>#{myRow.rank}</b></>}
          </p>
          {problem ? (
            <p className="small">{problem} Start a new game with a different nickname to join the leaderboard.</p>
          ) : (
            <>
              <Button variant="gold" onClick={post} disabled={posting}>
                {posting ? 'Posting...' : posted ? 'Update my score' : 'Post my score'}
              </Button>
              <p className="tiny muted">Only your nickname, level and net worth are shared. Never use your real name as a nickname.</p>
            </>
          )}
        </Section>
      )}
    </div>
  );
}
