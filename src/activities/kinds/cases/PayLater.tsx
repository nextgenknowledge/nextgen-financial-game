'use client';
/**
 * Pay Later Trap (Advanced, Department Store). Three months of shopping with buy-now-pay-later at
 * checkout. Each plan is interest free and small on its own; the trap is how they stack, what a
 * missed payment costs, and the "longer plan" that is really a loan.
 */
import type { KindProps } from '../../types';
import { Table } from '../pro/kit';
import { CaseRunner, Cards, Feed, dial, flag, pick, type CaseDef } from './kit';

const gbp = (v: number) => `£${Math.round(v).toLocaleString('en-GB')}`;

interface Plan {
  what: string;
  each: number;
  left: number;
}

interface S {
  savings: number;
  plans: Plan[];
  late: number;
}

const due = (s: S) => s.plans.reduce((a, p) => a + (p.left > 0 ? p.each : 0), 0);
const owed = (s: S) => s.plans.reduce((a, p) => a + p.each * p.left, 0);
const add = (what: string, total: number) => (s: S) => void s.plans.push({ what, each: total / 3, left: 3 });
const payMonth = (s: S) => s.plans.forEach((p) => (p.left = Math.max(0, p.left - 1)));

export default function PayLater({ seed, onFinish, addReview }: KindProps) {
  const def: CaseDef<S> = {
    kicker: 'Department Store · Pay later trap',
    init: (rng) => ({ savings: rng.pick([180, 220, 260]), plans: [], late: 0 }),
    meters: (s) => [
      ['Savings', gbp(s.savings), s.savings < 50 ? 'bad' : undefined],
      ['Plans open', String(s.plans.filter((p) => p.left > 0).length), s.plans.filter((p) => p.left > 0).length > 2 ? 'bad' : undefined],
    ],
    steps: [
      ({ s }) =>
        pick({
          brief: `You are 18, working weekends for about £600 a month. Bills, travel and phone take £430, leaving £170 a month spare, plus ${gbp(s.savings)} in savings. You have wanted these £120 trainers for weeks.`,
          visual: <Cards cards={[{ icon: '👟', title: 'Runner X trainers', sub: '£120', tag: 'Pay in 3', facts: [['Pay now', '£120'], ['Or', '3 monthly payments of £40, 0% interest']] }]} />,
          prompt: 'How do you pay?',
          options: [
            { label: 'Pay in 3. It is interest free and keeps my savings intact', credit: 0.8, why: 'Used once, for something planned, a 0% plan is genuinely free. The risk is that it rarely stays at one.', apply: add('Trainers', 120) },
            { label: 'Pay £120 from savings now', credit: 0.9, why: 'Clean and simple: nothing owed. It does drain the savings that cover surprises.', apply: (st) => void (st.savings -= 120) },
            { label: 'Wait a month and pay from what is left after bills', credit: 1, why: 'With £170 spare each month, waiting one month pays for them in full and keeps savings untouched. Patience is the cheapest credit there is.' },
          ],
        }),
      () =>
        pick({
          brief: 'Two weeks later. Payday is ten days away and a jacket you like is on sale. At checkout, the same button appears again. Then a concert goes on sale too.',
          visual: (
            <Table
              head={['In your basket', 'Price', 'Pay in 3']}
              rows={[
                ['Jacket, 30% off', '£90', '£30 a month'],
                ['Concert ticket', '£150', '£50 a month'],
              ]}
            />
          ),
          prompt: 'What do you do?',
          options: [
            { label: 'Put both on Pay in 3. Each payment is small', credit: 0, why: 'Each plan is small. Together with the trainers they can take most of your spare money for three months.', apply: (st) => (add('Jacket', 90)(st), add('Concert', 150)(st)) },
            { label: 'Buy the concert ticket on Pay in 3 and skip the jacket', credit: 0.6, why: 'The concert will sell out; the jacket will go on sale again. Still another plan to carry.', apply: add('Concert', 150) },
            { label: 'Skip both until payday, then buy what still fits the budget', credit: 1, why: 'If you cannot pay today, ask whether you can really pay in a month, and the month after. Waiting until payday answers that honestly.' },
            { label: 'Buy both from savings', credit: 0.3, why: 'Nothing is owed, but £240 of wants just emptied the emergency money.', apply: (st) => void (st.savings -= 240) },
          ],
        }),
      ({ s }) =>
        dial({
          brief: 'The app shows each plan separately, so you write them all down.',
          visual: s.plans.length ? <Table head={['Plan', 'Monthly payment', 'Payments left']} rows={s.plans.map((p) => [p.what, gbp(p.each), String(p.left)])} /> : <Table head={['Plan', 'Monthly payment']} rows={[['No plans open', '£0']]} />,
          prompt: 'How much is due next month, in total?',
          min: 0,
          max: 250,
          step: 5,
          answer: due(s),
          tol: 5,
          fmt: (v) => gbp(v),
          why: s.plans.length ? `${s.plans.map((p) => gbp(p.each)).join(' + ')} = ${gbp(due(s))} out of £170 spare. Each app only shows its own plan, which is why stacked plans surprise people.` : 'Nothing at all. All of your £170 spare money is yours next month.',
        }),
      () =>
        flag({
          brief: 'Before next month, you read the terms you clicked through.',
          prompt: 'Flag the terms that could cost you money or hurt your credit.',
          doc: {
            title: 'Pay in 3: Terms',
            sub: 'Summary',
            skin: 'contract',
            lines: [
              { id: 'zero', l: 'Pay in three equal monthly instalments with 0% interest.' },
              { id: 'auto', l: 'Payments are taken automatically from your debit card on the due date.' },
              { id: 'late', l: 'A missed payment incurs a £6 fee, plus a further £6 if still unpaid after 7 days.' },
              { id: 'credit', l: 'We share repayment information, including missed payments, with credit reference agencies.' },
              { id: 'longer', l: 'Need longer? Switch to Pay in 12 at 29.9% APR in one tap.' },
              { id: 'collect', l: 'Unpaid balances may be passed to a debt collection agency.' },
              { id: 'refund', l: 'Returns are refunded to your plan once the shop confirms the return.' },
            ],
          },
          issues: {
            late: 'Two fees on one missed £30 payment is a 40% penalty. Fees stack across plans too.',
            credit: 'Missed payments can now appear on your credit file, making a phone contract or flat harder to get later.',
            longer: 'One tap turns a free plan into a credit card-level loan. 29.9% is far above most personal loans.',
            collect: 'Debt collection follows you for years and is much harder to fix than a late fee.',
          },
          fine: {
            zero: 'Genuinely interest free, if every payment is on time.',
            auto: 'Normal for these plans. It does mean you must keep the money in your account.',
            refund: 'Fair, though keep paying until the refund actually lands.',
          },
        }),
      ({ s }) => {
        const owe = due(s);
        return pick({
          brief: owe > 0 ? `Month 3. Your shifts are cut and you earn £420. After bills you have nothing spare, and ${gbp(owe)} of plan payments are due on Friday. Savings: ${gbp(s.savings)}.` : `Month 3. Your shifts are cut and you earn £420. After bills you have nothing spare. Luckily, you owe nothing on any plan. Savings: ${gbp(s.savings)}.`,
          visual: owe > 0 ? <Feed posts={[{ who: 'PayLater', text: `Struggling this month? Switch your plans to Pay in 12 and pay just ${gbp((owed(s) * 1.15) / 12)} a month!`, tone: 'ad' }]} /> : undefined,
          prompt: owe > 0 ? 'What do you do?' : 'A friend in the same position asks what they should do. What is the best advice?',
          options: [
            { label: 'Pay from savings, cut spending until it is cleared, and open no new plans', credit: 1, why: 'Savings exist for exactly this. Clearing the plans stops the fees, protects your credit file and shrinks next month’s problem.', apply: (st) => void ((st.savings -= owe), payMonth(st)) },
            { label: 'Switch everything to Pay in 12', credit: 0.2, why: 'The monthly figure looks smaller, but you would pay about 15% more in total and stay in debt for a year.', apply: (st) => void ((st.savings -= owe * 0.2), payMonth(st)) },
            { label: 'Let the payments fail and sort it out next month', credit: 0, why: 'Late fees on every plan, possible marks on your credit file, and next month you owe two months at once.', apply: (st) => void ((st.late += st.plans.filter((p) => p.left > 0).length * 12), payMonth(st)) },
            { label: 'Use the overdraft to cover them', credit: 0.4, why: 'Better than missing payments, but an unarranged overdraft can charge around 40% a year. Use savings first.', apply: (st) => void payMonth(st) },
          ],
        });
      },
      () =>
        pick({
          brief: 'Shops pay Pay-in-3 companies a fee on every sale, often several percent, more than they pay for card payments.',
          prompt: 'Why would a shop happily pay extra for you to use it?',
          options: [
            { label: 'Because shoppers who can split payments buy more and spend more per basket', credit: 1, why: 'Splitting the price makes each purchase feel smaller, so people buy things they would have left behind. The fee is worth it for the extra sales.' },
            { label: 'Because the law makes them', credit: 0, why: 'Shops choose to offer it, because it sells more.' },
            { label: 'To help young people build credit', credit: 0.1, why: 'Some plans now report to credit agencies, but that is not why shops pay for them.' },
          ],
        }),
    ],
    alts: {
      0: [
        ({ s }) =>
          pick({
            brief: `You are 18, working weekends for about £600 a month. Bills, travel and phone take £430, leaving £170 a month spare, plus ${gbp(s.savings)} in savings. Your headphones just broke and the pair you want costs £150.`,
            visual: <Cards cards={[{ icon: '🎧', title: 'Studio Max headphones', sub: '£150', tag: 'Pay in 3', facts: [['Pay now', '£150'], ['Or', '3 monthly payments of £50, 0% interest']] }]} />,
            prompt: 'How do you pay?',
            options: [
              { label: 'Pay in 3. It is interest free', credit: 0.8, why: 'One planned 0% plan, paid on time, costs nothing extra. The danger is adding more.', apply: add('Headphones', 150) },
              { label: 'Pay £150 from savings now', credit: 0.9, why: 'Nothing owed, but your emergency money takes a hit.', apply: (st) => void (st.savings -= 150) },
              { label: 'Buy a £40 pair to get by, and save up for the good ones', credit: 1, why: 'You still have headphones today, owe nothing, and can buy the good pair in a month from spare money.', apply: (st) => void (st.savings -= 40) },
            ],
          }),
      ],
      1: [
        () =>
          pick({
            brief: 'Late at night, scrolling. A games sale ends at midnight and a festival day ticket is on sale. Both offer Pay in 3 at checkout.',
            visual: (
              <Table
                head={['In your basket', 'Price', 'Pay in 3']}
                rows={[
                  ['Three games, 50% off', '£60', '£20 a month'],
                  ['Festival day ticket', '£135', '£45 a month'],
                ]}
              />
            ),
            prompt: 'What do you do?',
            options: [
              { label: 'Put both on Pay in 3. Each payment is small', credit: 0, why: 'Two more plans on top of anything you already owe. Late-night deals are designed for exactly this.', apply: (st) => (add('Games', 60)(st), add('Festival', 135)(st)) },
              { label: 'Buy the festival ticket on Pay in 3 and skip the games', credit: 0.6, why: 'The games will be on sale again. Still another plan to carry.', apply: add('Festival', 135) },
              { label: 'Sleep on it and check the budget in the morning', credit: 1, why: 'Countdown sales rely on rushed decisions. If it is still worth it tomorrow, and fits the budget, buy it then.' },
              { label: 'Buy both from savings', credit: 0.3, why: 'Nothing owed, but £195 of wants just came out of your emergency money.', apply: (st) => void (st.savings -= 195) },
            ],
          }),
      ],
      2: [
        ({ s }) =>
          dial({
            brief: 'Each app shows only its own plan, so you list them all to see the full picture.',
            visual: s.plans.length ? <Table head={['Plan', 'Monthly payment', 'Payments left']} rows={s.plans.map((p) => [p.what, gbp(p.each), String(p.left)])} /> : <Table head={['Plan', 'Monthly payment']} rows={[['No plans open', '£0']]} />,
            prompt: 'How much do you still owe across every plan, in total?',
            min: 0,
            max: 500,
            step: 5,
            answer: owed(s),
            tol: 5,
            fmt: (v) => gbp(v),
            why: s.plans.length ? `Add up each monthly payment times the payments left: ${gbp(owed(s))} in total. That is money already spent from your future pay.` : 'Nothing. Your future pay is entirely yours.',
          }),
      ],
      3: [
        () =>
          flag({
            brief: 'A different pay-later app offers to "help you manage your plans". You read its terms.',
            prompt: 'Flag the terms that could cost you money or hurt your credit.',
            doc: {
              title: 'FlexiPay: Terms',
              sub: 'Summary',
              skin: 'contract',
              lines: [
                { id: 'zero', l: 'Pay in 4 fortnightly payments, 0% interest.' },
                { id: 'limit', l: 'Your spending limit rises automatically each time you pay on time.' },
                { id: 'late', l: 'Late fee: £8 per missed payment, up to 25% of the purchase.' },
                { id: 'retry', l: 'Failed payments are retried daily; your bank may charge for each failed attempt.' },
                { id: 'refund', l: 'Refunds are credited once the shop confirms the return.' },
                { id: 'cancel', l: 'You can close your account at any time once nothing is owed.' },
              ],
            },
            issues: {
              limit: 'A limit that grows on its own encourages bigger and more frequent borrowing.',
              late: 'Up to a quarter of the price in fees is a steep penalty for one slip.',
              retry: 'Daily retries can trigger repeated charges from your own bank on top of the late fee.',
            },
            fine: {
              zero: 'Interest free if every payment is on time.',
              refund: 'Fair, though keep paying until the refund lands.',
              cancel: 'Normal and reasonable.',
            },
          }),
      ],
      4: [
        ({ s }) => {
          const owe = due(s);
          return pick({
            brief: owe > 0 ? `Month 3. Your phone screen cracks and the repair is £90. ${gbp(owe)} of plan payments are also due this week. Savings: ${gbp(s.savings)}, and £170 spare this month.` : `Month 3. Your phone screen cracks and the repair is £90. You owe nothing on any plan. Savings: ${gbp(s.savings)}, and £170 spare this month.`,
            visual: owe > 0 ? <Feed posts={[{ who: 'PayLater', text: 'Repair it now, pay later! Split the £90 into 3.', tone: 'ad' }]} /> : undefined,
            prompt: owe > 0 ? 'What do you do?' : 'A friend in the same position asks what to do. What is the best advice?',
            options: [
              { label: 'Pay the plans and the repair from this month’s spare money and savings, and open no new plans', credit: 1, why: 'Clearing what you owe stops fees and keeps your credit file clean. An unexpected cost is exactly what savings are for.', apply: (st) => void ((st.savings -= Math.max(0, owe + 90 - 170)), payMonth(st)) },
              { label: 'Put the repair on another Pay in 3', credit: 0.3, why: 'Another plan stacked on the others. It works until the next surprise.', apply: (st) => void (add('Phone repair', 90)(st), payMonth(st)) },
              { label: 'Skip this month’s plan payments to cover the repair', credit: 0, why: 'Late fees on every plan, and missed payments can show on your credit file.', apply: (st) => void ((st.late += st.plans.filter((p) => p.left > 0).length * 12), payMonth(st)) },
            ],
          });
        },
      ],
      5: [
        () =>
          pick({
            brief: 'Pay-in-3 companies charge shoppers no interest when they pay on time.',
            prompt: 'So where does most of their money come from?',
            options: [
              { label: 'Fees from shops on every sale, plus late fees and interest on longer plans', credit: 1, why: 'Shops pay because these plans increase sales. Late fees and longer interest-charging plans add the rest.' },
              { label: 'They run at a loss to help shoppers', credit: 0, why: 'They are businesses. The money comes from shop fees and from customers who slip up.' },
              { label: 'Selling the products themselves', credit: 0, why: 'They do not sell goods. They lend you the price.' },
            ],
          }),
      ],
    },
    outcome: (s) => ({
      headline: s.late > 0 ? `Hit with ${gbp(s.late)} in late fees` : s.plans.length === 0 ? 'No plans, no stress' : `Got through it with ${gbp(Math.max(0, s.savings))} saved`,
      bonus: s.late > 0 ? -8 : s.plans.length <= 1 ? 4 : 0,
    }),
    takeaways: [
      'Each pay-later plan looks small. Add them all up, because the apps will not do it for you.',
      'If you cannot afford it today, check honestly whether you can afford it next month and the month after.',
      'Missed payments bring fees and can now show on your credit file.',
      'A "longer plan" with an APR is a loan. Compare it to one.',
    ],
  };
  return <CaseRunner def={def} seed={seed} onFinish={onFinish} addReview={addReview} />;
}
