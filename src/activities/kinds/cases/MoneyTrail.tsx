'use client';
/**
 * Where Did the Money Go? (Advanced, Accounting Office). The robotics club is short of money
 * before its big competition. Audit the treasurer's ledger, reconcile it to the bank, handle what
 * you find fairly, and set up the controls that stop it happening again.
 */
import type { KindProps } from '../../types';
import { Table, usd } from '../pro/kit';
import { CaseRunner, Say, choose, dial, flag, pick, type CaseDef } from './kit';

interface S {
  bank: number;
  gap: number;
  check: number;
}

export default function MoneyTrail({ seed, onFinish, addReview }: KindProps) {
  const def: CaseDef<S> = {
    kicker: 'Accounting Office · Where did the money go?',
    init: (rng) => ({ bank: rng.pick([1240, 1380, 1460]), gap: rng.pick([420, 500, 560]), check: rng.pick([130, 150, 175]) }),
    steps: [
      () =>
        flag({
          brief: 'The robotics club should have enough for the regional competition. It does not. The adviser asks you, the new vice president, to review the treasurer’s ledger.',
          prompt: 'Flag the entries that need explaining.',
          doc: {
            title: 'Robotics Club Ledger',
            sub: 'Fall semester',
            skin: 'statement',
            lines: [
              { id: 'h', head: true, l: 'Entry', r: 'Amount' },
              { id: 'dues', l: 'Sep 5 · Member dues, 24 × $25, list of payers attached', r: '+$600' },
              { id: 'parts1', l: 'Sep 12 · Motors and sensors, Voltmart, receipt #4471', r: '−$318' },
              { id: 'parts2', l: 'Sep 12 · Motors and sensors, Voltmart, receipt #4471', r: '−$318' },
              { id: 'bake', l: 'Oct 3 · Bake sale cash deposited (tally sheet signed by 2 members says $412)', r: '+$180' },
              { id: 'entry', l: 'Oct 20 · Regional competition entry fee, invoice attached', r: '−$150' },
              { id: 'reimb', l: 'Nov 2 · Reimburse treasurer for supplies, no receipt', r: '−$95' },
              { id: 'logo', l: 'Nov 9 · J. Lee Design: club logo (J. Lee is the treasurer’s cousin)', r: '−$250' },
              { id: 'misc', l: 'Nov 30 · Miscellaneous', r: '−$200' },
            ],
          },
          issues: {
            parts2: 'Same store, same day, same amount, same receipt number. Either the store was paid twice, or one entry hides something else.',
            bake: 'Two members counted $412 but only $180 reached the bank. $232 of cash is unaccounted for.',
            reimb: 'Money paid to the person keeping the books, with no proof, is exactly what reviews look for.',
            logo: 'Paying a relative is not automatically wrong, but it should have been disclosed and approved by the club first.',
            misc: 'A round number with no description is not a record.',
          },
          fine: {
            dues: 'Backed by a list of who paid. That is how income should be recorded.',
            parts1: 'A purchase with a receipt. The problem is the duplicate below it.',
            entry: 'Backed by an invoice.',
          },
        }),
      ({ s }) => {
        const ledger = s.bank - s.check + s.gap;
        return dial({
          brief: 'Next you compare the ledger to the bank. One payment, a check to the pizza place, was written but has not been cashed yet, so the bank does not know about it.',
          visual: <Table head={['', 'Balance']} rows={[['Ledger says the club has', usd(ledger)], ['Bank statement says', usd(s.bank)], ['Check written, not yet cashed', usd(s.check)]]} />,
          prompt: 'After allowing for the uncashed check, how much money is missing?',
          min: 0,
          max: 1000,
          step: 5,
          answer: s.gap,
          tol: 5,
          fmt: (v) => usd(v),
          why: `When the pizza check is cashed, the bank will show ${usd(s.bank)} − ${usd(s.check)} = ${usd(s.bank - s.check)}. The ledger says ${usd(ledger)}, so ${usd(s.gap)} is unexplained. Matching the books to the bank like this, a reconciliation, is the most basic check in all of accounting.`,
        });
      },
      () =>
        pick({
          brief: 'You now have a list of questions and a gap in the money. The treasurer, Alex, is a friend.',
          visual: <Say who="Another member">Just call Alex out in the group chat. Everyone deserves to know.</Say>,
          prompt: 'What do you do?',
          options: [
            { label: 'Take the documents to the club adviser privately, and let Alex explain each item before anyone draws conclusions', credit: 1, why: 'Some of it may be honest mistakes, like a duplicate entry. A private review with the facts is fair to Alex and protects you. Public accusations cannot be taken back.' },
            { label: 'Post the ledger in the group chat', credit: 0, why: 'If any of it has an innocent explanation, you have damaged someone’s reputation for nothing, and possibly broken school rules.' },
            { label: 'Ask Alex to quietly pay back the gap and say nothing', credit: 0.2, why: 'Kind in intent, but the adviser is responsible for club money. Hiding it makes you part of the problem.' },
            { label: 'Do nothing. It is not your job', credit: 0, why: 'The adviser asked you, and the club will miss its competition. Staying silent protects no one.' },
          ],
        }),
      () =>
        choose({
          brief: 'Alex resigns. The adviser asks you to set new rules for the next treasurer.',
          prompt: 'Which two rules would have prevented most of this?',
          k: 2,
          options: [
            { label: 'Two people count all cash and sign the tally, and the deposit must match it', good: true, why: 'This alone would have caught the bake sale gap on the day, not three months later.' },
            { label: 'Someone other than the treasurer matches the ledger to the bank statement every month', good: true, why: 'Separating the person who spends from the person who checks is the core of every financial control.' },
            { label: 'Choose a treasurer everyone trusts', good: false, why: 'Everyone trusted Alex. Controls work whoever holds the job.' },
            { label: 'Keep the cash box at the treasurer’s house so it is safe', good: false, why: 'That puts the cash with the one person who also keeps the records.' },
            { label: 'Post every expense on social media', good: false, why: 'Public, but nobody checks it, and it is no substitute for a review.' },
          ],
        }),
      () =>
        pick({
          brief: 'A member asks why companies spend so much money on auditors when most employees are honest.',
          prompt: 'What is the best answer?',
          options: [
            { label: 'Controls protect honest people as well. They catch mistakes early, and they prove nobody did anything wrong', credit: 1, why: 'Most problems an audit finds are errors, not theft. And when money does go missing, records show who is not responsible.' },
            { label: 'Because most people steal if they can', credit: 0, why: 'Most people do not. Controls are cheaper than finding out the hard way who does.' },
            { label: 'Because the law says so, and that is all', credit: 0.3, why: 'Some audits are required, but companies would want controls anyway.' },
          ],
        }),
    ],
    alts: {
      0: [
        () =>
          flag({
            brief: 'The drama club cannot afford costumes for the spring show. The adviser asks you to review the treasurer’s ledger.',
            prompt: 'Flag the entries that need explaining.',
            doc: {
              title: 'Drama Club Ledger',
              sub: 'Winter term',
              skin: 'statement',
              lines: [
                { id: 'h', head: true, l: 'Entry', r: 'Amount' },
                { id: 'tix', l: 'Jan 18 · Ticket sales, 140 sold at $8 (ticket stubs counted)', r: '+$1,120' },
                { id: 'dep', l: 'Jan 19 · Ticket money deposited', r: '+$860' },
                { id: 'paint', l: 'Jan 22 · Set paint, Brushworks, receipt attached', r: '−$84' },
                { id: 'gift', l: 'Feb 2 · Gift cards for "volunteers", 6 × $50, no names', r: '−$300' },
                { id: 'rent', l: 'Feb 10 · Hall rental, invoice attached', r: '−$200' },
                { id: 'cash', l: 'Feb 14 · Cash withdrawal, petty cash', r: '−$150' },
                { id: 'cost', l: 'Feb 20 · Costume fabric, receipt attached', r: '−$126' },
              ],
            },
            issues: {
              dep: '$1,120 in tickets were counted, but only $860 was deposited. $260 is unaccounted for.',
              gift: 'Gift cards act like cash. Without names and approval, nobody can tell who received them.',
              cash: 'Cash out with no record of what it was spent on.',
            },
            fine: {
              tix: 'Backed by counted stubs. That is how income should be recorded.',
              paint: 'A purchase with a receipt.',
              rent: 'Backed by an invoice.',
              cost: 'A purchase with a receipt.',
            },
          }),
      ],
      1: [
        ({ s }) => {
          const ledger = s.bank + s.check + s.gap;
          return dial({
            brief: 'Next you compare the ledger to the bank. Yesterday’s fundraiser money was deposited after the bank statement was printed, so the bank does not show it yet.',
            visual: <Table head={['', 'Balance']} rows={[['Ledger says the club has', usd(ledger)], ['Bank statement says', usd(s.bank)], ['Deposit made, not yet on the statement', usd(s.check)]]} />,
            prompt: 'After allowing for the late deposit, how much money is missing?',
            min: 0,
            max: 1000,
            step: 5,
            answer: s.gap,
            tol: 5,
            fmt: (v) => usd(v),
            why: `Once the deposit shows, the bank will hold ${usd(s.bank)} + ${usd(s.check)} = ${usd(s.bank + s.check)}. The ledger says ${usd(ledger)}, so ${usd(s.gap)} is unexplained. Timing differences like this explain some gaps; what is left needs answers.`,
          });
        },
      ],
      2: [
        () =>
          pick({
            brief: 'The adviser is busy and asks you to sign the end-of-year report saying the club’s books are correct. You have not checked them yet.',
            prompt: 'What do you do?',
            options: [
              { label: 'Say you will sign once you have matched the ledger to the bank and checked the receipts', credit: 1, why: 'Your signature says you checked. Signing without checking makes you responsible for anything wrong in the books.' },
              { label: 'Sign it. The adviser trusts the treasurer', credit: 0.1, why: 'Trust is not a check. If money is missing, your name is on the report.' },
              { label: 'Refuse to be involved at all', credit: 0.3, why: 'Safe for you, but the club still needs someone to check. Offer to do it properly.' },
            ],
          }),
      ],
      3: [
        () =>
          choose({
            brief: 'The club runs a big raffle next month. You set the rules for handling the money.',
            prompt: 'Which two rules protect the money best?',
            k: 2,
            options: [
              { label: 'Use numbered tickets, so the money collected must match the tickets sold', good: true, why: 'Numbered tickets turn "about $500" into an exact figure anyone can check.' },
              { label: 'Payments over $100 need two signatures', good: true, why: 'No single person can spend a large amount alone.' },
              { label: 'Let the most trusted member handle everything alone', good: false, why: 'Controls exist precisely so trust is not needed.' },
              { label: 'Keep the money in an envelope until the end of term', good: false, why: 'Cash should be deposited quickly, not stored.' },
              { label: 'Round all amounts to the nearest $10 to keep it simple', good: false, why: 'Rounding hides small differences that matter.' },
            ],
          }),
      ],
      4: [
        () =>
          pick({
            brief: 'A new member asks why the club keeps every receipt for years, even after the money is spent.',
            prompt: 'What is the best answer?',
            options: [
              { label: 'Receipts prove where every dollar went, so questions can be answered long after people have left', credit: 1, why: 'Records outlive memories. They protect the club and the people who handled the money.' },
              { label: 'There is no real reason; it is tradition', credit: 0, why: 'Without receipts, nobody can prove spending was honest.' },
              { label: 'Only for tax reasons', credit: 0.3, why: 'Tax is one reason, but records also catch mistakes and settle disputes.' },
            ],
          }),
      ],
    },
    takeaways: [
      'Every entry needs proof: receipts for spending, tallies for cash.',
      'Reconcile the books to the bank every month, allowing for checks not yet cashed.',
      'The person who handles money should not be the only one who checks it.',
      'Raise problems privately, with documents, and let people explain.',
    ],
  };
  return <CaseRunner def={def} seed={seed} onFinish={onFinish} addReview={addReview} />;
}
