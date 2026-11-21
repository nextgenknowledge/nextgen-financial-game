'use client';
/**
 * Whose Score Tanks? (Advanced, Credit Bureau). Five people start the year at the same score and
 * handle credit five different ways. Predict where each one lands before the bureau shows it.
 */
import type { KindProps } from '../../types';
import { Bars, C, usd } from '../pro/kit';
import { CaseRunner, Cards, dial, pick, type CardDef, type CaseDef } from './kit';

const PEOPLE: CardDef[] = [
  { icon: '👩', title: 'Aisha', sub: 'Starts at 700', facts: [['Cards', 'One, $2,000 limit'], ['Spends', '$300 a month'], ['Pays', 'In full, on time']] },
  { icon: '🧑', title: 'Ben', sub: 'Starts at 700', facts: [['Cards', 'One, $3,000 limit'], ['Balance', '$2,700, all year'], ['Pays', 'Minimum, always on time']] },
  { icon: '🧑', title: 'Cam', sub: 'Starts at 700', facts: [['Cards', 'One, $2,000 limit'], ['Balance', 'Under $200'], ['Pays', 'Forgot twice, 30+ days late']] },
  { icon: '👩', title: 'Dee', sub: 'Starts at 700', facts: [['Cards', 'Opened 5 new ones in 3 months'], ['Why', 'Sign-up bonuses'], ['Pays', 'In full, on time']] },
  { icon: '🧑', title: 'Eli', sub: 'Starts with no file', facts: [['Cards', 'None'], ['Pays with', 'Debit and cash'], ['Bills', 'Never late on anything']] },
];
const END = [
  { label: 'Aisha', value: 742, color: C.green },
  { label: 'Dee', value: 681, color: C.gold },
  { label: 'Ben', value: 652, color: C.gold },
  { label: 'Cam', value: 604, color: C.red },
];
const who = ['Aisha', 'Ben', 'Cam', 'Dee', 'Eli'];

export default function ScoreTanks({ seed, onFinish, addReview }: KindProps) {
  const def: CaseDef<{ limit: number; bal: number }> = {
    kicker: 'Credit Bureau · Whose score tanks?',
    init: (rng) => {
      const limit = rng.pick([3000, 4000, 5000]);
      return { limit, bal: limit * 0.9 };
    },
    steps: [
      () =>
        pick({
          brief: 'Five friends, one year. Four start at a score of 700 and one has never borrowed. Here is how each handled credit.',
          visual: <Cards cards={PEOPLE} />,
          prompt: 'Who ends the year with the LOWEST score?',
          ordered: true,
          options: who.map((n, i) => ({
            label: n,
            credit: [0, 0.3, 1, 0.1, 0.2][i],
            why: [
              'Aisha did everything the scoring models reward: low use of her limit and a perfect payment record.',
              'Ben is hurt badly by using 90% of his limit, but he never missed a payment, and payment history weighs more.',
              'Payment history is the largest part of a score, about 35%. Two payments 30 days late can cost 80 to 100 points and stay on the report for seven years.',
              'Five applications cost Dee a few points each and lower her average account age, but those dips are small and fade within a year.',
              'Eli has no score at all rather than a low one. That is its own problem, but it is not the lowest score.',
            ][i],
          })),
        }),
      () =>
        pick({
          brief: 'Same five people.',
          visual: <Cards cards={PEOPLE} />,
          prompt: 'Who ends with the HIGHEST score?',
          ordered: true,
          options: who.map((n, i) => ({
            label: n,
            credit: [1, 0, 0, 0.3, 0][i],
            why: [
              'On time, every time, using 15% of her limit. Boring is exactly what scores well.',
              'On-time payments help Ben, but a card that is 90% full signals someone stretched thin.',
              'Late payments are the single most damaging everyday mistake.',
              'Dee pays perfectly and her new limits lower her utilization, but five hard inquiries and brand-new accounts hold her under Aisha this year.',
              'With no borrowing on file, the bureaus have nothing to score.',
            ][i],
          })),
        }),
      () =>
        pick({
          brief: 'Eli is proud of never owing anyone a cent. He applies for an apartment, and the landlord runs a credit check.',
          prompt: 'What does the landlord see?',
          options: [
            { label: 'Almost nothing: a "thin file" with no score, which many landlords treat like a poor one', credit: 1, why: 'Debit, cash and most bills are not reported. With no borrowing history there is no score, and lenders and landlords cannot tell a careful person from a risky one.' },
            { label: 'An excellent score, because he has never missed a payment', credit: 0, why: 'His on-time debit and cash payments were never reported to anyone, so they earn him nothing.' },
            { label: 'A low score, because he has never had credit', credit: 0.4, why: 'Close, but the report shows no score at all rather than a low number. The effect on his application is often similar.' },
            { label: 'His bank balance and income', credit: 0, why: 'Credit reports do not include balances in bank accounts or income. They only show borrowing and repayment.' },
          ],
        }),
      ({ s }) =>
        dial({
          brief: `Ben wants his score back. His limit is ${usd(s.limit)} and he owes ${usd(s.bal)}. Lenders like to see less than 30% of a limit in use.`,
          prompt: 'His balance needs to be under what amount?',
          min: 0,
          max: s.limit,
          step: 50,
          answer: s.limit * 0.3,
          tol: 50,
          fmt: (v) => usd(v),
          why: `30% of ${usd(s.limit)} is ${usd(s.limit * 0.3)}. Utilization has no memory: the month his reported balance drops, most of the lost points come back.`,
        }),
      () =>
        pick({
          brief: 'Cam is shaken by his score and wants to fix it fast. He has four ideas.',
          prompt: 'Which one actually works?',
          options: [
            { label: 'Turn on autopay for at least the minimum, and let on-time months pile up', credit: 1, why: 'Late marks cannot be erased if they are accurate, but they count for less every month. Autopay makes the mistake impossible to repeat.' },
            { label: 'Pay a "credit repair" company $500 to delete the late payments', credit: 0, why: 'Nobody can legally remove accurate information. Companies that promise it are selling something he can do himself for free, or a scam.' },
            { label: 'Close the card so the late payments disappear', credit: 0, why: 'Closed accounts and their late marks stay on the report for seven years. Closing it also removes his available credit.' },
            { label: 'Open two new cards to bury the bad one', credit: 0.2, why: 'New accounts add inquiries and lower his average age, and a lender may decline him right now. Time and clean months are the fix.' },
          ],
        }),
      () =>
        pick({
          brief: 'Dee wants a car loan next month. Her five new cards are three months old.',
          prompt: 'What will the car lender most likely do?',
          options: [
            { label: 'Offer a higher interest rate than she would have got six months ago', credit: 1, why: 'A burst of new accounts looks like someone who suddenly needs credit. A point or two of extra interest on a car loan costs more than the sign-up bonuses earned.' },
            { label: 'Offer a better rate, since she has more available credit', credit: 0.1, why: 'More available credit helps utilization, but recent applications are what an auto lender notices first.' },
            { label: 'Ignore the cards, because car loans use a different report', credit: 0, why: 'Auto lenders pull the same credit reports, often with a score built to predict car loan risk.' },
            { label: 'Refuse outright: five cards means automatic denial', credit: 0.2, why: 'Not automatic. She pays on time, so she will probably be approved, at a worse price.' },
          ],
        }),
    ],
    alts: {
      0: [
        () =>
          pick({
            brief: 'Five friends, one year. Four start at a score of 700 and one has never borrowed. Then every card company cuts limits in half after a downturn.',
            visual: <Cards cards={PEOPLE} />,
            prompt: 'Whose score is hit hardest by the limit cut?',
            ordered: true,
            options: who.map((n, i) => ({
              label: n,
              credit: [0.1, 1, 0.2, 0.2, 0][i],
              why: [
                'Aisha goes from using 15% of her limit to 30%. Higher, but still fine.',
                'Ben owes $2,700. Halving his $3,000 limit leaves him over the new $1,500 limit, about 180% used. That is a big drop in his score.',
                'Cam’s balance is small, so the cut barely moves his utilization. His late payments are his real problem.',
                'Dee has five cards and small balances. Even halved, her total limit is large compared with what she owes.',
                'Eli has no cards, so a limit cut cannot touch him.',
              ][i],
            })),
          }),
      ],
      1: [
        () =>
          pick({
            brief: 'Same five people.',
            visual: <Cards cards={PEOPLE} />,
            prompt: 'Whose damage stays on the credit report the longest?',
            ordered: true,
            options: who.map((n, i) => ({
              label: n,
              credit: [0, 0.2, 1, 0.3, 0][i],
              why: [
                'Aisha has nothing negative on her report.',
                'High utilization has no memory. The month Ben pays down, most points come back.',
                'Late payments stay on the report for seven years, though they hurt less as time passes.',
                'Hard inquiries stay for two years and usually only affect the score for about one.',
                'Eli has no file, so there is nothing negative on it.',
              ][i],
            })),
          }),
      ],
      2: [
        () =>
          pick({
            brief: 'Eli decides he wants a credit score before he applies for an apartment next year.',
            prompt: 'What is the safest way to build one?',
            options: [
              { label: 'A secured card with a small limit, used for one bill a month and paid in full', credit: 1, why: 'A secured card is backed by his own deposit, so the risk is low. A year of small, on-time payments builds a solid score.' },
              { label: 'Become an authorized user on a parent’s well-managed card', credit: 0.8, why: 'This can add their good history to his file quickly, as long as they pay on time and keep the balance low.' },
              { label: 'Open three store cards at once for the discounts', credit: 0.2, why: 'Several applications at once and high-rate store cards are a poor start.' },
              { label: 'Take a small payday loan and pay it back', credit: 0, why: 'Payday loans usually are not reported to the bureaus at all, and they cost a fortune in fees.' },
            ],
          }),
      ],
      3: [
        ({ s }) =>
          dial({
            brief: `Ben’s limit is ${usd(s.limit)} and he owes ${usd(s.bal)}. Under 10% of the limit in use earns the best scores.`,
            prompt: 'How much must Ben pay off to get down to 10%?',
            min: 0,
            max: s.limit,
            step: 50,
            answer: s.bal - s.limit * 0.1,
            tol: 50,
            fmt: (v) => usd(v),
            why: `10% of ${usd(s.limit)} is ${usd(s.limit * 0.1)}. ${usd(s.bal)} − ${usd(s.limit * 0.1)} = ${usd(s.bal - s.limit * 0.1)} to pay off. Even getting under 30% brings back most of the points.`,
          }),
      ],
      4: [
        () =>
          pick({
            brief: 'Cam checks his credit report and finds a third late payment, for a month he knows he paid on time. He has the bank statement to prove it.',
            prompt: 'What should he do?',
            options: [
              { label: 'File a free dispute with the credit bureau and include the bank statement', credit: 1, why: 'Wrong information can be removed. Bureaus must investigate disputes, usually within 30 days, and it costs nothing.' },
              { label: 'Pay a credit repair company to handle it', credit: 0.2, why: 'They can only do what Cam can do himself for free.' },
              { label: 'Ignore it: one more late mark makes no difference', credit: 0, why: 'Every late mark costs points for years. An error is worth fixing.' },
            ],
          }),
      ],
      5: [
        () =>
          pick({
            brief: 'Dee earned $600 in sign-up bonuses. Her $20,000 five-year car loan now comes at 7% instead of the 6% she would have got before. That costs about $560 more in interest.',
            prompt: 'Was chasing the bonuses worth it?',
            options: [
              { label: 'Barely: the extra interest nearly cancels the bonuses, and she took on five new accounts to manage', credit: 1, why: 'Bonuses are not free if they make bigger borrowing dearer. Timing applications away from big loans keeps both.' },
              { label: 'Yes, $600 is $600', credit: 0.2, why: 'It ignores the higher interest that the applications caused.' },
              { label: 'No, she will lose thousands', credit: 0.3, why: 'One percentage point on $20,000 over five years is about $560, not thousands.' },
            ],
          }),
      ],
    },
    outcome: () => ({
      headline: 'The bureau’s verdict',
      detail: (
        <>
          <h4>Scores after one year</h4>
          <Bars items={END} fmt={(v) => v.toFixed(0)} />
          <p className="small" style={{ marginBottom: 0 }}>
            Eli: no score. Twelve months of one small card paid in full would have given him one.
          </p>
        </>
      ),
    }),
    takeaways: [
      'Paying on time is about 35% of a score. Nothing else comes close, so automate it.',
      'How much of your limit you use is next, about 30%. Under 30% is fine, under 10% is best.',
      'No credit is not good credit. A thin file can block an apartment or a phone plan.',
      'Space out applications, and stop applying for anything in the months before a big loan.',
    ],
  };
  return <CaseRunner def={def} seed={seed} onFinish={onFinish} addReview={addReview} />;
}
