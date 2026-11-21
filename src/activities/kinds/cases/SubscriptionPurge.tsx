'use client';
/**
 * Subscription Purge (Advanced, Corner Shop). A bank statement full of small monthly charges.
 * Find the ones that are not earning their keep, add up what they really cost in a year, and get
 * past the cancel page that is designed to stop you.
 */
import type { KindProps } from '../../types';
import { Table } from '../pro/kit';
import { CaseRunner, Cards, Feed, dial, flag, pick, type CaseDef } from './kit';

const gbp = (v: number) => `£${v.toFixed(2)}`;

type S = Record<string, never>;

const SUBS: { id: string; name: string; note: string; cost: number; cut: string | null; keep?: string }[] = [
  { id: 'flix', name: 'StreamFlix', note: 'watched 14 times this month', cost: 10.99, cut: null, keep: 'Used constantly. This is what a subscription should look like.' },
  { id: 'showbox', name: 'ShowBox', note: 'last watched 4 months ago', cost: 8.99, cut: 'Four months unused is £36 for nothing. Cancel; you can rejoin for one show if it comes back.' },
  { id: 'tune', name: 'TuneWave Music', note: 'used every day', cost: 11.99, cut: null, keep: 'Daily use for about 40p a day is good value.' },
  { id: 'spire', name: 'SoundSpire Music', note: 'signed up for one album in May', cost: 10.99, cut: 'A second music service doing the same job. Duplicates are the easiest money to find.' },
  { id: 'fit', name: 'FitPro app', note: 'opened twice since January', cost: 14.99, cut: 'Paying for the person you plan to be. Cancel it, and rejoin when the habit is real.' },
  { id: 'cloud', name: 'CloudBox 2TB', note: 'using 40GB; the free plan includes 50GB', cost: 7.99, cut: 'Your files fit in the free plan. Downgrade and lose nothing.' },
  { id: 'phone', name: 'Mobile contract', note: '18 months left on contract', cost: 18.0, cut: null, keep: 'A phone is a need, and leaving a contract early usually costs the remaining months.' },
  { id: 'games', name: 'GameHub Plus', note: 'needed for online play; you play weekly', cost: 6.99, cut: null, keep: 'Used weekly and required for what you do. Keep it.' },
  { id: 'photo', name: 'PhotoPro editor', note: 'free trial ended in March; never opened', cost: 4.99, cut: 'A free trial that quietly turned into a payment. The most common leak of all.' },
  { id: 'news', name: 'Daily Ledger news', note: '£1 intro offer ended; you read it once a month', cost: 9.99, cut: 'The £1 deal became £9.99 without you noticing. Once a month does not justify that.' },
  { id: 'deliv', name: 'SpeedyEats Pass', note: 'saves the £2.99 fee; 1 order in 3 months', cost: 7.99, cut: 'It saves £2.99 an order. At one order every three months, you pay £24 to save £3.' },
];

export default function SubscriptionPurge({ seed, onFinish, addReview }: KindProps) {
  const cuts = SUBS.filter((x) => x.cut);
  const monthly = cuts.reduce((a, x) => a + x.cost, 0);
  const def: CaseDef<S> = {
    kicker: 'Corner Shop · Subscription purge',
    init: () => ({}),
    steps: [
      () =>
        flag({
          brief: 'Your first year working. Money disappears and you cannot see where. The statement says it all: small monthly payments, eleven of them. Next to each, you have noted how much you use it.',
          prompt: 'Flag every subscription you should cancel or downgrade.',
          doc: {
            title: 'Current Account',
            sub: 'Card payments, June',
            skin: 'statement',
            lines: [{ id: 'h', head: true, l: 'Recurring payments', r: 'Amount' }, ...SUBS.map((x) => ({ id: x.id, l: `${x.name} · ${x.note}`, r: gbp(x.cost) }))],
            foot: 'Total recurring: ' + gbp(SUBS.reduce((a, x) => a + x.cost, 0)) + ' a month',
          },
          issues: Object.fromEntries(cuts.map((x) => [x.id, x.cut!])),
          fine: Object.fromEntries(SUBS.filter((x) => !x.cut).map((x) => [x.id, x.keep!])),
        }),
      () =>
        dial({
          brief: 'Your own statement has seven subscriptions that are not earning their keep. You decide to cut all seven.',
          visual: <Table head={['Cancel', 'Per month']} rows={cuts.map((x) => [x.name, gbp(x.cost)])} compact />,
          prompt: 'How much does that save in a year?',
          min: 0,
          max: 1200,
          step: 5,
          answer: Math.round(monthly * 12),
          tol: 15,
          fmt: (v) => `£${v}`,
          why: `${gbp(monthly)} a month × 12 = £${Math.round(monthly * 12)} a year. That is a holiday, or the start of an emergency fund, recovered without giving up a single thing you use.`,
        }),
      () =>
        pick({
          brief: 'You try to cancel FitPro. It takes four screens.',
          visual: (
            <Feed
              title="FitPro cancel page"
              posts={[
                { who: 'FitPro', text: 'Are you SURE? You will lose your 23-day streak and all your progress.', tone: 'warn' },
                { who: 'FitPro', text: 'Wait! Stay for 50% off for the next 3 months.', tone: 'ad' },
                { who: 'FitPro', text: '[ Keep my benefits ]   (small grey link: continue cancelling)' },
              ]}
            />
          ),
          prompt: 'What is going on, and what do you do?',
          options: [
            { label: 'The page is designed to make leaving hard. Ignore the guilt and the offer, and finish cancelling', credit: 1, why: 'Guilt messages, last-minute discounts and hidden links are deliberate. Half price for something you do not use is still money for nothing.' },
            { label: 'Take the 50% off. It is a good deal', credit: 0.2, why: 'Half of £14.99 for an app you opened twice is still £22 for nothing, and the price goes back up after three months.' },
            { label: 'Delete the app; that cancels it', credit: 0, why: 'Deleting an app does not cancel a subscription. Payments continue until you cancel in the account or app store settings.' },
          ],
        }),
      () =>
        pick({
          brief: 'StreamFlix offers an annual plan: £99 a year instead of £10.99 a month.',
          visual: <Cards cards={[{ icon: '📅', title: 'Monthly', facts: [['Cost for a year', '£131.88'], ['Cancel', 'Any month']] }, { icon: '🗓️', title: 'Annual', tag: 'Save 25%', facts: [['Cost for a year', '£99'], ['Cancel', 'No refund for unused months']] }]} />,
          prompt: 'When is the annual plan the right call?',
          options: [
            { label: 'Only if you have used it steadily for a year already and expect to keep doing so', credit: 1, why: 'The annual plan saves £32.88 if you use it all year. Cancel after eight months and you have paid more than monthly would have cost.' },
            { label: 'Always. It is 25% cheaper', credit: 0.3, why: 'Cheaper per month, but only if you stay all twelve months. You give up the right to leave.' },
            { label: 'Never. Annual plans are a trap', credit: 0.4, why: 'Too strong. For a service you clearly use, it is a real saving.' },
          ],
        }),
      () =>
        pick({
          brief: 'A new email arrives.',
          visual: <Cards cards={[{ icon: '✉️', title: 'TuneWave', sub: 'Changes to your plan', facts: [['Current price', '£11.99'], ['From next month', '£12.99'], ['To keep your plan', 'No action needed']] }]} />,
          prompt: 'What is the smartest response?',
          options: [
            { label: 'Decide whether it is still worth £12.99, and compare the student or family plans before it renews', credit: 1, why: '"No action needed" is designed to make you take none. A price change is the perfect moment to check cheaper plans, such as sharing a family plan.' },
            { label: 'Nothing. It is only £1', credit: 0.4, why: 'It is £12 a year, and the price rises keep coming. Fine to keep it, but decide on purpose.' },
            { label: 'Cancel immediately on principle', credit: 0.3, why: 'You use it every day, so it may still be worth it. Compare first.' },
          ],
        }),
    ],
    alts: {
      0: [
        () =>
          flag({
            brief: 'Your cousin asks for help: "I earn enough, so why am I always broke?" Their statement shows eight monthly payments, with a note on how much each is used.',
            prompt: 'Flag every subscription they should cancel or downgrade.',
            doc: {
              title: 'Current Account',
              sub: 'Card payments, September',
              skin: 'statement',
              lines: [
                { id: 'h', head: true, l: 'Recurring payments', r: 'Amount' },
                { id: 'gym', l: 'PeakGym · went 3 times since joining in March', r: gbp(29.99) },
                { id: 'mus', l: 'TuneWave Music · used every day', r: gbp(11.99) },
                { id: 'box', l: 'SnackCrate box · boxes pile up unopened', r: gbp(19.99) },
                { id: 'tv1', l: 'StreamFlix · watched most nights', r: gbp(10.99) },
                { id: 'tv2', l: 'KidsFlix · signed up for a younger cousin’s visit', r: gbp(5.99) },
                { id: 'lang', l: 'LinguaLeap Premium · free version covers what is used', r: gbp(7.49) },
                { id: 'ins', l: 'Phone insurance · phone is 5 years old, worth about £60', r: gbp(9.99) },
                { id: 'bus', l: 'Monthly bus pass · used every weekday', r: gbp(48.0) },
              ],
              foot: 'Total recurring: £144.43 a month',
            },
            issues: {
              gym: 'Three visits in six months is about £60 a visit. A pay-as-you-go pass would cost far less.',
              box: 'Unopened boxes are money spent on clutter.',
              tv2: 'A one-off visit turned into a monthly bill.',
              lang: 'The free version does the job. Downgrade.',
              ins: '£120 a year to insure a £60 phone costs more than replacing it.',
            },
            fine: {
              mus: 'Daily use at about 40p a day.',
              tv1: 'Used most nights. Good value.',
              bus: 'Essential travel, cheaper than single fares.',
            },
          }),
      ],
      1: [
        () =>
          dial({
            brief: 'FitPro costs £14.99 a month. Over the past year you opened it for a workout twice.',
            prompt: 'What did each workout really cost you?',
            min: 0,
            max: 150,
            step: 1,
            answer: 90,
            tol: 2,
            fmt: (v) => `£${v}`,
            why: '£14.99 × 12 = £179.88 for the year, divided by 2 workouts is about £90 each. Cost per use is the quickest test of whether a subscription earns its keep.',
          }),
      ],
      2: [
        () =>
          pick({
            brief: 'You signed up for PeakGym online in two minutes. To cancel, the contract says you must visit in person or send a signed letter, with 30 days’ notice.',
            prompt: 'What is the best move?',
            options: [
              { label: 'Send the letter today by a tracked method, keep a copy, and check your statement until the payments stop', credit: 1, why: 'Hard cancellation is designed to delay you. Every week you wait is another payment. Proof of sending protects you if they claim it never arrived.' },
              { label: 'Cancel the payment at your bank and ignore the gym', credit: 0.3, why: 'Stopping payment does not end the contract. The gym may chase the debt or pass it to collectors.' },
              { label: 'Wait until you are passing the gym one day', credit: 0.1, why: 'Weeks of payments while you wait. Act now.' },
            ],
          }),
      ],
      3: [
        () =>
          pick({
            brief: 'TuneWave has a family plan: £17.99 a month for up to six people in the same household. You and two housemates each pay £11.99 for single plans.',
            visual: <Cards cards={[{ icon: '🎵', title: 'Three single plans', facts: [['Cost each', '£11.99 a month'], ['Total', '£35.97 a month']] }, { icon: '🏠', title: 'One family plan', facts: [['Total', '£17.99 a month'], ['Split three ways', '£6.00 each']] }]} />,
            prompt: 'What is the smartest move?',
            options: [
              { label: 'Switch to the family plan, agree who holds it, and set up a regular transfer for each share', credit: 1, why: 'You live together, so it fits the rules, and each of you saves about £72 a year. A standing transfer avoids awkward reminders.' },
              { label: 'Keep three separate plans to avoid any hassle', credit: 0.3, why: 'Simple, but about £216 a year more between you for the same music.' },
              { label: 'Share one single login between all three', credit: 0, why: 'It breaks the terms, and only one person can listen at a time.' },
            ],
          }),
      ],
      4: [
        () =>
          pick({
            brief: 'A photo-editing app offers "7 days free". You must enter a card to start the trial.',
            prompt: 'What is the smartest way to try it?',
            options: [
              { label: 'Set a reminder for day 6 to decide, and cancel then if you are not using it', credit: 1, why: 'Trials turn into payments automatically. A reminder makes it a decision, not an accident. Many apps let you cancel straight away and keep the trial anyway.' },
              { label: 'Start the trial and trust yourself to remember', credit: 0.2, why: 'Forgotten trials are the most common subscription leak.' },
              { label: 'Never try anything that asks for a card', credit: 0.5, why: 'Safe, but a well-managed trial is a good way to test before you buy.' },
            ],
          }),
      ],
    },
    takeaways: [
      'Check your statement every few months for recurring payments. Small ones add up to hundreds a year.',
      'Free trials and intro prices turn into full payments automatically. Note the date when you sign up.',
      'Cancel pages are built to stop you. Guilt and last-minute discounts are part of the design.',
      'Annual plans only save money if you stay all year.',
    ],
  };
  return <CaseRunner def={def} seed={seed} onFinish={onFinish} addReview={addReview} />;
}
