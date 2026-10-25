/** The WorldState is exactly what gets saved to IndexedDB and exported to a file. */

export type Difficulty = 'entry' | 'advanced';
export type CityId = 'new-york' | 'london' | 'hong-kong' | 'san-francisco' | 'singapore';
export type LocationId = 'park' | CityId;
export const CITY_IDS: CityId[] = ['san-francisco', 'new-york', 'london', 'hong-kong', 'singapore'];

export type Topic =
  | 'counting'
  | 'needs-wants'
  | 'saving'
  | 'earning'
  | 'budgeting'
  | 'shopping'
  | 'banking'
  | 'interest'
  | 'investing'
  | 'business'
  | 'safety'
  | 'credit'
  | 'debt'
  | 'taxes'
  | 'retirement'
  | 'insurance'
  | 'economics'
  | 'giving'
  | 'housing';

export interface AvatarConfig {
  skin: string;
  hair: string;
  hairStyle: number; // 0 short, 1 long, 2 curly, 3 buzz, 4 bun, 5 spiky
  eyes: string;
  shirt: string;
  pants: string;
  shoes: string;
  hat: string | null; // owned outfit item id
  top: string | null; // outfit item id overriding shirt style
  accessory: string | null;
  bottom?: string | null; // outfit item id overriding pants
  feet?: string | null; // outfit item id overriding shoes
}

export type OutfitSlot = 'hat' | 'top' | 'bottom' | 'feet' | 'accessory';

export interface Holding {
  shares: number;
  cost: number; // total cost basis
}

export interface CD {
  id: string;
  principal: number;
  value: number;
  monthlyRate: number;
  termMonths: number;
  startMonth: number;
}

export type LoanKind = 'personal' | 'auto' | 'mortgage' | 'course' | 'iou';

export interface Loan {
  id: string;
  kind: LoanKind;
  name: string;
  principal: number;
  balance: number;
  apr: number;
  termMonths: number;
  payment: number;
  monthsPaid: number;
  startMonth: number;
  collateral?: string; // asset uid
  missed: number;
}

export interface CreditCard {
  open: boolean;
  limit: number;
  balance: number;
  apr: number;
  minDue: number;
  statementBalance: number;
  openedMonth: number;
  autopay: 'none' | 'minimum' | 'full';
}

export interface Goal {
  id: string;
  name: string;
  icon: string;
  target: number;
  saved: number;
  done: boolean;
}

export interface Txn {
  m: number; // month
  d: string; // description
  a: number; // amount (+in / -out)
  k: 'cash' | 'checking' | 'savings' | 'card' | 'invest' | 'other';
}

export interface MonthSummary {
  month: number;
  income: number;
  spending: number;
  interest: number;
  netWorth: number;
  notes: string[];
}

export interface OwnedVehicle {
  uid: string;
  itemId: string;
  value: number;
  price: number;
  boughtMonth: number;
  color?: string;
  leased?: boolean;
  lease?: { payment: number; monthsLeft: number };
}

export interface OwnedProperty {
  uid: string;
  itemId: string;
  plotId?: string;
  value: number;
  price: number;
  level: number;
  rented: boolean;
  boughtMonth: number;
  houseId?: string; // built house on a plot
  /** Furniture standing in this home (houses and condos). Missing in older saves. */
  layout?: PlacedFurniture[];
}

/** A furniture item (OwnedItem uid) placed in a home, in room coordinates (door at +z). */
export interface PlacedFurniture {
  item: string;
  x: number;
  z: number;
  /** Quarter turns only: 0, π/2, π, 3π/2. */
  rot: number;
}

export interface OwnedBusiness {
  uid: string;
  typeId: string;
  name: string;
  level: number;
  staff: number;
  invested: number;
  profits: number[]; // last 12 months
  boughtMonth: number;
}

export interface OwnedItem {
  uid: string;
  itemId: string;
  value: number;
  price: number;
  boughtMonth: number;
  placed?: boolean;
}

export interface OwnedPet {
  uid: string;
  itemId: string;
  name: string;
  boughtMonth: number;
}

export interface StartupStake {
  uid: string;
  startupId: string;
  amount: number;
  resolveMonth: number;
  outcome?: number; // multiple received when resolved
}

export interface NetWorthPoint {
  month: number;
  total: number;
  cash: number;
  bank: number;
  investments: number;
  property: number;
  other: number;
  debt: number;
}

export interface ActivityStat {
  best: number;
  stars: number;
  plays: number;
  last: number; // timestamp
}

export interface ChallengeState {
  id: string;
  progress: number;
  claimed: boolean;
}

export interface WorldState {
  version: number;
  id: string;
  name: string;
  nickname: string;
  difficulty: Difficulty;
  createdAt: number;
  lastPlayed: number;
  playSeconds: number;
  seed: number;
  rng: number;
  avatar: AvatarConfig;

  time: {
    month: number; // months elapsed since start (0 = Jan, Year 1)
    t: number; // 0..1 progress through the current month
    tick: number; // market ticks elapsed in this month
  };

  player: {
    location: LocationId;
    pos: [number, number, number];
    rotY: number;
    happiness: number;
    residence: string; // 'narwhal' | property uid
  };

  finance: {
    cash: number;
    hasChecking: boolean;
    hasSavings: boolean;
    checking: number;
    savings: number;
    cds: CD[];
    loans: Loan[];
    card: CreditCard;
    retirement: { open: boolean; balance: number; pct: number; roth: boolean; contributed: number; matched: number };
    holdings: Record<string, Holding>;
    startups: StartupStake[];
    goals: Goal[];
    subscriptions: string[];
    insurance: Record<string, string | null>; // category -> policy id
    credit: {
      onTime: number;
      late: number;
      lateMonths: number[];
      inquiryMonths: number[];
      firstAccountMonth: number | null;
      score: number | null;
      history: { month: number; score: number }[];
    };
    tax: {
      ytdGross: number;
      ytdWithheld: number;
      ytdFica: number;
      ytdCity: number;
      ytdOther: number;
      w2s: { year: number; gross: number; withheld: number; fica: number; city: number; other: number }[];
      filed: number[];
      owed: number;
    };
    unpaidBills: number;
    ledger: Txn[];
    monthIncome: number;
    monthSpending: number;
    monthInterest: number;
    summaries: MonthSummary[];
  };

  assets: {
    vehicles: OwnedVehicle[];
    properties: OwnedProperty[];
    businesses: OwnedBusiness[];
    items: OwnedItem[];
    pets: OwnedPet[];
    activeVehicle: string | null;
  };

  market: {
    prices: Record<string, number>;
    history: Record<string, number[]>; // last N ticks
    monthly: Record<string, number[]>; // month-end closes
    eps: Record<string, number>;
    regime: 'bull' | 'normal' | 'bear';
    reserveRate: number;
    inflation: number; // annual
    priceIndex: number; // cumulative inflation multiplier
    news: { month: number; tick: number; id: string; text: string; symbols: string[]; impact: number }[];
    shocks: { sector: string; drift: number; ticks: number }[];
  };

  progress: {
    xp: number;
    level: number;
    tickets: number;
    stats: Record<string, number>;
    topics: Record<string, { correct: number; total: number }>;
    subLevel: number; // Entry adaptive level 1..5
    streakRight: number;
    streakWrong: number;
    activities: Record<string, ActivityStat>;
    quests: { active: { id: string; step: number; progress: number }[]; completed: string[] };
    unlocked: LocationId[];
    achievements: Record<string, number>;
    titles: string[];
    activeTitle: string | null;
    daily: { date: string; list: ChallengeState[] };
    weekly: { week: string; list: ChallengeState[] };
    lessons: string[];
    perks: string[];
    collection: Record<string, number>;
    community: Record<string, number>;
    netWorth: NetWorthPoint[];
    jobs: Record<string, { shifts: number; level: number; best: number }>;
    flags: Record<string, boolean | number | string>;
    tipsShown: string[];
    seenBuildings: string[];
  };
}
