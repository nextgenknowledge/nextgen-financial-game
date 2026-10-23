'use client';
import type { Effect } from '@/game/effects';
import { useUI } from '@/store/ui';
import { useSettings } from '@/store/settings';
import { useGame } from '@/store/game';
import { playSfx } from '@/engine/audio';
import { speak } from './speech';

/** Plays rule-function effects in the UI: toasts, Narwhal lines, confetti and sounds. */
export function playEffects(fx: Effect[]) {
  const ui = useUI.getState();
  const settings = useSettings.getState();
  const entry = useGame.getState().world?.difficulty === 'entry';
  for (const e of fx) {
    switch (e.type) {
      case 'toast':
        ui.pushToast({ text: e.text, icon: e.icon, tone: e.tone });
        break;
      case 'narwhal': {
        const text = entry && e.entryText ? e.entryText : e.text;
        ui.sayNarwhal(text, e.mood ?? 'talking');
        if (settings.readAloud && ui.narwhal.length === 0) speak(text);
        break;
      }
      case 'confetti':
        if (!settings.reducedMotion) ui.burst();
        break;
      case 'sfx':
        playSfx(e.name);
        break;
      case 'levelUp':
        playSfx('levelup');
        if (!settings.reducedMotion) ui.burst();
        ui.pushToast({ text: `Level up! You're now level ${e.level}`, icon: '⬆️', tone: 'gold' });
        break;
      case 'achievement':
        playSfx('unlock');
        ui.pushToast({ text: `Achievement: ${e.name}`, icon: e.icon, tone: 'gold' });
        break;
      case 'unlock':
        playSfx('unlock');
        if (!settings.reducedMotion) ui.burst();
        break;
      case 'questComplete':
        playSfx('star');
        ui.pushToast({ text: `Quest complete: ${e.title}`, icon: '✅', tone: 'good' });
        break;
      case 'monthSummary':
        break;
    }
  }
}
