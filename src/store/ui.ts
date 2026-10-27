'use client';
import { create } from 'zustand';
import type { Mood } from '@/game/effects';
import type { LocationId } from '@/game/types';
import { forDevice } from '@/ui/touch';

export type Screen = 'intro' | 'title' | 'worlds' | 'game' | 'credits';

export interface Toast {
  id: number;
  text: string;
  icon?: string;
  tone?: 'good' | 'bad' | 'info' | 'gold';
}

export interface NarwhalLine {
  id: number;
  text: string;
  mood: Mood;
  /** Optional buttons. When present the line waits for a choice. */
  choices?: { label: string; onPick: () => void }[];
  onDone?: () => void;
}

export type Panel =
  | { type: 'phone'; app?: string; arg?: string }
  | { type: 'activity'; id: string; station?: string }
  | { type: 'service'; id: string; arg?: string }
  | { type: 'shop'; id: string }
  | { type: 'map' }
  | { type: 'pause' }
  | { type: 'settings' }
  | { type: 'monthSummary'; month: number }
  | { type: 'levelUp'; level: number }
  | { type: 'learn'; topic?: string; lesson?: string };

export interface Prompt {
  id: string;
  text: string;
  icon?: string;
}

export interface UIStore {
  screen: Screen;
  loading: {
    active: boolean;
    progress: number;
    text: string;
    /** What is loading: a world, a city, or a building (drives the loading-screen art). */
    kind?: 'world' | 'city' | 'building';
    city?: string;
    building?: string;
  };
  toasts: Toast[];
  narwhal: NarwhalLine[];
  panel: Panel | null;
  panelStack: Panel[];
  prompt: Prompt | null;
  confetti: number;
  fps: number;
  /** Activity running in the 3D world (e.g. delivery), HUD shows its overlay. */
  worldActivity: { id: string; data?: unknown } | null;
  /** An activity mid-play. It stays mounted (hidden) when closed so it can be resumed. */
  run: { id: string; name: string } | null;
  /** The first-play screen tour is showing; the game is paused under it. */
  tour: boolean;
  /** Arranging furniture at home: which home, and the piece being carried (item uid) if any. */
  decor: { home: string; carrying: string | null; rot: number } | null;
  /** "Show me the way": a place the player picked (a building door or their home) that the guide
   * trail, beacon and Narwhal lead to, through portals if needed, until they arrive. */
  guide: { city: LocationId; trigger: string; label: string } | null;
  setGuide: (g: UIStore['guide']) => void;
  setDecor: (d: UIStore['decor']) => void;
  setRun: (r: UIStore['run']) => void;
  setScreen: (s: Screen) => void;
  setLoading: (l: Partial<UIStore['loading']>) => void;
  pushToast: (t: Omit<Toast, 'id'>) => void;
  dropToast: (id: number) => void;
  sayNarwhal: (text: string, mood?: Mood, extra?: Partial<NarwhalLine>) => void;
  nextNarwhal: () => void;
  clearNarwhal: () => void;
  open: (p: Panel) => void;
  /** Open on top of the current panel; closing returns to it. */
  push: (p: Panel) => void;
  close: () => void;
  closeAll: () => void;
  setPrompt: (p: Prompt | null) => void;
  burst: () => void;
  setWorldActivity: (a: UIStore['worldActivity']) => void;
}

let nextId = 1;

/** Starting a different activity abandons the paused one; reopening the same one resumes it. */
const keepRun = (run: UIStore['run'], p: Panel) => (run && p.type === 'activity' && p.id !== run.id ? null : run);

export const useUI = create<UIStore>((set, get) => ({
  screen: 'intro',
  loading: { active: false, progress: 0, text: '' },
  toasts: [],
  narwhal: [],
  panel: null,
  panelStack: [],
  prompt: null,
  confetti: 0,
  fps: 60,
  worldActivity: null,
  run: null,
  tour: false,
  decor: null,
  guide: null,
  setGuide: (guide) => set({ guide }),
  setDecor: (decor) => set({ decor }),
  setRun: (run) => set({ run }),
  // Leaving the game drops any paused activity
  setScreen: (screen) => set(screen === 'game' ? { screen } : { screen, run: null, tour: false, decor: null }),
  setLoading: (l) => set({ loading: { ...get().loading, ...l } }),
  pushToast: (t) => {
    const id = nextId++;
    set({ toasts: [...get().toasts.slice(-4), { ...t, id }] });
    setTimeout(() => get().dropToast(id), 3800);
  },
  dropToast: (id) => set({ toasts: get().toasts.filter((t) => t.id !== id) }),
  sayNarwhal: (raw, mood = 'talking', extra) => {
    const text = forDevice(raw);
    const q = get().narwhal;
    // Avoid stacking the exact same line twice.
    if (q.some((l) => l.text === text)) return;
    set({ narwhal: [...q, { id: nextId++, text, mood, ...extra }] });
  },
  nextNarwhal: () => {
    const [head, ...rest] = get().narwhal;
    set({ narwhal: rest });
    head?.onDone?.();
  },
  clearNarwhal: () => set({ narwhal: [] }),
  open: (p) => set({ panel: p, panelStack: [], run: keepRun(get().run, p) }),
  push: (p) => {
    const cur = get().panel;
    set({ panel: p, panelStack: cur ? [...get().panelStack, cur] : get().panelStack, run: keepRun(get().run, p) });
  },
  close: () => {
    const stack = get().panelStack;
    if (stack.length) set({ panel: stack[stack.length - 1], panelStack: stack.slice(0, -1) });
    else set({ panel: null });
  },
  closeAll: () => set({ panel: null, panelStack: [] }),
  setPrompt: (p) => {
    const cur = get().prompt;
    if (cur?.id === p?.id && cur?.text === p?.text) return;
    set({ prompt: p });
  },
  burst: () => set({ confetti: get().confetti + 1 }),
  setWorldActivity: (a) => set({ worldActivity: a }),
}));

export const isPaused = () => {
  const s = useUI.getState();
  return s.panel !== null || s.screen !== 'game' || s.loading.active || s.tour;
};
