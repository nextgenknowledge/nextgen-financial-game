'use client';
/**
 * Gig or Job? (Advanced, Coding Cafe). A week driving for a delivery app against a steady job at
 * the café. Find the real hourly pay once waiting time, car costs and taxes are counted, and see
 * through the app's own numbers.
 */
import type { KindProps } from '../../types';
import { Table, usd } from '../pro/kit';
import { CaseRunner, Cards, choose, dial, flag, pick, type CaseDef } from './kit';

interface S {
  pay: number;
  hours: number;
  miles: number;
}

const PER_MILE = 0.3;

export default function GigOrJob({ seed, onFinish, addReview }: KindProps) {
  const def: CaseDef<S> = {
    kicker: 'Coding Cafe · Gig or job?',
    init: (rng) => ({ pay: rng.pick([520, 540, 580]), hours: 30, miles: rng.pick([420, 450, 480]) }),
    steps: [
      ({ s }) =>
        flag({
          brief: 'You are 19 and spent a week driving for SwiftDrop, a delivery app, using your own car. The app sends a summary.',
          prompt: 'Flag the lines that make the job look better than it is.',
          doc: {
            title: 'Your week with SwiftDrop',
            sub: 'Mon to Sun',
            skin: 'screen',
            lines: [
              { id: 'total', l: 'Total payouts, including tips', r: usd(s.pay) },
              { id: 'rate', l: 'You earned $27 per hour on deliveries!', r: '⭐' },
              { id: 'online', l: 'Time online, including waiting for orders', r: `${s.hours} hours` },
              { id: 'miles', l: 'Miles driven', r: String(s.miles) },
              { id: 'quest', l: 'So close! Do 15 more deliveries before Sunday for a $40 bonus', r: '🎯' },
              { id: 'gold', l: 'Keep your acceptance rate above 85% to stay Gold', r: '🏅' },
            ],
          },
          issues: {
            rate: '"Per hour on deliveries" leaves out all the time spent waiting and driving to restaurants. Divide by time online instead.',
            quest: 'Bonuses are timed to keep you driving longer, often at quiet hours when trips pay least.',
            gold: 'Pressure to accept nearly every order means taking trips that cost you more in fuel than they pay.',
          },
          fine: {
            total: 'The real money paid to you.',
            online: 'The honest number to divide by.',
            miles: 'The number that tells you your car costs.',
          },
        }),
      ({ s }) => {
        const net = s.pay - s.miles * PER_MILE;
        return dial({
          brief: 'Fuel and wear on your car (tires, oil, repairs and the value it loses) cost about 30¢ a mile.',
          visual: <Table head={['', '']} rows={[['Payouts', usd(s.pay)], ['Miles × $0.30', '?'], ['Hours online', String(s.hours)]]} />,
          prompt: 'What did you really earn per hour, after car costs?',
          min: 0,
          max: 30,
          step: 0.25,
          answer: Math.round((net / s.hours) * 4) / 4,
          tol: 0.3,
          fmt: (v) => usd(v, 2),
          why: `${usd(s.pay)} − ${s.miles} × $0.30 (${usd(s.miles * PER_MILE)}) = ${usd(net)}, over ${s.hours} hours = ${usd(net / s.hours, 2)} an hour. The app said $27.`,
        });
      },
      ({ s }) => {
        const gig = (s.pay - s.miles * PER_MILE) / s.hours;
        return pick({
          brief: 'The café down the street offers you a job at $17 an hour, 30 hours a week, with set shifts.',
          visual: (
            <Cards
              cards={[
                { icon: '🛵', title: 'SwiftDrop', facts: [['Pay per hour, after car costs', usd(gig, 2)], ['Payroll tax', 'You pay 15.3% yourself'], ['Schedule', 'Whenever you want'], ['If you get hurt', 'Usually no workers’ comp']] },
                { icon: '☕', title: 'Café', facts: [['Pay per hour', '$17.00'], ['Payroll tax', 'You pay 7.65%; the café pays the rest'], ['Schedule', 'Set shifts'], ['If you get hurt', 'Workers’ compensation']] },
              ]}
            />
          ),
          prompt: 'Which pays more, once everything is counted?',
          ordered: true,
          options: [
            { label: 'The café, clearly', credit: 1, why: `${usd(gig, 2)} before your extra payroll tax against $17 with half the tax paid for you. The app’s real attraction is flexibility, not pay.` },
            { label: 'SwiftDrop, because $27 an hour beats $17', credit: 0, why: 'That $27 left out waiting time, the car and the tax. It is closer to half that.' },
            { label: 'They come out about the same', credit: 0.3, why: 'Only if you ignore car costs and the extra payroll tax.' },
          ],
        });
      },
      () =>
        pick({
          brief: 'One evening, you are rear-ended while carrying a delivery. You assume your car insurance will cover it.',
          prompt: 'What might go wrong?',
          options: [
            { label: 'Personal car insurance often excludes driving for pay, so the claim could be denied unless you added rideshare cover', credit: 1, why: 'Many personal policies exclude commercial use. A rideshare or delivery add-on is usually cheap, and driving without one can leave you paying for everything.' },
            { label: 'Nothing. Insurance is insurance', credit: 0, why: 'Policies list what they exclude, and driving for money is a common exclusion.' },
            { label: 'The app’s insurance covers everything at all times', credit: 0.2, why: 'App cover often applies only during certain parts of a trip and may come with a large deductible.' },
          ],
        }),
      () =>
        choose({
          brief: 'Your cousin is about to start driving for an app and has only looked at the payouts.',
          prompt: 'Which two costs should they plan for?',
          k: 2,
          options: [
            { label: 'Car wear and the value the car loses with every mile', good: true, why: 'It does not show up until the repair bill or the trade-in, which is why it is easy to forget.' },
            { label: 'Self-employment tax on top of income tax, with nothing withheld', good: true, why: 'Nobody takes tax out of app pay. It all arrives in one bill.' },
            { label: 'Parking at home overnight', good: false, why: 'A personal cost they would have anyway.' },
            { label: 'A fee for receiving tips', good: false, why: 'Tips are passed on; there is no special fee for them.' },
          ],
        }),
      () =>
        pick({
          brief: 'So is gig work ever the right choice?',
          prompt: 'When does it make the most sense?',
          options: [
            { label: 'As flexible extra income around school or another job, with the real hourly rate in mind', credit: 1, why: 'Flexibility is genuinely valuable when your schedule changes week to week. Just compare it honestly, at the real rate, with steady work.' },
            { label: 'Never. Gig work is always a scam', credit: 0.2, why: 'It is not a scam; the pay is real. It is just lower than it looks.' },
            { label: 'Always. Being your own boss beats any job', credit: 0.1, why: 'Being your own boss also means paying your own costs, taxes and insurance.' },
          ],
        }),
    ],
    alts: {
      0: [
        ({ s }) =>
          flag({
            brief: 'You are 19 and spent a week driving passengers for RideLoop, a rideshare app, in your own car. The app sends a summary.',
            prompt: 'Flag the lines that make the job look better than it is.',
            doc: {
              title: 'Your RideLoop week',
              sub: 'Mon to Sun',
              skin: 'screen',
              lines: [
                { id: 'total', l: 'Total earnings, including tips', r: usd(s.pay + 60) },
                { id: 'gross', l: 'Riders paid $1,140 for your trips!', r: '🎉' },
                { id: 'online', l: 'Time online, including waiting', r: `${s.hours} hours` },
                { id: 'miles', l: 'Miles driven, including empty miles', r: String(s.miles) },
                { id: 'surge', l: 'Drive Saturday 2 am to 5 am for up to 2× earnings!', r: '⚡' },
                { id: 'top', l: 'You are in the top 10% of drivers this week', r: '🏆' },
              ],
            },
            issues: {
              gross: 'What riders paid is not what you earned. The gap is the app’s cut.',
              surge: '"Up to" 2× at the riskiest, most tiring hours is rarely what you actually get.',
              top: 'A ranking makes you feel successful but says nothing about your hourly pay.',
            },
            fine: {
              total: 'The real money paid to you.',
              online: 'The honest number to divide by.',
              miles: 'The number that tells you your car costs.',
            },
          }),
      ],
      1: [
        ({ s }) => {
          const net = s.pay - s.miles * PER_MILE;
          const tax = net * 0.9235 * 0.153;
          return dial({
            brief: `After car costs, your week of delivery driving earned ${usd(net)}. As a gig worker, you pay self-employment tax yourself: 15.3% on 92.35% of your earnings.`,
            prompt: 'How much self-employment tax should you set aside from this week?',
            min: 0,
            max: 100,
            step: 0.5,
            answer: Math.round(tax * 2) / 2,
            tol: 1,
            fmt: (v) => usd(v, 2),
            why: `${usd(net)} × 92.35% × 15.3% ≈ ${usd(tax, 2)}. An employee pays only half of this; the employer pays the rest. Income tax comes on top.`,
          });
        },
      ],
      2: [
        ({ s }) => {
          const gig = (s.pay - s.miles * PER_MILE) / s.hours;
          return pick({
            brief: 'A grocery store offers you $16 an hour, up to 25 hours a week, with shifts you can pick in an app each week.',
            visual: (
              <Cards
                cards={[
                  { icon: '🛵', title: 'Delivery app', facts: [['Pay per hour, after car costs', usd(gig, 2)], ['Payroll tax', 'You pay 15.3% yourself'], ['Schedule', 'Whenever you want']] },
                  { icon: '🛒', title: 'Grocery store', facts: [['Pay per hour', '$16.00'], ['Payroll tax', 'You pay 7.65%; the store pays the rest'], ['Schedule', 'Pick shifts weekly']] },
                ]}
              />
            ),
            prompt: 'Which pays more, once everything is counted?',
            ordered: true,
            options: [
              { label: 'The grocery store', credit: 1, why: `${usd(gig, 2)} before your extra payroll tax against $16 with half the tax paid for you, and the store schedule is nearly as flexible.` },
              { label: 'The delivery app', credit: 0, why: 'Only if you ignore waiting time, car costs and the extra tax.' },
              { label: 'They come out about the same', credit: 0.3, why: 'Once car costs and tax are counted, the store pays clearly more.' },
            ],
          });
        },
      ],
      3: [
        () =>
          pick({
            brief: 'After one customer complaint, the app deactivates your account without explanation. That income stops overnight.',
            prompt: 'What does this show about gig work?',
            options: [
              { label: 'Gig workers usually lack the protections employees get, so keep savings and other income options ready', credit: 1, why: 'Contractors can often be cut off with no notice or appeal. A buffer and a second source of income soften the blow.' },
              { label: 'It cannot happen; apps need drivers', credit: 0, why: 'Apps deactivate accounts regularly.' },
              { label: 'You can claim unemployment like any employee', credit: 0.2, why: 'In many places contractors cannot, or face extra hurdles.' },
            ],
          }),
      ],
      4: [
        () =>
          choose({
            brief: 'Your cousin drives for a delivery app and wants to pay as little tax as is legally allowed.',
            prompt: 'Which two records should they keep?',
            k: 2,
            options: [
              { label: 'A log of business miles driven', good: true, why: 'Mileage is often the biggest deduction for drivers, and it needs a record.' },
              { label: 'Receipts for work costs, such as an insulated bag and the business share of a phone', good: true, why: 'Genuine business costs reduce taxable profit.' },
              { label: 'Photos of every meal delivered', good: false, why: 'Not useful for tax.' },
              { label: 'Receipts for their own groceries', good: false, why: 'Personal spending is not a business cost.' },
            ],
          }),
      ],
      5: [
        () =>
          pick({
            brief: 'An app advertises "Guaranteed minimum pay of $20 an hour!" The small print says it applies to "engaged time" only.',
            prompt: 'What does that mean for you?',
            options: [
              { label: 'Only time actually on a trip counts. Waiting between orders is unpaid, so the real hourly rate is lower', credit: 1, why: 'Engaged time can be half or less of your time online. Always divide total pay by total hours.' },
              { label: 'You earn at least $20 for every hour logged in', credit: 0.1, why: 'That is what it sounds like, which is exactly why the small print matters.' },
              { label: 'It is illegal, so it does not count', credit: 0, why: 'It is legal. It is just narrower than it sounds.' },
            ],
          }),
      ],
    },
    takeaways: [
      'Divide pay by all the hours you are working, including waiting, not just time on trips.',
      'Count car costs: fuel, wear and lost value, about 30¢ a mile or more.',
      'Gig workers pay both halves of payroll tax and get no workers’ compensation.',
      'Check that your insurance covers driving for pay.',
    ],
  };
  return <CaseRunner def={def} seed={seed} onFinish={onFinish} addReview={addReview} />;
}
