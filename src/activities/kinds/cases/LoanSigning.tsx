'use client';
/**
 * Loan Signing Day (Advanced, Borrowing Booth). Before college, choose which student loans to take
 * and in what order, watch interest build while you study, read a private loan's fine print, and
 * plan for a first job that pays less than hoped.
 */
import type { KindProps } from '../../types';
import { Table, usd } from '../pro/kit';
import { CaseRunner, Cards, Feed, dial, flag, pick, type CaseDef } from './kit';

interface S {
  unsub: number;
}

export default function LoanSigning({ seed, onFinish, addReview }: KindProps) {
  const def: CaseDef<S> = {
    kicker: 'Borrowing Booth · Loan signing day',
    init: (rng) => ({ unsub: rng.pick([4000, 5000, 6000]) }),
    steps: [
      () =>
        pick({
          brief: 'After grants and savings, you still need $9,000 for your first year. Three kinds of loans are available.',
          visual: (
            <Cards
              cards={[
                { icon: '🏛️', title: 'Federal subsidized', sub: 'Need-based, limited amount', facts: [['Rate', '6%, fixed'], ['Interest while in school', 'Paid by the government'], ['If income is low later', 'Income-based payment plans']] },
                { icon: '🏛️', title: 'Federal unsubsidized', facts: [['Rate', '6%, fixed'], ['Interest while in school', 'Builds up, added to the loan'], ['If income is low later', 'Income-based payment plans']] },
                { icon: '🏦', title: 'Private bank loan', tag: 'Low starting rate!', facts: [['Rate', '4.5% now, variable'], ['Interest while in school', 'Builds up'], ['If income is low later', 'Up to the bank'], ['Needs', 'A cosigner']] },
              ]}
            />
          ),
          prompt: 'In what order should you borrow?',
          options: [
            { label: 'Federal subsidized first, then federal unsubsidized, then private only if still needed', credit: 1, why: 'Subsidized loans cost nothing while you study. Federal loans have fixed rates and protections if your income is low. Private loans have neither, so they come last.' },
            { label: 'Private first, because 4.5% is the lowest rate', credit: 0.2, why: 'It is the lowest today. A variable rate can rise over ten years, and the federal protections are worth more than a slightly lower starting rate.' },
            { label: 'Federal unsubsidized first, since it is easiest', credit: 0.4, why: 'Federal is right, but subsidized is strictly better: same rate, no interest while you study.' },
          ],
        }),
      ({ s }) =>
        dial({
          brief: `You borrow ${usd(s.unsub)} in an unsubsidized loan in your first year. Interest builds at 6% a year, simple interest, for four years of college plus a six-month grace period.`,
          visual: <Table head={['Unsubsidized loan', '']} rows={[['Borrowed', usd(s.unsub)], ['Rate', '6% a year'], ['Time before payments start', '4.5 years']]} />,
          prompt: 'How much interest builds up before your first payment?',
          min: 0,
          max: 3000,
          step: 5,
          answer: Math.round(s.unsub * 0.06 * 4.5),
          tol: 15,
          fmt: (v) => usd(v),
          why: `${usd(s.unsub)} × 6% × 4.5 years = ${usd(s.unsub * 0.06 * 4.5)}. That is usually added to the loan when repayment starts, so you then pay interest on the interest. Paying even the interest during college prevents it.`,
        }),
      () =>
        flag({
          brief: 'You still need a little more, and look at the private loan’s promissory note.',
          prompt: 'Flag the terms that add risk for you or your cosigner.',
          doc: {
            title: 'Private Student Loan: Promissory Note',
            sub: 'Key terms',
            skin: 'contract',
            lines: [
              { id: 'var', l: 'Interest rate: 4.5% at signing, variable. May change every quarter with market rates, up to 18%.' },
              { id: 'cos', l: 'The cosigner is fully responsible for the loan if the borrower does not pay.' },
              { id: 'release', l: 'Cosigner release is available after 48 consecutive on-time payments, at the lender’s discretion.' },
              { id: 'idr', l: 'Payments are not based on income.' },
              { id: 'prepay', l: 'No penalty for paying early.' },
              { id: 'auto', l: '0.25% rate discount with automatic payments.' },
            ],
          },
          issues: {
            var: 'A variable rate with a ceiling of 18% could quadruple your interest over ten years.',
            cos: 'Your cosigner owes every dollar if you cannot pay, and missed payments damage their credit too.',
            release: 'Four years without a single late payment, and even then only if the lender agrees.',
            idr: 'If your first job pays little, the payment stays the same. Federal loans can adjust; this cannot.',
          },
          fine: {
            prepay: 'A good term: you can pay it off faster at no cost.',
            auto: 'A small, genuine discount.',
          },
        }),
      () =>
        pick({
          brief: 'Your dad offers to cosign the private loan.',
          visual: <Feed posts={[{ who: 'Dad', text: 'Happy to sign, it is just a formality right?' }]} />,
          prompt: 'What do you tell him?',
          options: [
            { label: 'It is not a formality: he would owe all of it if I miss payments, and it shows on his credit when he applies for loans', credit: 1, why: 'A cosigned loan appears on both credit reports. It can affect his ability to borrow, and the lender can pursue him directly.' },
            { label: 'Yes, it just helps me get approved', credit: 0, why: 'That is how it is often described, and it is exactly how cosigners get surprised.' },
            { label: 'He only pays if I die', credit: 0, why: 'He pays if you do not, for any reason.' },
          ],
        }),
      () =>
        pick({
          brief: 'You graduate. Your first job pays $36,000, less than you hoped. Your standard federal loan payment is $330 a month, which is a stretch.',
          visual: <Table head={['Option', 'Monthly payment', 'Catch']} rows={[['Standard 10-year plan', '$330', 'Tight budget'], ['Income-driven plan', 'About $90', 'Takes longer; more interest overall'], ['Stop paying', '$0', 'Default']]} />,
          prompt: 'What is the smartest move?',
          options: [
            { label: 'Switch to an income-driven plan now, and pay extra when your pay rises', credit: 1, why: 'Federal loans offer this exactly for this situation. A payment you can make every month protects your credit; paying extra later limits the added interest.' },
            { label: 'Stop paying until you earn more', credit: 0, why: 'Default brings collections, damaged credit and possible garnished wages. Federal loans rarely go away, even in bankruptcy.' },
            { label: 'Keep the standard payment by putting rent on a credit card', credit: 0.1, why: 'Swapping 6% loan debt for 24% card debt makes things worse.' },
            { label: 'Keep the standard payment by cutting every other expense', credit: 0.6, why: 'Admirable and it saves interest, but with no buffer, one surprise could cause a missed payment.' },
          ],
        }),
    ],
    alts: {
      0: [
        () =>
          pick({
            brief: 'Your first year of college costs $9,000 more than your family can pay. Before borrowing anything, you list the other options.',
            prompt: 'What should you use before any loan?',
            options: [
              { label: 'Grants, scholarships and work-study, because none of them have to be repaid', credit: 1, why: 'Free money and money you earn come first. Every dollar of them is a dollar plus interest you never borrow.' },
              { label: 'A credit card, since it is quick', credit: 0, why: 'Card rates are several times student loan rates, with none of the protections.' },
              { label: 'A private loan, since it is the simplest form', credit: 0.1, why: 'Private loans come last, after free money and federal loans.' },
            ],
          }),
      ],
      1: [
        ({ s }) =>
          dial({
            brief: `You borrow ${usd(s.unsub)} in an unsubsidized loan at 6% a year. You decide to pay just the interest each month while in college, so the balance never grows.`,
            prompt: 'How much is that each month?',
            min: 0,
            max: 100,
            step: 1,
            answer: Math.round((s.unsub * 0.06) / 12),
            tol: 1,
            fmt: (v) => usd(v),
            why: `${usd(s.unsub)} × 6% = ${usd(s.unsub * 0.06)} a year, ÷ 12 = ${usd((s.unsub * 0.06) / 12)} a month. A small amount from a part-time job stops interest from being added to the loan.`,
          }),
      ],
      2: [
        () =>
          flag({
            brief: 'A second private lender sends its loan terms.',
            prompt: 'Flag the terms that add cost or risk.',
            doc: {
              title: 'Private Student Loan: Key Terms',
              sub: 'Lender B',
              skin: 'contract',
              lines: [
                { id: 'fixed', l: 'Interest rate: 8.9%, fixed for the life of the loan.' },
                { id: 'orig', l: 'Origination fee: 5% of the loan, taken from the money before you receive it.' },
                { id: 'forb', l: 'Payment pause: up to 12 months in total, interest continues to build.' },
                { id: 'disc', l: 'If the borrower dies or is permanently disabled, the cosigner still owes the balance.' },
                { id: 'prepay', l: 'No penalty for paying early.' },
                { id: 'grace', l: 'Payments begin six months after graduation.' },
              ],
            },
            issues: {
              orig: 'A 5% fee means you receive less than you borrow but repay the full amount, with interest.',
              forb: 'Only 12 months of relief in total, with interest still growing, is thin protection.',
              disc: 'Federal loans are discharged in these cases. This one passes the debt to your family.',
            },
            fine: {
              fixed: 'Fixed rates are predictable, though this one is high.',
              prepay: 'You can pay it off early at no extra cost.',
              grace: 'A normal grace period.',
            },
          }),
      ],
      3: [
        () =>
          pick({
            brief: 'You need $2,000 more. The private lender approves you for up to $25,000, "the full cost of attendance".',
            prompt: 'How much do you borrow?',
            options: [
              { label: 'Only the $2,000 you actually need', credit: 1, why: 'Every extra dollar borrowed is repaid with interest. Lenders approve the maximum because it earns them more.' },
              { label: 'The full $25,000, to have a cushion', credit: 0, why: 'A cushion of borrowed money at loan interest is an expensive cushion.' },
              { label: '$5,000, just in case', credit: 0.4, why: 'A small buffer can make sense, but $3,000 extra still costs interest for a decade.' },
            ],
          }),
      ],
      4: [
        () =>
          pick({
            brief: 'Six months into your first job, you get a $3,000 bonus. You have $24,000 of federal loans at 6% and no savings.',
            prompt: 'What is the best use of the bonus?',
            options: [
              { label: 'Build a small emergency fund first, then put the rest toward the loans', credit: 1, why: 'Without savings, the next surprise lands on a credit card at 24%. A cushion first, then extra loan payments, is the safer order.' },
              { label: 'All of it on the loans immediately', credit: 0.6, why: 'It saves interest, but leaves you one surprise away from expensive debt.' },
              { label: 'A holiday; you earned it', credit: 0.2, why: 'Some celebration is fine, but all of it leaves both savings and debt untouched.' },
            ],
          }),
      ],
    },
    takeaways: [
      'Borrow in order: grants, federal subsidized, federal unsubsidized, private last.',
      'Unsubsidized interest builds while you study and is added to the loan.',
      'Variable rates and cosigners add risk that a low starting rate hides.',
      'If payments are too high, federal income-driven plans beat missing payments.',
    ],
  };
  return <CaseRunner def={def} seed={seed} onFinish={onFinish} addReview={addReview} />;
}
