'use client';
/**
 * Talks to the leaderboard Google Sheet (an Apps Script web app, see docs/LEADERBOARD.md). The
 * link comes from NEXT_PUBLIC_LEADERBOARD_URL at build time, or src/data/leaderboard.json. With
 * no link the Leaderboard app just says it's coming soon, and the game makes no requests.
 * Requests only happen when the player opens the Leaderboard app or taps Post my score.
 */
import config from '@/data/leaderboard.json';
import { parseBoard, type BoardRow, type ScoreEntry } from '@/game/leaderboard';
import type { Difficulty } from '@/game/types';

const fromEnv = process.env.NEXT_PUBLIC_LEADERBOARD_URL ?? '';
/** The sheet's web app link, if one is set (must be an Apps Script /exec link). */
export const LEADERBOARD_URL = [fromEnv, config.url].find((u) => /^https:\/\/script\.google(usercontent)?\.com\/.+/.test(u ?? '')) ?? '';

export async function fetchBoard(difficulty: Difficulty): Promise<BoardRow[]> {
  const res = await fetch(`${LEADERBOARD_URL}?difficulty=${difficulty}`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`Leaderboard replied ${res.status}`);
  return parseBoard(await res.json(), difficulty);
}

/**
 * Sends a score. Apps Script doesn't answer cross-site POSTs in a way the browser lets us read,
 * so this is fire-and-forget (plain text body, no-cors); the board is re-read afterwards.
 */
export async function postScore(entry: ScoreEntry): Promise<void> {
  await fetch(LEADERBOARD_URL, { method: 'POST', mode: 'no-cors', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(entry) });
}
