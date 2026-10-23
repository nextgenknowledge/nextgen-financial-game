/**
 * A tiny, safe arithmetic expression language for question templates and the in-game calculator.
 * No eval(): a recursive-descent parser over numbers, variables, + - * / ^ %, parentheses and
 * a whitelist of functions. Example: "P*(1+r/100/n)^(n*t)".
 */
import { monthlyPayment, totalInterest } from '../finance/loans';
import { bracketTax, marginalRate } from '../finance/tax';

type Fn = (...args: number[]) => number;

const FUNCTIONS: Record<string, Fn> = {
  round: (x, d = 0) => {
    const f = Math.pow(10, d);
    return Math.round((x + Number.EPSILON) * f) / f;
  },
  floor: Math.floor,
  ceil: Math.ceil,
  abs: Math.abs,
  min: Math.min,
  max: Math.max,
  sqrt: Math.sqrt,
  log: Math.log10,
  ln: Math.log,
  exp: Math.exp,
  pow: Math.pow,
  // Finance helpers so teachers don't need to write the formulas out.
  pmt: (principal, apr, months) => monthlyPayment(principal, apr, months),
  totint: (principal, apr, months, extra = 0) => totalInterest(principal, apr, months, extra),
  fv: (pv, rate, periods) => pv * Math.pow(1 + rate, periods),
  fvs: (c, rate, periods) => (rate === 0 ? c * periods : c * ((Math.pow(1 + rate, periods) - 1) / rate)),
  tax: (taxable) => bracketTax(taxable),
  marginal: (taxable) => marginalRate(taxable) * 100,
  /** Fewest US-style coins & bills to make an amount (greedy). */
  coins: (amount) => {
    let left = Math.round(amount * 100);
    let n = 0;
    for (const d of [2000, 1000, 500, 100, 25, 10, 5, 1]) {
      n += Math.floor(left / d);
      left %= d;
    }
    return n;
  },
};

const CONSTANTS: Record<string, number> = { pi: Math.PI, e: Math.E };
const own = (o: object, k: string) => Object.prototype.hasOwnProperty.call(o, k);

type Token =
  | { t: 'num'; v: number }
  | { t: 'id'; v: string }
  | { t: 'op'; v: string }
  | { t: '('; v: '(' }
  | { t: ')'; v: ')' }
  | { t: ','; v: ',' };

export class ExprError extends Error {}

function tokenize(src: string): Token[] {
  const out: Token[] = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (c === ' ' || c === '\t' || c === '\n') {
      i++;
      continue;
    }
    if (/[0-9.]/.test(c)) {
      let j = i;
      while (j < src.length && /[0-9._]/.test(src[j])) j++;
      // scientific notation
      if (src[j] === 'e' && /[0-9+-]/.test(src[j + 1] ?? '')) {
        j += 2;
        while (j < src.length && /[0-9]/.test(src[j])) j++;
      }
      const v = Number(src.slice(i, j).replace(/_/g, ''));
      if (Number.isNaN(v)) throw new ExprError(`Bad number near "${src.slice(i, j)}"`);
      out.push({ t: 'num', v });
      i = j;
      continue;
    }
    if (/[A-Za-z_]/.test(c)) {
      let j = i;
      while (j < src.length && /[A-Za-z0-9_]/.test(src[j])) j++;
      out.push({ t: 'id', v: src.slice(i, j) });
      i = j;
      continue;
    }
    if ('+-*/^%×÷'.includes(c)) {
      out.push({ t: 'op', v: c === '×' ? '*' : c === '÷' ? '/' : c });
      i++;
      continue;
    }
    if (c === '(' || c === ')' || c === ',') {
      out.push({ t: c, v: c } as Token);
      i++;
      continue;
    }
    if (c === '$') {
      i++;
      continue;
    }
    throw new ExprError(`Unexpected "${c}"`);
  }
  return out;
}

export function evaluate(src: string, vars: Record<string, number> = {}): number {
  const tokens = tokenize(src);
  let pos = 0;
  const peek = () => tokens[pos];
  const take = () => tokens[pos++];

  // expr := term (('+'|'-') term)*
  function expr(): number {
    let v = term();
    while (peek()?.t === 'op' && (peek()!.v === '+' || peek()!.v === '-')) {
      const op = take().v;
      const r = term();
      v = op === '+' ? v + r : v - r;
    }
    return v;
  }
  // term := unary (('*'|'/'|'%') unary)*   (implicit multiplication: "2(3)" or "2x")
  function term(): number {
    let v = unary();
    for (;;) {
      const p = peek();
      if (p?.t === 'op' && (p.v === '*' || p.v === '/' || p.v === '%')) {
        take();
        const r = unary();
        if (p.v === '*') v *= r;
        else if (p.v === '/') v /= r;
        else v = v % r;
      } else if (p && (p.t === '(' || p.t === 'id' || p.t === 'num') && pos > 0) {
        v *= unary();
      } else break;
    }
    return v;
  }
  // unary := ('-'|'+') unary | power
  function unary(): number {
    const p = peek();
    if (p?.t === 'op' && (p.v === '-' || p.v === '+')) {
      take();
      const v = unary();
      return p.v === '-' ? -v : v;
    }
    return power();
  }
  // power := atom ('^' unary)?   (right associative)
  function power(): number {
    const base = atom();
    if (peek()?.t === 'op' && peek()!.v === '^') {
      take();
      return Math.pow(base, unary());
    }
    return base;
  }
  function atom(): number {
    const tok = take();
    if (!tok) throw new ExprError('Unexpected end of expression');
    if (tok.t === 'num') return tok.v;
    if (tok.t === '(') {
      const v = expr();
      if (take()?.t !== ')') throw new ExprError('Missing )');
      return v;
    }
    if (tok.t === 'id') {
      const name = tok.v;
      if (peek()?.t === '(') {
        take();
        const fn = own(FUNCTIONS, name) ? FUNCTIONS[name] : undefined;
        if (!fn) throw new ExprError(`Unknown function ${name}`);
        const args: number[] = [];
        if (peek()?.t !== ')') {
          args.push(expr());
          while (peek()?.t === ',') {
            take();
            args.push(expr());
          }
        }
        if (take()?.t !== ')') throw new ExprError('Missing ) after arguments');
        return fn(...args);
      }
      if (own(vars, name)) return vars[name];
      if (own(CONSTANTS, name)) return CONSTANTS[name];
      throw new ExprError(`Unknown variable ${name}`);
    }
    throw new ExprError(`Unexpected "${tok.v}"`);
  }

  const v = expr();
  if (pos < tokens.length) throw new ExprError(`Unexpected "${tokens[pos].v}"`);
  return v;
}

/** Calculator-friendly wrapper: returns null instead of throwing. */
export function tryEvaluate(src: string, vars: Record<string, number> = {}): number | null {
  try {
    const v = evaluate(src, vars);
    return Number.isFinite(v) ? v : null;
  } catch {
    return null;
  }
}
