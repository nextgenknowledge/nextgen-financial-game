/** Loans, amortization and credit-card math. */

export function monthlyPayment(principal: number, apr: number, months: number): number {
  if (months <= 0) return principal;
  const i = apr / 12;
  if (i === 0) return principal / months;
  return (principal * i) / (1 - Math.pow(1 + i, -months));
}

export interface AmortRow {
  month: number;
  payment: number;
  interest: number;
  principal: number;
  balance: number;
}

/** Full amortization schedule. `extra` is an additional principal payment each month. */
export function amortize(principal: number, apr: number, months: number, extra = 0): AmortRow[] {
  const i = apr / 12;
  const pmt = monthlyPayment(principal, apr, months);
  const rows: AmortRow[] = [];
  let bal = principal;
  let m = 0;
  while (bal > 0.005 && m < months * 2) {
    m++;
    const interest = bal * i;
    let principalPart = pmt - interest + extra;
    if (principalPart > bal) principalPart = bal;
    const payment = principalPart + interest;
    bal -= principalPart;
    rows.push({ month: m, payment, interest, principal: principalPart, balance: Math.max(0, bal) });
  }
  return rows;
}

export function totalInterest(principal: number, apr: number, months: number, extra = 0): number {
  return amortize(principal, apr, months, extra).reduce((s, r) => s + r.interest, 0);
}

/** Months to pay off a revolving balance making a fixed payment. Infinity if never. */
export function monthsToPayoff(balance: number, apr: number, payment: number): number {
  const i = apr / 12;
  if (payment <= balance * i) return Infinity;
  if (i === 0) return Math.ceil(balance / payment);
  return Math.ceil(-Math.log(1 - (i * balance) / payment) / Math.log(1 + i));
}

/** Credit-card minimum payment: max($25, 1% of balance + this month's interest), never above balance. */
export function cardMinimumPayment(balance: number, apr: number): number {
  if (balance <= 0) return 0;
  const interest = balance * (apr / 12);
  return Math.min(balance, Math.max(25, balance * 0.01 + interest));
}

/** Simulates paying only the minimum each month. Returns months and total interest paid. */
export function minimumPaymentTrap(balance: number, apr: number, maxMonths = 600) {
  let bal = balance;
  let months = 0;
  let interestPaid = 0;
  while (bal > 0.01 && months < maxMonths) {
    const interest = bal * (apr / 12);
    const pay = cardMinimumPayment(bal, apr);
    interestPaid += interest;
    bal = bal + interest - pay;
    months++;
  }
  return { months, interestPaid, paidOff: bal <= 0.01 };
}

/** Lease payment (simplified money-factor method). */
export function leasePayment(price: number, residual: number, months: number, apr: number): number {
  const moneyFactor = apr / 24;
  const depreciation = (price - residual) / months;
  const finance = (price + residual) * moneyFactor;
  return depreciation + finance;
}

/** Remaining balance after k payments. */
export function remainingBalance(principal: number, apr: number, months: number, paid: number): number {
  const i = apr / 12;
  if (i === 0) return Math.max(0, principal - (principal / months) * paid);
  const pmt = monthlyPayment(principal, apr, months);
  const bal = principal * Math.pow(1 + i, paid) - pmt * ((Math.pow(1 + i, paid) - 1) / i);
  return Math.max(0, bal);
}
