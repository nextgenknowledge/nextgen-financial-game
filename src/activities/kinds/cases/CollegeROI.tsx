'use client';
/**
 * College ROI (Advanced, Sorting Center). Decode a financial aid letter, find the real price,
 * compare schools, and connect what you borrow to what your first job will pay.
 */
import type { KindProps } from '../../types';
import { Table, usd } from '../pro/kit';
import { CaseRunner, Cards, dial, flag, pick, type CaseDef } from './kit';

interface S {
  coa: number;
  grant: number;
  borrow: number;
}

export default function CollegeROI({ seed, onFinish, addReview }: KindProps) {
  const def: CaseDef<S> = {
    kicker: 'Sorting Center · College ROI',
    init: (rng) => ({ coa: rng.pick([44000, 46000, 48000]), grant: rng.pick([8000, 9000, 11000]), borrow: rng.pick([24000, 27000, 30000]) }),
    steps: [
      ({ s }) =>
        flag({
          brief: 'Your acceptance letter from Westbrook College arrives with a financial aid award. The headline number is big.',
          prompt: 'Flag every line that is a loan someone in your family must repay.',
          doc: {
            title: 'Westbrook College: Financial Aid Award',
            sub: 'First year',
            skin: 'paper',
            lines: [
              { id: 'h1', head: true, l: 'Cost of attendance (tuition, housing, food, books)', r: usd(s.coa) },
              { id: 'grant', l: 'Westbrook Grant', r: usd(s.grant) },
              { id: 'schol', l: 'Merit Scholarship', r: '$4,000' },
              { id: 'sub', l: 'Federal Direct Subsidized Loan', r: '$3,500' },
              { id: 'unsub', l: 'Federal Direct Unsubsidized Loan', r: '$2,000' },
              { id: 'plus', l: 'Parent PLUS Loan', r: '$9,000' },
              { id: 'ws', l: 'Federal Work-Study', r: '$2,500' },
            ],
            foot: `Total aid awarded: ${usd(s.grant + 4000 + 3500 + 2000 + 9000 + 2500)}. Congratulations!`,
          },
          issues: {
            sub: 'A loan, though the government pays the interest while you are in school.',
            unsub: 'A loan with interest building from day one, even while you study.',
            plus: 'A loan in your parent’s name, often at a higher rate. It is easy to miss because the word "Parent" makes it sound like help.',
          },
          fine: {
            grant: 'Free money you never repay.',
            schol: 'Free money, though check whether it needs a minimum GPA to keep.',
            ws: 'Not a loan, but not free either. You earn it by working a campus job, and it is not taken off the bill up front.',
          },
        }),
      ({ s }) =>
        dial({
          brief: 'The real price of a college is the cost minus the free money: grants and scholarships only.',
          prompt: 'What is Westbrook’s net price for your first year?',
          min: 0,
          max: 50000,
          step: 250,
          answer: s.coa - s.grant - 4000,
          tol: 250,
          fmt: (v) => usd(v),
          why: `${usd(s.coa)} − ${usd(s.grant)} − $4,000 = ${usd(s.coa - s.grant - 4000)}. The letter called ${usd(s.grant + 21000)} "aid", but ${usd(14500)} of it was loans and $2,500 was a job. You would still owe or earn ${usd(s.coa - s.grant - 4000)} every year, for four years.`,
        }),
      ({ s }) =>
        pick({
          brief: 'Your state university also accepted you, for the same major.',
          visual: (
            <Cards
              cards={[
                { icon: '🏛️', title: 'Westbrook College', sub: 'Private', facts: [['Net price a year', usd(s.coa - s.grant - 4000)], ['Graduate within 6 years', '82%'], ['Typical early-career pay, your major', '$58,000']] },
                { icon: '🎓', title: 'State University', sub: 'Public, in-state', facts: [['Net price a year', '$15,500'], ['Graduate within 6 years', '74%'], ['Typical early-career pay, your major', '$55,000']] },
              ]}
            />
          ),
          prompt: 'Which is the better deal?',
          options: [
            { label: 'State: about half the price for a similar outcome in your major', credit: 1, why: `Over four years the gap is about ${usd(((s.coa - s.grant - 4000) - 15500) * 4)}, against $3,000 a year in typical pay. Name and prestige matter far less than graduating with manageable debt.` },
            { label: 'Westbrook, because private colleges lead to better jobs', credit: 0.2, why: 'For most majors, early-career pay depends more on the field and the student than the school’s price tag.' },
            { label: 'Westbrook, because it has a higher graduation rate', credit: 0.5, why: 'A real point: finishing matters. But 74% at a school you can afford can beat 82% with heavy debt.' },
            { label: 'Ask Westbrook to improve the offer, using the State offer as leverage, then decide', credit: 0.8, why: 'A smart move. Colleges do reconsider aid. Just decide on the final numbers, not the hope.' },
          ],
        }),
      ({ s }) =>
        dial({
          brief: `Say you graduate with ${usd(s.borrow)} of federal loans at about 6%, on the standard 10-year plan.`,
          visual: <Table head={['Borrowed at 6% over 10 years', 'Monthly payment']} rows={[['$10,000', '$111'], ['$20,000', '$222'], ['$30,000', '$333']]} />,
          prompt: 'What will your monthly payment be?',
          min: 0,
          max: 600,
          step: 1,
          answer: Math.round((s.borrow / 10000) * 111),
          tol: 5,
          fmt: (v) => usd(v),
          why: `${usd(s.borrow)} is ${s.borrow / 10000} × $10,000, so about ${s.borrow / 10000} × $111 = ${usd((s.borrow / 10000) * 111)} a month for ten years, about ${usd((s.borrow / 10000) * 111 * 120)} in total.`,
        }),
      ({ s }) =>
        pick({
          brief: `Three classmates borrowed the same ${usd(s.borrow)}.`,
          visual: <Table head={['Classmate', 'Major', 'Typical starting pay']} rows={[['Ana', 'Nursing', '$72,000'], ['Ben', 'Art history, no plan yet', '$38,000'], ['Cara', 'Dropped out after two years', '$31,000']]} />,
          prompt: 'Who is in the most trouble?',
          ordered: true,
          options: [
            { label: 'Ana', credit: 0, why: 'Her debt is well under one year’s pay. A common rule of thumb is to keep total student debt below your expected first-year salary.' },
            { label: 'Ben', credit: 0.4, why: 'Tight but workable. A lower-paying field means a bigger share of pay goes to the loan.' },
            { label: 'Cara', credit: 1, why: 'The worst case in student debt is owing for a degree you never got. Dropouts carry the payments without the pay bump, which is why graduation rates matter.' },
          ],
        }),
      () =>
        pick({
          brief: 'Your cousin is weighing two years at community college, then transferring to State.',
          prompt: 'What is the biggest thing to check first?',
          options: [
            { label: 'That the credits transfer to the major at State, ideally through a written transfer agreement', credit: 1, why: 'Community college can cut the cost of a degree dramatically, but only if the credits count. Students who lose credits end up paying twice.' },
            { label: 'Whether it sounds impressive', credit: 0, why: 'The diploma comes from the school you finish at.' },
            { label: 'Nothing; it is always cheaper', credit: 0.3, why: 'Usually cheaper per year, but lost credits can erase the savings.' },
          ],
        }),
    ],
    alts: {
      0: [
        ({ s }) =>
          flag({
            brief: 'Lakeview University sends its financial aid award. The total looks generous.',
            prompt: 'Flag every line that is a loan someone in your family must repay.',
            doc: {
              title: 'Lakeview University: Financial Aid Award',
              sub: 'First year',
              skin: 'paper',
              lines: [
                { id: 'h1', head: true, l: 'Cost of attendance (tuition, housing, food, books)', r: usd(s.coa) },
                { id: 'pell', l: 'Federal Pell Grant', r: '$3,000' },
                { id: 'dean', l: 'Dean’s Scholarship (renewable with a 3.0 GPA)', r: usd(s.grant) },
                { id: 'inst', l: 'Lakeview Institutional Loan', r: '$4,000' },
                { id: 'sub', l: 'Federal Direct Subsidized Loan', r: '$3,500' },
                { id: 'priv', l: 'Suggested: Partner Bank Private Loan', r: '$10,000' },
                { id: 'ws', l: 'Federal Work-Study', r: '$2,000' },
              ],
              foot: `Total aid offered: ${usd(s.grant + 3000 + 4000 + 3500 + 10000 + 2000)}. Congratulations!`,
            },
            issues: {
              inst: 'A loan from the university itself, often with fewer protections than federal loans.',
              sub: 'A federal loan, though the government pays the interest while you are in school.',
              priv: 'A private bank loan, usually with higher rates and fewer protections. Listing it as "aid" is misleading.',
            },
            fine: {
              pell: 'Free money you never repay.',
              dean: 'Free money, as long as you keep the GPA.',
              ws: 'Not a loan; you earn it by working.',
            },
          }),
      ],
      1: [
        ({ s }) =>
          dial({
            brief: `A college costs ${usd(s.coa)} a year. It offers a ${usd(s.grant)} grant and a $4,000 scholarship each year, and the rest is loans. Assume costs stay the same.`,
            prompt: 'What is the net price for all four years?',
            min: 0,
            max: 200000,
            step: 1000,
            answer: (s.coa - s.grant - 4000) * 4,
            tol: 1000,
            fmt: (v) => usd(v),
            why: `${usd(s.coa)} − ${usd(s.grant)} − $4,000 = ${usd(s.coa - s.grant - 4000)} a year, × 4 = ${usd((s.coa - s.grant - 4000) * 4)}. In reality costs usually rise each year, so the true figure is higher.`,
          }),
      ],
      2: [
        () =>
          pick({
            brief: 'Your dream school is a public university in another state. Your own state’s university has an honors college that accepted you for the same major.',
            visual: (
              <Cards
                cards={[
                  { icon: '✈️', title: 'Out-of-state public', facts: [['Net price a year', '$34,000'], ['Graduate within 6 years', '80%'], ['Typical early-career pay, your major', '$60,000']] },
                  { icon: '🏛️', title: 'In-state honors college', facts: [['Net price a year', '$14,000'], ['Graduate within 6 years', '85% for honors'], ['Typical early-career pay, your major', '$58,000']] },
                ]}
              />
            ),
            prompt: 'Which is the better deal?',
            options: [
              { label: 'In-state honors: $80,000 less over four years for a very similar outcome', credit: 1, why: 'A $2,000 difference in typical pay cannot repay $80,000 of extra cost. Honors programs often add smaller classes and priority registration too.' },
              { label: 'Out-of-state, because it is the dream school', credit: 0.2, why: 'Dreams matter, but $80,000 more debt follows you for a decade.' },
              { label: 'Out-of-state, because higher pay', credit: 0.1, why: '$2,000 a year more pay would take 40 years to cover the gap.' },
            ],
          }),
      ],
      3: [
        () =>
          dial({
            brief: 'In your first year you borrow $6,000 as an unsubsidized federal loan at 6%. Interest builds from day one, and you make no payments during four years of school.',
            prompt: 'About how much interest builds up before you graduate? (Simple interest)',
            min: 0,
            max: 3000,
            step: 10,
            answer: 1440,
            tol: 20,
            fmt: (v) => usd(v),
            why: '$6,000 × 6% = $360 a year, × 4 years = $1,440. Paying even the interest while in school stops the balance from growing.',
          }),
      ],
      4: [
        ({ s }) =>
          pick({
            brief: `You graduate with ${usd(s.borrow)} of student loans at 6% on a 10-year plan.`,
            prompt: 'Which choice saves you the most money overall?',
            options: [
              { label: 'Paying an extra $100 a month toward the balance', credit: 1, why: 'Extra payments cut the balance that interest is charged on, so you finish years early and pay less in total.' },
              { label: 'Stretching repayment to 25 years for a lower payment', credit: 0.2, why: 'Lower payments, but far more interest in total.' },
              { label: 'Pausing payments for a year to save up', credit: 0.1, why: 'Interest usually keeps building during a pause, making the debt bigger.' },
            ],
          }),
      ],
      5: [
        () =>
          pick({
            brief: 'A friend is choosing a major and asks how to check whether it pays off.',
            prompt: 'What is the best source?',
            options: [
              { label: 'Government data on typical earnings and debt for that major at that specific school', credit: 1, why: 'Earnings vary hugely by major and school. Real data for the exact program beats general claims.' },
              { label: 'The school’s brochure', credit: 0.2, why: 'Marketing material shows the best outcomes, not the typical ones.' },
              { label: 'One older student’s opinion', credit: 0.2, why: 'One experience is a story, not data.' },
            ],
          }),
      ],
    },
    takeaways: [
      'In an aid letter, only grants and scholarships are free. Loans and work-study are not.',
      'Net price is cost minus free money. Compare schools on that.',
      'Keep total student debt below your expected first-year salary.',
      'Finishing matters. Debt without a degree is the hardest kind to repay.',
    ],
  };
  return <CaseRunner def={def} seed={seed} onFinish={onFinish} addReview={addReview} />;
}
