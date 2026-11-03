/** "What this really cost": the numbers shown after a financed purchase or a pet adoption. */

export interface CostSummary {
  name: string;
  rows: { label: string; amount: number; strong?: boolean }[];
  note: string;
}

const round2 = (x: number) => Math.round(x * 100) / 100;
const money = (x: number) => `$${x.toLocaleString('en-US', { maximumFractionDigits: 2 })}`;

export function financedSummary(o: { name: string; price: number; down: number; payment: number; months: number; upkeep?: number }): CostSummary {
  const total = round2(o.down + o.payment * o.months);
  const extra = round2(total - o.price);
  const monthly = round2(o.payment + (o.upkeep ?? 0));
  return {
    name: o.name,
    rows: [
      { label: 'Price', amount: o.price },
      { label: 'Down payment', amount: o.down },
      { label: `Monthly payment (${o.months} months)`, amount: o.payment },
      { label: 'Interest and fees', amount: extra },
      { label: 'Total you pay', amount: total, strong: true },
      ...(o.upkeep ? [{ label: 'Upkeep every month', amount: o.upkeep }] : []),
    ],
    note: `Borrowing adds ${money(extra)} to the price. Your monthly bills go up by ${money(monthly)} while you pay it off.`,
  };
}

export function leaseSummary(o: { name: string; signing: number; payment: number; months: number; upkeep?: number }): CostSummary {
  return {
    name: o.name,
    rows: [
      { label: 'Due at signing', amount: o.signing },
      { label: `Monthly payment (${o.months} months)`, amount: o.payment },
      { label: 'Total you pay', amount: round2(o.signing + o.payment * o.months), strong: true },
      ...(o.upkeep ? [{ label: 'Upkeep every month', amount: o.upkeep }] : []),
    ],
    note: 'When a lease ends you hand the vehicle back, so all of that money buys you nothing you can keep or sell.',
  };
}

export function petSummary(name: string, adoption: number, monthly: number): CostSummary {
  const year = round2(adoption + monthly * 12);
  return {
    name,
    rows: [
      { label: 'Adoption fee', amount: adoption },
      { label: 'Food and care every month', amount: monthly },
      { label: 'Total for the first year', amount: year, strong: true },
    ],
    note: `The adoption fee is the small part. Food and care add ${money(monthly)} to your bills every month.`,
  };
}
