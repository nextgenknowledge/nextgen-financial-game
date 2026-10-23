/** Local Hall of Fame: best net worth per world, kept on this device only. */
import { getGlobal, setGlobal } from './db';
import type { WorldState } from '@/game/types';
import { netWorth } from '@/game/finance/netWorth';

export interface FameEntry {
  worldId: string;
  worldName: string;
  nickname: string;
  difficulty: string;
  netWorth: number;
  date: number;
}

export async function getHallOfFame(): Promise<FameEntry[]> {
  try {
    const list = (await getGlobal<FameEntry[]>('hallOfFame')) ?? [];
    return list.sort((a, b) => b.netWorth - a.netWorth);
  } catch {
    return [];
  }
}

export async function updateHallOfFame(w: WorldState) {
  const nw = Math.round(netWorth(w).total);
  const list = await getHallOfFame();
  const i = list.findIndex((e) => e.worldId === w.id);
  const entry: FameEntry = { worldId: w.id, worldName: w.name, nickname: w.nickname, difficulty: w.difficulty, netWorth: nw, date: Date.now() };
  if (i === -1) list.push(entry);
  else if (list[i].netWorth < nw) list[i] = entry;
  else list[i] = { ...list[i], worldName: w.name, nickname: w.nickname };
  await setGlobal('hallOfFame', list.sort((a, b) => b.netWorth - a.netWorth).slice(0, 50));
}
