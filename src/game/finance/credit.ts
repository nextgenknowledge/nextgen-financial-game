/** Credit score model (Advanced mode). Range 300–850, FICO-style factor weights. */

export interface CreditInputs {
  onTime: number;
  late: number;
  /** Months-ago of each late payment (recent lates hurt more). */
  lateMonthsAgo?: number[];
  utilization: number | null; // 0..1, null when no revolving credit
  oldestAccountMonths: number;
  hardInquiriesLast12: number;
  hasRevolving: boolean;
  hasInstallment: boolean;
}

export const CREDIT_WEIGHTS = { payment: 0.35, utilization: 0.3, age: 0.15, newCredit: 0.1, mix: 0.1 };

export function utilizationFactor(u: number | null): number {
  if (u === null) return 0.7;
  if (u < 0.1) return 1;
  if (u < 0.3) return 0.85;
  if (u < 0.5) return 0.6;
  if (u < 0.75) return 0.4;
  return 0.2;
}

export function paymentFactor(onTime: number, late: number, lateMonthsAgo: number[] = []): number {
  // Recent lates (within 12 months) count double.
  const recent = lateMonthsAgo.filter((m) => m < 12).length;
  const weightedLate = late + recent;
  return (onTime + 1) / (onTime + 1 + 4 * weightedLate);
}

export function creditFactors(c: CreditInputs) {
  return {
    payment: paymentFactor(c.onTime, c.late, c.lateMonthsAgo),
    utilization: utilizationFactor(c.utilization),
    age: Math.min(1, c.oldestAccountMonths / 60),
    newCredit: Math.max(0, 1 - 0.15 * c.hardInquiriesLast12),
    mix: c.hasRevolving && c.hasInstallment ? 1 : c.hasRevolving || c.hasInstallment ? 0.6 : 0,
  };
}

export function creditScore(c: CreditInputs): number {
  const f = creditFactors(c);
  const w = CREDIT_WEIGHTS;
  const s =
    w.payment * f.payment + w.utilization * f.utilization + w.age * f.age + w.newCredit * f.newCredit + w.mix * f.mix;
  return Math.round(Math.min(850, Math.max(300, 300 + 550 * s)));
}

export type CreditTier = 'excellent' | 'good' | 'fair' | 'poor' | 'very-poor' | 'none';

export function creditTier(score: number | null): CreditTier {
  if (score === null) return 'none';
  if (score >= 760) return 'excellent';
  if (score >= 700) return 'good';
  if (score >= 640) return 'fair';
  if (score >= 580) return 'poor';
  return 'very-poor';
}

export const TIER_LABEL: Record<CreditTier, string> = {
  excellent: 'Excellent',
  good: 'Good',
  fair: 'Fair',
  poor: 'Poor',
  'very-poor': 'Very poor',
  none: 'No score yet',
};

/** Percentage-point spread a lender adds to the reserve rate for each tier. */
export const TIER_SPREAD: Record<CreditTier, number> = {
  excellent: 0.02,
  good: 0.04,
  fair: 0.07,
  poor: 0.11,
  'very-poor': 0.16,
  none: 0.08,
};

export function loanAprFor(score: number | null, reserveRate: number, kind: 'personal' | 'auto' | 'mortgage' | 'course') {
  const kindAdj = kind === 'mortgage' ? -0.01 : kind === 'auto' ? 0 : kind === 'course' ? -0.005 : 0.02;
  return Math.max(0.01, reserveRate + TIER_SPREAD[creditTier(score)] + kindAdj);
}
