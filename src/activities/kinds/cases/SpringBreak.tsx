'use client';
/**
 * Spring Break on $600 (Advanced, Map & Travel). Four friends, four nights at the coast, and a
 * fixed budget. Every price in travel has a second price behind it, and each choice here comes
 * out of the same $600.
 */
import type { KindProps } from '../../types';
import { Table, usd } from '../pro/kit';
import { CaseRunner, Cards, Feed, dial, pick, type CaseDef } from './kit';

interface S {
  left: number;
  carry: number;
  debt: boolean;
}

const spend = (n: number) => (s: S) => void (s.left -= n);

export default function SpringBreak({ seed, onFinish, addReview }: KindProps) {
  const def: CaseDef<S> = {
    kicker: 'Map & Travel · Spring break on $600',
    init: (rng) => ({ left: 600, carry: rng.pick([40, 45, 50]), debt: false }),
    meters: (s) => [['Budget', '$600'], ['Left', usd(s.left), s.left < 0 ? 'bad' : s.left > 150 ? 'good' : undefined]],
    steps: [
      ({ s }) =>
        dial({
          brief: 'ZipJet advertises a $89 round trip to the coast. You are bringing one carry-on bag, and you do not care where you sit.',
          visual: <Table head={['ZipJet fare rules', '']} rows={[['Round-trip fare', '$89'], ['Personal item (fits under the seat)', 'Free'], ['Carry-on bag', `${usd(s.carry)} each way`], ['Choose your seat', '$15 each way'], ['Printed boarding pass at the airport', '$10']]} />,
          prompt: 'What will ZipJet really cost you?',
          min: 50,
          max: 300,
          step: 1,
          answer: 89 + s.carry * 2,
          tol: 2,
          fmt: (v) => usd(v),
          why: `$89 plus ${usd(s.carry)} each way for the bag is ${usd(89 + s.carry * 2)}. Seat selection and a printed pass are avoidable: take the seat you are given and use the app. The headline fare is the price of a seat with nothing else.`,
        }),
      ({ s }) => {
        const zip = 89 + s.carry * 2;
        return pick({
          brief: 'Now compare the real prices of getting there.',
          visual: (
            <Cards
              cards={[
                { icon: '✈️', title: 'ZipJet', sub: '2 hours', facts: [['Real cost', usd(zip)], ['Changes', 'Not allowed'], ['Flight times', '5:40 am out, 11 pm back']] },
                { icon: '🛩️', title: 'Atlas Air', sub: '2 hours', facts: [['Real cost', '$198'], ['Changes', 'Free'], ['Flight times', 'Midday both ways']] },
                { icon: '🚌', title: 'Coast Coach', sub: '9 hours each way', facts: [['Real cost', '$72'], ['Changes', '$10'], ['Times', 'Overnight both ways']] },
              ]}
            />
          ),
          prompt: 'How do you travel?',
          ordered: true,
          options: [
            { label: 'ZipJet', credit: 0.8, why: `${usd(zip)} with awkward hours and no changes. Fine if the plan is firm; you now know its real price.`, apply: spend(zip) },
            { label: 'Atlas Air', credit: 0.5, why: 'Easy and flexible, but $198 is a third of the whole budget before you have a bed.', apply: spend(198) },
            { label: 'Coast Coach', credit: 1, why: 'Overnight buses cost you sleep, not beach days, and save over $100 compared with flying. On a $600 trip that is two days of food.', apply: spend(72) },
          ],
        });
      },
      () =>
        pick({
          brief: 'Four nights for the four of you. Each listing shows a nightly price; the totals are another story.',
          visual: (
            <Table
              head={['Place', 'Advertised', 'Then add', 'Your share, all in']}
              rows={[
                ['Seabreeze Hotel, one room', '$140 a night', '$32 a night resort fee, 13% tax', '?'],
                ['Beach house rental, with kitchen', '$130 a night', '$120 cleaning, $78 service fee', '?'],
                ['Tide Hostel, four dorm beds', '$38 a bed a night', 'Nothing', '?'],
              ]}
            />
          ),
          prompt: 'Where do you stay?',
          ordered: true,
          options: [
            { label: 'Seabreeze Hotel', credit: 0.3, why: '($140 + $32) × 1.13 × 4 nights is about $777, or $194 each. The resort fee alone adds 23% to the advertised price.', apply: spend(194) },
            { label: 'Beach house rental', credit: 1, why: '$520 + $120 + $78 is $718, or about $180 each. It is $28 more than the hostel, but the kitchen can save far more than that on food.', apply: spend(180) },
            { label: 'Tide Hostel', credit: 0.9, why: '$38 × 4 nights is $152 each, the cheapest bed and the only honest price on the list. No kitchen means paying for every meal.', apply: spend(152) },
          ],
        }),
      () =>
        pick({
          brief: 'You are about to pay for the stay. One of the four is not sure they can get the time off work.',
          visual: <Cards cards={[{ icon: '🔒', title: 'Non-refundable rate', facts: [['Price', 'As quoted'], ['If plans change', 'You lose it all']] }, { icon: '🔓', title: 'Free cancellation', sub: 'Until 3 days before', facts: [['Price', '$15 more each'], ['If plans change', 'Full refund']] }]} />,
          prompt: 'Which rate do you book?',
          options: [
            { label: 'Free cancellation, for $15 more', credit: 1, why: 'If the fourth friend drops out, three people cover four shares or lose everything. $15 is cheap insurance against a risk you can already see.', apply: spend(15) },
            { label: 'Non-refundable. $15 is $15', credit: 0.3, why: 'It is the right call when plans are certain. Here one person has already told you they might not come.' },
            { label: 'Non-refundable, and make the unsure friend promise to pay regardless', credit: 0.4, why: 'Fair in theory. In practice, collecting from a friend who did not get a holiday is how trips end friendships.' },
            { label: 'Wait until everyone is sure, then book', credit: 0.5, why: 'Sensible, but prices for spring break week climb as it gets closer. The refundable rate locks the price and keeps the exit.' },
          ],
        }),
      ({ s }) =>
        pick({
          brief: `You arrive with ${usd(s.left)} left for four days. The group wants to rent a car. You are all 19.`,
          visual: <Table head={['Getting around, 3 days', 'Total', 'Each']} rows={[['Rental car: $45 a day + $30 a day under-25 fee + $18 a day insurance', '$279', '$70'], ['Rideshares, estimated', '$160', '$40'], ['Beach trolley pass', '$48', '$12']]} />,
          prompt: 'How do you get around?',
          ordered: true,
          options: [
            { label: 'Rental car', credit: 0.2, why: 'The $45 a day became $93 a day once the under-25 fee and insurance were added, before fuel and parking.', apply: spend(70) },
            { label: 'Rideshares', credit: 0.6, why: 'Flexible, but the estimate assumes no surge pricing. Late nights at the beach are when prices double.', apply: spend(40) },
            { label: 'Trolley pass', credit: 1, why: '$12 for three days. It runs where tourists go, and the $58 saved against the car is a day of meals.', apply: spend(12) },
          ],
        }),
      ({ s }) => {
        const perDay = Math.floor((s.left - 40) / 4);
        return pick({
          brief: `${usd(s.left)} left, four days to go. You want to keep $40 back for the trip home.`,
          visual: <Feed title="Group chat" posts={[{ who: 'Jules', text: 'Sunset dinner at The Pier tonight?? It is like $55 each but the view!!' }, { who: 'Sam', text: 'There is a taco truck on the beach, $9 a plate' }]} />,
          prompt: 'What is your plan for food and fun?',
          options: [
            { label: `Set a daily number, about ${usd(Math.max(0, perDay))} a day, and choose one splurge inside it`, credit: 1, why: 'A daily number turns a vague budget into a decision you can make at each meal. One planned splurge is more fun than four days of worrying.', apply: (st) => void (st.left -= Math.min(Math.max(0, st.left - 40), Math.max(0, perDay) * 4)) },
            { label: 'Say yes to The Pier tonight and work the rest out later', credit: 0.2, why: 'The first night is when spending feels free. It is also when most trip budgets break.', apply: (st) => void ((st.left -= 55 + 200), (st.debt = st.left < 0)) },
            { label: 'Eat as cheaply as possible every meal and skip everything else', credit: 0.5, why: 'It protects the budget, but the money was saved to be enjoyed. Under-spending a trip budget is also missing the target.', apply: spend(110) },
            { label: 'Put it on a credit card and deal with it at home', credit: 0, why: 'A holiday bought at 24% interest is still being paid for long after the tan fades.', apply: (st) => void ((st.left -= 420), (st.debt = true)) },
          ],
        });
      },
      ({ s }) =>
        pick({
          brief: s.left < 0 ? `You are home, and ${usd(-s.left)} of the trip is sitting on a credit card at 24% a year.` : 'On the last night a friend who overspent asks to put $300 of the trip on your credit card, to be paid back "soon". Your card charges 24% a year.',
          visual: <Table head={['Paying off $300 at 24%', 'Time', 'Interest']} rows={[['$25 a month', '14 months', '$46'], ['$50 a month', '7 months', '$23'], ['In full when the statement arrives', '0 months', '$0']]} />,
          prompt: s.left < 0 ? 'How do you clear it?' : 'What do you say?',
          options:
            s.left < 0
              ? [
                  { label: 'Pay it in full from savings when the statement arrives', credit: 1, why: 'No interest is charged on purchases paid in full by the due date. The lesson costs nothing extra.' },
                  { label: 'Pay $50 a month', credit: 0.6, why: 'It clears in about seven months. Not a disaster, but every dollar of interest is a price paid for not planning.' },
                  { label: 'Pay the $25 minimum', credit: 0.1, why: 'More than a year of payments for four nights away, and the card is unavailable for a real emergency.' },
                  { label: 'Wait until summer job money comes in', credit: 0, why: 'Missing payments adds late fees and a mark on your credit report on top of the interest.' },
                ]
              : [
                  { label: 'No to the card, but offer to lend a smaller amount of cash you can afford to lose', credit: 1, why: 'The debt would be in your name, with your credit at risk and interest running. Lending only what you could afford never to see again keeps the friendship and your score.' },
                  { label: 'Yes. Friends help each other', credit: 0.1, why: 'If they pay late, you pay the interest and take the damage to your credit. The card company has no agreement with your friend.' },
                  { label: 'Yes, and charge them the interest', credit: 0.3, why: 'Fairer, but you still carry all the risk, and you have become a lender to a friend who is already overspending.' },
                  { label: 'No, and say nothing more', credit: 0.6, why: 'It protects you. A small cash loan or helping them find a cheaper way home would protect the friendship as well.' },
                ],
        }),
    ],
    alts: {
      0: [
        () =>
          dial({
            brief: 'Your friend Riley offers to drive the four of you to the coast instead of flying.',
            visual: <Table head={['Road trip', '']} rows={[['Distance', '375 miles each way'], ['Car', '30 miles per gallon'], ['Gas', '$3.60 a gallon'], ['Tolls', '$12 each way'], ['Split', 'Four ways']]} />,
            prompt: 'What is your share of the drive, there and back?',
            min: 0,
            max: 150,
            step: 1,
            answer: 29,
            tol: 2,
            fmt: (v) => usd(v),
            why: '750 miles ÷ 30 = 25 gallons × $3.60 = $90, plus $24 in tolls is $114. Split four ways that is about $29 each. Shared driving is cheap, as long as everyone agrees the split before you leave.',
          }),
      ],
      1: [
        () =>
          pick({
            brief: 'Four ways to get to the coast. Each price below is the real one, with fees included.',
            visual: (
              <Cards
                cards={[
                  { icon: '🚗', title: 'Riley’s car', sub: '6 hours', facts: [['Your share', '$29'], ['Risk', 'One driver, an old car'], ['Times', 'Whenever you like']] },
                  { icon: '🚆', title: 'Shoreline Rail', sub: '5 hours', facts: [['Real cost', '$110'], ['Changes', '$20'], ['Times', 'Morning both ways']] },
                  { icon: '✈️', title: 'Atlas Air', sub: '2 hours', facts: [['Real cost', '$198'], ['Changes', 'Free'], ['Times', 'Midday both ways']] },
                ]}
              />
            ),
            prompt: 'How do you travel?',
            ordered: true,
            options: [
              { label: 'Riley’s car, sharing the driving', credit: 1, why: 'By far the cheapest. Sharing the driving and agreeing the split upfront manage the main risks.', apply: spend(29) },
              { label: 'Shoreline Rail', credit: 0.7, why: 'Comfortable and reliable, at nearly four times the cost of the car.', apply: spend(110) },
              { label: 'Atlas Air', credit: 0.4, why: 'Fast, but $198 is a third of the budget before you have a bed.', apply: spend(198) },
            ],
          }),
      ],
      2: [
        () =>
          pick({
            brief: 'Four nights for the four of you. Here are the totals once the fees are added.',
            visual: (
              <Table
                head={['Place', 'Advertised', 'Then add', 'Your share, all in']}
                rows={[
                  ['Pine Cove Motel, two rooms', '$95 a room a night', '12% tax', '?'],
                  ['Condo with kitchen', '$110 a night', '$90 cleaning, $60 service fee', '?'],
                  ['Dune Campground', '$45 a site a night', '$20 tent rental', '?'],
                ]}
              />
            ),
            prompt: 'Where do you stay?',
            ordered: true,
            options: [
              { label: 'Pine Cove Motel', credit: 0.3, why: '$95 × 2 rooms × 4 nights × 1.12 is about $851, or $213 each. Two rooms doubled the price.', apply: spend(213) },
              { label: 'Condo with kitchen', credit: 1, why: '$440 + $90 + $60 is $590, or about $148 each, and the kitchen cuts the food bill.', apply: spend(148) },
              { label: 'Dune Campground', credit: 0.8, why: '$180 + $20 is $200, or $50 each. Cheapest by far, as long as the weather holds.', apply: spend(50) },
            ],
          }),
      ],
      3: [
        () =>
          pick({
            brief: 'The booking site flashes: "Only 1 left at this price! 14 people are looking right now." A timer counts down from 10 minutes.',
            prompt: 'What do you do?',
            options: [
              { label: 'Ignore the timer, check the same place on one other site and read the cancellation terms, then book', credit: 1, why: 'Countdowns and "people looking" messages are designed to rush you. Five minutes of checking often finds the same room cheaper or with better terms.' },
              { label: 'Book immediately before it is gone', credit: 0.3, why: 'Sometimes the warning is true. Often it is a sales tactic, and rushing means skipping the fees and cancellation rules.' },
              { label: 'Wait a few days to see if the price drops', credit: 0.4, why: 'For a busy week, prices usually rise. Checking now is better than waiting.' },
            ],
          }),
      ],
      4: [
        ({ s }) =>
          pick({
            brief: `You arrive with ${usd(s.left)} left for four days. Everything you want to see is within 3 miles.`,
            visual: <Table head={['Getting around, 3 days', 'Each']} rows={[['Bike rental, $15 a day', '$45'], ['E-scooter app, about 40 minutes a day at $0.45 a minute', '$54'], ['Walking and one taxi home late at night', '$8']]} />,
            prompt: 'How do you get around?',
            ordered: true,
            options: [
              { label: 'Rent bikes', credit: 0.6, why: 'Fun, but $45 for distances you could mostly walk.', apply: spend(45) },
              { label: 'E-scooter app', credit: 0.3, why: 'Per-minute pricing adds up quietly. Small charges are easy to ignore and hard to total.', apply: spend(54) },
              { label: 'Walk, and share a taxi for the late night', credit: 1, why: 'Everything is close. Paying only for the one trip that needs it is the cheapest safe plan.', apply: spend(8) },
            ],
          }),
      ],
      5: [
        ({ s }) => {
          const perDay = Math.floor((s.left - 40) / 4);
          return pick({
            brief: `${usd(s.left)} left, four days to go. You want to keep $40 back for the trip home.`,
            visual: <Feed title="Group chat" posts={[{ who: 'Theo', text: 'Grocery run? We could do breakfast and lunch for like $8 a day each' }, { who: 'Jules', text: 'Or we just eat out every meal, it is a holiday!' }]} />,
            prompt: 'What is your plan for food?',
            options: [
              { label: `Groceries for breakfast and lunch, eat out for dinner, staying within about ${usd(Math.max(0, perDay))} a day`, credit: 1, why: 'Cheap meals in the day pay for good dinners. A daily number keeps the whole plan honest.', apply: (st) => void (st.left -= Math.min(Math.max(0, st.left - 40), Math.max(0, perDay) * 4)) },
              { label: 'Eat out every meal', credit: 0.2, why: 'Three restaurant meals a day can be $60 or more. Four days of it can sink the whole trip.', apply: (st) => void ((st.left -= 240), (st.debt = st.left < 0)) },
              { label: 'Live on instant noodles to save every dollar', credit: 0.5, why: 'Safe for the budget, but the money was saved to enjoy the trip.', apply: spend(60) },
              { label: 'Eat out and use buy now, pay later for the bills', credit: 0, why: 'Splitting meals into payments turns a holiday into months of bills.', apply: (st) => void ((st.left -= 300), (st.debt = true)) },
            ],
          });
        },
      ],
      6: [
        () =>
          pick({
            brief: 'A week after the trip, Jules sends you a payment request for $64 for "gas and snacks". You never agreed to split snacks, and you think you already paid for gas.',
            prompt: 'What is the best way to handle it?',
            options: [
              { label: 'Ask to go through the receipts together, and next trip track shared costs in a split app as you go', credit: 1, why: 'Shared costs cause the most arguments when nobody wrote them down. A running list during the trip settles it before it gets awkward.' },
              { label: 'Pay it to avoid an argument', credit: 0.3, why: 'Peaceful, but you may be paying twice, and resentment builds quietly.' },
              { label: 'Ignore the request', credit: 0.1, why: 'Ignoring it does not make it go away. It just makes the conversation harder later.' },
            ],
          }),
      ],
    },
    outcome: (s) => ({
      headline: s.left >= 0 ? `Home with ${usd(s.left)} to spare` : `Home ${usd(-s.left)} over budget`,
      bonus: s.left >= 0 ? (s.left <= 120 ? 5 : 2) : -12,
      detail: (
        <>
          <h4>How the $600 went</h4>
          <p className="small" style={{ margin: 0 }}>{s.left >= 0 ? (s.left <= 120 ? 'On budget, with a little left. That is the target: the money was there to be used.' : 'Well under budget. Safe, though some of that money could have gone on the trip it was saved for.') : 'Over budget. The trip is finished, and the paying is not.'}</p>
        </>
      ),
    }),
    takeaways: [
      'The advertised price is the starting bid. Add bags, fees, taxes and age surcharges before comparing.',
      'Divide what is left by the days remaining. A daily number is easier to keep than a total.',
      'Pay a little for flexibility when you can already see what might go wrong.',
      'A debt in your name is yours, whoever spent the money.',
    ],
  };
  return <CaseRunner def={def} seed={seed} onFinish={onFinish} addReview={addReview} />;
}
