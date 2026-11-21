'use client';
/**
 * Side Hustle Tax Surprise (Advanced, Tax Office). A year of tutoring, babysitting and selling
 * things online. Sort what counts as income, see why a small side hustle means filing a return,
 * work out the self-employment tax, and avoid the April shock next year.
 */
import type { KindProps } from '../../types';
import { Table, usd } from '../pro/kit';
import { CaseRunner, Cards, Say, dial, flag, pick, type CaseDef } from './kit';

interface S {
  net: number;
}

export default function SideHustleTax({ seed, onFinish, addReview }: KindProps) {
  const def: CaseDef<S> = {
    kicker: 'Tax Office · Side hustle tax surprise',
    init: (rng) => ({ net: rng.pick([2400, 3000, 3600]) }),
    steps: [
      () =>
        flag({
          brief: 'You are 17. Besides your weekend job, a lot of money came in this year. Your notes:',
          prompt: 'Flag every item that counts as taxable income.',
          doc: {
            title: 'Money in, this year',
            sub: 'From my notes app',
            skin: 'paper',
            lines: [
              { id: 'tutor', l: 'Math tutoring through an app', r: '$1,800' },
              { id: 'baby', l: 'Babysitting for neighbors, paid in cash', r: '$1,200' },
              { id: 'bike', l: 'Sold my old bike for less than I paid', r: '$150' },
              { id: 'gift', l: 'Birthday money from Grandma', r: '$300' },
              { id: 'flip', l: 'Bought vintage jackets at thrift stores and resold them, profit', r: '$400' },
              { id: 'prize', l: 'Won a gift card in a radio contest', r: '$500' },
              { id: 'refund', l: 'Store refund for headphones I returned', r: '$80' },
            ],
          },
          issues: {
            tutor: 'Payment for your work is income, whether or not the app sends you a tax form.',
            baby: 'Cash is income too. The tax rules do not care how you were paid.',
            flip: 'Buying to resell for profit is a small business. The profit is income.',
            prize: 'Prizes and contest winnings count as income, even as gift cards.',
          },
          fine: {
            bike: 'Selling your own used things for less than you paid is not a profit, so there is nothing to tax.',
            gift: 'Gifts are not income for the person receiving them.',
            refund: 'Getting your own money back is not income.',
          },
        }),
      () =>
        pick({
          brief: 'Your income from tutoring, babysitting and flipping comes to a few thousand dollars after costs. Your friend says students do not need to file unless they earn more than the standard deduction.',
          visual: <Say who="Tax office volunteer">That rule is true for wages. Self-employment has a different trigger.</Say>,
          prompt: 'Do you need to file a tax return?',
          options: [
            { label: 'Yes. Self-employment profit of $400 or more requires a return, because of self-employment tax', credit: 1, why: 'Even when no income tax is due, self-employment tax applies once net self-employment earnings reach $400. Many teenagers with side hustles do not know this.' },
            { label: 'No, you earned less than the standard deduction', credit: 0.2, why: 'That covers income tax on wages. Self-employment tax has its own, much lower, $400 threshold.' },
            { label: 'Only if an app sent you a tax form', credit: 0, why: 'The income is taxable whether or not a form arrives. Forms only make it easier for the tax office to notice.' },
          ],
        }),
      ({ s }) =>
        dial({
          brief: `Your net self-employment profit is ${usd(s.net)}. Self-employment tax is 15.3% of 92.35% of that.`,
          visual: <Table head={['Self-employment tax', '']} rows={[['Net profit', usd(s.net)], ['× 92.35%', '?'], ['× 15.3%', '?']]} />,
          prompt: 'How much self-employment tax is due?',
          min: 0,
          max: 800,
          step: 1,
          answer: Math.round(s.net * 0.9235 * 0.153),
          tol: 6,
          fmt: (v) => usd(v),
          why: `${usd(s.net)} × 0.9235 × 0.153 ≈ ${usd(s.net * 0.9235 * 0.153)}. It pays into Social Security and Medicare, the same taxes taken from paychecks, but as a self-employed person you pay both the worker’s and the employer’s share.`,
        }),
      () =>
        pick({
          brief: 'You realize the tutoring app took a 20% fee, and you spent $180 on a used graphing calculator and workbooks for tutoring.',
          visual: <Cards cards={[{ icon: '🧾', title: 'Receipts you kept', facts: [['App fees', 'In your account history'], ['Calculator and workbooks', 'Receipt photos']] }]} />,
          prompt: 'How do these affect your taxes?',
          options: [
            { label: 'Business costs reduce your profit, so you pay tax only on what is left. Records prove them', credit: 1, why: 'Tax is charged on profit, not on everything you are paid. Fees and supplies used for the work are deductible, and receipts are your evidence if anyone asks.' },
            { label: 'They do not matter; tax is on everything you were paid', credit: 0, why: 'That would overstate your income. Legitimate costs come off first.' },
            { label: 'You can deduct anything, like your phone and clothes', credit: 0.1, why: 'Only costs genuinely for the business count, and only the business share of mixed-use items.' },
          ],
        }),
      () =>
        pick({
          brief: 'Next year your tutoring will grow, and you expect to owe more than $1,000 in tax.',
          prompt: 'How do you avoid a big bill and a penalty next April?',
          options: [
            { label: 'Pay estimated tax each quarter, or have extra withheld from your weekend job’s paycheck', credit: 1, why: 'Tax is meant to be paid as you earn. Owing $1,000 or more at filing time without paying along the way can bring an underpayment penalty.' },
            { label: 'Save it all up and pay once in April', credit: 0.4, why: 'Saving is good, but a large balance owed at filing can still be penalized. Paying during the year avoids that.' },
            { label: 'Claim "exempt" on your job’s tax form so you have more cash', credit: 0, why: 'That stops all withholding and makes the April bill even bigger.' },
          ],
        }),
      () =>
        pick({
          brief: 'One last question from your little sister: "Why bother with taxes on babysitting? Nobody will ever know."',
          prompt: 'What is the most honest answer?',
          options: [
            { label: 'It is the law, and reported earnings also count toward your own future Social Security and help prove income for loans and apartments', credit: 1, why: 'Unreported income is not just a legal risk. It also leaves no record when you need to show a landlord, a lender or a college what you earn.' },
            { label: 'You are right; cash is invisible', credit: 0, why: 'Not reporting income is tax evasion, and it gives you no proof of income later.' },
            { label: 'Because the parents you babysit for will report you', credit: 0.2, why: 'They might, but that is not the main reason to report it.' },
          ],
        }),
    ],
    alts: {
      0: [
        () =>
          flag({
            brief: 'You are 17. You list everything that came in this year.',
            prompt: 'Flag every item that counts as taxable income.',
            doc: {
              title: 'Money in, this year',
              sub: 'From my notes app',
              skin: 'paper',
              lines: [
                { id: 'lawn', l: 'Mowing lawns for neighbors, cash', r: '$900' },
                { id: 'dog', l: 'Dog walking through an app', r: '$700' },
                { id: 'art', l: 'Digital art commissions', r: '$350' },
                { id: 'clothes', l: 'Sold my old clothes for less than I paid', r: '$60' },
                { id: 'allow', l: 'Allowance from my parents', r: '$400' },
                { id: 'lotto', l: 'Scratch-card win', r: '$200' },
              ],
            },
            issues: {
              lawn: 'Cash for your work is income.',
              dog: 'App payments for your work are income, with or without a tax form.',
              art: 'Payment for creative work is self-employment income.',
              lotto: 'Gambling and lottery winnings count as income.',
            },
            fine: {
              clothes: 'Selling your own things at a loss is not a profit.',
              allow: 'Money from your parents is a gift, not income.',
            },
          }),
      ],
      1: [
        () =>
          pick({
            brief: 'Your weekend job took $210 of income tax from your paychecks. With your low income, you actually owe no income tax for the year.',
            prompt: 'Should you file a tax return?',
            options: [
              { label: 'Yes. Filing is the only way to get the $210 back', credit: 1, why: 'Withheld tax is refunded only if you file. Many teenagers leave money with the government simply by not filing.' },
              { label: 'No. You earned too little to need to file', credit: 0.2, why: 'You may not be required to, but you would give up $210 of your own money.' },
              { label: 'Only if your employer tells you to', credit: 0, why: 'Employers do not file for you. It is up to you.' },
            ],
          }),
      ],
      2: [
        ({ s }) =>
          dial({
            brief: `You expect ${usd(s.net)} of self-employment profit next year. Self-employment tax is 15.3% of 92.35% of profit, and you plan to set it aside in four equal quarterly amounts.`,
            prompt: 'How much should you set aside each quarter for self-employment tax?',
            min: 0,
            max: 300,
            step: 1,
            answer: Math.round((s.net * 0.9235 * 0.153) / 4),
            tol: 3,
            fmt: (v) => usd(v),
            why: `${usd(s.net)} × 0.9235 × 0.153 ≈ ${usd(s.net * 0.9235 * 0.153)} for the year, ÷ 4 ≈ ${usd((s.net * 0.9235 * 0.153) / 4)} a quarter. Income tax, if any, comes on top.`,
          }),
      ],
      3: [
        () =>
          pick({
            brief: 'Your phone bill is $50 a month. You use the phone about a quarter of the time for your tutoring business.',
            prompt: 'How much of the phone bill can you count as a business expense for the year?',
            options: [
              { label: 'About $150: the business share of $600', credit: 1, why: 'Mixed-use costs are split. A quarter of $600 is $150, and a simple note of how you worked it out is your record.' },
              { label: 'All $600, because you use it for work', credit: 0.1, why: 'Only the business share counts. Claiming personal use is not allowed.' },
              { label: 'Nothing, because it is also personal', credit: 0.3, why: 'Too cautious. The business share is a genuine cost.' },
            ],
          }),
      ],
      4: [
        () =>
          pick({
            brief: 'A family asks to pay you for babysitting with a $100 restaurant gift card instead of cash.',
            prompt: 'How does that affect your taxes?',
            options: [
              { label: 'It is still income, worth $100, just paid in a different form', credit: 1, why: 'Income is income whatever form it takes: cash, app, gift card or goods.' },
              { label: 'Gift cards are gifts, so it is not income', credit: 0, why: 'It is payment for work, not a gift.' },
              { label: 'Only cash counts', credit: 0, why: 'The form of payment does not change whether it is income.' },
            ],
          }),
      ],
      5: [
        () =>
          pick({
            brief: 'Your friend earned money from three side hustles. Only one app sent a tax form. "So I only report that one, right?"',
            prompt: 'What do you tell them?',
            options: [
              { label: 'All income must be reported, whether or not a form was sent', credit: 1, why: 'Forms only help the tax office spot income. The duty to report all of it is the same.' },
              { label: 'Right, only the form counts', credit: 0, why: 'Leaving out unreported income is tax evasion.' },
              { label: 'Report none of it, since it is all small', credit: 0, why: 'Small amounts still count, especially self-employment profit over $400.' },
            ],
          }),
      ],
    },
    takeaways: [
      'Pay for your work is income, whether cash, an app or a gift card. Gifts and selling your own used things at a loss are not.',
      'Self-employment profit of $400 or more means filing a return, even for a teenager.',
      'Self-employed people pay 15.3% on most of their profit, on top of income tax.',
      'Keep receipts, pay as you go, and set money aside from every payment.',
    ],
  };
  return <CaseRunner def={def} seed={seed} onFinish={onFinish} addReview={addReview} />;
}
