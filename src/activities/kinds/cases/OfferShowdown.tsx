'use client';
/**
 * Offer Letter Showdown (Advanced, Job Center). Three job offers out of college: a big salary in
 * an expensive city, a smaller one somewhere cheaper, and a startup with stock options. Compare
 * what each really leaves you, read the fine print, and negotiate.
 */
import type { KindProps } from '../../types';
import { Table, usd } from '../pro/kit';
import { CaseRunner, Cards, Say, choose, dial, flag, pick, type CaseDef } from './kit';

type S = Record<string, never>;

export default function OfferShowdown({ seed, onFinish, addReview }: KindProps) {
  const def: CaseDef<S> = {
    kicker: 'Job Center · Offer letter showdown',
    init: () => ({}),
    steps: [
      () =>
        dial({
          brief: 'You graduate in May with three offers for similar data analyst jobs.',
          visual: (
            <Cards
              cards={[
                { icon: '🌉', title: 'Baycrest Bank', sub: 'San Francisco', facts: [['Salary', '$95,000'], ['Take-home a month', '$5,650'], ['Typical 1-bed rent', '$2,600'], ['Retirement match', '4% of salary']] },
                { icon: '🏙️', title: 'Riverton Health', sub: 'Riverton, a mid-size city', facts: [['Salary', '$78,000'], ['Take-home a month', '$4,850'], ['Typical 1-bed rent', '$1,400'], ['Retirement match', '6% of salary']] },
                { icon: '🚀', title: 'Loopwise', sub: 'San Francisco startup', facts: [['Salary', '$85,000'], ['Take-home a month', '$5,150'], ['Typical 1-bed rent', '$2,600'], ['Stock options', '0.1% of the company']] },
              ]}
            />
          ),
          prompt: 'After rent, how much more does Riverton leave you each month than Baycrest?',
          min: -1000,
          max: 1000,
          step: 25,
          answer: 400,
          tol: 25,
          fmt: (v) => usd(v),
          why: 'Riverton: $4,850 − $1,400 = $3,450. Baycrest: $5,650 − $2,600 = $3,050. The $17,000 smaller salary leaves you $400 a month better off, about $4,800 a year, before even counting the bigger match.',
        }),
      () =>
        pick({
          brief: 'Both Baycrest and Riverton match retirement savings: they add a dollar for every dollar you put in, up to a percentage of your salary.',
          visual: <Table head={['', 'Baycrest', 'Riverton']} rows={[['Match', '4% of $95,000', '6% of $78,000'], ['Free money a year, if you contribute enough', '$3,800', '$4,680']]} />,
          prompt: 'What must you do to get the match?',
          options: [
            { label: 'Put in at least the matched percentage of your own pay. Contribute nothing and you get nothing', credit: 1, why: 'A match is an instant 100% return on the money you put in. Skipping it is turning down part of your pay.' },
            { label: 'Nothing; it is paid automatically', credit: 0, why: 'Matches only follow your own contributions. Many new workers miss it for years.' },
            { label: 'Wait until you are older and earning more', credit: 0.1, why: 'Every year you wait loses that year’s match forever, and the decades of growth it would have had.' },
          ],
        }),
      () =>
        flag({
          brief: 'Loopwise sends its offer letter.',
          prompt: 'Flag the lines to question before you sign.',
          doc: {
            title: 'Loopwise: Offer of Employment',
            sub: 'Data Analyst',
            skin: 'contract',
            lines: [
              { id: 'sal', l: 'Base salary: $85,000 a year.' },
              { id: 'opt', l: 'Options for 0.1% of the company, vesting over 4 years with a 1-year cliff.' },
              { id: 'worth', l: 'At our next valuation these options could be worth $500,000!' },
              { id: 'exer', l: 'If you leave, you have 90 days to buy your vested shares, or you lose them.' },
              { id: 'health', l: 'Health insurance: company pays 100% of your premium.' },
              { id: 'nc', l: 'For two years after leaving, you may not work for any company in technology.' },
            ],
          },
          issues: {
            worth: 'A guess presented as a fact. Most startup options end up worth little or nothing; value them near zero until proven otherwise.',
            exer: 'Buying your shares could cost thousands, plus tax, within 90 days of leaving. Many people lose their options this way. Ask for a longer window.',
            nc: 'Banning you from an entire industry is extremely broad, and in some states, including California, most such clauses cannot be enforced. Ask for it to be removed.',
          },
          fine: {
            sal: 'A clear base salary.',
            opt: 'Standard vesting, exactly like founders get.',
            health: 'Fully paid premiums are a generous, real benefit.',
          },
        }),
      () =>
        pick({
          brief: 'You prefer Riverton, but Baycrest’s offer is much higher. You email the Riverton recruiter.',
          visual: <Say who="Riverton recruiter">We are so excited to have you! Is there anything that would help you say yes?</Say>,
          prompt: 'What do you say?',
          options: [
            { label: 'Riverton is my first choice. I have an offer at $95,000; could you reach $84,000? If so, I am ready to accept', credit: 1, why: 'Enthusiastic, specific and backed by a real alternative. A clear number, with a promise to accept, makes it easy for the recruiter to argue for you.' },
            { label: 'Nothing. I do not want to seem greedy', credit: 0.2, why: 'Polite negotiation is expected. Starting salary sets every future raise, so a few thousand now compounds over years.' },
            { label: 'Match $95,000 or I walk', credit: 0.3, why: 'Ultimatums can work but often sour the relationship, and Riverton cannot match a San Francisco salary.' },
            { label: 'Could you do better on salary?', credit: 0.6, why: 'Better than nothing, but vague. Without a number or a reason, the answer is usually a small bump or none.' },
          ],
        }),
      () =>
        choose({
          brief: 'Your friend is choosing between two offers and only compares the salaries.',
          prompt: 'Which two things should they add to the comparison?',
          k: 2,
          options: [
            { label: 'The cost of living, especially rent, in each city', good: true, why: 'A big salary in an expensive city can leave less than a smaller one somewhere cheaper.' },
            { label: 'Total compensation: retirement match, health costs and other benefits', good: true, why: 'Benefits can be worth $5,000 to $15,000 a year, and they differ a lot between employers.' },
            { label: 'Which company has the cooler office', good: false, why: 'Nice, but it pays no bills.' },
            { label: 'Which job title sounds more senior', good: false, why: 'Titles vary wildly between companies and say little about pay or growth.' },
          ],
        }),
    ],
    alts: {
      0: [
        () =>
          dial({
            brief: 'You graduate with two offers for similar marketing jobs.',
            visual: (
              <Cards
                cards={[
                  { icon: '🗽', title: 'Harbor Media', sub: 'Big city', facts: [['Salary', '$90,000'], ['Take-home a month', '$5,400'], ['Typical 1-bed rent', '$2,800'], ['Getting to work', 'Transit pass $130']] },
                  { icon: '🌳', title: 'Mapleton Insurance', sub: 'Smaller city', facts: [['Salary', '$72,000'], ['Take-home a month', '$4,500'], ['Typical 1-bed rent', '$1,250'], ['Getting to work', 'Car costs $450']] },
                ]}
              />
            ),
            prompt: 'After rent and getting to work, how much more does Mapleton leave you each month than Harbor?',
            min: -1000,
            max: 1000,
            step: 10,
            answer: 330,
            tol: 10,
            fmt: (v) => usd(v),
            why: 'Mapleton: $4,500 − $1,250 − $450 = $2,800. Harbor: $5,400 − $2,800 − $130 = $2,470. The lower salary leaves $330 more a month, even after paying for a car.',
          }),
      ],
      1: [
        () =>
          pick({
            brief: 'Your new employer matches retirement contributions, but the match "vests over 3 years". You might leave after about 18 months.',
            visual: <Table head={['Years worked', 'Share of the match you keep']} rows={[['Under 1', '0%'], ['1 to 2', '33%'], ['2 to 3', '67%'], ['3 or more', '100%']]} />,
            prompt: 'If you leave at 18 months, what do you keep?',
            options: [
              { label: 'All of your own contributions, plus a third of the match', credit: 1, why: 'Your own money is always yours. Only the employer’s match vests. Knowing the schedule helps you time a move.' },
              { label: 'Nothing; you leave before 3 years', credit: 0.1, why: 'Your own contributions are always 100% yours.' },
              { label: 'Everything, including the full match', credit: 0.1, why: 'Only vested match money leaves with you. Here that is a third.' },
            ],
          }),
      ],
      2: [
        () =>
          flag({
            brief: 'Harbor Media sends its offer letter.',
            prompt: 'Flag the lines to question before you sign.',
            doc: {
              title: 'Harbor Media: Offer of Employment',
              sub: 'Marketing Associate',
              skin: 'contract',
              lines: [
                { id: 'sal', l: 'Base salary: $90,000 a year.' },
                { id: 'bonus', l: 'Signing bonus: $8,000, repayable in full if you leave within 2 years for any reason.' },
                { id: 'pto', l: 'Paid time off: 15 days a year, plus public holidays.' },
                { id: 'hours', l: 'Employees are expected to be reachable evenings and weekends.' },
                { id: 'health', l: 'Health insurance: company pays 80% of your premium.' },
                { id: 'ip', l: 'Anything you create, at work or at home, belongs to Harbor Media.' },
              ],
            },
            issues: {
              bonus: 'Full repayment even if you are laid off could cost you $8,000. Ask for it to shrink over time and not apply if they let you go.',
              hours: 'Always on call, with no extra pay, quietly lowers your real hourly rate. Ask what it means in practice.',
              ip: 'Claiming your personal projects outside work is too broad. Ask to limit it to work done for the company.',
            },
            fine: {
              sal: 'A clear base salary.',
              pto: 'A normal amount of leave.',
              health: 'A solid benefit.',
            },
          }),
      ],
      3: [
        () =>
          pick({
            brief: 'You ask Riverton for more money. The recruiter replies that salaries are fixed by pay band and cannot change.',
            visual: <Say who="Riverton recruiter">I really can’t move on salary. Is there anything else that would help?</Say>,
            prompt: 'What do you ask for?',
            options: [
              { label: 'A signing bonus, an extra week of leave, or a pay review after six months instead of a year', credit: 1, why: 'When salary is fixed, other parts of the offer often are not. An early review can raise your pay sooner, and it compounds.' },
              { label: 'Nothing. If salary is fixed, everything is', credit: 0.2, why: 'Bonuses, leave and review dates are often more flexible than base pay.' },
              { label: 'Say you will only accept if they break the pay band', credit: 0.1, why: 'Pushing against a stated rule rarely works and can sour a good start.' },
            ],
          }),
      ],
      4: [
        () =>
          choose({
            brief: 'Before you accept any offer, you can ask the employer two questions about money.',
            prompt: 'Which two are most useful?',
            k: 2,
            options: [
              { label: 'How and when are raises decided?', good: true, why: 'Your starting salary is only the first year. How it grows matters more over a career.' },
              { label: 'What will health insurance cost me each month, and what is the deductible?', good: true, why: 'Health costs vary by thousands a year between employers.' },
              { label: 'How rich is the CEO?', good: false, why: 'Irrelevant to your pay.' },
              { label: 'Is there free coffee?', good: false, why: 'Nice, but not worth one of your two questions.' },
            ],
          }),
      ],
    },
    takeaways: [
      'Compare what each offer leaves after taxes and rent, not the salary.',
      'Always contribute enough to get the full retirement match. It is part of your pay.',
      'Value startup options near zero, and check how long you have to buy them if you leave.',
      'Negotiate with a specific number and a reason. Your starting salary shapes every raise after it.',
    ],
  };
  return <CaseRunner def={def} seed={seed} onFinish={onFinish} addReview={addReview} />;
}
