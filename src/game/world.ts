import companies from '@/data/companies.json';
import type { AvatarConfig, Difficulty, WorldState } from './types';
import { randomSeed } from './rng';

export const SAVE_VERSION = 1;

export const DEFAULT_AVATAR: AvatarConfig = {
  skin: '#e8b48f',
  hair: '#3b2a20',
  hairStyle: 0,
  eyes: '#2b2b38',
  shirt: '#2ebaba',
  pants: '#2f3e66',
  shoes: '#f4f6fa',
  hat: null,
  top: null,
  accessory: null,
  bottom: null,
  feet: null,
};

let uidCounter = 0;
export function uid(prefix = 'id'): string {
  uidCounter = (uidCounter + 1) % 1e6;
  return `${prefix}_${Date.now().toString(36)}${uidCounter.toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`;
}

export function initialMarket(): WorldState['market'] {
  const prices: Record<string, number> = {};
  const history: Record<string, number[]> = {};
  const monthly: Record<string, number[]> = {};
  const eps: Record<string, number> = {};
  for (const s of companies.securities) {
    prices[s.symbol] = s.price;
    history[s.symbol] = [s.price];
    monthly[s.symbol] = [s.price];
    eps[s.symbol] = s.eps;
  }
  return {
    prices,
    history,
    monthly,
    eps,
    regime: 'normal',
    reserveRate: 0.04,
    inflation: 0.03,
    priceIndex: 1,
    news: [],
    shocks: [],
  };
}

export interface NewWorldOptions {
  name: string;
  nickname: string;
  difficulty: Difficulty;
  avatar?: Partial<AvatarConfig>;
  seed?: number;
}

export function createWorld(opts: NewWorldOptions): WorldState {
  const seed = opts.seed ?? randomSeed();
  const now = Date.now();
  return {
    version: SAVE_VERSION,
    id: uid('world'),
    name: opts.name.trim() || 'My Fin City',
    nickname: opts.nickname.trim() || 'Player',
    difficulty: opts.difficulty,
    createdAt: now,
    lastPlayed: now,
    playSeconds: 0,
    seed,
    rng: seed,
    avatar: { ...DEFAULT_AVATAR, ...opts.avatar },
    time: { month: 0, t: 0.3, tick: 0 },
    player: { location: 'park', pos: [0, 0, 34], rotY: Math.PI, happiness: 60, residence: 'narwhal' },
    finance: {
      cash: 20,
      hasChecking: false,
      hasSavings: false,
      checking: 0,
      savings: 0,
      cds: [],
      loans: [],
      card: { open: false, limit: 0, balance: 0, apr: 0.2499, minDue: 0, statementBalance: 0, openedMonth: 0, autopay: 'full' },
      retirement: { open: false, balance: 0, pct: 0, roth: true, contributed: 0, matched: 0 },
      holdings: {},
      startups: [],
      goals: [],
      subscriptions: [],
      insurance: { health: null, auto: null, home: null, pet: null },
      credit: { onTime: 0, late: 0, lateMonths: [], inquiryMonths: [], firstAccountMonth: null, score: null, history: [] },
      tax: { ytdGross: 0, ytdWithheld: 0, ytdFica: 0, ytdCity: 0, ytdOther: 0, w2s: [], filed: [], owed: 0 },
      unpaidBills: 0,
      ledger: [],
      monthIncome: 0,
      monthSpending: 0,
      monthInterest: 0,
      summaries: [],
    },
    assets: { vehicles: [], properties: [], businesses: [], items: [], pets: [], activeVehicle: null },
    market: initialMarket(),
    progress: {
      xp: 0,
      level: 1,
      tickets: 0,
      stats: {},
      topics: {},
      subLevel: 1,
      streakRight: 0,
      streakWrong: 0,
      activities: {},
      quests: { active: [{ id: 'q1-welcome', step: 0, progress: 0 }], completed: [] },
      unlocked: ['park'],
      achievements: {},
      titles: ['Newcomer'],
      activeTitle: 'Newcomer',
      daily: { date: '', list: [] },
      weekly: { week: '', list: [] },
      lessons: [],
      perks: [],
      collection: {},
      community: {},
      netWorth: [],
      jobs: {},
      flags: {},
      tipsShown: [],
      seenBuildings: [],
    },
  };
}

/** Upgrades older saves to the current shape. Add a case per version bump. */
export function migrateWorld(raw: unknown): WorldState {
  const w = raw as WorldState;
  if (!w || typeof w !== 'object' || !w.id || !w.finance) throw new Error('Not a Fin City world');
  // v1 is current. Fill in any fields added after a save was made (defensive merge).
  const fresh = createWorld({ name: w.name, nickname: w.nickname, difficulty: w.difficulty, seed: w.seed });
  const merged = deepFillDefaults(w, fresh) as WorldState;
  // New securities added to data after the save was made.
  for (const s of companies.securities) {
    if (merged.market.prices[s.symbol] === undefined) {
      merged.market.prices[s.symbol] = s.price;
      merged.market.history[s.symbol] = [s.price];
      merged.market.monthly[s.symbol] = [s.price];
      merged.market.eps[s.symbol] = s.eps;
    }
  }
  merged.version = SAVE_VERSION;
  return merged;
}

function deepFillDefaults(target: unknown, defaults: unknown): unknown {
  if (Array.isArray(defaults)) return Array.isArray(target) ? target : defaults;
  if (defaults && typeof defaults === 'object') {
    if (!target || typeof target !== 'object' || Array.isArray(target)) return defaults;
    const out: Record<string, unknown> = { ...(target as Record<string, unknown>) };
    for (const [k, v] of Object.entries(defaults as Record<string, unknown>)) {
      // Records keyed by dynamic ids (prices, stats…) keep whatever the save had.
      out[k] = k in out ? deepFillDefaults(out[k], v) : v;
    }
    return out;
  }
  return target === undefined ? defaults : target;
}

export const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function monthLabel(month: number): string {
  return `${MONTH_NAMES[month % 12]} · Year ${Math.floor(month / 12) + 1}`;
}
