/** Rent vs. buy over a horizon, including opportunity cost on the down payment. Pure & tested. */
import { monthlyPayment, remainingBalance } from './loans';

export interface RentBuyInput {
  years: number;
  price: number;
  downPct: number;
  apr: number;
  rent: number; // monthly
  rentGrowth: number; // yearly
  appreciation: number; // yearly
  maintenancePct: number; // of price per year
  propertyTaxPct: number; // of value per year
  closingPct: number; // buying costs
  sellingPct: number; // selling costs
  investReturn: number; // yearly return on money not used for a down payment
}

export function rentVsBuy(i: RentBuyInput) {
  const months = i.years * 12;
  const down = i.price * i.downPct;
  const loan = i.price - down;
  const pmt = monthlyPayment(loan, i.apr, 360);
  let buyOut = down + i.price * i.closingPct;
  let value = i.price;
  for (let y = 0; y < i.years; y++) {
    buyOut += pmt * 12 + value * (i.maintenancePct + i.propertyTaxPct);
    value *= 1 + i.appreciation;
  }
  const balance = remainingBalance(loan, i.apr, 360, months);
  const equity = value * (1 - i.sellingPct) - balance;
  const buyNet = buyOut - equity;
  let rentOut = 0;
  let rent = i.rent;
  for (let y = 0; y < i.years; y++) {
    rentOut += rent * 12;
    rent *= 1 + i.rentGrowth;
  }
  // The renter invests the down payment + closing costs instead
  const upfront = down + i.price * i.closingPct;
  const investGain = upfront * (Math.pow(1 + i.investReturn, i.years) - 1);
  const rentNet = rentOut - investGain;
  return { pmt, buyNet, rentNet, equity, value, better: buyNet < rentNet ? ('buy' as const) : ('rent' as const) };
}
