'use client';
/**
 * First Account Showdown (Advanced, Bank). Four real-feeling accounts, three young customers with
 * different habits. The right account depends on how each person actually uses money, and the
 * fee schedule decides what a bad month costs.
 */
import type { KindProps } from '../../types';
import { usd } from '../pro/kit';
import { CaseRunner, Cards, Say, dial, flag, pick, type CardDef, type CaseDef } from './kit';

const ACCOUNTS: CardDef[] = [
  { icon: '🏦', title: 'Harbor Free Checking', sub: 'Branch bank', facts: [['Monthly fee', '$0'], ['Overdraft', '$35 per item'], ['Other banks’ ATMs', '$3 each'], ['Cash deposits', 'Any branch'], ['Interest', 'None'], ['Age', '18+, or 13+ with a parent']] },
  { icon: '💎', title: 'Summit Premier', sub: 'Branch bank', facts: [['Monthly fee', '$12, waived at $1,500'], ['Overdraft', '$35 per item'], ['Other banks’ ATMs', 'Free'], ['Cash deposits', 'Any branch'], ['Interest', '0.5% a year'], ['Age', '18+']] },
  { icon: '📱', title: 'Volt', sub: 'Online only', facts: [['Monthly fee', '$0'], ['Overdraft', 'Card is declined, no fee'], ['ATMs', 'Fees refunded to $10 a month'], ['Cash deposits', 'Not possible'], ['Savings interest', '4.0% a year'], ['Age', '18+']] },
  { icon: '🎓', title: 'Student Starter', sub: 'Branch bank', tag: 'Under 24', facts: [['Monthly fee', '$0 until age 24, then $8'], ['Overdraft', 'No fee under $50 short'], ['Other banks’ ATMs', '$3 each'], ['Cash deposits', 'Any branch'], ['Interest', 'None'], ['Age', '13+ with a parent on the account']] },
];

const names = ['Harbor Free Checking', 'Summit Premier', 'Volt', 'Student Starter'];

export default function AccountShowdown({ seed, onFinish, addReview }: KindProps) {
  const def: CaseDef<{ short: number; atm: number }> = {
    kicker: 'Fin City Bank · First account showdown',
    init: (rng) => ({ short: rng.pick([2, 3, 4]), atm: rng.pick([2, 3]) }),
    steps: [
      () =>
        pick({
          brief: 'Maya is 16 and lifeguards at the pool. Her $900 a month arrives by direct deposit, she pays for everything by card, and her balance is often near $20 the week before payday.',
          visual: <Cards cards={ACCOUNTS} />,
          prompt: 'Which account fits Maya?',
          ordered: true,
          options: [
            { label: names[0], credit: 0.3, why: 'She can open it with a parent, but a balance near $20 and a $35 fee per short purchase is the worst pairing on the board.' },
            { label: names[1], credit: 0, why: 'She is under 18, and she would never hold $1,500, so it would cost $144 a year in fees.' },
            { label: names[2], credit: 0.2, why: 'No overdraft fee is exactly what she needs, but Volt will not open an account for anyone under 18.' },
            { label: names[3], credit: 1, why: 'She is old enough with a parent, it costs nothing, and being a few dollars short does not trigger a fee. It is built for the way she uses money.' },
          ],
        }),
      () =>
        pick({
          brief: 'Dev is 19 and waits tables. About $300 a week of his pay is cash tips that he needs to get into his account, and he pays rent from it by transfer.',
          visual: <Cards cards={ACCOUNTS} />,
          prompt: 'Which account fits Dev?',
          ordered: true,
          options: [
            { label: names[0], credit: 0.8, why: 'Free, with branches for his cash. It works. The only weak spot is the $35 overdraft if rent lands before his tips do.' },
            { label: names[1], credit: 0.1, why: 'His balance swings with his tips, so he would often fall under $1,500 and pay the $12 fee.' },
            { label: names[2], credit: 0.1, why: 'Volt cannot take cash. He would be buying money orders or carrying tips to someone else’s account every week.' },
            { label: names[3], credit: 1, why: 'Branches for his cash, no fee until 24, and forgiveness when he is a few dollars short. He qualifies on age, so there is no reason to take the stricter account.' },
          ],
        }),
      () =>
        pick({
          brief: 'Lena is 22. She has saved $6,000 toward a car she plans to buy in about eight months, and she will not touch the money until then.',
          visual: <Cards cards={ACCOUNTS} />,
          prompt: 'Where should the $6,000 sit?',
          ordered: true,
          options: [
            { label: names[0], credit: 0.1, why: 'Safe, but it earns nothing. Eight months at 0% leaves about $160 on the table compared with Volt.' },
            { label: names[1], credit: 0.4, why: 'She clears the $1,500 minimum so it is free, but 0.5% earns only about $20 in eight months.' },
            { label: names[2], credit: 1, why: 'She does not need branches or cash deposits for parked money. At 4.0% the $6,000 earns about $160 in eight months, and it is still insured.' },
            { label: names[3], credit: 0.1, why: 'Free for her, but it pays no interest. This money’s only job is to wait safely and earn.' },
          ],
        }),
      ({ s }) =>
        flag({
          brief: (
            <>
              Suppose Maya had picked Harbor Free Checking. In one bad month she makes {s.short} card purchases while her balance is short, and takes cash from another bank’s ATM {s.atm} times. She only uses the app and has paperless statements.
            </>
          ),
          prompt: 'Flag the lines that charge her this month.',
          doc: {
            title: 'Harbor Free Checking',
            sub: 'Schedule of fees',
            skin: 'statement',
            lines: [
              { id: 'h1', l: 'Everyday fees', head: true },
              { id: 'monthly', l: 'Monthly maintenance fee', r: '$0.00' },
              { id: 'paper', l: 'Paper statement by post', r: '$3.00 / month' },
              { id: 'od', l: 'Overdraft, per item paid while short (up to 4 a day)', r: '$35.00' },
              { id: 'atm', l: 'Withdrawal at another bank’s ATM (the machine’s owner may add about $3.50)', r: '$3.00' },
              { id: 'h2', l: 'Occasional fees', head: true },
              { id: 'card', l: 'Replacement debit card', r: '$5.00' },
              { id: 'idle', l: 'Inactivity, after 12 months with no transactions', r: '$5.00 / month' },
              { id: 'wire', l: 'Outgoing wire transfer', r: '$25.00' },
            ],
            foot: 'Deposits are FDIC insured up to $250,000.',
          },
          issues: {
            od: 'Each purchase made while short costs $35, even a $4 snack. This is the fee that turns a small mistake into a big one.',
            atm: 'She pays twice: $3 to her own bank and about $3.50 to the machine’s owner, every time.',
          },
          fine: {
            paper: 'She has paperless statements, so this never applies to her.',
            idle: 'She uses the account every week. Inactivity fees only hit forgotten accounts.',
            monthly: 'It is $0. The free part of "free checking" is true; the fees live elsewhere.',
            card: 'Only charged if she loses her card.',
            wire: 'She is not sending wires.',
          },
        }),
      ({ s }) =>
        dial({
          brief: `Add it up: ${s.short} overdrafts at $35, and ${s.atm} ATM withdrawals at $3 plus about $3.50 to the machine’s owner.`,
          prompt: 'What did that month cost Maya in fees?',
          min: 0,
          max: 250,
          step: 1,
          answer: s.short * 35 + s.atm * 6.5,
          tol: 3,
          fmt: (v) => usd(v, 2),
          why: `${s.short} × $35 = ${usd(s.short * 35)} and ${s.atm} × $6.50 = ${usd(s.atm * 6.5, 2)}. That is ${usd(s.short * 35 + s.atm * 6.5, 2)} out of a $900 paycheck, on an account with no monthly fee.`,
        }),
      () =>
        pick({
          brief: 'The banker offers Maya "overdraft coverage" for her card.',
          visual: <Say who="Banker">It means your card will never be embarrassingly declined at the register. We cover the purchase and charge the standard $35 fee.</Say>,
          prompt: 'What should she do?',
          options: [
            { label: 'Say no. With coverage off, a purchase she cannot afford is simply declined, for free', credit: 1, why: 'Banks must ask before adding this to a debit card. Declined costs $0. "Covered" costs $35 for the same snack.' },
            { label: 'Say yes. A declined card is worse than a fee', credit: 0, why: 'A decline is a free warning. The coverage is the product that earns banks billions from customers with low balances.' },
            { label: 'Say no, and turn on low-balance alerts in the app', credit: 1, why: 'Declining the coverage removes the fee, and an alert at $50 removes the surprise. Both are free.' },
            { label: 'Say yes, but promise herself to be careful', credit: 0.1, why: 'Her balance sits near $20 before every payday. Careful is not a plan when one tap costs $35.' },
          ],
        }),
    ],
    alts: {
      0: [
        () =>
          pick({
            brief: 'Omar is 15. He earns about $60 a week babysitting, paid in cash, and is saving for a phone. He rarely buys anything by card.',
            visual: <Cards cards={ACCOUNTS} />,
            prompt: 'Which account fits Omar?',
            ordered: true,
            options: [
              { label: names[0], credit: 0.7, why: 'He can open it with a parent and deposit cash at a branch. It works, but Student Starter does the same and forgives small slips.' },
              { label: names[1], credit: 0, why: 'He is under 18, and he will not hold $1,500 for a long time.' },
              { label: names[2], credit: 0, why: 'Volt is for 18 and over, and it cannot take cash, which is all he earns.' },
              { label: names[3], credit: 1, why: 'Opened with a parent, free, and branches take his cash. Ideal for a first account.' },
            ],
          }),
      ],
      1: [
        () =>
          pick({
            brief: 'Theo is 25 and works at an insurance office. His balance never drops below $2,000, he likes to sort things out in a branch, and he uses other banks’ ATMs often.',
            visual: <Cards cards={ACCOUNTS} />,
            prompt: 'Which account fits Theo?',
            ordered: true,
            options: [
              { label: names[0], credit: 0.5, why: 'Free, but every trip to another bank’s ATM costs $3, and it pays no interest on his steady balance.' },
              { label: names[1], credit: 1, why: 'He stays above $1,500, so the fee is waived. He gets branches, free ATMs at other banks and a little interest.' },
              { label: names[2], credit: 0.6, why: 'Great rates, but he wants a branch, and Volt has none.' },
              { label: names[3], credit: 0, why: 'He is over 24, so it would cost $8 a month for fewer features.' },
            ],
          }),
      ],
      2: [
        () =>
          pick({
            brief: 'Jordan is 18. He has $3,000 saved for college books and a laptop, which he will need in a year. He will not touch it before then.',
            visual: <Cards cards={ACCOUNTS} />,
            prompt: 'Where should the $3,000 sit?',
            ordered: true,
            options: [
              { label: names[0], credit: 0.1, why: 'Safe but earns nothing. A year at 0% leaves about $120 behind compared with Volt.' },
              { label: names[1], credit: 0.4, why: 'He clears the $1,500 minimum, but 0.5% earns only about $15 in a year.' },
              { label: names[2], credit: 1, why: 'He is 18, the money needs no branch, and 4.0% earns about $120 in a year, still insured.' },
              { label: names[3], credit: 0.1, why: 'Free, but no interest. Money that waits should earn.' },
            ],
          }),
      ],
      3: [
        () =>
          flag({
            brief: 'Dev turned 24 and kept his Student Starter account. This month he got paper statements in the post, sent one wire for a flat deposit, and was $20 short for one day.',
            prompt: 'Flag the lines that charge him this month.',
            doc: {
              title: 'Student Starter',
              sub: 'Schedule of fees',
              skin: 'statement',
              lines: [
                { id: 'h1', l: 'Everyday fees', head: true },
                { id: 'monthly', l: 'Monthly fee from age 24', r: '$8.00' },
                { id: 'paper', l: 'Paper statement by post', r: '$2.00 / month' },
                { id: 'od', l: 'Overdraft, only if more than $50 short', r: '$35.00' },
                { id: 'h2', l: 'Occasional fees', head: true },
                { id: 'wire', l: 'Outgoing wire transfer', r: '$25.00' },
                { id: 'card', l: 'Replacement debit card', r: '$5.00' },
                { id: 'idle', l: 'Inactivity, after 12 months with no transactions', r: '$5.00 / month' },
              ],
              foot: 'Deposits are FDIC insured up to $250,000.',
            },
            issues: {
              monthly: 'The free period ended at 24. Accounts change their terms as you age, so check when they do.',
              paper: 'He still gets paper statements, which cost $2 a month. Switching to paperless is free.',
              wire: 'He sent one wire, so this applies once.',
            },
            fine: {
              od: 'He was only $20 short, under the $50 cushion, so no fee.',
              card: 'He did not lose his card.',
              idle: 'He uses the account every week.',
            },
          }),
      ],
      4: [
        ({ s }) =>
          dial({
            brief: `Dev kept Student Starter after turning 24. This month: the $8 monthly fee, $2 for paper statements, one $25 wire, and ${s.atm} withdrawals at other banks’ ATMs at $3 plus about $3.50 to the machine’s owner.`,
            prompt: 'What did the month cost Dev in fees?',
            min: 0,
            max: 120,
            step: 0.5,
            answer: 35 + s.atm * 6.5,
            tol: 2,
            fmt: (v) => usd(v, 2),
            why: `$8 + $2 + $25 = $35, plus ${s.atm} × $6.50 = ${usd(s.atm * 6.5, 2)}. Total ${usd(35 + s.atm * 6.5, 2)}. Moving to a free account with ATM refunds would save most of it.`,
          }),
      ],
      5: [
        () =>
          pick({
            brief: 'The banker offers Maya a different plan for short days.',
            visual: <Say who="Banker">Link your savings account. If checking runs short, we move money across for a $10 transfer fee instead of the $35 overdraft.</Say>,
            prompt: 'What is her best choice?',
            options: [
              { label: 'Turn overdraft coverage off and set a low-balance alert, so a short purchase is just declined for free', credit: 1, why: 'A decline costs nothing and the alert warns her early. No fee at all beats a smaller fee.' },
              { label: 'Link savings: $10 is better than $35', credit: 0.6, why: 'It is cheaper than an overdraft, but it is still a fee every time, and she may not have savings to move.' },
              { label: 'Keep the standard $35 coverage', credit: 0, why: 'This is the most expensive option on the table.' },
            ],
          }),
      ],
    },
    takeaways: [
      'There is no best account, only the best one for how a person actually uses money.',
      '"Free checking" usually is free, until the month you are short. Read the overdraft line first.',
      'Money you will not touch for months belongs where it earns interest, not in checking.',
      'Turning off debit overdraft coverage and turning on balance alerts costs nothing and prevents the most common bank fee.',
    ],
  };
  return <CaseRunner def={def} seed={seed} onFinish={onFinish} addReview={addReview} />;
}
