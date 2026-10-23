/** Fin City Revenue Service (FCRS): fictional taxes modelled on US single-filer rules. */

export interface Bracket {
  upTo: number; // Infinity for the top bracket
  rate: number;
}

export const BRACKETS: Bracket[] = [
  { upTo: 11925, rate: 0.1 },
  { upTo: 48475, rate: 0.12 },
  { upTo: 103350, rate: 0.22 },
  { upTo: 197300, rate: 0.24 },
  { upTo: 250525, rate: 0.32 },
  { upTo: 626350, rate: 0.35 },
  { upTo: Infinity, rate: 0.37 },
];

export const STANDARD_DEDUCTION = 15000;
export const SOCIAL_SECURITY_RATE = 0.062;
export const MEDICARE_RATE = 0.0145;
export const FICA_RATE = SOCIAL_SECURITY_RATE + MEDICARE_RATE;
export const CITY_TAX_RATE = 0.03;
export const SALES_TAX_RATE = 0.06;
export const PROPERTY_TAX_RATE = 0.011;

/** Tax owed on taxable income using progressive brackets. */
export function bracketTax(taxable: number, brackets: Bracket[] = BRACKETS): number {
  let tax = 0;
  let lower = 0;
  for (const b of brackets) {
    if (taxable <= lower) break;
    const amount = Math.min(taxable, b.upTo) - lower;
    tax += amount * b.rate;
    lower = b.upTo;
  }
  return tax;
}

export function marginalRate(taxable: number, brackets: Bracket[] = BRACKETS): number {
  for (const b of brackets) if (taxable <= b.upTo) return b.rate;
  return brackets[brackets.length - 1].rate;
}

export function effectiveRate(gross: number, deduction = STANDARD_DEDUCTION): number {
  if (gross <= 0) return 0;
  return bracketTax(Math.max(0, gross - deduction)) / gross;
}

export interface Paycheck {
  gross: number;
  federal: number;
  socialSecurity: number;
  medicare: number;
  city: number;
  retirement: number;
  net: number;
}

/**
 * Paycheck withholding. Annualizes this check over `periodsPerYear` to estimate federal withholding.
 * `pretaxRetirement` (traditional) reduces taxable wages; Roth contributions come from net pay.
 */
export function paycheck(
  gross: number,
  periodsPerYear: number,
  opts: { retirementPct?: number; roth?: boolean; advanced?: boolean } = {},
): Paycheck {
  const { retirementPct = 0, roth = false, advanced = true } = opts;
  const retirement = gross * retirementPct;
  if (!advanced) {
    return { gross, federal: 0, socialSecurity: 0, medicare: 0, city: 0, retirement, net: gross - retirement };
  }
  const taxableWages = roth ? gross : gross - retirement;
  const annual = taxableWages * periodsPerYear;
  const federal = bracketTax(Math.max(0, annual - STANDARD_DEDUCTION)) / periodsPerYear;
  const socialSecurity = gross * SOCIAL_SECURITY_RATE;
  const medicare = gross * MEDICARE_RATE;
  const city = gross * CITY_TAX_RATE;
  const net = gross - federal - socialSecurity - medicare - city - retirement;
  return { gross, federal, socialSecurity, medicare, city, retirement, net };
}

export interface ReturnInput {
  wages: number;
  otherIncome?: number;
  withheld: number;
  itemized?: number;
  credits?: number;
  pretaxRetirement?: number;
}

export interface ReturnResult {
  totalIncome: number;
  adjustedIncome: number;
  deduction: number;
  taxable: number;
  taxBeforeCredits: number;
  credits: number;
  tax: number;
  withheld: number;
  refund: number; // positive = refund, negative = owed
}

/** File a simple FC-1040: deductions reduce taxable income, credits reduce the tax itself. */
export function fileReturn(r: ReturnInput): ReturnResult {
  const totalIncome = r.wages + (r.otherIncome ?? 0);
  const adjustedIncome = totalIncome - (r.pretaxRetirement ?? 0);
  const deduction = Math.max(STANDARD_DEDUCTION, r.itemized ?? 0);
  const taxable = Math.max(0, adjustedIncome - deduction);
  const taxBeforeCredits = bracketTax(taxable);
  const credits = Math.min(taxBeforeCredits, r.credits ?? 0);
  const tax = taxBeforeCredits - credits;
  return {
    totalIncome,
    adjustedIncome,
    deduction,
    taxable,
    taxBeforeCredits,
    credits,
    tax,
    withheld: r.withheld,
    refund: r.withheld - tax,
  };
}

export function withSalesTax(price: number, advanced: boolean): { tax: number; total: number } {
  const tax = advanced ? Math.round(price * SALES_TAX_RATE * 100) / 100 : 0;
  return { tax, total: price + tax };
}
