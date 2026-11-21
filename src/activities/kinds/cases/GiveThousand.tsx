'use client';
/**
 * $1,000 to Give (Advanced, Giving Center). A local foundation lets your class direct $1,000.
 * Catch the fake charity, see past the overhead myth, compare programs by what they achieve per
 * dollar, use a match, and give in a way that helps after a disaster.
 */
import type { KindProps } from '../../types';
import { Table, usd } from '../pro/kit';
import { CaseRunner, Cards, Say, dial, flag, pick, type CaseDef } from './kit';

interface S {
  yCost: number;
  yJobs: number;
}

export default function GiveThousand({ seed, onFinish, addReview }: KindProps) {
  const def: CaseDef<S> = {
    kicker: 'Giving Center · $1,000 to give',
    init: (rng) => ({ yCost: rng.pick([30000, 36000, 42000]), yJobs: rng.pick([15, 18, 20]) }),
    steps: [
      () =>
        flag({
          brief: 'The Fin City Foundation lets your class decide where $1,000 goes. Suggestions pour in, including this message forwarded by a classmate.',
          prompt: 'Flag the signs that this charity may not be real.',
          doc: {
            title: 'Help Kids Smile Now!',
            sub: 'Forwarded message',
            skin: 'screen',
            lines: [
              { id: 'urgent', l: 'URGENT: children need help TODAY. Every hour counts!' },
              { id: 'pay', l: 'Donate by gift card or crypto so 100% reaches the kids.' },
              { id: 'reg', l: 'We are too new to be registered as a charity, but we are 100% legit.' },
              { id: 'story', l: 'Photo of a smiling child with no name, place or program described.' },
              { id: 'similar', l: 'Name is one letter off a famous children’s charity.' },
              { id: 'ask', l: 'Any amount helps, even $5.' },
            ],
          },
          issues: {
            urgent: 'Pressure to act before you can check is the same tactic every scam uses.',
            pay: 'Real charities take cards and bank transfers. Gift cards and crypto cannot be traced or refunded.',
            reg: 'Registered charities can be looked up in public databases in minutes. "Too new to register" means you cannot check anything.',
            story: 'No program, place or result. Just an emotional picture.',
            similar: 'Copycat names borrow trust from a real organization.',
          },
          fine: {
            ask: 'Real charities welcome small gifts too. On its own, this is normal.',
          },
        }),
      () =>
        pick({
          brief: 'Two real, registered charities make the shortlist.',
          visual: (
            <Cards
              cards={[
                { icon: '📚', title: 'ReadUp', sub: 'Tutoring for kids behind in reading', facts: [['Spent on programs', '72%'], ['Spent on staff, offices, fundraising', '28%'], ['Results', 'Independent study: kids gain a full grade level in a year']] },
                { icon: '🎒', title: 'BookDrop', sub: 'Donates books to schools', facts: [['Spent on programs', '96%'], ['Spent on staff, offices, fundraising', '4%'], ['Results', 'Counts books handed out; no reading data']] },
              ]}
            />
          ),
          prompt: 'A classmate says BookDrop is better because it spends less on overhead. Is that right?',
          options: [
            { label: 'Not necessarily. ReadUp’s higher costs pay for trained tutors, and it has evidence that kids actually read better', credit: 1, why: 'Low overhead is not the same as impact. Good programs need skilled staff and measurement. What matters is what each dollar achieves.' },
            { label: 'Yes, lower overhead always means more good done', credit: 0.1, why: 'A charity can spend 96% on programs that change nothing. Overhead is a cost, not a measure of results.' },
            { label: 'Overhead does not matter at all', credit: 0.4, why: 'Very high overhead can be a warning sign, especially fundraising costs. It is one clue, not the answer.' },
          ],
        }),
      ({ s }) =>
        dial({
          brief: 'Two job-training charities share their numbers.',
          visual: <Table head={['', 'Program budget', 'People trained', 'Got a job within a year']} rows={[['Bridge Skills', '$50,000', '100', '40'], ['NextStep', usd(s.yCost), '60', String(s.yJobs)]]} />,
          prompt: 'How much does NextStep spend for each person who gets a job?',
          min: 0,
          max: 4000,
          step: 25,
          answer: Math.round(s.yCost / s.yJobs),
          tol: 25,
          fmt: (v) => usd(v),
          why: `${usd(s.yCost)} ÷ ${s.yJobs} = ${usd(s.yCost / s.yJobs)} per job, against Bridge Skills’ $50,000 ÷ 40 = $1,250. Comparing cost per outcome, not cost per person served, shows which program turns money into results.`,
        }),
      () =>
        pick({
          brief: 'Your teacher mentions that a local company matches student-directed gifts one-for-one until Friday.',
          visual: <Say who="Teacher">Match funds are first come, first served.</Say>,
          prompt: 'What is the best use of that?',
          options: [
            { label: 'Give before Friday to the charity you chose, so $1,000 becomes $2,000', credit: 1, why: 'Matches are among the easiest ways to double impact. Many employers match their staff’s donations too, and much of it goes unclaimed.' },
            { label: 'Ignore it; the company is just trying to look good', credit: 0.2, why: 'Perhaps, but the extra $1,000 helps people either way.' },
            { label: 'Switch to whichever charity the company prefers', credit: 0.3, why: 'Check the match rules, but do not abandon your research to chase a logo.' },
          ],
        }),
      () =>
        pick({
          brief: 'Before you give, a hurricane hits a town on the coast. Your class wants to help there instead, and someone suggests collecting clothes and canned food to ship.',
          prompt: 'What helps the town most?',
          options: [
            { label: 'Cash to an established relief group working there', credit: 1, why: 'Cash lets responders buy exactly what is needed, often locally, which also supports the town’s shops. Donated goods often pile up unsorted and cost more to ship than they are worth.' },
            { label: 'A truck of donated clothes and cans', credit: 0.2, why: 'Kind, but relief workers often have to sort, store or throw away unrequested goods. It can slow the response.' },
            { label: 'Wait until the news coverage ends, then decide', credit: 0.4, why: 'Recovery does take years, and later gifts are valuable. But the early weeks need flexible cash too.' },
          ],
        }),
    ],
    alts: {
      0: [
        () =>
          flag({
            brief: 'After a storm on the coast, a fundraising page goes viral in your class group chat.',
            prompt: 'Flag the signs that this fundraiser may not be genuine.',
            doc: {
              title: 'Storm Relief NOW',
              sub: 'Shared fundraising page',
              skin: 'screen',
              lines: [
                { id: 'acct', l: 'Donations go to my personal account while we “set things up”.' },
                { id: 'who', l: 'No names of who runs it or who will receive the money.' },
                { id: 'photos', l: 'Photos match ones published by news sites last year.' },
                { id: 'town', l: 'Says which town it will help.' },
                { id: 'secret', l: 'Please don’t ask questions, just give. Time is running out!' },
                { id: 'amt', l: 'Suggested gift: $25.' },
              ],
            },
            issues: {
              acct: 'Money into a stranger’s personal account cannot be traced to any relief work.',
              who: 'Genuine fundraisers say who they are and who gets the money.',
              photos: 'Reused photos are a common sign of a fake appeal. A quick reverse image search finds them.',
              secret: 'Discouraging questions and pushing urgency are classic pressure tactics.',
            },
            fine: {
              town: 'Naming the place is normal. On its own it is not a warning sign.',
              amt: 'A suggested amount is normal for real charities too.',
            },
          }),
      ],
      1: [
        () =>
          pick({
            brief: 'Two animal shelters make the shortlist. Both spend about $1M a year.',
            visual: (
              <Cards
                cards={[
                  { icon: '🐶', title: 'PawsHome', sub: 'Finds homes for stray pets', facts: [['Spent on programs', '80%'], ['Spent on staff, offices, fundraising', '20%'], ['Results', '2,000 pets adopted last year, tracked by microchip']] },
                  { icon: '🐱', title: 'HappyTails', sub: 'Cares for stray pets', facts: [['Spent on programs', '95%'], ['Spent on staff, offices, fundraising', '5%'], ['Results', '400 pets adopted last year']] },
                ]}
              />
            ),
            prompt: 'A classmate wants HappyTails because it spends less on overhead. What do you say?',
            options: [
              { label: 'PawsHome gets a pet adopted for about $500, HappyTails for about $2,500. Results per dollar matter more', credit: 1, why: '$1M ÷ 2,000 = $500 per adoption against $1M ÷ 400 = $2,500. PawsHome does five times as much with each dollar, even with higher overhead.' },
              { label: 'Agree: lower overhead always means more good done', credit: 0.1, why: 'Overhead is a cost, not a result. Spending almost everything on programs that achieve less is not better.' },
              { label: 'Split the money evenly so nobody is upset', credit: 0.3, why: 'Fair-sounding, but half the money would do far less good than it could.' },
            ],
          }),
      ],
      2: [
        ({ s }) =>
          dial({
            brief: 'Two mentoring programs help students who are at risk of dropping out of school.',
            visual: <Table head={['', 'Program budget', 'Students mentored', 'Graduated who were at risk']} rows={[['StudyHall', '$50,000', '100', '40'], ['MentorUp', usd(s.yCost), '60', String(s.yJobs)]]} />,
            prompt: 'How much does MentorUp spend for each at-risk student who graduates?',
            min: 0,
            max: 4000,
            step: 25,
            answer: Math.round(s.yCost / s.yJobs),
            tol: 25,
            fmt: (v) => usd(v),
            why: `${usd(s.yCost)} ÷ ${s.yJobs} = ${usd(s.yCost / s.yJobs)} per graduate, against StudyHall’s $50,000 ÷ 40 = $1,250. Cost per result, not per student served, shows which program turns money into change.`,
          }),
      ],
      3: [
        () =>
          pick({
            brief: 'ReadUp tells your class that a gift of $85 a month helps it more than $1,000 given once.',
            visual: <Say who="ReadUp volunteer">Regular gifts let us plan the whole year.</Say>,
            prompt: 'Why might that be true, even though the yearly totals are about the same?',
            options: [
              { label: 'Steady income lets a charity hire tutors and plan, instead of guessing what will arrive', credit: 1, why: 'Predictable money is easier to spend well. Charities can commit to staff and programs when they know the money is coming.' },
              { label: 'Monthly gifts are tax-free and one-off gifts are not', credit: 0, why: 'Tax treatment is the same either way. The benefit is planning, not tax.' },
              { label: 'Charities charge a fee on one-off gifts', credit: 0.1, why: 'Card fees are similar either way. The real benefit is reliability.' },
            ],
          }),
      ],
      4: [
        () =>
          pick({
            brief: 'Your class decides to run a toy drive for the children’s hospital instead.',
            prompt: 'What should you do first?',
            options: [
              { label: 'Ask the hospital what it actually needs and what it can accept', credit: 1, why: 'Hospitals often cannot take used toys for hygiene reasons, and many need specific items, gift cards or cash. Asking first makes every gift count.' },
              { label: 'Buy lots of the year’s most popular toy', credit: 0.3, why: 'Kind, but it may not suit the ages, rules or needs of the ward.' },
              { label: 'Collect everyone’s old toys', credit: 0.1, why: 'Many hospitals cannot accept used toys, so they may end up thrown away.' },
            ],
          }),
      ],
    },
    takeaways: [
      'Check any charity in a public registry before giving. Urgency, gift cards and copycat names are red flags.',
      'Judge charities by results per dollar, not by overhead alone.',
      'Use matching gifts: they double what you give.',
      'After disasters, send cash to established groups, not goods.',
    ],
  };
  return <CaseRunner def={def} seed={seed} onFinish={onFinish} addReview={addReview} />;
}
