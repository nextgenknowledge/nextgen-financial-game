/**
 * Rule functions never touch the UI directly. They push Effects, and the UI layer plays them
 * (toasts, Narwhal lines, confetti, sounds). This keeps all game rules pure and testable.
 */
export type Mood = 'confident' | 'talking' | 'skeptical' | 'shocked' | 'hyped' | 'disappointed';

export type SfxName =
  | 'coin'
  | 'cash'
  | 'click'
  | 'correct'
  | 'wrong'
  | 'levelup'
  | 'unlock'
  | 'whoosh'
  | 'portal'
  | 'buy'
  | 'error'
  | 'pop'
  | 'tick'
  | 'star'
  | 'bill'
  | 'jump'
  | 'door'
  | 'horn';

export type Effect =
  | { type: 'toast'; text: string; icon?: string; tone?: 'good' | 'bad' | 'info' | 'gold' }
  | { type: 'narwhal'; text: string; mood?: Mood; entryText?: string }
  | { type: 'confetti' }
  | { type: 'sfx'; name: SfxName }
  | { type: 'levelUp'; level: number }
  | { type: 'achievement'; id: string; name: string; icon: string }
  | { type: 'unlock'; location: string }
  | { type: 'questComplete'; title: string }
  | { type: 'monthSummary'; month: number };

export type Fx = Effect[];

export const toast = (fx: Fx, text: string, icon?: string, tone?: 'good' | 'bad' | 'info' | 'gold') =>
  fx.push({ type: 'toast', text, icon, tone });
export const sfx = (fx: Fx, name: SfxName) => fx.push({ type: 'sfx', name });
export const say = (fx: Fx, text: string, mood: Mood = 'talking') => fx.push({ type: 'narwhal', text, mood });
