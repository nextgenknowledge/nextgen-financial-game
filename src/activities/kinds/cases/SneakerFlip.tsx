'use client';
/**
 * Sneaker Flip (Advanced, Night Market). Reselling limited drops: the real profit after fees,
 * spotting a fake listing, when prices peak, and why borrowing to buy more stock turns a side
 * hustle into a gamble.
 */
import type { KindProps } from '../../types';
import { C, LineChart, Table, usd } from '../pro/kit';
import { CaseRunner, Cards, choose, dial, flag, pick, type CaseDef } from './kit';

interface S {
  resale: number;
}

export default function SneakerFlip({ seed, onFinish, addReview }: KindProps) {
  const def: CaseDef<S> = {
    kicker: 'Night Market · Sneaker flip',
    init: (rng) => ({ resale: rng.pick([300, 320, 340]) }),
    steps: [
      ({ s }) => {
        const keep = s.resale * (1 - 0.095 - 0.03) - 14;
        return dial({
          brief: `You win the raffle for the Kestrel 4 "Harbor" at $180 retail. On the resale app, pairs in your size are selling for ${usd(s.resale)}.`,
          visual: <Table head={['Resale app fees (seller pays)', '']} rows={[['Seller fee', '9.5% of sale price'], ['Payment processing', '3% of sale price'], ['Shipping to the authenticator', '$14'], ['Authentication', 'Included']]} />,
          prompt: 'If you sell at that price, what is your actual profit?',
          min: 0,
          max: 200,
          step: 1,
          answer: Math.round(keep - 180),
          tol: 3,
          fmt: (v) => usd(v),
          why: `Fees take 12.5% of ${usd(s.resale)}, which is ${usd(s.resale * 0.125)}. ${usd(s.resale)} − ${usd(s.resale * 0.125)} − $14 shipping − $180 = ${usd(keep - 180)}. The headline gap was ${usd(s.resale - 180)}; around 40% of it went to fees and postage.`,
        });
      },
      () =>
        flag({
          brief: 'You want to flip a rarer pair. A seller in a group chat has the Kestrel 1 "Origin", which goes for about $900.',
          prompt: 'Flag the red flags in the listing.',
          doc: {
            title: 'FOR SALE: Kestrel 1 "Origin"',
            sub: 'Posted 2 hours ago',
            skin: 'screen',
            lines: [
              { id: 'price', l: 'Price: $450. Need cash fast, moving abroad.' },
              { id: 'size', l: 'Size: US 10. Deadstock, never worn.' },
              { id: 'pay', l: 'Payment by gift card or friends-and-family transfer ONLY.' },
              { id: 'photo', l: 'Photos: three product shots on a white background.' },
              { id: 'box', l: 'Comes with the original box and spare laces.' },
              { id: 'acct', l: 'Seller account created this week. No reviews.' },
              { id: 'rush', l: 'Three people interested, first to pay gets them!' },
            ],
          },
          issues: {
            price: 'Half the market price with a sad story is the classic bait. Real sellers know what their shoes are worth.',
            pay: 'Gift cards and friends-and-family transfers have no buyer protection. Once sent, the money is gone.',
            photo: 'Product shots on white are usually copied from a store website. Ask for photos with today’s date written on paper next to the shoes.',
            acct: 'A brand-new account with no history cannot be checked or held to account.',
            rush: 'Fake urgency stops you from thinking or checking.',
          },
          fine: {
            size: 'Normal details for a listing.',
            box: 'Normal, though boxes can be faked too.',
          },
        }),
      () =>
        pick({
          brief: 'Here is what typically happens to resale prices for a hyped release.',
          visual: <LineChart series={[{ pts: [420, 400, 360, 330, 300, 280, 270, 265, 262, 260], color: C.gold, label: 'Typical hyped pair' }]} fmt={(v) => usd(v)} xLabel="Weeks after release" h={170} />,
          prompt: 'For most pairs, when is the best time to sell?',
          options: [
            { label: 'Soon after release, while buyers who missed out are paying a premium', credit: 1, why: 'For most releases, hype fades and more pairs reach the market. A few rare pairs rise over years, but betting every pair is one of those is how stock piles up.' },
            { label: 'Hold for years. Sneakers always go up', credit: 0.1, why: 'Only a small minority do. Most pairs end near or below retail once the hype passes.' },
            { label: 'Wait for the price to bounce before selling', credit: 0.2, why: 'Waiting for a bounce in a falling market is how sellers end up holding.' },
          ],
        }),
      () =>
        pick({
          brief: 'A friend suggests going big: take a $2,000 cash advance on a credit card, buy ten pairs at retail, and flip them all.',
          visual: <Cards cards={[{ icon: '💳', title: 'Cash advance', facts: [['Fee', '5% up front'], ['Interest', '29% a year, starting immediately'], ['Grace period', 'None']] }]} />,
          prompt: 'What is the main problem with the plan?',
          options: [
            { label: 'The debt is certain while the profit is not. If prices fall or pairs do not sell, you still owe $2,000 plus fees and interest', credit: 1, why: 'Borrowing turns a small loss into a debt problem. Cash advances are among the most expensive borrowing there is, with no interest-free period.' },
            { label: 'Ten pairs is too few to make it worthwhile', credit: 0, why: 'More pairs means more borrowed money at risk, not less.' },
            { label: 'Nothing, if you pick the right shoes', credit: 0.1, why: 'Nobody reliably picks the right shoes. Raffles, bots and changing tastes make it a gamble.' },
          ],
        }),
      () =>
        choose({
          brief: 'After six months, you add it all up.',
          prompt: 'Which two costs do new resellers forget most often?',
          k: 2,
          options: [
            { label: 'Fees and shipping on every sale', good: true, why: 'Easily 15% or more of every sale, as you found at the start.' },
            { label: 'Pairs that never sell, or sell below what you paid', good: true, why: 'Unsold stock is cash stuck in a box. One dud can wipe out the profit from three good flips.' },
            { label: 'The cost of the shoebox', good: false, why: 'The box comes with the shoes.' },
            { label: 'Sales tax on the resale app', good: false, why: 'The buyer pays that, not you.' },
          ],
        }),
      () =>
        pick({
          brief: 'The resale app emails you a tax form at the end of the year showing your total sales.',
          prompt: 'Is your sneaker profit taxable?',
          options: [
            { label: 'Yes. Profit from buying to resell is income. Keep records of what you paid so you are only taxed on the profit', credit: 1, why: 'The tax office gets the same form you do. Your purchase receipts and fees reduce the taxable amount, which is why keeping them matters.' },
            { label: 'No, it is just selling your own stuff', credit: 0.3, why: 'Selling old personal things at a loss is usually not taxed. Buying items specifically to resell for profit is a business.' },
            { label: 'Only if you sell more than 100 pairs', credit: 0, why: 'There is no pair limit. Profit is income from the first sale.' },
          ],
        }),
    ],
    alts: {
      0: [
        ({ s }) => {
          const sale = s.resale + 40;
          const keep = sale * (1 - 0.08 - 0.029) - 0.3 - 16;
          return dial({
            brief: `You bought the Kestrel 5 "Dune" at $210 retail. On a marketplace app, they are selling for ${usd(sale)}.`,
            visual: <Table head={['Marketplace fees (seller pays)', '']} rows={[['Selling fee', '8% of sale price'], ['Payment processing', '2.9% + $0.30'], ['Shipping label', '$16']]} />,
            prompt: 'If you sell at that price, what is your actual profit?',
            min: 0,
            max: 250,
            step: 1,
            answer: Math.round(keep - 210),
            tol: 3,
            fmt: (v) => usd(v),
            why: `Fees take 10.9% of ${usd(sale)} plus $0.30, about ${usd(sale * 0.109 + 0.3)}. Then $16 shipping and the $210 you paid leave ${usd(keep - 210)}. The headline gap was ${usd(sale - 210)}.`,
          });
        },
      ],
      1: [
        () =>
          flag({
            brief: 'You list a pair for $320. A buyer messages you within minutes.',
            prompt: 'Flag the messages that are signs of a scam.',
            doc: {
              title: 'Messages with buyer',
              sub: 'Today',
              skin: 'screen',
              lines: [
                { id: 'size', l: 'Hi! Are these still available in US 9?' },
                { id: 'over', l: 'I sent $420 by mistake, please refund the extra $100 to my cousin.' },
                { id: 'link', l: 'To receive payment, click this link and enter your card details.' },
                { id: 'ship', l: 'Please ship today, my payment will clear in a few days.' },
                { id: 'off', l: 'Can we finish this outside the app? Their fees are too high.' },
                { id: 'photo', l: 'Could you send a photo of the size tag?' },
              ],
            },
            issues: {
              over: 'The classic overpayment trick. The original payment bounces later, and the "refund" you sent is gone.',
              link: 'You never need to enter card details to receive money. This is a phishing link.',
              ship: 'Never ship before payment has truly cleared.',
              off: 'Leaving the app removes all seller protection.',
            },
            fine: {
              size: 'A normal question.',
              photo: 'A careful buyer checking details. Reasonable.',
            },
          }),
      ],
      2: [
        () =>
          pick({
            brief: 'You hold four pairs of a hyped shoe, now reselling at $290. The brand announces a big restock of the same pair next month.',
            prompt: 'What is likely to happen, and what do you do?',
            options: [
              { label: 'More pairs will push the resale price down, so sell now while it is still high', credit: 1, why: 'Prices depend on scarcity. A restock floods the market, and sellers who wait usually sell for less.' },
              { label: 'Hold; the restock will make the pair more popular', credit: 0.1, why: 'Popular, but no longer scarce. Buyers will just get them at retail.' },
              { label: 'Buy more at the restock to sell later', credit: 0.1, why: 'You would be buying more of something that just became common.' },
            ],
          }),
      ],
      3: [
        () =>
          pick({
            brief: 'A reseller group offers a sneaker bot for $300, plus a "cook group" with release tips for $40 a month. "Our members win way more raffles!"',
            prompt: 'What is the main problem?',
            options: [
              { label: 'The costs are certain and the wins are not. You need several profitable flips just to cover them', credit: 1, why: 'At around $60 profit a pair, the bot alone needs five good flips to pay off, before the monthly fee. Many shops also cancel bot orders.' },
              { label: 'Nothing; serious resellers all use them', credit: 0.2, why: 'Some do, but they still need enough wins to pay for the tools.' },
              { label: 'The bot is too cheap to work', credit: 0, why: 'Price is not the problem. Certain costs against uncertain wins is.' },
            ],
          }),
      ],
      4: [
        () =>
          choose({
            brief: 'You want buyers to trust your listings so pairs sell faster.',
            prompt: 'Which two habits help most?',
            k: 2,
            options: [
              { label: 'Clear photos of the actual pair, including the size tag and box label', good: true, why: 'Buyers fear fakes. Real photos of the real item answer that before they ask.' },
              { label: 'Selling through a platform with authentication or buyer protection', good: true, why: 'Protection on both sides makes buyers willing to pay a fair price.' },
              { label: 'Asking for payment by gift card', good: false, why: 'That is what scammers ask for. Honest buyers will walk away.' },
              { label: 'Using stock photos from the brand’s website', good: false, why: 'Stock photos are a classic sign of a fake listing.' },
            ],
          }),
      ],
      5: [
        () =>
          pick({
            brief: 'This year you sold 40 pairs for a total of $12,000. You paid $10,300 for them, and fees and shipping came to $800.',
            prompt: 'Roughly what amount is taxable income?',
            options: [
              { label: 'About $900: sales minus what you paid and your costs', credit: 1, why: 'Tax applies to profit. $12,000 − $10,300 − $800 = $900. Without receipts, you might be taxed on far more.' },
              { label: 'The full $12,000', credit: 0.1, why: 'That is your sales, not your profit. Records of costs bring the taxable figure down.' },
              { label: 'Nothing, since the profit is small', credit: 0, why: 'Small profits are still income.' },
            ],
          }),
      ],
    },
    takeaways: [
      'The real profit is the sale price minus fees, shipping and what you paid. Fees can eat 40% of the gap.',
      'Half-price deals, gift-card payment and rushed sellers are how resale scams work.',
      'Most hyped items lose value as hype fades. Sell into the excitement, not after it.',
      'Never borrow to buy stock you are not sure you can sell.',
    ],
  };
  return <CaseRunner def={def} seed={seed} onFinish={onFinish} addReview={addReview} />;
}
