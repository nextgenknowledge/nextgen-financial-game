'use client';
/**
 * Talks to the leaderboard Google Sheet (an Apps Script web app, see docs/LEADERBOARD.md), through
 * fincity.dev's own route on the real site so school networks that block Google links still work. The
 * link comes from NEXT_PUBLIC_LEADERBOARD_URL at build time, or src/data/leaderboard.json. With
 * no link the Leaderboard app stays hidden on the FinPhone, and the game makes no requests.
 * Once a player chooses to share, scores go out by themselves during play on the real site;
 * local and preview builds never send, so testing can't add players to the real board.
 */
import config from '@/data/leaderboard.json';
import { parseBoard, scoreEntry, sharesScore, shouldSend, type BoardRow, type LastSend, type ScoreEntry } from '@/game/leaderboard';
import { act, useGame } from '@/store/game';
import type { Difficulty } from '@/game/types';

const fromEnv = process.env.NEXT_PUBLIC_LEADERBOARD_URL ?? '';
/** The sheet's web app link, if one is set (must be an Apps Script /exec link). */
export const LEADERBOARD_URL = [fromEnv, config.url].find((u) => /^https:\/\/script\.google(usercontent)?\.com\/.+/.test(u ?? '')) ?? '';

/** fincity.dev's own route to the sheet (functions/api/leaderboard.ts): school networks often block Google links. */
const PROXY = '/api/leaderboard';

function hasProxy() {
  return typeof location !== 'undefined' && (liveSite() || location.hostname.endsWith('.pages.dev'));
}

async function readBoard(url: string, difficulty: Difficulty): Promise<BoardRow[]> {
  const res = await fetch(`${url}?difficulty=${difficulty}`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`Leaderboard replied ${res.status}`);
  return parseBoard(await res.json(), difficulty);
}

export async function fetchBoard(difficulty: Difficulty): Promise<BoardRow[]> {
  if (!hasProxy()) return readBoard(LEADERBOARD_URL, difficulty);
  return readBoard(PROXY, difficulty).catch(() => readBoard(LEADERBOARD_URL, difficulty));
}

/** Only the live site sends scores, always through its own route. keepalive lets one finish as the tab closes. */
async function post(body: object): Promise<void> {
  const res = await fetch(PROXY, { method: 'POST', keepalive: true, headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(body) });
  if (!res.ok) throw new Error(`Leaderboard replied ${res.status}`);
}

function liveSite() {
  return typeof location !== 'undefined' && /^(www\.)?fincity\.dev$/.test(location.hostname);
}

const lastSends = new Map<string, LastSend>();

/** Sends the current world's score if it's due; true if one went out. `leaving` allows a shorter wait. */
export function sendScore(leaving = false): boolean {
  const w = useGame.getState().world;
  if (!w || !LEADERBOARD_URL || !liveSite() || !sharesScore(w)) return false;
  const entry = scoreEntry(w);
  const now = Date.now();
  if (!shouldSend(entry, lastSends.get(w.id), now, leaving)) return false;
  lastSends.set(w.id, { entry, at: now });
  post(entry).catch(() => lastSends.delete(w.id));
  return true;
}

/** Records the player's choice: yes sends their score now, no takes them off the board. */
export function setScoreShared(share: boolean): void {
  const w = useGame.getState().world;
  if (!w) return;
  // leaderboardPosted is from the old Post my score button, so those players have a row too
  const onBoard = sharesScore(w) || !!w.progress.flags.leaderboardPosted;
  act((d) => {
    d.progress.flags.leaderboardShare = share;
    d.progress.flags.leaderboardPosted = false;
  });
  if (share) {
    sendScore(true);
    return;
  }
  lastSends.delete(w.id);
  // A no from someone who never shared sends nothing at all
  if (onBoard && LEADERBOARD_URL && liveSite()) post({ id: w.id, remove: true }).catch(() => {});
}
