import { describe, expect, it } from 'vitest';
import { pickDpr } from '@/engine/Resolution';

describe('pickDpr', () => {
  it('keeps a Chromebook on Low where it was', () => {
    expect(pickDpr('low', 1366, 768, 1)).toBeCloseTo(0.75, 1);
  });
  it('draws a phone held sideways sharper than the old fixed 0.75', () => {
    const d = pickDpr('low', 844, 390, 3);
    expect(d).toBeGreaterThan(1.2);
    expect(d).toBeLessThanOrEqual(2);
  });
  it('never goes past the screen itself or 2x', () => {
    expect(pickDpr('low', 320, 200, 1)).toBe(1);
    expect(pickDpr('high', 2560, 1440, 3)).toBe(2);
    expect(pickDpr('medium', 400, 300, 3)).toBe(1.5);
  });
  it('steps down with the slow-device scale but not below 0.5', () => {
    expect(pickDpr('low', 1366, 768, 1, 0.65)).toBe(0.5);
    expect(pickDpr('low', 844, 390, 3, 0.85)).toBeLessThan(pickDpr('low', 844, 390, 3));
  });
});
