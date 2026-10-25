import { afterEach, describe, expect, it, vi } from 'vitest';
import quests from '@/data/quests.json';
import { forDevice } from '@/ui/touch';

/** Every string in the quest data (titles, step text, Narwhal's lines). */
function strings(o: unknown, out: string[] = []): string[] {
  if (typeof o === 'string') out.push(o);
  else if (o && typeof o === 'object') Object.values(o).forEach((v) => strings(v, out));
  return out;
}
const KEYBOARD = /W A S D|WASD|arrow keys|\bSpace\b|\bShift\b|\bpress E\b|\bPress E\b|\bmouse\b|\bclick/;

describe('touch wording', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('leaves text alone with a mouse and keyboard', () => {
    vi.stubGlobal('window', { matchMedia: () => ({ matches: false }) });
    expect(forDevice('Walk around! Use W A S D or the arrow keys')).toBe('Walk around! Use W A S D or the arrow keys');
  });

  it('never tells a touch player to use keys or a mouse', () => {
    vi.stubGlobal('window', { matchMedia: () => ({ matches: true }) });
    const left = strings(quests).map(forDevice).filter((s) => KEYBOARD.test(s));
    expect(left).toEqual([]);
  });

  it('reads naturally on touch screens', () => {
    vi.stubGlobal('window', { matchMedia: () => ({ matches: true }) });
    expect(forDevice('Walk around! Use W A S D or the arrow keys')).toBe('Walk around with the joystick!');
    expect(forDevice('Jump with Space (hold Shift to sprint)')).toBe('Jump with the jump button (push the stick all the way to run)');
    expect(forDevice('Walk to the gold light and press E.')).toBe('Walk to the gold light and tap the gold E button.');
  });
});
