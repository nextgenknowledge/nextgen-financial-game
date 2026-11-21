'use client';
/**
 * Co-founder Split (Advanced, Business Registry). Three friends start a company. Divide the
 * ownership, add vesting so it survives someone leaving, and then live through the day one of
 * them quits.
 */
import type { KindProps } from '../../types';
import { Table } from '../pro/kit';
import { CaseRunner, Cards, Feed, dial, flag, pick, type CaseDef } from './kit';

interface S {
  vest: boolean;
  months: number;
}

export default function CofounderSplit({ seed, onFinish, addReview }: KindProps) {
  const def: CaseDef<S> = {
    kicker: 'Business Registry · Co-founder split',
    init: (rng) => ({ vest: false, months: rng.pick([14, 18, 20]) }),
    steps: [
      () =>
        pick({
          brief: 'You, Mei and Jordan are starting StudyStack, an app that turns class notes into practice quizzes. Time to divide the 1,000,000 shares.',
          visual: (
            <Cards
              cards={[
                { icon: '💡', title: 'You', sub: 'Had the idea', facts: [['Role', 'Product and design'], ['Time', 'Full time'], ['Cash put in', '$2,000']] },
                { icon: '💻', title: 'Mei', sub: 'Builds the app', facts: [['Role', 'All the code'], ['Time', 'Full time'], ['Cash put in', '$0']] },
                { icon: '📣', title: 'Jordan', sub: 'Marketing', facts: [['Role', 'Social media, schools'], ['Time', '10 hours a week, has another job'], ['Cash put in', '$0']] },
              ]}
            />
          ),
          prompt: 'Which split is most defensible?',
          options: [
            { label: 'You and Mei about 42% each, Jordan about 16%, and repay your $2,000 as a loan', credit: 1, why: 'Ownership should follow ongoing commitment, not who had the idea. Ideas are cheap; years of work are not. Treating your cash as a loan keeps it separate from the work split.' },
            { label: 'A third each. We are friends and equal', credit: 0.4, why: 'Easy today, painful later. Jordan would own as much as two people working full time, and resentment grows every week.' },
            { label: 'You take 60% because it was your idea', credit: 0.1, why: 'The idea is worth far less than Mei’s code. A founder who feels underpaid for the real work tends to leave.' },
            { label: 'Mei takes 60% because she does the hardest work', credit: 0.4, why: 'Closer to the truth than "it was my idea", but you are both full time and essential.' },
          ],
        }),
      () =>
        pick({
          brief: 'A startup lawyer at the registry suggests adding vesting before anyone signs.',
          visual: <Table head={['Standard founder vesting', '']} rows={[['Total period', '4 years'], ['Cliff', '1 year: leave before it and you keep nothing'], ['After the cliff', '25% vests at once, then the rest monthly over 3 years']]} />,
          prompt: 'Do you add vesting to everyone’s shares?',
          options: [
            { label: 'Yes, for all three of us, including me', credit: 1, why: 'Vesting means shares are earned over time. If someone leaves early, unvested shares go back to the company and can be given to whoever replaces them. Every serious investor will ask for it.', apply: (s) => void (s.vest = true) },
            { label: 'No. We trust each other', credit: 0, why: 'Vesting is not about trust. People leave for jobs, college or family. Without it, a founder who leaves after a month keeps their whole stake.' },
            { label: 'Only for Jordan, since he is part time', credit: 0.4, why: 'Fairer than nothing, but full-time founders leave too. And founders who exempt themselves from vesting worry investors.', apply: (s) => void (s.vest = true) },
          ],
        }),
      ({ s }) => {
        const mei = 420000;
        const vested = s.months < 12 ? 0 : mei * 0.25 + (mei * 0.75 * (s.months - 12)) / 36;
        return dial({
          brief: s.vest ? `Month ${s.months}. Mei, the co-founder who builds the app, gets a dream job offer and decides to leave. She holds 420,000 shares on standard four-year vesting with a one-year cliff.` : `Month ${s.months}. Mei, the co-founder who builds the app, gets a dream job offer and leaves. With no vesting, she keeps all 420,000 shares, 42% of a company she no longer works for. Work out what standard vesting would have let her keep.`,
          visual: <Table head={['Mei’s vesting', '']} rows={[['Total shares', '420,000'], ['At 12 months (cliff)', '25% vests'], ['Each month after that', '1/36 of the remaining 75%']]} />,
          prompt: s.vest ? 'How many shares does Mei keep?' : 'With standard vesting, how many would she have kept?',
          min: 0,
          max: 420000,
          step: 2500,
          answer: Math.round(vested),
          tol: 3000,
          fmt: (v) => v.toLocaleString('en-US'),
          why: `At the cliff she earned 105,000. The remaining 315,000 vest at 8,750 a month, and ${s.months - 12} months have passed since: 105,000 + ${(s.months - 12) * 8750} = ${Math.round(vested).toLocaleString('en-US')}. The other ${(420000 - Math.round(vested)).toLocaleString('en-US')} ${s.vest ? 'go' : 'would have gone'} back to the company to hire a new engineer.${s.vest ? '' : ' Because you skipped vesting, she keeps all 420,000 instead.'}`,
        });
      },
      () =>
        flag({
          brief: 'You hire a new lead engineer, Sam. Sam’s friend drafts an offer letter.',
          prompt: 'Flag the lines that could cause problems for StudyStack.',
          doc: {
            title: 'Offer Letter: Lead Engineer',
            sub: 'StudyStack Ltd',
            skin: 'contract',
            lines: [
              { id: 'salary', l: 'Salary: $70,000 a year, paid monthly.' },
              { id: 'equity', l: 'Equity: 5% of the company, fully owned on day one.' },
              { id: 'ip', l: 'Code Sam writes stays Sam’s property; StudyStack gets a licence to use it.' },
              { id: 'title', l: 'Title: Head of Engineering.' },
              { id: 'leave', l: 'Either side may end employment with one month’s notice.' },
              { id: 'promise', l: 'Promise: the company will be sold within three years for at least $50 million.' },
            ],
          },
          issues: {
            equity: 'Fully owned on day one means Sam could leave in week two and keep 5% forever. Employee shares should vest like the founders’ did.',
            ip: 'The company must own the code it pays for. Without it, StudyStack’s main asset belongs to an employee, and no investor will touch it.',
            promise: 'Nobody can promise a sale or a price. Written promises like this can become legal claims later.',
          },
          fine: {
            salary: 'A clear, normal salary term.',
            title: 'Titles are free, and this one matches the job.',
            leave: 'A standard notice period.',
          },
        }),
      () =>
        pick({
          brief: 'Two years in, an investor offers $500,000 for new shares that will make up 20% of StudyStack after the deal.',
          visual: <Feed posts={[{ who: 'Jordan', text: 'Wait, so my 16% becomes less? That is not fair, I did not agree to that!' }]} />,
          prompt: 'What do you tell Jordan?',
          options: [
            { label: 'Everyone’s percentage shrinks by a fifth, but the company is now worth $2.5 million with cash to grow. His slice is smaller and worth more', credit: 1, why: 'Before, his 16% was of a company with almost no cash. After, roughly 12.8% of a $2.5 million company is worth about $320,000 on paper. Dilution is normal when a company raises money.' },
            { label: 'He is right; existing owners should never be diluted', credit: 0, why: 'Without new shares, there is no investment. Founders accept dilution to get the money to grow.' },
            { label: 'Only you and Mei get diluted, not him', credit: 0, why: 'New shares dilute every existing owner equally, by percentage.' },
          ],
        }),
    ],
    alts: {
      0: [
        () =>
          pick({
            brief: 'You, Ana and Kai are starting a company: an app that turns class notes into practice quizzes. Time to divide the 1,000,000 shares.',
            visual: (
              <Cards
                cards={[
                  { icon: '💡', title: 'You', sub: 'Runs the business', facts: [['Role', 'Sales, schools, money'], ['Time', 'Full time'], ['Cash put in', '$0']] },
                  { icon: '💻', title: 'Ana', sub: 'Builds the app', facts: [['Role', 'All the code'], ['Time', 'Full time'], ['Cash put in', '$0']] },
                  { icon: '💰', title: 'Kai', sub: 'Funds the start', facts: [['Role', 'Advice now and then'], ['Time', 'A few hours a month'], ['Cash put in', '$10,000']] },
                ]}
              />
            ),
            prompt: 'Which split is most defensible?',
            options: [
              { label: 'You and Ana about 45% each; Kai gets about 10% for the cash, as an early investor rather than a founder', credit: 1, why: 'Kai’s money is valuable, but the business is built by the two full-time founders. Treating Kai as an investor prices his cash separately from years of work.' },
              { label: 'A third each, since Kai paid for everything', credit: 0.3, why: '$10,000 and a few hours a month would then be worth the same as years of full-time work.' },
              { label: 'Kai takes 50% because he put in the money', credit: 0.1, why: 'Founders who own a minority of their own company early tend to lose motivation, and later investors notice.' },
            ],
          }),
      ],
      1: [
        () =>
          pick({
            brief: 'Before signing, a mentor asks how founder shares will work if someone leaves early.',
            visual: <Table head={['Option', 'What it means']} rows={[['A', 'Everyone owns all their shares from day one'], ['B', 'Shares vest over 4 years with a 1-year cliff, for every founder'], ['C', 'Vesting only for anyone who joins later']]} />,
            prompt: 'Which do you choose?',
            options: [
              { label: 'B: 4-year vesting with a 1-year cliff, for every founder', credit: 1, why: 'Shares are earned over time. A founder who leaves early keeps only what they earned, and the rest can go to their replacement.', apply: (s) => void (s.vest = true) },
              { label: 'A: everyone owns their shares now', credit: 0, why: 'A founder who quits next month would keep their whole stake.' },
              { label: 'C: vesting for later hires only', credit: 0.2, why: 'Founders leave too. Exempting yourselves also makes investors nervous.' },
            ],
          }),
      ],
      2: [
        ({ s }) => {
          const jordan = 160000;
          const vested = s.months < 12 ? 0 : jordan * 0.25 + (jordan * 0.75 * (s.months - 12)) / 36;
          return dial({
            brief: `Month ${s.months}. Jordan, a co-founder working part time, leaves to focus on college. Jordan holds 160,000 shares on standard four-year vesting with a one-year cliff.`,
            visual: <Table head={['Jordan’s vesting', '']} rows={[['Total shares', '160,000'], ['At 12 months (cliff)', '25% vests'], ['Each month after that', '1/36 of the remaining 75%']]} />,
            prompt: 'How many shares has Jordan earned?',
            min: 0,
            max: 160000,
            step: 1000,
            answer: Math.round(vested),
            tol: 1500,
            fmt: (v) => v.toLocaleString('en-US'),
            why: `At the cliff, 40,000 vested. The remaining 120,000 vest at about 3,333 a month, and ${s.months - 12} months have passed: about ${Math.round(vested).toLocaleString('en-US')}. The rest returns to the company.`,
          });
        },
      ],
      3: [
        () =>
          flag({
            brief: 'A well-known entrepreneur offers to advise the company. Their lawyer sends an agreement.',
            prompt: 'Flag the lines that could cause problems for the company.',
            doc: {
              title: 'Advisor Agreement',
              sub: 'Draft',
              skin: 'contract',
              lines: [
                { id: 'eq', l: 'Equity: 3% of the company, fully owned on signing.' },
                { id: 'dut', l: 'Duties: introductions and advice "as the Advisor sees fit".' },
                { id: 'term', l: 'Term: 2 years, ending early if either side gives 30 days’ notice.' },
                { id: 'conf', l: 'The Advisor keeps company information confidential.' },
                { id: 'veto', l: 'The Advisor must approve any future fundraising.' },
                { id: 'meet', l: 'One call a month with the founders.' },
              ],
            },
            issues: {
              eq: 'Advisor shares should vest monthly over the term, so they are earned by actual help.',
              dut: 'No defined duties means no way to judge whether the shares were earned.',
              veto: 'An advisor with a veto over fundraising has more power than most investors.',
            },
            fine: {
              term: 'A clear term with a way out.',
              conf: 'Standard and important.',
              meet: 'A concrete, checkable commitment.',
            },
          }),
      ],
      4: [
        () =>
          pick({
            brief: 'Eight months in, an investor offers $200,000 for 40% of the company.',
            visual: <Feed posts={[{ who: 'Investor', text: 'Take it or leave it. Nobody else will fund you this early.' }]} />,
            prompt: 'What is the main concern?',
            options: [
              { label: 'Giving away 40% this early leaves too little for founders and future investors. Negotiate, or raise less', credit: 1, why: 'Early rounds usually sell 10% to 25%. After two more rounds, founders could own a small minority of their own company, and later investors worry about that.' },
              { label: 'None. $200,000 is a lot of money', credit: 0.2, why: 'It is, but the price is what matters: it values the company at only $500,000 including the cash.' },
              { label: 'The investor will run the company', credit: 0.4, why: 'A 40% owner has a lot of influence, but the bigger issue is how little ownership is left for everyone else.' },
            ],
          }),
      ],
    },
    outcome: (s) => ({ headline: s.vest ? 'StudyStack survived a founder leaving' : 'A departed founder still owns 42% of your company', bonus: s.vest ? 3 : -10 }),
    takeaways: [
      'Split ownership by ongoing commitment, not by who had the idea.',
      'Vesting with a cliff protects the company when someone leaves, and everyone leaves eventually.',
      'The company must own everything employees build for it.',
      'Raising money shrinks every owner’s percentage. A smaller slice of a bigger company can be worth more.',
    ],
  };
  return <CaseRunner def={def} seed={seed} onFinish={onFinish} addReview={addReview} />;
}
