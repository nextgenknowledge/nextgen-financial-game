/** Interest & time-value-of-money math. Rates are decimals (0.05 = 5%). */

export const round2 = (x: number) => Math.round((x + Number.EPSILON) * 100) / 100;

export function simpleInterest(principal: number, rate: number, years: number): number {
  return principal * rate * years;
}

export function compoundAmount(principal: number, rate: number, years: number, periodsPerYear = 1): number {
  if (periodsPerYear === Infinity) return principal * Math.exp(rate * years);
  return principal * Math.pow(1 + rate / periodsPerYear, periodsPerYear * years);
}

export function apyFromApr(apr: number, periodsPerYear: number): number {
  if (periodsPerYear === Infinity) return Math.exp(apr) - 1;
  return Math.pow(1 + apr / periodsPerYear, periodsPerYear) - 1;
}

export function aprFromApy(apy: number, periodsPerYear: number): number {
  return periodsPerYear * (Math.pow(1 + apy, 1 / periodsPerYear) - 1);
}

/** Monthly growth factor minus one that compounds to the given APY over 12 months. */
export function monthlyRateFromApy(apy: number): number {
  return Math.pow(1 + apy, 1 / 12) - 1;
}

export function ruleOf72(ratePercent: number): number {
  return 72 / ratePercent;
}

/** Exact doubling time in years for annual compounding. */
export function doublingYears(rate: number): number {
  return Math.log(2) / Math.log(1 + rate);
}

/** Future value of a series of equal end-of-period contributions. */
export function futureValueSeries(contribution: number, ratePerPeriod: number, periods: number): number {
  if (ratePerPeriod === 0) return contribution * periods;
  return contribution * ((Math.pow(1 + ratePerPeriod, periods) - 1) / ratePerPeriod);
}

export function presentValue(future: number, rate: number, years: number): number {
  return future / Math.pow(1 + rate, years);
}

export function realReturn(nominal: number, inflation: number): number {
  return (1 + nominal) / (1 + inflation) - 1;
}

/** Purchasing power of `amount` after `years` of inflation. */
export function purchasingPower(amount: number, inflation: number, years: number): number {
  return amount / Math.pow(1 + inflation, years);
}

/**
 * Year-by-year balances for monthly contributions with monthly compounding.
 * Used by the Retirement Tower and Savings Garden.
 */
export function growthSchedule(opts: {
  start: number;
  monthly: number;
  annualRate: number;
  years: number;
  startDelayYears?: number;
}): number[] {
  const { start, monthly, annualRate, years, startDelayYears = 0 } = opts;
  const i = annualRate / 12;
  let bal = start;
  const out = [bal];
  for (let y = 1; y <= years; y++) {
    for (let m = 0; m < 12; m++) {
      bal = bal * (1 + i) + (y > startDelayYears ? monthly : 0);
    }
    out.push(bal);
  }
  return out;
}
