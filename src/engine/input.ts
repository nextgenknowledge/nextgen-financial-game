/** Keyboard state with remappable bindings. Arrow keys always work for movement too. */
import { useSettings, type KeyAction } from '@/store/settings';

const down = new Set<string>();
type Listener = (action: KeyAction, e: KeyboardEvent) => void;
const listeners = new Set<Listener>();
let installed = false;

const ALT: Partial<Record<KeyAction, string[]>> = {
  forward: ['ArrowUp'],
  back: ['ArrowDown'],
  left: ['ArrowLeft'],
  right: ['ArrowRight'],
  sprint: ['ShiftRight'],
  interact: ['Enter'],
};

function isTyping(e: KeyboardEvent) {
  const t = e.target as HTMLElement | null;
  return !!t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable);
}

export function actionForCode(code: string): KeyAction | null {
  const keys = useSettings.getState().keys;
  for (const [action, k] of Object.entries(keys) as [KeyAction, string][]) {
    if (k === code) return action;
  }
  for (const [action, alts] of Object.entries(ALT) as [KeyAction, string[]][]) {
    if (alts.includes(code)) return action;
  }
  return null;
}

export function installInput() {
  if (installed || typeof window === 'undefined') return;
  installed = true;
  window.addEventListener('keydown', (e) => {
    if (isTyping(e)) return;
    const action = actionForCode(e.code);
    if (action && ['forward', 'back', 'left', 'right', 'jump'].includes(action)) e.preventDefault();
    if (!e.repeat) {
      if (action) listeners.forEach((l) => l(action, e));
    }
    down.add(e.code);
  });
  window.addEventListener('keyup', (e) => down.delete(e.code));
  window.addEventListener('blur', () => down.clear());
}

export function isDown(action: KeyAction): boolean {
  const k = useSettings.getState().keys[action];
  if (down.has(k)) return true;
  return (ALT[action] ?? []).some((c) => down.has(c));
}

export function onAction(l: Listener): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function clearKeys() {
  down.clear();
}

/** Virtual joystick / on-screen buttons feed into the same state. */
/** On-screen touch controls. `jumpTap` latches a tap so one shorter than a frame still jumps. */
export const virtual = { x: 0, y: 0, sprint: false, jump: false, jumpTap: false };
