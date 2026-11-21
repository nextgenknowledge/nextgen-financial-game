'use client';
/**
 * Tariff Shock (Advanced, Harbor Trading). You import e-bikes, and a new 25% tariff lands on your
 * supplier's country. Work out who actually pays it, the new cost of each bike, how much of it to
 * pass on, and which "tariff solutions" are simply customs fraud.
 */
import type { KindProps } from '../../types';
import { Table, usd } from '../pro/kit';
import { CaseRunner, Say, dial, flag, pick, type CaseDef } from './kit';

interface S {
  factory: number;
}

export default function TariffShock({ seed, onFinish, addReview }: KindProps) {
  const def: CaseDef<S> = {
    kicker: 'Harbor Trading · Tariff shock',
    init: (rng) => ({ factory: rng.pick([560, 600, 640]) }),
    steps: [
      () =>
        pick({
          brief: 'You run a small company that imports e-bikes from a factory in Corvania and sells them at home. The news breaks: a 25% tariff on all Corvanian bikes, starting next month.',
          visual: <Say who="Your cousin">Good. Corvania has to pay us now.</Say>,
          prompt: 'Who actually pays the tariff to the government?',
          options: [
            { label: 'You, the importer, when the bikes clear customs. Then some of it usually reaches your customers', credit: 1, why: 'A tariff is a tax collected from the importer. Corvania only feels it indirectly, if it sells fewer bikes or cuts prices to keep customers.' },
            { label: 'The Corvanian factory', credit: 0.1, why: 'The factory may lower prices to keep your business, but the government collects the tariff from you.' },
            { label: 'The Corvanian government', credit: 0, why: 'Governments do not pay each other tariffs. It is a tax on your own country’s importers.' },
          ],
        }),
      ({ s }) =>
        dial({
          brief: 'Each bike costs you the factory price, plus shipping. The tariff is charged on the factory price.',
          visual: <Table head={['Per bike', 'Before', 'After']} rows={[['Factory price', usd(s.factory), usd(s.factory)], ['Ocean shipping and insurance', '$40', '$40'], ['Tariff, 25% of factory price', '$0', '?']]} />,
          prompt: 'What does one bike cost you, delivered, after the tariff?',
          min: 500,
          max: 1100,
          step: 5,
          answer: s.factory * 1.25 + 40,
          tol: 5,
          fmt: (v) => usd(v),
          why: `${usd(s.factory)} + $40 + ${usd(s.factory * 0.25)} tariff = ${usd(s.factory * 1.25 + 40)}, up ${usd(s.factory * 0.25)} a bike. That landed cost, not the factory price, is what your pricing has to cover.`,
        }),
      ({ s }) => {
        const cost = s.factory * 1.25 + 40;
        const rows: [number, number][] = [
          [1100, 100],
          [1100 + Math.round((s.factory * 0.25) / 2 / 10) * 10, 92],
          [1100 + Math.round((s.factory * 0.25) / 10) * 10, 72],
        ];
        const prof = rows.map(([p, u]) => (p - cost) * u);
        const best = prof.indexOf(Math.max(...prof));
        return pick({
          brief: 'You sell bikes at $1,100 and move about 100 a month. Your sales team estimates how many you would sell at higher prices.',
          visual: <Table head={['Your price', 'Bikes sold a month', 'Profit a month']} rows={rows.map(([p, u]) => [usd(p), String(u), '?'])} />,
          prompt: `With a delivered cost of ${usd(cost)}, which price earns the most?`,
          ordered: true,
          options: rows.map(([p], i) => ({
            label: `${usd(p)}${i === 0 ? ' (absorb the tariff)' : i === 1 ? ' (pass on half)' : ' (pass on all of it)'}`,
            credit: i === best ? 1 : prof[i] >= prof[best] * 0.97 ? 0.7 : 0.2,
            why: `${usd(p)} − ${usd(cost)} = ${usd(p - cost)} a bike × ${rows[i][1]} = ${usd(prof[i])} a month. ${i === best ? 'The best of the three: some of the tariff goes to customers, but not so much that sales collapse.' : 'Not the highest profit on the table.'}`,
          })),
        });
      },
      () =>
        flag({
          brief: 'A freight agent sends a menu of "tariff solutions".',
          prompt: 'Flag the options that are illegal.',
          doc: {
            title: 'Tariff Solutions Menu',
            sub: 'Confidential',
            skin: 'paper',
            lines: [
              { id: 'relabel', l: 'Ship through our warehouse in Lindos and relabel the bikes "Made in Lindos".' },
              { id: 'under', l: 'We print a second invoice showing a lower factory price for customs.' },
              { id: 'parts', l: 'Declare finished bikes as "bicycle parts", which have a lower rate.' },
              { id: 'move', l: 'Move real production to a Lindos factory that makes the frames and motors.' },
              { id: 'bond', l: 'Store bikes in a bonded warehouse and pay the tariff only when each one is sold.' },
              { id: 'supplier', l: 'Switch to a supplier in a country without the tariff.' },
            ],
          },
          issues: {
            relabel: 'Changing the label without changing where the bike is made is illegal transshipment. Customs fraud brings large fines and can bring criminal charges.',
            under: 'A false invoice to lower the duty is customs fraud, and the factory now has evidence against you.',
            parts: 'Misdescribing goods to get a lower rate is fraud. Customs officers open containers.',
          },
          fine: {
            move: 'Legal: when the product is genuinely made somewhere else, its origin changes. It just takes time and money.',
            bond: 'Legal: bonded warehouses delay the payment of duty, which helps your cash flow.',
            supplier: 'Legal, and the most common real response to a tariff.',
          },
        }),
      () =>
        pick({
          brief: 'Six months later, Corvania responds with its own tariffs, on your country’s apples and aircraft parts.',
          prompt: 'Who is most likely to be hurt by this round?',
          options: [
            { label: 'Exporters at home, like apple farmers, who suddenly cost more in Corvania and lose sales', credit: 1, why: 'Retaliation targets exports on purpose, often from places politicians care about. Trade wars usually hurt businesses in both countries.' },
            { label: 'Nobody; the two tariffs cancel out', credit: 0, why: 'They do not cancel. Each tariff makes trade more expensive, so both sides lose some customers.' },
            { label: 'Only Corvanian shoppers', credit: 0.3, why: 'They pay more for apples, but your farmers lose the sales.' },
          ],
        }),
    ],
    alts: {
      0: [
        () =>
          pick({
            brief: 'You import e-bikes from Corvania. Your government announces a 25% tariff on Corvanian bikes "to protect our own bike makers".',
            prompt: 'Which statement best describes the trade-off?',
            options: [
              { label: 'Home bike makers face less competition, while buyers and importers pay more', credit: 1, why: 'Tariffs shift money: they can protect some home jobs, but shoppers pay higher prices and importers lose margin or sales.' },
              { label: 'Everyone at home is better off', credit: 0.1, why: 'Home producers can gain, but buyers pay more, so not everyone wins.' },
              { label: 'Only Corvania is affected', credit: 0.1, why: 'The tax is collected at home, from importers like you.' },
            ],
          }),
      ],
      1: [
        ({ s }) =>
          dial({
            brief: `A 15% tariff applies to the factory price of each e-bike, ${usd(s.factory)}. Your next shipment holds 50 bikes.`,
            prompt: 'How much tariff will you pay on the whole shipment?',
            min: 0,
            max: 10000,
            step: 50,
            answer: s.factory * 0.15 * 50,
            tol: 50,
            fmt: (v) => usd(v),
            why: `15% of ${usd(s.factory)} is ${usd(s.factory * 0.15)} a bike, × 50 = ${usd(s.factory * 0.15 * 50)}. It is due when the bikes clear customs, often weeks before you sell a single one.`,
          }),
      ],
      2: [
        ({ s }) =>
          pick({
            brief: `After a 25% tariff, your bikes cost ${usd(s.factory * 1.25 + 40)} each delivered. A supplier in Lindos, where there is no tariff, can deliver a similar bike for ${usd(s.factory * 1.1 + 40)}, but you have never worked with them.`,
            prompt: 'What is the most sensible move?',
            options: [
              { label: 'Order a small trial batch from Lindos to check quality, while keeping your current supplier for now', credit: 1, why: 'Cheaper only matters if the quality is right. A trial tests it without risking the whole business on an unknown supplier.' },
              { label: 'Switch everything to Lindos immediately', credit: 0.3, why: 'The saving is real, but an untested supplier could deliver late or faulty bikes.' },
              { label: 'Ignore it and keep paying the tariff', credit: 0.2, why: 'Safe, but you may lose customers to competitors who find cheaper sources.' },
            ],
          }),
      ],
      3: [
        () =>
          flag({
            brief: 'A consultant pitches ways to cut your tariff bill.',
            prompt: 'Flag the options that are illegal.',
            doc: {
              title: 'Duty Savings Proposal',
              sub: 'For discussion',
              skin: 'paper',
              lines: [
                { id: 'used', l: 'Declare new bikes as "used", which carry a lower rate.' },
                { id: 'split', l: 'Split each order into hundreds of small parcels to stay under the duty-free limit.' },
                { id: 'broker', l: 'Hire a licensed customs broker to make sure bikes are classified correctly.' },
                { id: 'value', l: 'Leave the motor off the invoice and ship it separately as a "gift".' },
                { id: 'excl', l: 'Apply through the official process for an exclusion from the tariff.' },
                { id: 'ftz', l: 'Use a free trade zone, paying duty only on bikes that enter the country.' },
              ],
            },
            issues: {
              used: 'Lying about the condition of goods to cut duty is customs fraud.',
              split: 'Deliberately breaking commercial shipments up to dodge duty is evasion, and customs watch for it.',
              value: 'Hiding part of the value is undervaluation, which is fraud.',
            },
            fine: {
              broker: 'Legal and smart: correct classification avoids both overpaying and penalties.',
              excl: 'Legal: some tariffs have an official exclusion process.',
              ftz: 'Legal: free trade zones delay or reduce duty on goods that are re-exported.',
            },
          }),
      ],
      4: [
        () =>
          pick({
            brief: 'Two years later, the tariff is removed. Your delivered cost per bike falls back by about $150.',
            prompt: 'What usually happens to shop prices?',
            options: [
              { label: 'They come down slowly, and only as far as competition forces them to', credit: 1, why: 'Prices tend to rise quickly and fall slowly. Sellers lower prices when rivals do, so competition decides how much of the saving reaches shoppers.' },
              { label: 'They drop by the full $150 the next day', credit: 0.1, why: 'Sellers have old stock bought at the higher cost, and no reason to cut faster than rivals.' },
              { label: 'They never come down at all', credit: 0.3, why: 'Too strong. In a competitive market, prices usually do fall back over time.' },
            ],
          }),
      ],
    },
    takeaways: [
      'A tariff is a tax paid by the importer, and part of it usually reaches shoppers.',
      'Price from the landed cost: factory price, shipping and duty.',
      'Passing on part of a cost often earns more than absorbing it all or passing it all on.',
      'Relabeling, false invoices and false descriptions are customs fraud, however they are marketed.',
    ],
  };
  return <CaseRunner def={def} seed={seed} onFinish={onFinish} addReview={addReview} />;
}
