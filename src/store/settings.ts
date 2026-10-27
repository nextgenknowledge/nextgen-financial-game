'use client';
import { create } from 'zustand';
import { getGlobal, setGlobal } from '@/save/db';

export type Quality = 'low' | 'medium' | 'high';
export type KeyAction =
  | 'forward'
  | 'back'
  | 'left'
  | 'right'
  | 'sprint'
  | 'jump'
  | 'interact'
  | 'map'
  | 'inventory'
  | 'phone'
  | 'pause'
  | 'camera';

export const KEY_ACTION_LABELS: Record<KeyAction, string> = {
  forward: 'Move forward',
  back: 'Move back',
  left: 'Move left',
  right: 'Move right',
  sprint: 'Sprint / boost',
  jump: 'Jump / brake / fly up',
  interact: 'Interact / ride',
  map: 'Map',
  inventory: 'Bag (inventory)',
  phone: 'FinPhone',
  pause: 'Pause',
  camera: 'Reset camera',
};

export const DEFAULT_KEYS: Record<KeyAction, string> = {
  forward: 'KeyW',
  back: 'KeyS',
  left: 'KeyA',
  right: 'KeyD',
  sprint: 'ShiftLeft',
  jump: 'Space',
  interact: 'KeyE',
  map: 'KeyM',
  inventory: 'KeyI',
  phone: 'KeyP',
  pause: 'Escape',
  camera: 'KeyC',
};

export interface Settings {
  quality: Quality;
  autoQuality: boolean;
  music: number;
  sfx: number;
  readAloud: boolean;
  speechRate: number;
  /** Chosen read-aloud voice (voiceURI); empty picks the friendliest one on the device. */
  voice: string;
  textSize: 's' | 'm' | 'l' | 'xl';
  colorblind: 'off' | 'deuteranopia' | 'protanopia' | 'tritanopia';
  reducedMotion: boolean;
  hints: boolean;
  /** Narwhal walks beside the player in the world. Off keeps the instructions but not the companion. */
  narwhalFollow: boolean;
  monthMinutes: number;
  mouseSensitivity: number;
  invertY: boolean;
  /** The camera swings round behind the player as they turn while walking. */
  camFollow: boolean;
  keys: Record<KeyAction, string>;
  showFps: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  quality: 'medium',
  autoQuality: true,
  music: 0.05,
  sfx: 0.8,
  readAloud: false,
  speechRate: 1,
  voice: '',
  textSize: 'm',
  colorblind: 'off',
  reducedMotion: false,
  hints: true,
  narwhalFollow: true,
  monthMinutes: 8,
  mouseSensitivity: 1,
  invertY: false,
  camFollow: true,
  keys: DEFAULT_KEYS,
  showFps: false,
};

interface SettingsStore extends Settings {
  loaded: boolean;
  set: (patch: Partial<Settings>) => void;
  load: () => Promise<void>;
}

function applyToDocument(s: Settings) {
  if (typeof document === 'undefined') return;
  const html = document.documentElement;
  html.dataset.text = s.textSize;
  html.dataset.cb = s.colorblind;
  html.dataset.reducedMotion = String(s.reducedMotion);
}

function gpuName(): string {
  try {
    const gl = document.createElement('canvas').getContext('webgl');
    const ext = gl?.getExtension('WEBGL_debug_renderer_info');
    return (ext && gl?.getParameter(ext.UNMASKED_RENDERER_WEBGL)) || '';
  } catch {
    return '';
  }
}

function detectDefaults(): Partial<Settings> {
  if (typeof window === 'undefined') return {};
  const out: Partial<Settings> = {};
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) out.reducedMotion = true;
  const cores = navigator.hardwareConcurrency ?? 4;
  const mem = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 4;
  if (cores <= 4 || mem <= 4) out.quality = 'low';
  // School Chromebooks and older laptops: integrated or mobile GPUs start on Low
  const gpu = gpuName();
  if (/swiftshader|llvmpipe|mali|adreno|powervr|intel\(r\) (hd|uhd) graphics [0-9]{3}\b|intel\(r\) hd graphics$|celeron|pentium/i.test(gpu)) out.quality = 'low';
  // Every Chromebook starts on Low; players with a fast one can raise it in Settings
  if (/\bCrOS\b/.test(navigator.userAgent)) out.quality = 'low';
  return out;
}

export const useSettings = create<SettingsStore>((set, get) => ({
  ...DEFAULT_SETTINGS,
  loaded: false,
  set: (patch) => {
    set(patch);
    const { loaded: _l, set: _s, load: _ld, ...rest } = get();
    applyToDocument(rest);
    setGlobal('settings', rest).catch(() => {});
  },
  load: async () => {
    let saved: Partial<Settings> | undefined;
    try {
      saved = await getGlobal<Partial<Settings>>('settings');
    } catch {
      saved = undefined;
    }
    const merged: Settings = {
      ...DEFAULT_SETTINGS,
      ...(saved ? {} : detectDefaults()),
      ...saved,
      keys: { ...DEFAULT_KEYS, ...(saved?.keys ?? {}) },
    };
    set({ ...merged, loaded: true });
    applyToDocument(merged);
  },
}));

export function keyLabel(code: string): string {
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  const map: Record<string, string> = {
    ShiftLeft: 'Shift',
    ShiftRight: 'R-Shift',
    Space: 'Space',
    Escape: 'Esc',
    ArrowUp: '↑',
    ArrowDown: '↓',
    ArrowLeft: '←',
    ArrowRight: '→',
    ControlLeft: 'Ctrl',
    AltLeft: 'Alt',
    Tab: 'Tab',
    Enter: 'Enter',
  };
  return map[code] ?? code;
}
