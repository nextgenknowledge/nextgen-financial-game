'use client';
/**
 * The Dealer's Playbook (Advanced, Auto Dealer). Buying a first used car against a salesperson
 * who does this every day: the monthly-payment question, the add-ons on the buyer's order, the
 * long loan, the rate markup and the "today only" close.
 */
import type { KindProps } from '../../types';
import { Table, usd } from '../pro/kit';
import { CaseRunner, Cards, Say, dial, flag, pick, type CaseDef } from './kit';

interface S {
  price: number;
  short: number;
  long: number;
}

/** Monthly payment on a fixed-rate loan. */
const pmt = (p: number, apr: number, n: number) => (p * (apr / 12)) / (1 - Math.pow(1 + apr / 12, -n));

export default function DealerPlaybook({ seed, onFinish, addReview }: KindProps) {
  const def: CaseDef<S> = {
    kicker: 'Auto Dealer · The dealer’s playbook',
    init: (rng) => {
      const price = rng.pick([13500, 14500, 15500]);
      const loan = price + 500;
      return { price, short: Math.round(pmt(loan, 0.07, 48)), long: Math.round(pmt(loan, 0.09, 84)) };
    },
    steps: [
      ({ s }) =>
        pick({
          brief: `You have found a 2019 hatchback listed at ${usd(s.price)}. Before any talk of price, the salesperson leans in.`,
          visual: <Say who="Salesperson">So I can find the right car for you, what monthly payment are you comfortable with?</Say>,
          prompt: 'How do you answer?',
          options: [
            { label: '"I am negotiating the total out-the-door price. We can talk about financing after that."', credit: 1, why: 'Any payment can be hit by stretching the loan. Fixing the total price first means every later number has to add up to it.' },
            { label: '"About $250 a month."', credit: 0, why: 'Now the dealer can build any deal that lands on $250: a higher price, add-ons and a seven-year loan all fit inside a monthly number.' },
            { label: '"As low as possible."', credit: 0.1, why: 'The lowest payment is the longest loan, which is the most expensive way to buy the car.' },
            { label: '"What payment would you suggest?"', credit: 0, why: 'You have handed over the negotiation. Their suggestion will be whatever earns the dealership the most.' },
          ],
        }),
      ({ s }) =>
        flag({
          brief: 'You agree on the price. The finance office prints the buyer’s order, and it is a lot longer than you expected.',
          prompt: 'Flag the extras you never asked for and can refuse.',
          doc: {
            title: 'Buyer’s Order',
            sub: 'Fin City Motors',
            skin: 'contract',
            lines: [
              { id: 'car', l: '2019 hatchback, agreed price', r: usd(s.price) },
              { id: 'paint', l: 'Paint and fabric protection package', r: '$895' },
              { id: 'vin', l: 'Anti-theft window etching', r: '$299' },
              { id: 'warr', l: 'Extended service contract, 5 years', r: '$2,400' },
              { id: 'nitro', l: 'Nitrogen tire fill', r: '$199' },
              { id: 'doc', l: 'Dealer documentation fee', r: '$399' },
              { id: 'tax', l: 'Sales tax, 6%', r: usd(s.price * 0.06) },
              { id: 'reg', l: 'Title and registration', r: '$185' },
            ],
            foot: 'Initial here to accept all items listed above.',
          },
          issues: {
            paint: 'A spray-on coating that costs the dealer very little. It is pure profit, and it is optional.',
            vin: 'Etching kits cost about $25. It is often already done to the car so that it looks like you cannot say no. You can.',
            warr: 'An extended contract is optional, its price is negotiable, and it can be bought later or elsewhere. It was added without asking.',
            nitro: 'Air is already 78% nitrogen. This is a fee for almost nothing.',
          },
          fine: {
            doc: 'Documentation fees are common and many states cap them. It is fair to ask for a lower price to offset it, but it is not a junk add-on.',
            tax: 'Sales tax goes to the state. The dealer does not keep it and cannot waive it.',
            reg: 'Title and registration are government charges that every buyer pays.',
            car: 'This is the price you agreed.',
          },
        }),
      ({ s }) =>
        dial({
          brief: 'With the extras removed, the finance manager shows two ways to pay. He circles the second one.',
          visual: <Table head={['Loan', 'Rate', 'Months', 'Monthly payment']} rows={[['Option 1', '7%', '48', usd(s.short)], ['Option 2', '9%', '84', usd(s.long)]]} hl={[1]} />,
          prompt: 'How much MORE does the lower payment cost in total?',
          min: 0,
          max: 6000,
          step: 50,
          answer: Math.round((s.long * 84 - s.short * 48) / 50) * 50,
          tol: 100,
          fmt: (v) => usd(v),
          why: `Option 2: ${usd(s.long)} × 84 = ${usd(s.long * 84)}. Option 1: ${usd(s.short)} × 48 = ${usd(s.short * 48)}. The "cheaper" payment costs about ${usd(s.long * 84 - s.short * 48)} more, and you would be making payments for seven years.`,
        }),
      () =>
        pick({
          brief: 'Your credit union approved you for a loan at 6.5% before you came in. The dealer’s best offer so far is 9%.',
          prompt: 'What do you do with the pre-approval?',
          options: [
            { label: 'Show it and ask them to beat 6.5%. If they cannot, use the credit union', credit: 1, why: 'Dealers are often allowed to add a point or two to the rate a lender approves and keep the difference. A pre-approval sets the price to beat.' },
            { label: 'Keep it secret so the dealer does not get annoyed', credit: 0.1, why: 'It is your best piece of leverage. Used cars are a negotiation, and dealers expect it.' },
            { label: 'Take the dealer’s 9%: one stop is easier', credit: 0, why: 'On this loan, 2.5 points more over four years is roughly $800 for the convenience of not sending one email.' },
            { label: 'Take the 9% now and refinance later', credit: 0.3, why: 'Refinancing can work, but it means paying the higher rate for months and applying again. The 6.5% is already in your pocket.' },
          ],
        }),
      () =>
        pick({
          brief: 'The car looks clean and drives well. The dealer says it passed their 120-point inspection.',
          visual: <Cards cards={[{ icon: '🔍', title: 'Independent mechanic', sub: 'Pre-purchase inspection', facts: [['Cost', '$150'], ['Time', 'About an hour']] }, { icon: '📄', title: 'Vehicle history report', sub: 'By VIN', facts: [['Cost', '$30'], ['Shows', 'Accidents, owners, title problems']] }]} />,
          prompt: 'What is worth paying for before you sign?',
          options: [
            { label: 'Both: $180 to check a $15,000 purchase', credit: 1, why: 'The dealer’s inspection is done by the party selling the car. An independent mechanic and a history report cost about 1% of the price and catch flood damage, frame repairs and rolled-back mileage.' },
            { label: 'Neither. The dealer already inspected it', credit: 0, why: 'The seller has checked the seller’s car. That is not a second opinion.' },
            { label: 'Just the history report', credit: 0.5, why: 'It catches reported problems. It cannot see worn brakes, leaks or a repair that was never reported, which is what the mechanic is for.' },
            { label: 'Just the extended warranty instead', credit: 0.1, why: 'A $2,400 contract with exclusions is a costly substitute for a $150 look under the car before you own it.' },
          ],
        }),
      () =>
        pick({
          brief: 'You ask for a day to arrange the inspection. The manager comes over.',
          visual: <Say who="Manager">I have another couple looking at this exact car at four. This price is only good if you sign today.</Say>,
          prompt: 'What now?',
          options: [
            { label: 'Thank him, leave your number, and go arrange the inspection', credit: 1, why: 'Being willing to walk is the strongest position a buyer has. Deadlines like this are a standard closing tactic, and good deals usually survive a night’s sleep.' },
            { label: 'Sign now. It would be painful to lose the car', credit: 0, why: 'Pressure to skip your checks is the reason to keep them. There are many 2019 hatchbacks.' },
            { label: 'Offer $500 more to hold it', credit: 0, why: 'You would be bidding against a buyer who may not exist.' },
            { label: 'Put down a refundable deposit, in writing, to hold it for 24 hours', credit: 0.8, why: 'A reasonable middle path, as long as "refundable" is written on the receipt. Walking is still stronger.' },
          ],
        }),
    ],
    alts: {
      0: [
        ({ s }) =>
          pick({
            brief: `You like a 2019 hatchback listed at ${usd(s.price)}. You also have an old car to sell. The salesperson asks first thing.`,
            visual: <Say who="Salesperson">Are you trading anything in today? Let’s work it all into one number for you.</Say>,
            prompt: 'How do you answer?',
            options: [
              { label: '"Let’s agree the price of this car first. Then we can talk about my trade-in separately."', credit: 1, why: 'Mixing them lets the dealer give a “great” trade-in value while quietly raising the price, or the other way round. Separate deals are easier to check.' },
              { label: '"Yes, what will you give me for it?"', credit: 0.3, why: 'Fine to ask eventually, but leading with it lets them shuffle numbers between the two deals.' },
              { label: '"One number is great, keep it simple."', credit: 0, why: 'One combined number is exactly where costs can hide.' },
              { label: 'Get offers for the old car from two buyers first, then negotiate the new car on its own', credit: 1, why: 'Knowing what your trade-in is worth elsewhere means you can spot a low offer instantly.' },
            ],
          }),
      ],
      1: [
        ({ s }) =>
          flag({
            brief: 'The car has a second sticker beside the official one. It lists dealer additions.',
            prompt: 'Flag the charges you can push back on or refuse.',
            doc: {
              title: 'Dealer addendum',
              sub: 'Fin City Motors',
              skin: 'contract',
              lines: [
                { id: 'car', l: 'Listed price', r: usd(s.price) },
                { id: 'adj', l: 'Market adjustment', r: '$1,500' },
                { id: 'prep', l: 'Dealer preparation', r: '$595' },
                { id: 'locks', l: 'Wheel locks', r: '$149' },
                { id: 'tint', l: 'Window tint (already applied)', r: '$399' },
                { id: 'tax', l: 'Sales tax, 6%', r: usd(s.price * 0.06) },
                { id: 'emis', l: 'State emissions certificate', r: '$50' },
              ],
            },
            issues: {
              adj: 'A “market adjustment” is just extra profit. It is fully negotiable, and many buyers refuse it.',
              prep: 'Getting a car ready to sell is part of the dealer’s cost of doing business, already in the price.',
              locks: 'A $20 part priced at $149. Optional.',
              tint: 'Already applied does not mean you must pay for it. Ask for it to be removed from the price.',
            },
            fine: {
              car: 'The listed price is your starting point.',
              tax: 'Sales tax goes to the state and cannot be waived.',
              emis: 'A real state requirement in many places.',
            },
          }),
      ],
      2: [
        ({ s }) =>
          dial({
            brief: `You borrow ${usd(s.price + 500)} at 7% for 48 months. The payment is ${usd(s.short)} a month.`,
            visual: <Table head={['Loan', 'Rate', 'Months', 'Monthly payment']} rows={[['Your loan', '7%', '48', usd(s.short)]]} />,
            prompt: 'How much interest do you pay over the whole loan?',
            min: 0,
            max: 5000,
            step: 50,
            answer: Math.round((s.short * 48 - (s.price + 500)) / 50) * 50,
            tol: 100,
            fmt: (v) => usd(v),
            why: `${usd(s.short)} × 48 = ${usd(s.short * 48)}, minus the ${usd(s.price + 500)} borrowed = ${usd(s.short * 48 - (s.price + 500))} of interest. That is the price of borrowing instead of saving up.`,
          }),
      ],
      3: [
        () =>
          pick({
            brief: 'The finance manager offers GAP insurance for $995. It covers the gap between what you owe and what the car is worth if it is written off. Your credit union sells the same cover for $250.',
            prompt: 'What do you do?',
            options: [
              { label: 'Decline it here. If you need it, buy it from the credit union for $250', credit: 1, why: 'GAP can make sense with a small down payment, but the same cover elsewhere costs a quarter of the price.' },
              { label: 'Buy it here: it is easier', credit: 0.1, why: 'Convenience costs $745 here.' },
              { label: 'Buy it here but ask to add it to the loan', credit: 0, why: 'Now you pay interest on an overpriced product too.' },
            ],
          }),
      ],
      4: [
        () =>
          pick({
            brief: 'The car has a “clean title”. But the history report shows it was registered last year in a county hit by major flooding.',
            prompt: 'What should you do?',
            options: [
              { label: 'Have an independent mechanic check for flood damage, or walk away', credit: 1, why: 'Flooded cars are sometimes moved and re-titled to hide their past. Water damage causes electrical faults and rust that appear months later.' },
              { label: 'Buy it: the title says clean', credit: 0, why: 'A clean title does not guarantee a car was never flooded.' },
              { label: 'Ask the salesperson if it was flooded', credit: 0.2, why: 'Worth asking, but the seller’s answer is not a substitute for an independent check.' },
            ],
          }),
      ],
      5: [
        () =>
          pick({
            brief: 'You signed and drove the car home. Three days later the dealer calls.',
            visual: <Say who="Dealer">Bad news, your financing fell through. Come back and sign a new contract at 12%.</Say>,
            prompt: 'What should you do?',
            options: [
              { label: 'Do not sign anything new. Return the car if needed, get your down payment back, and use your credit union loan', credit: 1, why: 'This is called a yo-yo sale. In many places, if the financing really fell through, the deal is cancelled and you are owed your deposit and trade-in back.' },
              { label: 'Sign at 12% so you can keep the car', credit: 0, why: 'This is exactly what the call is designed to make you do.' },
              { label: 'Ignore the call', credit: 0.2, why: 'Ignoring it does not solve the problem. Respond in writing and know your rights.' },
            ],
          }),
      ],
    },
    takeaways: [
      'Negotiate the out-the-door price. The monthly payment is where costs hide.',
      'Read every line of the buyer’s order. Add-ons are optional even when they are pre-printed.',
      'Multiply the payment by the months. A longer loan is a more expensive car.',
      'Arrive with a pre-approval, pay for an independent inspection, and be ready to walk.',
    ],
  };
  return <CaseRunner def={def} seed={seed} onFinish={onFinish} addReview={addReview} />;
}
