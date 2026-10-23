import { describe, expect, it } from 'vitest';
import { evaluate, tryEvaluate } from '@/game/questions/expr';

describe('expression evaluator', () => {
  it('arithmetic & precedence', () => {
    expect(evaluate('1+2*3')).toBe(7);
    expect(evaluate('(1+2)*3')).toBe(9);
    expect(evaluate('2^3^2')).toBe(512);
    expect(evaluate('-2^2')).toBe(-4);
    expect(evaluate('10 % 4')).toBe(2);
    expect(evaluate('2(3+1)')).toBe(8);
    expect(evaluate('3 × 4 ÷ 2')).toBe(6);
    expect(evaluate('$1,000'.replace(',', ''))).toBe(1000);
  });
  it('variables and functions', () => {
    expect(evaluate('P*(1+r/100/n)^(n*t)', { P: 1000, r: 6, n: 12, t: 10 })).toBeCloseTo(1819.4, 1);
    expect(evaluate('round(2.345, 2)')).toBe(2.35);
    expect(evaluate('max(1, 5, 3)')).toBe(5);
    expect(evaluate('pmt(20000, 0.06, 60)')).toBeCloseTo(386.66, 2);
    expect(evaluate('tax(10000)')).toBeCloseTo(1000);
    expect(evaluate('fvs(100, 0.01, 12)')).toBeCloseTo(1268.25, 2);
  });
  it('rejects unsafe or bad input', () => {
    expect(() => evaluate('alert(1)')).toThrow();
    expect(() => evaluate('x + 1')).toThrow();
    expect(() => evaluate('1 +')).toThrow();
    expect(() => evaluate('constructor')).toThrow();
    expect(tryEvaluate('1/0')).toBeNull();
    expect(tryEvaluate('((2)')).toBeNull();
  });
});
