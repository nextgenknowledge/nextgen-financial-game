'use client';
/**
 * First Year Out (Advanced, Budget Hall). Your first year as a freelance designer, where no two
 * months pay the same. Budget on the lean month, plan for bills that come once a year, set tax
 * aside, and survive a client who pays two months late.
 */
import type { KindProps } from '../../types';
import { Bars, C, Table } from '../pro/kit';
import { CaseRunner, Feed, dial, flag, pick, type CaseDef } from './kit';

const gbp = (v: number) => `£${Math.round(v).toLocaleString('en-GB')}`;

interface S {
  income: number[];
  buffer: number;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];

export default function FirstYearOut({ seed, onFinish, addReview }: KindProps) {
  const def: CaseDef<S> = {
    kicker: 'Budget Hall · First year out',
    init: (rng) => ({ income: rng.shuffle([1400, 2600, 900, 2200, 1800, 1300]), buffer: 600 }),
    meters: (s) => [['Buffer account', gbp(s.buffer), s.buffer < 300 ? 'bad' : s.buffer > 1500 ? 'good' : undefined]],
    steps: [
      ({ s }) =>
        pick({
          brief: 'You left college and went freelance as a graphic designer. Here is what clients paid you, after expenses, in your first six months. Rent and bills take £1,050 a month whatever happens.',
          visual: <Bars items={s.income.map((v, i) => ({ label: MONTHS[i], value: v, color: v < 1100 ? C.red : C.green }))} fmt={(v) => gbp(v)} />,
          prompt: 'What monthly income should you build your budget on?',
          options: [
            { label: 'A lean month, about £1,300, with everything above it going to a buffer account', credit: 1, why: 'Budgeting on a lean month means a normal month never surprises you. Good months fill the buffer that pays you in the bad ones.' },
            { label: 'The average, about £1,700', credit: 0.5, why: 'The average is right over a year but wrong in any given month. Half the time you would come up short.' },
            { label: 'The best month, £2,600, since you are getting more clients', credit: 0, why: 'Planning on your best month guarantees you will overspend in every other one.' },
            { label: 'The worst month, £900', credit: 0.6, why: 'Very safe, but it does not even cover rent. Budget on lean, not on disaster; the buffer handles disasters.' },
          ],
        }),
      () =>
        dial({
          brief: 'Some costs do not come monthly. They arrive once a year and wreck the month they land in.',
          visual: <Table head={['Yearly costs', 'Amount']} rows={[['TV licence', '£175'], ['Software subscription, paid annually', '£240'], ['Train home at Christmas', '£180'], ['Birthdays and gifts', '£300'], ['New laptop every three years (£900 ÷ 3)', '£300']]} />,
          prompt: 'How much should you set aside every month to cover them?',
          min: 0,
          max: 200,
          step: 1,
          answer: 100,
          tol: 3,
          fmt: (v) => gbp(v),
          why: 'They add up to £1,195 a year, so about £100 a month. Saving it monthly in a separate pot, a sinking fund, turns five nasty surprises into a boring standing order.',
        }),
      () =>
        flag({
          brief: 'You sketch your monthly plan.',
          prompt: 'Flag the lines that will cause trouble.',
          doc: {
            title: 'My monthly budget',
            sub: 'Based on £1,300',
            skin: 'paper',
            lines: [
              { id: 'rent', l: 'Rent and bills', r: '£1,050' },
              { id: 'food', l: 'Food', r: '£160' },
              { id: 'tax', l: 'Tax: nothing set aside. I will deal with it in January', r: '£0' },
              { id: 'sink', l: 'Yearly costs pot', r: '£100' },
              { id: 'fun', l: 'Going out: whatever is left in a good month', r: 'Varies' },
              { id: 'emerg', l: 'Emergency fund: will start once I earn more', r: '£0' },
            ],
            foot: 'Total planned: £1,310',
          },
          issues: {
            tax: 'Nobody takes tax from a freelancer’s pay. The whole year’s bill arrives at once. Put aside around 20% of every payment the day it arrives.',
            emerg: '"Once I earn more" never feels like now. A freelancer, with no sick pay, needs the buffer most.',
            fun: 'Spending "whatever is left" in good months is how the buffer stays empty. Give fun a fixed amount.',
          },
          fine: {
            rent: 'Fixed and known.',
            food: 'A realistic amount.',
            sink: 'Exactly right: the yearly costs, spread out.',
          },
        }),
      ({ s }) =>
        pick({
          brief: 'Month eight. Your biggest client has not paid a £1,600 invoice, now 45 days overdue. This month you earned £400.',
          visual: <Feed title="Email" posts={[{ who: 'Client', text: 'So sorry, accounts are running a bit behind. Should be with you soon!', meta: 'Day 45' }]} />,
          prompt: `Rent is due in a week. You have ${gbp(s.buffer)} in your buffer. What do you do?`,
          options: [
            { label: 'Pay rent from the buffer, chase the invoice with a firm deadline, and pause new work for that client until they pay', credit: 1, why: 'This is what the buffer is for. Pausing work stops the amount they owe you from growing. In the UK, businesses can also charge statutory interest on late invoices.', apply: (st) => void (st.buffer -= 650) },
            { label: 'Put rent on a credit card until they pay', credit: 0.3, why: 'Fine for a few days if you clear it in full, but "soon" can stretch to months, and interest is around 25% a year.' },
            { label: 'Keep working for the client so they stay happy', credit: 0.1, why: 'Doing more unpaid work for a client who pays late increases the money you could lose.' },
            { label: 'Ask your landlord for a delay', credit: 0.4, why: 'Some landlords agree, but it costs you goodwill and may count as late payment. Use your own buffer first.' },
          ],
        }),
      () =>
        pick({
          brief: 'Month eleven. A big project pays £3,800 at once, your best month ever.',
          prompt: 'What do you do with it?',
          options: [
            { label: 'Set aside the tax, top up the buffer to three months of costs, and then enjoy a fixed amount', credit: 1, why: 'Tax first, buffer second, fun third. A big month is a gift to the lean months ahead, not a raise.', apply: (st) => void (st.buffer += 1500) },
            { label: 'Upgrade to a nicer flat now that you are earning well', credit: 0, why: 'One great month is not a new income. Locking in higher rent turns the next lean month into a crisis.' },
            { label: 'Spend it; you earned it after a tough year', credit: 0.2, why: 'You did earn it, but around 20% of it already belongs to the tax office.' },
          ],
        }),
    ],
    alts: {
      0: [
        () =>
          pick({
            brief: 'You went freelance as a graphic designer straight after college. Your income swings between £900 and £2,600 a month. Rent and bills take £1,050 a month whatever happens.',
            prompt: 'How big should your buffer account be before you relax?',
            options: [
              { label: 'About three months of essential costs, roughly £3,150', credit: 1, why: 'Three months covers a dry spell or a late client without panic. Freelancers have no sick pay, so the buffer is their safety net.' },
              { label: 'One month, £1,050', credit: 0.4, why: 'Better than nothing, but one slow month and one late invoice would empty it.' },
              { label: 'No buffer. Just find more work when money runs low', credit: 0, why: 'Work takes weeks to find and longer to be paid for. Rent is due on a fixed date.' },
              { label: 'A full year of costs before spending anything on fun', credit: 0.5, why: 'Very safe, but it could take years to build. Three months, then a normal life, is a better balance.' },
            ],
          }),
      ],
      1: [
        () =>
          dial({
            brief: 'Some costs arrive once a year and wreck the month they land in. You list yours.',
            visual: <Table head={['Yearly costs', 'Amount']} rows={[['Dentist and eye test', '£60'], ['New glasses', '£180'], ['Contents insurance', '£420'], ['A week away in summer', '£600'], ['Birthdays and gifts', '£300']]} />,
            prompt: 'How much should you set aside every month to cover them?',
            min: 0,
            max: 250,
            step: 1,
            answer: 130,
            tol: 3,
            fmt: (v) => gbp(v),
            why: 'They add up to £1,560 a year, so £130 a month. A separate pot that fills a little every month means none of them is ever a shock.',
          }),
      ],
      2: [
        () =>
          flag({
            brief: 'A new client wants a three-month branding project. You draft the agreement.',
            prompt: 'Flag the terms that put you at risk of not being paid properly.',
            doc: {
              title: 'Project Agreement',
              sub: 'Draft',
              skin: 'paper',
              lines: [
                { id: 'fee', l: 'Fee: £3,600 for logo, colours and a brand guide.' },
                { id: 'when', l: 'Payment: the full fee once the whole project is finished.' },
                { id: 'rev', l: 'Revisions: as many as the client wants.' },
                { id: 'terms', l: 'Invoices to be paid whenever convenient.' },
                { id: 'scope', l: 'Deliverables are listed in the attached brief.' },
                { id: 'own', l: 'The client owns the designs once paid in full.' },
              ],
            },
            issues: {
              when: 'Three months of work with nothing paid until the end. Ask for a deposit up front and payments at milestones.',
              rev: 'Unlimited revisions can double the work for the same fee. Include a set number.',
              terms: '"Whenever convenient" can mean never. Set a deadline, such as 14 or 30 days.',
            },
            fine: {
              fee: 'A clear, agreed price.',
              scope: 'A written list of what you will deliver protects both sides.',
              own: 'Fair, and it gives the client a reason to pay.',
            },
          }),
      ],
      3: [
        ({ s }) =>
          pick({
            brief: 'Month eight. Your laptop dies in the middle of a project. A new one costs £900; a refurbished one of the same model costs £550 with a one-year warranty.',
            prompt: `You have ${gbp(s.buffer)} in your buffer. What do you do?`,
            options: [
              { label: 'Buy the refurbished one from the buffer and rebuild the buffer from the next good month', credit: 1, why: 'It is the tool you earn with, so it cannot wait. Refurbished with a warranty saves £350, and the buffer is for exactly this.', apply: (st) => void (st.buffer -= 550) },
              { label: 'Buy a new one on a credit card and pay it off slowly', credit: 0.3, why: 'Works, but you pay interest for months on something your buffer could cover.', apply: (st) => void (st.buffer -= 100) },
              { label: 'Buy the most powerful laptop available, since it is a business expense', credit: 0.1, why: 'A business expense still costs real money. Tax relief only returns a part of it.', apply: (st) => void (st.buffer -= 1400) },
            ],
          }),
      ],
      4: [
        () =>
          pick({
            brief: 'Month eleven. A client offers a steady contract: £1,400 a month for 12 months, for about half of your working week.',
            prompt: 'What is the smartest response?',
            options: [
              { label: 'Take it, and use the other half of your week for project work that fills the buffer', credit: 1, why: 'Guaranteed income that covers your essentials removes the worst of freelance stress. Everything you earn on top can go to the buffer and tax.', apply: (st) => void (st.buffer += 1500) },
              { label: 'Turn it down; you went freelance to be free', credit: 0.3, why: 'Freedom matters, but steady income on half your time still leaves plenty of freedom.', apply: (st) => void (st.buffer += 300) },
              { label: 'Take it, and raise your spending to match the extra money', credit: 0.2, why: 'Spending more as income rises leaves you just as exposed when the contract ends.', apply: (st) => void (st.buffer += 200) },
            ],
          }),
      ],
    },
    outcome: (s) => ({ headline: s.buffer > 1200 ? 'Ending the year with a real cushion' : 'Ending the year on thin ice', bonus: s.buffer > 1200 ? 4 : -4 }),
    takeaways: [
      'With irregular income, budget on a lean month and let good months fill a buffer.',
      'Add up the once-a-year costs and save a twelfth of them every month.',
      'Freelancers pay their own tax. Put around 20% of every payment aside the day it lands.',
      'Treat a big month as next season’s income, not as a raise.',
    ],
  };
  return <CaseRunner def={def} seed={seed} onFinish={onFinish} addReview={addReview} />;
}
