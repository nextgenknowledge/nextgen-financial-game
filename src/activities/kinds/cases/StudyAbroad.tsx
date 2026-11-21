'use client';
/**
 * Study Abroad Wallet (Advanced, Currency Exchange). A semester in Lisbon on a budget set in
 * pounds. Every way of paying abroad has a price hidden in the exchange rate: airport kiosks,
 * "pay in pounds?" card machines, ATM fees and a falling pound.
 */
import type { KindProps } from '../../types';
import { Table } from '../pro/kit';
import { CaseRunner, Cards, Say, dial, flag, pick, type CaseDef } from './kit';

interface S {
  mid: number;
  kiosk: number;
}

const eur = (v: number) => `€${Math.round(v)}`;

export default function StudyAbroad({ seed, onFinish, addReview }: KindProps) {
  const def: CaseDef<S> = {
    kicker: 'Currency Exchange · Study abroad wallet',
    init: (rng) => {
      const mid = rng.pick([1.15, 1.17, 1.19]);
      return { mid, kiosk: Math.round((mid - rng.pick([0.13, 0.15, 0.17])) * 100) / 100 };
    },
    steps: [
      ({ s }) =>
        dial({
          brief: `You land in Lisbon for a semester. The real exchange rate today, the one banks use with each other, is £1 = €${s.mid.toFixed(2)}. The airport kiosk has a big sign: "0% COMMISSION!"`,
          visual: <Cards cards={[{ icon: '💱', title: 'Airport kiosk', tag: '0% commission', facts: [['We sell euros at', `£1 = €${s.kiosk.toFixed(2)}`], ['Fee', 'None!']] }, { icon: '🌍', title: 'Real rate', facts: [['Today', `£1 = €${s.mid.toFixed(2)}`]] }]} />,
          prompt: 'You change £300 at the kiosk. How many fewer euros do you get than at the real rate?',
          min: 0,
          max: 100,
          step: 1,
          answer: Math.round(300 * (s.mid - s.kiosk)),
          tol: 2,
          fmt: (v) => eur(v),
          why: `At the real rate £300 is ${eur(300 * s.mid)}; the kiosk gives ${eur(300 * s.kiosk)}. The ${eur(300 * (s.mid - s.kiosk))} gap, about ${Math.round((1 - s.kiosk / s.mid) * 100)}%, is the commission, hidden in the rate. "0% commission" only means the fee is not written as a fee.`,
        }),
      () =>
        pick({
          brief: 'At a café, you tap your UK card. The card machine asks a question.',
          visual: <Say who="Card machine">Pay £8.61 in GBP (rate includes 6% markup), or pay €9.50 in EUR?</Say>,
          prompt: 'Which do you choose?',
          options: [
            { label: 'Pay in euros, and let your own bank convert it', credit: 1, why: 'Paying in pounds lets the café’s payment company set the rate, and it is almost always worse. This is called dynamic currency conversion. Always pay in the local currency.' },
            { label: 'Pay in pounds so you know exactly what it costs', credit: 0.1, why: 'You know the price, and you pay up to 6% extra for knowing it. Your bank’s rate is nearly always better.' },
            { label: 'It makes no difference', credit: 0, why: 'It makes a 3% to 7% difference on every purchase, which adds up over a semester.' },
          ],
        }),
      () =>
        flag({
          brief: 'After your first month, you check your bank statement.',
          prompt: 'Flag the charges you could avoid next month.',
          doc: {
            title: 'Current Account',
            sub: 'Month 1 abroad',
            skin: 'statement',
            lines: [
              { id: 'rent', l: 'Rent: Casa Alfama (paid in euros)', r: '£512.00' },
              { id: 'ntf', l: 'Non-sterling transaction fee, 2.99%, on 42 card payments', r: '£11.80' },
              { id: 'atm', l: 'Cash machine fee, £1.50 each, 9 small withdrawals', r: '£13.50' },
              { id: 'dcc', l: 'Supermarket: paid in GBP at the till', r: '£46.20' },
              { id: 'phone', l: 'Phone contract (includes EU roaming)', r: '£18.00' },
              { id: 'trans', l: 'Monthly metro pass', r: '£34.10' },
            ],
          },
          issues: {
            ntf: 'A card with no foreign transaction fee, and many exist for students, removes this entirely.',
            atm: 'A fixed fee per withdrawal punishes small amounts. Fewer, larger withdrawals, or a fee-free card, cut this to almost nothing.',
            dcc: 'Paying in pounds at the till means a worse rate, probably £2 to £3 extra on this shop alone. Always choose euros.',
          },
          fine: {
            rent: 'A real cost of living there.',
            phone: 'A plan with roaming included is the cheap way to have data abroad.',
            trans: 'Monthly passes are usually the cheapest way to get around if you travel daily.',
          },
        }),
      () =>
        pick({
          brief: 'You need cash for a market that does not take cards. The ATM offers to convert it for you, with a guaranteed rate.',
          visual: <Table head={['ATM screen', '']} rows={[['Withdraw €100', ''], ['Convert to £93.50 now with our guaranteed rate', 'Accept'], ['Or continue without conversion', 'Decline']]} />,
          prompt: 'What do you press?',
          options: [
            { label: 'Decline the conversion and let your bank handle it', credit: 1, why: 'It is the same trick as the card machine. At the real rate €100 is about £85. "Guaranteed" just means guaranteed to be worse.' },
            { label: 'Accept. A guaranteed rate protects you', credit: 0, why: 'It protects the ATM operator’s profit. Your bank would charge you much less.' },
            { label: 'Withdraw €20 at a time to keep less cash on you', credit: 0.3, why: 'Safer to carry, but if your bank charges a fixed fee per withdrawal, many small withdrawals multiply it.' },
          ],
        }),
      () =>
        pick({
          brief: 'Halfway through the semester, the pound falls 6% against the euro. Your rent and food are in euros; your student loan arrives in pounds.',
          visual: <Table head={['', 'Before', 'After']} rows={[['£1 buys', '€1.17', '€1.10'], ['Monthly rent of €600 costs you', '£513', '£545']]} />,
          prompt: 'What could you have done at the start of the semester to protect yourself?',
          options: [
            { label: 'Converted the rent money for the whole semester up front, locking in the rate for the biggest fixed cost', credit: 1, why: 'Your largest bills were known and in euros. Converting that part early removes the currency risk on it. The pound could also have risen, but certainty matters more for rent.' },
            { label: 'Nothing. Exchange rates are pure luck', credit: 0.3, why: 'The movement is unpredictable, but you can choose how exposed you are to it.' },
            { label: 'Bet on the pound rising by keeping all money in pounds', credit: 0.1, why: 'That is a currency bet, taken without meaning to. Students should be paying rent, not speculating.' },
          ],
        }),
      () =>
        pick({
          brief: 'On a night out, your phone and wallet are stolen. Your only card was in the wallet.',
          prompt: 'What would have helped most?',
          options: [
            { label: 'A second card from a different bank, kept somewhere else, and an app that can freeze cards instantly', credit: 1, why: 'Freezing stops thieves within minutes. A backup card means you can still pay rent and eat while a replacement is posted abroad, which can take weeks.' },
            { label: 'Carrying more cash instead of cards', credit: 0.1, why: 'Stolen cash is gone for good, while card fraud is usually refunded.' },
            { label: 'Writing the PIN on the card so friends could help', credit: 0, why: 'A written PIN means the bank may refuse to refund fraud. Never write it down.' },
          ],
        }),
    ],
    alts: {
      0: [
        ({ s }) => {
          const fee = Math.round((900 / s.mid) * 0.0299 * 4);
          return dial({
            brief: `You will spend about €900 a month for a four-month semester in Lisbon. The real exchange rate is £1 = €${s.mid.toFixed(2)}. Your bank charges a 2.99% fee on every card payment in a foreign currency.`,
            visual: <Table head={['Your card', '']} rows={[['Monthly spending', '€900'], ['Exchange rate', `£1 = €${s.mid.toFixed(2)}`], ['Foreign transaction fee', '2.99%'], ['Months', '4']]} />,
            prompt: 'How much will that fee cost you over the semester, in pounds?',
            min: 0,
            max: 200,
            step: 1,
            answer: fee,
            tol: 3,
            fmt: (v) => `£${v}`,
            why: `€900 ÷ ${s.mid.toFixed(2)} is about £${Math.round(900 / s.mid)} a month. 2.99% of that is about £${((900 / s.mid) * 0.0299).toFixed(2)}, and over four months about £${fee}. A card with no foreign fee saves all of it.`,
          });
        },
      ],
      1: [
        () =>
          pick({
            brief: 'You book a train to Porto on the operator’s website using your UK card. Checkout offers a choice.',
            visual: <Say who="Checkout">Pay €29.00, or pay £26.40 in your home currency (conversion by our partner)?</Say>,
            prompt: 'Which do you choose?',
            options: [
              { label: 'Pay €29.00 and let your bank convert it', credit: 1, why: 'At a real rate of about €1.17, €29 is about £24.80. The "home currency" option adds £1.60, roughly 6%.' },
              { label: 'Pay £26.40 so you know the exact cost', credit: 0.1, why: 'Certainty costs about 6% here. Your own bank’s rate is almost always better.' },
              { label: 'It makes no difference online', credit: 0, why: 'The same conversion trick works online as at card machines.' },
            ],
          }),
      ],
      2: [
        () =>
          flag({
            brief: 'Month two abroad. You check your bank statement.',
            prompt: 'Flag the charges you could avoid next month.',
            doc: {
              title: 'Current Account',
              sub: 'Month 2 abroad',
              skin: 'statement',
              lines: [
                { id: 'rent', l: 'Rent: Casa Alfama (paid in euros)', r: '£512.00' },
                { id: 'tour', l: 'Tourist-area cash machine operator fee, €3.95 × 4', r: '£13.50' },
                { id: 'roam', l: 'Roaming day passes, £2.50 × 12 days', r: '£30.00' },
                { id: 'kiosk', l: 'Currency kiosk in town, poor rate on £200', r: '£24.00' },
                { id: 'books', l: 'Course books', r: '£41.00' },
                { id: 'gym', l: 'University gym, term pass', r: '£22.00' },
              ],
            },
            issues: {
              tour: 'Standalone cash machines in tourist areas charge their own fee. Bank-owned machines usually do not.',
              roam: 'A plan with EU roaming included, or a local SIM, is far cheaper than day passes.',
              kiosk: 'Kiosks hide a fee in the rate. A fee-free card at a bank machine gives close to the real rate.',
            },
            fine: {
              rent: 'A real cost of living there.',
              books: 'A real cost of the course.',
              gym: 'A term pass is usually the cheapest way to use it regularly.',
            },
          }),
      ],
      3: [
        () =>
          pick({
            brief: 'Your parents want to send you £500 for the rest of the semester.',
            visual: <Table head={['Option', 'Fee', 'Exchange rate']} rows={[['Their high-street bank', '£25', '4% worse than the real rate'], ['A money transfer service', '£3', 'Real rate'], ['Cash in a card posted abroad', 'Postage', 'Kiosk rate when you change it']]} />,
            prompt: 'Which is cheapest?',
            ordered: true,
            options: [
              { label: 'Their high-street bank', credit: 0.2, why: '£25 plus about £20 lost in the rate. Close to 9% of the money gone.' },
              { label: 'A money transfer service', credit: 1, why: '£3 and the real rate means almost all £500 arrives. Always compare the rate as well as the fee.' },
              { label: 'Cash in a card', credit: 0, why: 'Risky to post, and changing it at a kiosk loses several percent.' },
            ],
          }),
      ],
      4: [
        () =>
          pick({
            brief: 'At the start of the semester you converted your rent money into euros all at once. Two months later the pound rises 5%. Had you waited, the rent would have cost you less.',
            prompt: 'Was converting early a mistake?',
            options: [
              { label: 'No. It removed the risk on your biggest fixed bill. The pound could just as easily have fallen', credit: 1, why: 'Locking in is about certainty, not about guessing right. You knew exactly what rent would cost, whatever happened.' },
              { label: 'Yes. You should always wait for a better rate', credit: 0.1, why: 'Nobody can predict exchange rates. Waiting is a bet that can go either way.' },
              { label: 'Yes. Next time keep everything in pounds', credit: 0.2, why: 'That would leave your rent exposed to every swing in the rate.' },
            ],
          }),
      ],
      5: [
        () =>
          pick({
            brief: 'On your first day abroad, your card is declined at the supermarket. Your bank has blocked it because of a sudden payment from another country.',
            prompt: 'What would have prevented this?',
            options: [
              { label: 'Checking your banking app’s travel settings before leaving, and bringing a second card from a different bank', credit: 1, why: 'Banks block unusual activity to stop fraud. Telling them you are travelling, where they ask, and carrying a backup card avoids being stuck.' },
              { label: 'Only using cash abroad', credit: 0.1, why: 'Cash can be lost or stolen and is never refunded.' },
              { label: 'Nothing. Blocks are random', credit: 0, why: 'They follow fraud rules, which a little preparation can avoid triggering.' },
            ],
          }),
      ],
    },
    takeaways: [
      '"0% commission" means the fee is hidden in the exchange rate. Compare with the real rate.',
      'When a card machine or ATM offers to convert to pounds, decline. Pay in the local currency.',
      'Fixed fees punish small transactions. A card with no foreign fee is worth getting before you travel.',
      'If your costs are in one currency and your income in another, lock in the big fixed costs.',
    ],
  };
  return <CaseRunner def={def} seed={seed} onFinish={onFinish} addReview={addReview} />;
}
