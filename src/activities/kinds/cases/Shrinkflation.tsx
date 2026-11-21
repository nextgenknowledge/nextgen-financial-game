'use client';
/**
 * Shrinkflation Detective (Advanced, London Market). A weekly shop where the shelf is designed to
 * mislead: shrinking packs, multibuys that cost more, "family size" that is not cheaper, and
 * member prices that come with a catch. The tool is the unit price.
 */
import type { KindProps } from '../../types';
import { Table } from '../pro/kit';
import { CaseRunner, Cards, choose, dial, flag, pick, type CaseDef } from './kit';

const gbp = (v: number, d = 2) => `£${v.toFixed(d)}`;

interface S {
  oldG: number;
  newG: number;
  price: number;
}

export default function Shrinkflation({ seed, onFinish, addReview }: KindProps) {
  const def: CaseDef<S> = {
    kicker: 'Market Hall · Shrinkflation detective',
    init: (rng) => {
      const [oldG, newG] = rng.pick([
        [200, 180],
        [250, 220],
        [400, 360],
      ]);
      return { oldG, newG, price: rng.pick([1.8, 2, 2.4]) };
    },
    steps: [
      ({ s }) =>
        dial({
          brief: `Your favourite crisps still cost ${gbp(s.price)}. The bag looks the same, but the small print has changed from ${s.oldG}g to ${s.newG}g.`,
          visual: <Cards cards={[{ icon: '📦', title: 'Last year', facts: [['Price', gbp(s.price)], ['Weight', `${s.oldG}g`]] }, { icon: '📦', title: 'This year', tag: 'Same great taste', facts: [['Price', gbp(s.price)], ['Weight', `${s.newG}g`]] }]} />,
          prompt: 'By how much has the real price per gram gone up?',
          min: 0,
          max: 30,
          step: 0.5,
          answer: Math.round((s.oldG / s.newG - 1) * 1000) / 10,
          tol: 0.6,
          fmt: (v) => `${v.toFixed(1)}%`,
          why: `You now pay ${gbp(s.price)} for ${s.newG}g instead of ${s.oldG}g. ${s.oldG} ÷ ${s.newG} = ${(s.oldG / s.newG).toFixed(3)}, a ${((s.oldG / s.newG - 1) * 100).toFixed(1)}% rise. Note it is not the ${Math.round((1 - s.newG / s.oldG) * 100)}% the pack shrank by: less food for the same money is a bigger price rise than it looks.`,
        }),
      () =>
        pick({
          brief: 'Pasta aisle. Two packs of the same brand.',
          visual: <Table head={['Pack', 'Price', 'Price per kg']} rows={[['500g', '£0.95', '£1.90'], ['Family size, 1.5kg', '£3.15', '?']]} />,
          prompt: 'Which is cheaper per kilogram?',
          ordered: true,
          options: [
            { label: '500g', credit: 1, why: '£3.15 ÷ 1.5 is £2.10 a kg, more than the £1.90 for the small pack. Bigger packs are usually cheaper per kilo, which is exactly why shoppers stop checking.' },
            { label: 'Family size', credit: 0, why: 'It works out to £2.10 a kg against £1.90. "Family size" is a label, not a promise.' },
            { label: 'They are the same', credit: 0, why: 'The small pack is 20p a kilo cheaper. Always check the unit price on the shelf label.' },
          ],
        }),
      () =>
        flag({
          brief: 'The drinks aisle is covered in offers.',
          prompt: 'Flag the offers that are not actually saving money.',
          doc: {
            title: 'Today’s offers',
            sub: 'Aisle 7',
            skin: 'receipt',
            lines: [
              { id: 'multi', l: 'Juice 1L: £1.40 each, or 3 for £4.50', r: 'Offer' },
              { id: 'half', l: 'Sparkling water 6-pack: was £3.00, now £1.50', r: 'Half price' },
              { id: 'was', l: 'Cola 2L: was £2.99, now £1.99 (sold at £1.99 for 11 of the last 12 weeks)', r: 'Save £1' },
              { id: 'bogo', l: 'Iced tea: £1.20, buy one get one free', r: 'BOGOF' },
              { id: 'bigger', l: 'Squash 1L £1.10, or squash 1.5L "Bigger pack!" £1.80', r: 'Bigger!' },
            ],
          },
          issues: {
            multi: 'Three singles cost £4.20. The "offer" charges 30p more for the same three bottles.',
            was: 'If it has been £1.99 almost all year, £1.99 is the normal price. The "was" price was only charged briefly so the saving could be advertised.',
            bigger: 'The 1L costs £1.10 a litre; the 1.5L costs £1.20 a litre. Bigger, and dearer per litre.',
          },
          fine: {
            half: 'A genuine half-price cut, if it is something you would buy anyway.',
            bogo: 'Two for £1.20 is 60p each, a real saving if you will drink both.',
          },
        }),
      () =>
        pick({
          brief: 'At the till, a sign says "Members save 20%: download our app". Signing up asks for your email, location access and permission to track your purchases.',
          prompt: 'What is the fairest way to think about the member price?',
          options: [
            { label: 'It is a real discount paid for with your data, and it trains you to shop there. Fine if you understand the trade', credit: 1, why: 'Shops use your purchase history to target offers and set prices. The saving is real; so is what you are giving in return.' },
            { label: 'It is free money with no downside', credit: 0.2, why: 'Nothing is free: your data has value to the shop, which is why they will pay 20% for it.' },
            { label: 'It is a scam', credit: 0.2, why: 'It is not a scam. It is a trade, and a decent one for some people.' },
          ],
        }),
      () =>
        choose({
          brief: 'You get home and check the receipt against your list. You spent £14 more than planned.',
          prompt: 'Which two habits would have saved the most next time?',
          k: 2,
          options: [
            { label: 'Compare the unit price on the shelf label, not the pack price', good: true, why: 'It is printed on almost every UK shelf label, and it cuts through pack sizes, multibuys and shrinking packs in one glance.' },
            { label: 'Shop from a list and treat offers on things not on it as costs, not savings', good: true, why: 'A 50%-off item you did not need is 100% extra spending. Most offers are placed to make you buy more, not to save you money.' },
            { label: 'Always buy the biggest pack', good: false, why: 'Often cheaper per unit, sometimes not, and food that goes off before you eat it is the most expensive of all.' },
            { label: 'Always buy whatever has a yellow sticker', good: false, why: 'Offer stickers are there to sell more. Some are real; the unit price tells you which.' },
            { label: 'Go shopping when you are hungry so you buy enough', good: false, why: 'Hungry shoppers reliably spend more on things they did not plan to buy.' },
          ],
        }),
    ],
    alts: {
      0: [
        ({ s }) => {
          const o = Math.round(s.oldG / 2.5);
          const n = Math.round(s.newG / 2.5);
          return dial({
            brief: `Your usual box of tea still costs ${gbp(s.price)}. The box is the same size, but it now says ${n} bags instead of ${o}.`,
            visual: <Cards cards={[{ icon: '☕', title: 'Last year', facts: [['Price', gbp(s.price)], ['Tea bags', String(o)]] }, { icon: '☕', title: 'This year', tag: 'New look!', facts: [['Price', gbp(s.price)], ['Tea bags', String(n)]] }]} />,
            prompt: 'By how much has the real price per bag gone up?',
            min: 0,
            max: 30,
            step: 0.5,
            answer: Math.round((o / n - 1) * 1000) / 10,
            tol: 0.6,
            fmt: (v) => `${v.toFixed(1)}%`,
            why: `${o} ÷ ${n} = ${(o / n).toFixed(3)}, so each bag costs ${((o / n - 1) * 100).toFixed(1)}% more. A "new look" box is a common moment for the count to quietly drop.`,
          });
        },
      ],
      1: [
        () =>
          pick({
            brief: 'Yoghurt aisle. Same brand, same flavour.',
            visual: <Table head={['Pack', 'Price', 'Price per kg']} rows={[['4-pack, 4 × 125g', '£1.80', '?'], ['Big pot, 500g', '£1.20', '?']]} />,
            prompt: 'Which is cheaper per kilogram?',
            ordered: true,
            options: [
              { label: '4-pack', credit: 0, why: '500g for £1.80 is £3.60 a kg. You pay 50% more for the little pots.' },
              { label: 'Big pot', credit: 1, why: '500g for £1.20 is £2.40 a kg, against £3.60 for the 4-pack. Same yoghurt, same weight, a third cheaper.' },
              { label: 'They are the same', credit: 0, why: 'Same weight, but 60p apart. Convenience packs carry a big premium.' },
            ],
          }),
      ],
      2: [
        () =>
          flag({
            brief: 'The snacks aisle is covered in offers.',
            prompt: 'Flag the offers that are not actually saving money.',
            doc: {
              title: 'Today’s offers',
              sub: 'Aisle 4',
              skin: 'receipt',
              lines: [
                { id: 'two', l: 'Biscuits: £1.00 each, or 2 for £2.20', r: '2 for £2.20' },
                { id: 'third', l: 'Crackers 300g: same price, now 33% extra free (400g)', r: 'Extra free' },
                { id: 'club', l: 'Popcorn: £2.50, or £2.00 with a loyalty card (card is free)', r: 'Member price' },
                { id: 'share', l: 'Chocolate: 100g bar £1.20, or 150g "sharing bag" £2.10', r: 'Sharing size!' },
                { id: 'ref', l: 'Nuts: "was £4.00" for one week in January, £3.00 the rest of the year', r: 'Save £1' },
              ],
            },
            issues: {
              two: 'Two singles cost £2.00. The "deal" costs 20p more.',
              share: 'The bar is £1.20 per 100g; the sharing bag is £1.40 per 100g. Bigger, and dearer.',
              ref: 'A "was" price charged for one week is not a real normal price. £3.00 is the usual price.',
            },
            fine: {
              third: 'More food for the same money is a genuine saving.',
              club: 'A real discount, if you are happy to use the card.',
            },
          }),
      ],
      3: [
        () =>
          pick({
            brief: 'Tinned beans. At eye level: a famous brand at £1.10. On the bottom shelf: the shop’s own brand, same weight, at £0.45.',
            prompt: 'Why are they arranged like this?',
            options: [
              { label: 'Shops put the products they most want you to buy at eye level. Cheaper options are often above or below', credit: 1, why: 'Brands often pay for the best shelf spots. Looking high and low takes two seconds and can halve the price.' },
              { label: 'The best products always go at eye level', credit: 0.1, why: 'Placement is about sales, not quality. Own brands are often made in the same factories.' },
              { label: 'It is random', credit: 0, why: 'Shelf layout is planned carefully, because it changes what people buy.' },
            ],
          }),
      ],
      4: [
        () =>
          choose({
            brief: 'A friend thinks their shopping got more expensive, but the prices on the packs look the same as last year.',
            prompt: 'Which two checks would show what is happening?',
            k: 2,
            options: [
              { label: 'Check the weight or count printed on the pack, not just the price', good: true, why: 'Shrinkflation keeps the price and cuts the contents. The small print gives it away.' },
              { label: 'Compare the unit price on the shelf label over time', good: true, why: 'Price per 100g or per item rises when a pack shrinks, even if the sticker price does not.' },
              { label: 'Only buy products with "new look" packaging', good: false, why: 'A new look is often exactly when the contents shrink.' },
              { label: 'Trust that brands keep sizes the same', good: false, why: 'Many well-known products have shrunk without any announcement.' },
              { label: 'Buy whatever is on the end-of-aisle display', good: false, why: 'Those spots are for promotions, not always the best value.' },
            ],
          }),
      ],
    },
    takeaways: [
      'The unit price on the shelf label is the real price. Compare that, not the pack price.',
      'Shrinkflation is a price rise. A 10% smaller pack at the same price is an 11% increase.',
      'Multibuys, "was" prices and "bigger" packs are not always savings. Do the quick check.',
      'An offer on something you did not plan to buy is spending, not saving.',
    ],
  };
  return <CaseRunner def={def} seed={seed} onFinish={onFinish} addReview={addReview} />;
}
