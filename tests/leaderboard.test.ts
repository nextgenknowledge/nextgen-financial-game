import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import vm from 'node:vm';
import { createWorld } from '@/game/world';
import { LEAVING_GAP, SEND_GAP, nicknameProblem, parseBoard, scoreEntry, sharesScore, shouldSend } from '@/game/leaderboard';

describe('leaderboard nicknames', () => {
  it('lets every suggested nickname through', () => {
    for (const n of ['CoinCaptain42', 'PennyPilot17', 'SavvySaver99', 'BudgetBoss10', 'StockStar55', 'NickelNinja23', 'DimeDiver71', 'Tester', 'Fin_Fan 3']) expect(nicknameProblem(n), n).toBeNull();
  });
  it('blocks rude ones, even disguised', () => {
    for (const n of ['sh1t lord', 'f.u.c.k', 'B1TCH', 'poopy b4stard']) expect(nicknameProblem(n), n).not.toBeNull();
  });
  it('checks length and characters', () => {
    expect(nicknameProblem('a')).not.toBeNull();
    expect(nicknameProblem('x'.repeat(17))).not.toBeNull();
    expect(nicknameProblem('<script>')).not.toBeNull();
  });
});

describe('leaderboard scores', () => {
  it('sends only nickname, level, net worth and mode, keyed by the world id', () => {
    const w = createWorld({ name: 'My Real Name World', nickname: 'CoinCaptain42', difficulty: 'entry', seed: 1 });
    const e = scoreEntry(w);
    expect(Object.keys(e).sort()).toEqual(['difficulty', 'id', 'level', 'netWorth', 'nickname']);
    expect(JSON.stringify(e)).not.toContain('My Real Name');
  });
  it('ranks richest first, for the chosen mode, skipping junk', () => {
    const rows = parseBoard(
      { rows: [
        { id: 'a', nickname: 'Ann', level: 3, netWorth: 500, difficulty: 'entry' },
        { id: 'b', nickname: 'Bo', level: 9, netWorth: 9000, difficulty: 'entry' },
        { id: 'c', nickname: 'Cy', level: 2, netWorth: 99999, difficulty: 'advanced' },
        { id: 'd', nickname: 'sh1thead', level: 2, netWorth: 1e6, difficulty: 'entry' },
        { nickname: 'NoId', level: 1, netWorth: 1, difficulty: 'entry' },
      ] },
      'entry',
    );
    expect(rows.map((r) => [r.rank, r.nickname])).toEqual([[1, 'Bo'], [2, 'Ann']]);
  });
});

/** Runs docs/leaderboard/leaderboard.gs against an in-memory sheet. */
function sheetScript() {
  let table: unknown[][] = [];
  const sheet = {
    appendRow: (r: unknown[]) => void table.push([...r]),
    setFrozenRows: () => {},
    deleteRow: (row: number) => void table.splice(row - 1, 1),
    getDataRange: () => ({ getValues: () => table.map((r) => [...r]) }),
    getRange: (row: number, col: number, _n: number, w: number) => ({ setValues: (v: unknown[][]) => { for (let k = 0; k < w; k++) table[row - 1][col - 1 + k] = v[0][k]; } }),
  };
  let created = false;
  const ctx = {
    SpreadsheetApp: { getActiveSpreadsheet: () => ({ getSheetByName: () => (created ? sheet : null), insertSheet: () => ((created = true), sheet) }) },
    ContentService: { MimeType: { JSON: 'json' }, createTextOutput: (t: string) => ({ setMimeType: () => ({ body: t }) }) },
    LockService: { getScriptLock: () => ({ waitLock: () => {}, releaseLock: () => {} }) },
  } as Record<string, unknown>;
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync('docs/leaderboard/leaderboard.gs', 'utf8'), ctx);
  const post = (o: object) => JSON.parse((ctx.doPost as (e: unknown) => { body: string })({ postData: { contents: JSON.stringify(o) } }).body);
  const get = (d: string) => JSON.parse((ctx.doGet as (e: unknown) => { body: string })({ parameter: { difficulty: d } }).body);
  return { post, get, table: () => table, hide: (i: number) => (table[i][6] = 'x') };
}

describe('sending scores by themselves', () => {
  it('never shares unless the player said yes', () => {
    const w = createWorld({ name: 'Test', nickname: 'Zed', difficulty: 'entry', seed: 1 });
    expect(sharesScore(w)).toBe(false);
    w.progress.flags.leaderboardShare = false;
    expect(sharesScore(w)).toBe(false);
    w.progress.flags.leaderboardShare = true;
    expect(sharesScore(w)).toBe(true);
  });
  const e = { id: 'world_a', nickname: 'Ann', level: 3, netWorth: 100, difficulty: 'entry' as const };
  it('sends a first score straight away at any level, but not for a rude name', () => {
    expect(shouldSend(e, undefined, 0)).toBe(true);
    expect(shouldSend({ ...e, level: 1 }, undefined, 0)).toBe(true);
    expect(shouldSend({ ...e, nickname: 'b4d sh1t' }, undefined, 0)).toBe(false);
  });
  it('only sends again when the score changed and enough time has passed', () => {
    const last = { entry: e, at: 0 };
    expect(shouldSend(e, last, SEND_GAP * 5)).toBe(false);
    const richer = { ...e, netWorth: 500 };
    expect(shouldSend(richer, last, SEND_GAP - 1)).toBe(false);
    expect(shouldSend(richer, last, SEND_GAP)).toBe(true);
    expect(shouldSend(richer, last, LEAVING_GAP - 1, true)).toBe(false);
    expect(shouldSend(richer, last, LEAVING_GAP, true)).toBe(true);
  });
});

describe('leaderboard Google Sheet script', () => {
  it('lets a player take themselves off, but a teacher-hidden row stays', () => {
    const s = sheetScript();
    s.post({ id: 'world_aaa', nickname: 'Ann', level: 2, netWorth: 100, difficulty: 'entry' });
    s.post({ id: 'world_bbb', nickname: 'Bo', level: 2, netWorth: 50, difficulty: 'entry' });
    expect(s.post({ id: 'world_aaa', remove: true }).ok).toBe(true);
    expect(s.get('entry').rows.map((r: { nickname: string }) => r.nickname)).toEqual(['Bo']);
    s.hide(1);
    s.post({ id: 'world_bbb', remove: true });
    expect(s.table().length).toBe(2);
  });
  it('adds a row, updates the same player instead of duplicating, and ranks the board', () => {
    const s = sheetScript();
    expect(s.post({ id: 'world_aaa', nickname: 'Ann', level: 2, netWorth: 100, difficulty: 'entry' }).ok).toBe(true);
    expect(s.post({ id: 'world_bbb', nickname: 'Bo', level: 5, netWorth: 900, difficulty: 'entry' }).ok).toBe(true);
    expect(s.post({ id: 'world_aaa', nickname: 'Ann', level: 7, netWorth: 5000, difficulty: 'entry' }).ok).toBe(true);
    expect(s.table().length).toBe(3); // header + two players
    const board = s.get('entry').rows;
    expect(board.map((r: { nickname: string; netWorth: number }) => [r.nickname, r.netWorth])).toEqual([['Ann', 5000], ['Bo', 900]]);
    expect(s.get('advanced').rows).toEqual([]);
  });
  it('rejects rude nicknames and silly numbers, and respects the Hidden column', () => {
    const s = sheetScript();
    expect(s.post({ id: 'world_ccc', nickname: 'b1tch', level: 2, netWorth: 1, difficulty: 'entry' }).ok).toBe(false);
    expect(s.post({ id: 'world_ddd', nickname: 'Dee', level: 2, netWorth: -5, difficulty: 'entry' }).ok).toBe(false);
    expect(s.post({ id: 'world_eee', nickname: 'Eve', level: 2, netWorth: 50, difficulty: 'entry' }).ok).toBe(true);
    s.hide(1);
    expect(s.get('entry').rows).toEqual([]);
    expect(s.post({ id: 'world_eee', nickname: 'Eve', level: 3, netWorth: 60, difficulty: 'entry' }).error).toBe('hidden');
  });
});
