'use client';
/**
 * Delivery App Squeeze (Advanced, Dim Sum House). Your family's dumpling shop joins a delivery
 * app that takes 30% of every order. Work out what an app order really earns, price the menu,
 * judge the app's promotions, and win back customers you do not have to share.
 */
import type { KindProps } from '../../types';
import { Table, usd } from '../pro/kit';
import { CaseRunner, Cards, Feed, choose, dial, pick, type CaseDef } from './kit';

interface S {
  price: number;
}

export default function DeliverySqueeze({ seed, onFinish, addReview }: KindProps) {
  const def: CaseDef<S> = {
    kicker: 'Dim Sum House · Delivery app squeeze',
    init: (rng) => ({ price: rng.pick([16, 17, 18]) }),
    steps: [
      ({ s }) =>
        dial({
          brief: `Your aunt runs a small dumpling shop. A box of 12 dumplings sells for ${usd(s.price)}. She joined DashBite, a delivery app, and orders are pouring in. So why does the bank account feel emptier?`,
          visual: <Table head={['One app order', '']} rows={[['Menu price', usd(s.price)], ['DashBite commission', '30% of the price'], ['Ingredients', '$5.00'], ['Takeaway box and bag', '$1.00'], ['Kitchen staff time', '$3.00']]} />,
          prompt: 'How much does the shop keep from one app order?',
          min: -5,
          max: 10,
          step: 0.1,
          answer: Math.round((s.price * 0.7 - 9) * 10) / 10,
          tol: 0.15,
          fmt: (v) => usd(v, 2),
          why: `${usd(s.price)} − ${usd(s.price * 0.3, 2)} commission − $5 − $1 − $3 = ${usd(s.price * 0.7 - 9, 2)}. A customer eating in pays the same ${usd(s.price)} and leaves ${usd(s.price - 8, 2)}. Busy is not the same as profitable.`,
        }),
      ({ s }) =>
        pick({
          brief: 'Many restaurants charge more on delivery apps than in the shop.',
          visual: <Cards cards={[{ icon: '🏪', title: 'In the shop', facts: [['Box of 12', usd(s.price)]] }, { icon: '🛵', title: 'On DashBite', tag: 'Option', facts: [['Box of 12', usd(Math.round(s.price * 1.2))]] }]} />,
          prompt: 'Is it fair to charge app customers 20% more?',
          options: [
            { label: 'Yes. App orders cost more to serve, and customers are paying for the convenience of delivery', credit: 1, why: 'The commission is a real cost created by that order. Pricing it in is honest, and app customers already accept delivery fees.' },
            { label: 'No. One price everywhere is the only fair way', credit: 0.4, why: 'One price is simple, but then shop customers quietly pay for the convenience of app customers.' },
            { label: 'It does not matter; the app sets the price', credit: 0, why: 'Restaurants set their own menu prices on most delivery apps.' },
          ],
        }),
      ({ s }) => {
        const p = Math.round(s.price * 1.2);
        const base = p * 0.7 - 9;
        const promo = p * 0.65 - 9 - 4;
        return pick({
          brief: `You raise the app price to ${usd(p)}. Now DashBite offers a "Boost" deal.`,
          visual: <Feed posts={[{ who: 'DashBite for Business', text: 'Boost your shop to the top of the app! Commission goes from 30% to 35%, and you fund a $4 discount on every order. Shops on Boost see up to 40% more orders!', tone: 'ad' }]} />,
          prompt: 'Should your aunt sign up?',
          options: [
            { label: `Not unless the extra orders are huge: each Boost order earns ${usd(promo, 2)} instead of ${usd(base, 2)}`, credit: 1, why: `${usd(p)} × 65% − $9 − $4 = ${usd(promo, 2)}. "Up to 40% more orders" at that margin ${promo <= 0 ? 'earns nothing, or less than nothing, on every order' : `earns less than now unless orders grow more than ${Math.ceil(base / promo)}-fold`}. The app wins either way; the shop takes the risk.` },
            { label: 'Yes, more orders means more profit', credit: 0, why: 'Only if each order is profitable. Selling more at a loss loses more.' },
            { label: 'Try it for one month and compare the actual profit', credit: 0.6, why: 'Testing is sensible, but do the maths first: it tells you how many extra orders it would need, and that is usually more than any promotion delivers.' },
          ],
        });
      },
      () =>
        choose({
          brief: 'Your aunt wants to depend on DashBite less, without losing her regular customers.',
          prompt: 'Which two moves help most?',
          k: 2,
          options: [
            { label: 'Take pickup orders by phone or her own website, with no commission', good: true, why: 'Every order that moves off the app keeps the full price. Many customers will happily pick up to save the fees.' },
            { label: 'Put a card in every app bag: order direct next time and get a free spring roll', good: true, why: 'The app keeps customers’ details to itself. The bag is the one way to reach them directly, and the reward still costs far less than 30% commission.' },
            { label: 'Use cheaper ingredients for app orders', good: false, why: 'Reviews on the app are permanent. Worse food loses customers everywhere.' },
            { label: 'Leave the app tomorrow', good: false, why: 'Too sudden. Some customers only find her through the app. Shift orders gradually.' },
            { label: 'Offer free delivery from the shop by car', good: false, why: 'Paying a driver for each order can cost more than the commission.' },
          ],
        }),
      () =>
        pick({
          brief: 'A friend asks why delivery apps can charge restaurants so much.',
          prompt: 'What gives the app its power?',
          options: [
            { label: 'It controls the customers: they search the app, not the street, and the app keeps their contact details', credit: 1, why: 'Whoever owns the relationship with customers sets the terms. That is why restaurants work so hard to get customers ordering directly.' },
            { label: 'Delivery is expensive, so 30% is just the cost', credit: 0.3, why: 'Delivery costs money, but the commission also pays for marketing, profit and the app’s position between shop and customer.' },
            { label: 'The government sets the commission', credit: 0, why: 'Some cities have capped commissions, but most rates are set by the apps.' },
          ],
        }),
    ],
    alts: {
      0: [
        ({ s }) =>
          dial({
            brief: `Your aunt runs a small dumpling shop. A box of 12 dumplings is ${usd(s.price)}. She starts taking pickup orders through her own website, which charges a 3% card fee and nothing else.`,
            visual: <Table head={['One website pickup order', '']} rows={[['Menu price', usd(s.price)], ['Card fee', '3% of the price'], ['Ingredients', '$5.00'], ['Takeaway box and bag', '$1.00'], ['Kitchen staff time', '$3.00']]} />,
            prompt: 'How much does the shop keep from one website order?',
            min: -5,
            max: 15,
            step: 0.1,
            answer: Math.round((s.price * 0.97 - 9) * 10) / 10,
            tol: 0.15,
            fmt: (v) => usd(v, 2),
            why: `${usd(s.price)} − ${usd(s.price * 0.03, 2)} card fee − $5 − $1 − $3 = ${usd(s.price * 0.97 - 9, 2)}. Through a 30% delivery app, the same order keeps only ${usd(s.price * 0.7 - 9, 2)}.`,
          }),
      ],
      1: [
        () =>
          pick({
            brief: 'Your aunt lists all 40 dishes from her menu on DashBite. Some arrive soggy and get bad reviews.',
            prompt: 'What is the smartest change?',
            options: [
              { label: 'Offer a shorter app menu of dishes that travel well and earn enough after the commission', credit: 1, why: 'A smaller app menu protects reviews and drops dishes that lose money after the 30% cut.' },
              { label: 'Keep everything; more choice means more orders', credit: 0.2, why: 'More choice also means more bad reviews and more dishes sold at a loss.' },
              { label: 'Leave the app because of the reviews', credit: 0.3, why: 'Too drastic. Fixing the menu solves the cause.' },
            ],
          }),
      ],
      2: [
        ({ s }) => {
          const p = Math.round(s.price * 1.2);
          const full = p * 0.7 - 9;
          const own = p * 0.85 - 9 - 4;
          return pick({
            brief: `The app price is ${usd(p)}. DashBite offers a 15% commission instead of 30% if the shop delivers the orders itself. A driver would cost about $4 an order.`,
            visual: <Table head={['Per app order', 'App delivers', 'Shop delivers']} rows={[['Commission', '30%', '15%'], ['Driver', '$0', '$4'], ['Food, box, staff', '$9', '$9']]} />,
            prompt: 'Which earns more on each order?',
            ordered: true,
            options: [
              { label: 'App delivers', credit: 1, why: `${usd(p)} × 70% − $9 = ${usd(full, 2)}, against ${usd(p)} × 85% − $9 − $4 = ${usd(own, 2)}. The commission saving is smaller than the driver cost.` },
              { label: 'Shop delivers', credit: 0.2, why: `It keeps ${usd(own, 2)}, less than ${usd(full, 2)}. A lower commission only helps if delivery costs less than it saves.` },
              { label: 'They earn the same', credit: 0, why: `${usd(full, 2)} against ${usd(own, 2)}. Always do the maths per order.` },
            ],
          });
        },
      ],
      3: [
        () =>
          choose({
            brief: 'Your aunt wants each app order to earn more.',
            prompt: 'Which two moves help most?',
            k: 2,
            options: [
              { label: 'Offer meal bundles that raise the size of each order', good: true, why: 'The box, bag and packing time cost about the same for a bigger order, so larger orders keep more of each dollar.' },
              { label: 'Set app prices to cover the commission on each dish', good: true, why: 'Pricing each item for its real cost on the app stops orders losing money.' },
              { label: 'Add free extras to every app order', good: false, why: 'Generous, but it cuts an already thin margin.' },
              { label: 'Pay for top placement on the app', good: false, why: 'More orders at a thin margin rarely pay for the placement.' },
              { label: 'Accept every promotion the app offers', good: false, why: 'Each one usually costs the shop more than it brings in.' },
            ],
          }),
      ],
      4: [
        () =>
          pick({
            brief: 'A friend notices that the same few restaurants always appear first on the delivery app, marked "Featured".',
            prompt: 'Why might they be at the top?',
            options: [
              { label: 'Many have paid for placement or accepted higher commission, so "Featured" is often an ad', credit: 1, why: 'Apps earn money from where shops appear. Top spots are not always the best food.' },
              { label: 'They are always the best-rated', credit: 0.2, why: 'Sometimes, but placement is often bought.' },
              { label: 'They are closest to you', credit: 0.2, why: 'Distance matters, but paid placement often matters more.' },
            ],
          }),
      ],
    },
    takeaways: [
      'Work out profit per order, not total sales. A busy kitchen can be losing money.',
      'Charging more on apps passes a real cost to the customers who create it.',
      'Promotions that cut your margin need far more extra orders than they promise.',
      'Whoever owns the customer relationship sets the price. Build ways for customers to reach you directly.',
    ],
  };
  return <CaseRunner def={def} seed={seed} onFinish={onFinish} addReview={addReview} />;
}
