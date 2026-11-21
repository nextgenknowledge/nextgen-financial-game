'use client';
/**
 * Concert Pricing (Advanced, Trade Hall). You price Nova Lane's arena tour. Tickets sell out in
 * minutes and reappear at five times the price. Find who captured that money, pick a pricing
 * strategy, strip the fees out of a checkout page, and weigh revenue against the fans.
 */
import type { KindProps } from '../../types';
import { Table, usd } from '../pro/kit';
import { CaseRunner, Cards, Feed, dial, flag, pick, type CaseDef } from './kit';

interface S {
  resold: number;
  avg: number;
}

export default function ConcertPricing({ seed, onFinish, addReview }: KindProps) {
  const def: CaseDef<S> = {
    kicker: 'Trade Hall · Concert pricing',
    init: (rng) => ({ resold: rng.pick([3000, 3500, 4000]), avg: rng.pick([290, 310, 340]) }),
    steps: [
      () =>
        pick({
          brief: 'You work for Nova Lane’s tour manager. Last tour, every seat in the 15,000-seat arena cost $80. All of them sold in four minutes. An hour later, hundreds were listed on resale sites for $300 to $500.',
          visual: <Feed posts={[{ who: 'nova_fan_22', text: 'Queue for 2 hours, sold out, now they are $450 on resale?? I hate this.', meta: '18k likes' }]} />,
          prompt: 'What does the four-minute sellout tell you?',
          options: [
            { label: 'The price was far below what many fans would pay, so resellers bought low and captured the difference', credit: 1, why: 'When something sells out instantly and resells for five times the price, the price was too low for the demand. The gap did not go to fans or the artist; it went to whoever bought fastest, often with bots.' },
            { label: 'The tour was a success; a fast sellout is the goal', credit: 0.3, why: 'It feels like success, but it means the money fans were willing to pay went to resellers.' },
            { label: 'Resellers caused the demand', credit: 0, why: 'Resellers did not create the demand; they spotted that the price was below it.' },
          ],
        }),
      ({ s }) =>
        dial({
          brief: `The team estimates ${s.resold.toLocaleString('en-US')} tickets were resold, at an average of ${usd(s.avg)} each.`,
          prompt: 'How much money went to resellers above the $80 face value?',
          min: 0,
          max: 2000000,
          step: 10000,
          answer: s.resold * (s.avg - 80),
          tol: 15000,
          fmt: (v) => usd(v),
          why: `${s.resold.toLocaleString('en-US')} × (${usd(s.avg)} − $80) = ${usd(s.resold * (s.avg - 80))}. That came out of fans’ pockets and paid neither the artist, the crew, nor the venue.`,
        }),
      () =>
        pick({
          brief: 'For the new tour, the team debates four plans.',
          visual: (
            <Cards
              cards={[
                { icon: '📈', title: 'Dynamic pricing', facts: [['How', 'Price rises automatically with demand'], ['Risk', 'Fans see $80 jump to $400 while in the queue']] },
                { icon: '💵', title: 'Flat $200', facts: [['How', 'One higher price for every seat'], ['Risk', 'Prices out younger fans']] },
                { icon: '🎟️', title: 'Tiers plus fan exchange', facts: [['How', 'Cheap seats far back, pricier ones up front; resale only at face value on the official site'], ['Risk', 'More work to run']] },
                { icon: '🔁', title: 'Same as last time', facts: [['How', '$80, first come first served'], ['Risk', 'Resellers again']] },
              ]}
            />
          ),
          prompt: 'Which plan best balances fans, the artist and resellers?',
          options: [
            { label: 'Tiers plus a face-value fan exchange', credit: 1, why: 'Tiers let fans who will pay more do so, and keep cheap seats for those who cannot. A face-value exchange removes the resale profit, so bots have no reason to buy.' },
            { label: 'Dynamic pricing', credit: 0.5, why: 'It captures the money resellers took, but fans watching prices climb in a queue feel cheated, and artists have faced big backlash for it.' },
            { label: 'Flat $200', credit: 0.3, why: 'Earns more, but the front row and the back row cost the same, and many younger fans are shut out completely.' },
            { label: 'Same as last time', credit: 0, why: 'You already know what happens: a four-minute sellout and a resale market at five times the price.' },
          ],
        }),
      () =>
        flag({
          brief: 'You test the ticket site’s checkout before launch. A $95 ticket ends in a surprising total.',
          prompt: 'Flag the charges fans would rightly complain about.',
          doc: {
            title: 'Your order',
            sub: '1 × Floor standing',
            skin: 'receipt',
            lines: [
              { id: 'ticket', l: 'Ticket', r: '$95.00' },
              { id: 'service', l: 'Service fee (shown only at checkout)', r: '$24.50' },
              { id: 'facility', l: 'Facility charge (shown only at checkout)', r: '$7.00' },
              { id: 'order', l: 'Order processing fee', r: '$5.95' },
              { id: 'ins', l: 'Ticket protection (pre-ticked)', r: '$12.00' },
              { id: 'deliv', l: 'Mobile ticket delivery', r: '$0.00' },
              { id: 'tax', l: 'Sales tax', r: '$7.60' },
            ],
            foot: 'Total: $152.05',
          },
          issues: {
            service: 'Fees revealed only at the last step make the advertised price misleading. Many places now require the all-in price from the start.',
            facility: 'Another fee hidden until checkout. Fans compare prices on the number they see first.',
            order: 'A fee for "processing" an online order is a cost of selling tickets, dressed up as an extra.',
            ins: 'Pre-ticked add-ons are sold to people who did not choose them. Extras should be opt-in.',
          },
          fine: {
            ticket: 'The price itself.',
            deliv: 'Free and clearly shown.',
            tax: 'A government tax, not a seller’s fee.',
          },
        }),
      () =>
        pick({
          brief: 'The team finds that at $120 a seat, about 40,000 people would still try to buy the 15,000 seats.',
          visual: <Table head={['Price', 'People trying to buy', 'Seats']} rows={[['$80', 'About 90,000', '15,000'], ['$120', 'About 40,000', '15,000'], ['$250', 'About 12,000', '15,000']]} />,
          prompt: 'What happens if the average price rises from $80 to $120?',
          options: [
            { label: 'Every seat still sells, the artist earns 50% more, and the resale profit shrinks', credit: 1, why: 'Demand still far exceeds the seats, so attendance does not fall. Raising the price takes money from resellers, not from the crowd size.' },
            { label: 'A third of the seats go empty', credit: 0, why: 'At $120, 40,000 people still want 15,000 seats. That only starts to happen above about $250.' },
            { label: 'Nothing changes, because fans will pay anything', credit: 0.1, why: 'At $250, fewer people want tickets than there are seats. Fans have limits.' },
          ],
        }),
      () =>
        pick({
          brief: 'The manager says: "Let us just go to $250. More money, end of story."',
          prompt: 'What is the strongest argument against it?',
          options: [
            { label: 'Empty seats, and fans who feel priced out. A loyal audience is worth more over a career than one tour', credit: 1, why: 'At $250, demand falls below 15,000. Beyond lost tickets, artists depend on fans who buy music, merchandise and future tours. Short-term revenue can cost long-term loyalty.' },
            { label: 'It is illegal to charge that much', credit: 0, why: 'Ticket prices are generally not capped. It is a business choice.' },
            { label: 'Higher prices always earn less money', credit: 0.1, why: 'Not always. Up to about $120 here, higher prices earn more.' },
          ],
        }),
    ],
    alts: {
      0: [
        () =>
          pick({
            brief: 'A summer festival put 40,000 weekend passes on sale at $150. They sold out in nine minutes. By lunchtime, resale sites listed passes for $450 to $600.',
            visual: <Feed posts={[{ who: 'festfan_ana', text: 'In the queue at 9:00 sharp. Sold out at 9:09. Now $520 on resale. Who is buying all these?', meta: '9k likes' }]} />,
            prompt: 'Who ends up with the money between $150 and the resale price?',
            options: [
              { label: 'Whoever bought first and resold, often using bots to buy in bulk', credit: 1, why: 'The festival got $150 a pass. The gap went to resellers who bought fast and sold to the fans who missed out.' },
              { label: 'The festival, through the resale sites', credit: 0, why: 'Unless the festival runs the resale site itself, it earns nothing when a pass is resold.' },
              { label: 'Nobody: resale prices are only asking prices', credit: 0.3, why: 'Some listings never sell, but many do. Every one that sells moves real money from fans to resellers.' },
            ],
          }),
      ],
      1: [
        ({ s }) =>
          dial({
            brief: `Resold tickets went for an average of ${usd(s.avg)}. The face value was $80.`,
            prompt: 'By what percentage were resold tickets marked up?',
            min: 0,
            max: 500,
            step: 5,
            answer: Math.round(((s.avg - 80) / 80) * 100),
            tol: 8,
            fmt: (v) => `${v}%`,
            why: `(${usd(s.avg)} − $80) ÷ $80 = ${Math.round(((s.avg - 80) / 80) * 100)}%. A markup that large means the original price was far below what fans would pay.`,
          }),
      ],
      2: [
        () =>
          pick({
            brief: 'Last tour, one buyer got 400 tickets using thousands of fake accounts. The team wants to stop it happening again.',
            visual: (
              <Cards
                cards={[
                  { icon: '🔐', title: 'Verified fan sign-up', facts: [['How', 'Fans register ahead; codes go to real, checked people'], ['Limit', '4 tickets each, with names on the tickets']] },
                  { icon: '🤖', title: 'Puzzle check at checkout', facts: [['How', 'A quick test to prove you are human'], ['Weakness', 'Bot farms pay people to solve them']] },
                  { icon: '🎟️', title: 'Raise the limit to 10', facts: [['How', 'Fewer, bigger orders'], ['Weakness', 'Easier for resellers to buy in bulk']] },
                ]}
              />
            ),
            prompt: 'Which does the most to keep tickets with real fans?',
            options: [
              { label: 'Verified fan sign-up with named tickets', credit: 1, why: 'Checking buyers before the sale and putting names on tickets makes bulk buying and reselling much harder.' },
              { label: 'A puzzle check at checkout', credit: 0.4, why: 'It slows simple bots, but organised resellers get past it cheaply.' },
              { label: 'Raise the limit to 10 per order', credit: 0, why: 'That makes it easier, not harder, for one buyer to scoop up tickets.' },
            ],
          }),
      ],
      3: [
        () =>
          flag({
            brief: 'Your cousin missed the sale and found a “last chance” pair of tickets on a social media marketplace.',
            prompt: 'Flag the signs this could be a ticket scam.',
            doc: {
              title: '2 × Nova Lane, Floor',
              sub: 'Marketplace listing',
              skin: 'screen',
              lines: [
                { id: 'price', l: 'Price', r: '$310 each' },
                { id: 'pay', l: 'Payment by bank transfer or gift card only' },
                { id: 'shot', l: 'Tickets sent as screenshots after payment' },
                { id: 'new', l: 'Seller account created 2 days ago, no reviews' },
                { id: 'rush', l: '“3 other people asking, decide in 10 minutes”' },
                { id: 'date', l: 'Date and venue match the official tour page' },
              ],
            },
            issues: {
              pay: 'Bank transfers and gift cards cannot be reversed. Proper resale sites hold the money until the ticket is delivered.',
              shot: 'A screenshot can be sold to many buyers. Only the first one through the gate gets in.',
              new: 'Brand-new accounts with no history are how scammers sell and vanish.',
              rush: 'Pressure to decide fast stops you checking anything.',
            },
            fine: {
              price: 'High, but a high price alone is not a sign of a scam.',
              date: 'Correct details are easy to copy, so they prove nothing, but they are not a warning sign either.',
            },
          }),
      ],
      4: [
        () =>
          pick({
            brief: 'The arena holds 15,000. The team estimates how many people would try to buy at each price.',
            visual: <Table head={['Price', 'People trying to buy']} rows={[['$100', 'About 60,000'], ['$150', 'About 18,000'], ['$200', 'About 9,000']]} />,
            prompt: 'Which price earns the most from ticket sales?',
            options: [
              { label: '$150: there are still more buyers than seats, so all 15,000 sell for $2.25M', credit: 1, why: 'At $150 every seat still sells. At $200 only about 9,000 sell, earning $1.8M, and 6,000 seats sit empty.' },
              { label: '$200: the highest price earns the most', credit: 0.2, why: 'Only about 9,000 people want tickets at $200: 9,000 × $200 = $1.8M, less than the $2.25M at $150.' },
              { label: '$100: more fans means more money', credit: 0.3, why: 'There are only 15,000 seats. 15,000 × $100 = $1.5M. The other 45,000 fans cannot buy seats that do not exist.' },
            ],
          }),
      ],
      5: [
        () =>
          pick({
            brief: 'Nova Lane wants tickets to stay at $80 for real fans, even though demand is far higher. The team suggests a lottery: fans register, winners are drawn, and tickets can only be resold at face value on the official site.',
            prompt: 'What is the honest trade-off?',
            options: [
              { label: 'The artist earns less than it could, but fans pay $80 and resellers earn nothing', credit: 1, why: 'Keeping prices low is a choice to give fans value. The lottery and face-value resale make sure that value reaches fans instead of resellers.' },
              { label: 'There is no downside at all', credit: 0.2, why: 'The artist leaves money on the table, and most fans still lose the draw.' },
              { label: 'It will push resale prices even higher', credit: 0, why: 'If tickets can only be resold at face value, there is no resale profit to chase.' },
            ],
          }),
      ],
    },
    takeaways: [
      'An instant sellout with a booming resale market means the price was below demand.',
      'Tiered pricing and face-value resale take the profit out of scalping.',
      'Advertise the all-in price. Fees revealed at checkout and pre-ticked extras damage trust.',
      'Raise prices only while demand still exceeds supply. Past that point, seats and goodwill go empty.',
    ],
  };
  return <CaseRunner def={def} seed={seed} onFinish={onFinish} addReview={addReview} />;
}
