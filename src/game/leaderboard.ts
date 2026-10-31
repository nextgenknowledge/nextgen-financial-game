/**
 * Leaderboard rules shared by the game and its tests. Scores go to the team's Google Sheet
 * (see docs/LEADERBOARD.md) only when a player taps "Post my score": the nickname, level, net
 * worth and Entry/Advanced, keyed by a random world id so posting again updates the same row.
 * Never real names, world names or answers.
 */
import type { Difficulty, WorldState } from './types';
import { netWorth } from './finance/netWorth';

export interface ScoreEntry {
  /** The world's random id, so a player's row is updated rather than duplicated. */
  id: string;
  nickname: string;
  level: number;
  netWorth: number;
  difficulty: Difficulty;
}

export interface BoardRow extends ScoreEntry {
  rank: number;
}

/*
 * Words a nickname may not contain. Checked after folding look-alike characters (0→o, 1→i,
 * 3→e, 4→a, 5→s, 7→t, @→a, $→s) and dropping spaces, dots and underscores, so "b a d" and
 * "b4d" are caught too. The Google Sheet script runs the same check.
 */
const BLOCKED = [
  'fuck', 'shit', 'bitch', 'cunt', 'dick', 'cock', 'pussy', 'asshole', 'bastard', 'slut', 'whore', 'piss',
  'penis', 'vagina', 'boob', 'tits', 'porn', 'sex', 'nude', 'naked', 'rape', 'nazi', 'hitler', 'kkk',
  'nigg', 'fag', 'retard', 'kys', 'killyourself', 'wank', 'twat', 'prick', 'dildo',
];

function fold(s: string) {
  return s
    .toLowerCase()
    .replace(/0/g, 'o')
    .replace(/1|!|\|/g, 'i')
    .replace(/3/g, 'e')
    .replace(/4|@/g, 'a')
    .replace(/5|\$/g, 's')
    .replace(/7/g, 't')
    .replace(/[^a-z]/g, '');
}

/** Why a nickname can't go on the leaderboard, or null if it's fine. */
export function nicknameProblem(nickname: string): string | null {
  const n = nickname.trim();
  if (n.length < 2) return 'Nicknames need at least 2 characters.';
  if (n.length > 16) return 'Nicknames can be at most 16 characters.';
  if (!/^[A-Za-z0-9 _.-]+$/.test(n)) return 'Use letters, numbers, spaces, dots, dashes or underscores.';
  const f = fold(n);
  if (BLOCKED.some((w) => f.includes(w))) return 'Please pick a kinder nickname.';
  return null;
}

/** What gets sent for this world. */
export function scoreEntry(w: WorldState): ScoreEntry {
  return {
    id: w.id,
    nickname: w.nickname.trim().slice(0, 16),
    level: w.progress.level,
    netWorth: Math.max(0, Math.round(netWorth(w).total)),
    difficulty: w.difficulty,
  };
}

/** Reads the sheet's reply into ranked rows (richest first), dropping anything malformed. */
export function parseBoard(data: unknown, difficulty: Difficulty, limit = 50): BoardRow[] {
  const rows = Array.isArray(data) ? data : Array.isArray((data as { rows?: unknown })?.rows) ? (data as { rows: unknown[] }).rows : [];
  const clean: ScoreEntry[] = [];
  for (const r of rows) {
    const o = r as Partial<ScoreEntry>;
    if (typeof o.id !== 'string' || typeof o.nickname !== 'string') continue;
    const level = Number(o.level);
    const nw = Number(o.netWorth);
    if (!Number.isFinite(level) || !Number.isFinite(nw)) continue;
    if (o.difficulty !== difficulty) continue;
    if (nicknameProblem(o.nickname)) continue;
    clean.push({ id: o.id, nickname: o.nickname, level, netWorth: nw, difficulty });
  }
  clean.sort((a, b) => b.netWorth - a.netWorth || b.level - a.level);
  return clean.slice(0, limit).map((r, i) => ({ ...r, rank: i + 1 }));
}
