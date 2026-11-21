'use client';
/**
 * Which Company Would You Own? (Advanced, Brokerage). Two fictional companies, their stories and
 * a handful of numbers. No formulas to recall: read what the numbers say about the business, see
 * through the spin, and decide what you would actually be buying.
 */
import type { KindProps } from '../../types';
import { Table, usd } from '../pro/kit';
import { CaseRunner, Cards, Say, choose, dial, flag, pick, type CaseDef } from './kit';

interface S {
  cash: number;
  burn: number;
}

export default function WhichCompany({ seed, onFinish, addReview }: KindProps) {
  const def: CaseDef<S> = {
    kicker: 'Brokerage · Which company would you own?',
    init: (rng) => ({ cash: rng.pick([240, 300, 360]), burn: rng.pick([20, 25, 30]) }),
    steps: [
      ({ s }) =>
        pick({
          brief: 'Your grandparents gave you $1,000 to invest for at least ten years. The broker narrows it to two companies.',
          visual: (
            <Cards
              cards={[
                { icon: '🥤', title: 'Crisp Cola', sub: 'Drinks sold in 140 countries', facts: [['Sales growth', '3% a year'], ['Profit on each $1 of sales', '18¢'], ['Pays a dividend', 'Yes, for 40 years'], ['Price vs. yearly profit', '22 times']] },
                { icon: '🛴', title: 'Orbit Scooters', sub: 'E-scooter rentals in 30 cities', facts: [['Sales growth', '60% a year'], ['Profit on each $1 of sales', '-25¢ (a loss)'], ['Pays a dividend', 'No'], ['Price vs. yearly sales', '12 times']] },
              ]}
            />
          ),
          prompt: 'Which statement is most accurate?',
          options: [
            { label: 'Crisp is the steadier bet; Orbit could be worth far more or nothing, and its price already assumes years of success', credit: 1, why: 'Orbit is priced at 12 times its sales while losing money, so the market already expects it to win. It can still do well, but it has to beat a high bar. Crisp is priced for slow, dependable growth.' },
            { label: 'Orbit, because growth is what makes stocks go up', credit: 0.3, why: 'Growth matters, but you also pay for it. When the price already assumes great growth, merely good growth makes the stock fall.' },
            { label: 'Crisp, because companies that lose money are always bad investments', credit: 0.4, why: 'Many great companies lost money for years while they grew. The question is whether the losses are shrinking and how long the cash lasts.' },
            { label: 'They are the same; it is luck either way', credit: 0, why: 'The numbers describe two very different risks. That is the whole point of reading them.' },
          ],
        }),
      ({ s }) =>
        dial({
          brief: `Orbit has ${usd(s.cash)} million in the bank and loses about ${usd(s.burn)} million a month running the business.`,
          prompt: 'How many months can Orbit keep going without raising more money?',
          min: 0,
          max: 36,
          step: 1,
          answer: Math.round(s.cash / s.burn),
          tol: 0.5,
          fmt: (v) => `${v} months`,
          why: `${usd(s.cash)}M ÷ ${usd(s.burn)}M a month is ${Math.round(s.cash / s.burn)} months of runway. Before it runs out, Orbit must become profitable, borrow, or sell new shares, which shrinks the slice owned by everyone already holding the stock.`,
        }),
      () =>
        flag({
          brief: 'Orbit releases its quarterly results. Companies write these to make themselves look good.',
          prompt: 'Flag the lines that are spin: true, but chosen to make things sound better than they are.',
          doc: {
            title: 'Orbit Scooters: Q3 Results',
            sub: 'For immediate release',
            skin: 'paper',
            lines: [
              { id: 'rev', l: 'Revenue grew 58% from the same quarter last year, to $96 million.' },
              { id: 'ebitda', l: 'Record "adjusted" profit of $4 million, excluding stock pay, scooter wear and interest.' },
              { id: 'riders', l: '12 million riders, counting everyone who has ever unlocked a scooter.' },
              { id: 'loss', l: 'Net loss of $71 million, compared with $80 million a year ago.' },
              { id: 'tam', l: 'Our market opportunity is $1 trillion: all urban transportation worldwide.' },
              { id: 'cash', l: 'Cash at the end of the quarter was $300 million.' },
            ],
          },
          issues: {
            ebitda: '"Adjusted" profit leaves out real costs. Scooters wear out and employees are paid in stock; ignoring both turns a large loss into a small profit.',
            riders: 'Everyone who ever tried it once is not a customer. The useful number is active riders each month.',
            tam: 'Every taxi, train and car is not Orbit’s market. Huge market claims make any company sound small and early.',
          },
          fine: {
            rev: 'A standard, comparable figure. It is genuinely good news.',
            loss: 'The real bottom line, stated plainly. Shrinking losses are progress.',
            cash: 'A plain fact, and the most important one for runway.',
          },
        }),
      () =>
        pick({
          brief: 'Next quarter, Crisp Cola reports that profit rose 8%. The stock falls 6% the same morning.',
          visual: <Say who="Market news">Analysts had expected profit to rise 12%. Crisp also said next year will be slower.</Say>,
          prompt: 'Why would a stock fall on rising profit?',
          options: [
            { label: 'The price already assumed more. Stocks move on the gap between results and expectations', credit: 1, why: 'Investors had priced in 12% growth. 8% is a disappointment against that, and the warning about next year matters more than the past quarter.' },
            { label: 'Short sellers pushed it down', credit: 0.1, why: 'Possible on any day, but the explanation is right there: results missed what was expected.' },
            { label: 'Markets are random, so there is no reason', credit: 0.2, why: 'Daily moves are noisy, but a 6% drop on results day has a clear cause.' },
            { label: 'Profit rising is bad for a stock', credit: 0, why: 'Rising profit is good. Rising less than everyone assumed is what hurts.' },
          ],
        }),
      () =>
        choose({
          brief: 'Before you invest, you can ask the company’s investor relations team two questions.',
          prompt: 'Which two would tell you the most about Orbit?',
          k: 2,
          options: [
            { label: 'How many riders used Orbit last month, and how is that changing?', good: true, why: 'Active use shows whether people keep coming back. Lifetime sign-ups can only ever go up.' },
            { label: 'Does each ride make money once the scooter, charging and repairs are paid for?', good: true, why: 'If every ride loses money, growth makes the losses bigger. If each ride makes money, scale can fix the rest.' },
            { label: 'What is your stock price target?', good: false, why: 'Companies do not set price targets, and their opinion of their own stock is not evidence.' },
            { label: 'Which celebrities ride your scooters?', good: false, why: 'Marketing reach says nothing about whether the business can pay for itself.' },
            { label: 'How big is the urban transportation market?', good: false, why: 'You already know the answer will be "enormous". It tells you nothing about Orbit.' },
          ],
        }),
      () =>
        pick({
          brief: 'Orbit runs low on cash and sells 25 million new shares. Before the sale there were 100 million shares, and you owned 20 of them.',
          visual: <Table head={['', 'Before', 'After']} rows={[['Total shares', '100 million', '125 million'], ['Your shares', '20', '20'], ['Cash in the company', 'Almost none', '+ $250 million']]} />,
          prompt: 'What happened to you?',
          options: [
            { label: 'You own a smaller slice of a company that is now better funded. Whether that is good depends on the price of the new shares', credit: 1, why: 'This is dilution: your 20 shares now represent 20% less of the company. If the new money keeps Orbit alive and growing, a smaller slice of a bigger, safer pie can still be worth more.' },
            { label: 'Nothing. You still have 20 shares', credit: 0, why: 'The number of shares stayed the same; the share of the company they represent fell by a fifth.' },
            { label: 'You lost 25% of your money', credit: 0.2, why: 'Your slice shrank, but the company also received $250 million. Value depends on what that cash does.' },
            { label: 'The company must buy your shares back', credit: 0, why: 'No such duty exists. Shareholders bear dilution when a company needs money.' },
          ],
        }),
      () =>
        pick({
          brief: 'Decision day for your $1,000.',
          prompt: 'Which plan best fits a ten-year goal?',
          options: [
            { label: 'Most of it in a low-cost index fund, with a small slice in whichever company you understand best', credit: 1, why: 'The fund spreads your money across hundreds of companies, so one mistake cannot sink you. A small single-stock slice keeps the learning without the risk of the whole gift.' },
            { label: 'All $1,000 in Orbit for the biggest upside', credit: 0.2, why: 'It could work. It could also go to zero, and one company’s survival is a lot to bet ten years on.' },
            { label: 'All $1,000 in Crisp for safety', credit: 0.6, why: 'Steady, but still one company. "Safe" single stocks have fallen hard before when their industry changed.' },
            { label: 'Half in each, so you are diversified', credit: 0.5, why: 'Two stocks is not diversification. Two companies can both disappoint in the same decade.' },
          ],
        }),
    ],
    alts: {
      0: [
        () =>
          pick({
            brief: 'You have $1,000 from a summer job to invest for at least ten years. You are choosing between two companies.',
            visual: (
              <Cards
                cards={[
                  { icon: '💡', title: 'Steady Grid', sub: 'Electricity for 4 million homes', facts: [['Sales growth', '2% a year'], ['Profit on each $1 of sales', '12¢'], ['Pays a dividend', 'Yes, for 60 years'], ['Price vs. yearly profit', '17 times']] },
                  { icon: '🩺', title: 'Helix Bio', sub: 'One drug in final trials', facts: [['Sales', 'None yet'], ['Profit', 'A loss every year'], ['Pays a dividend', 'No'], ['Next big news', 'Trial results in 6 months']] },
                ]}
              />
            ),
            prompt: 'Which statement is most accurate?',
            options: [
              { label: 'Steady Grid is predictable; Helix depends almost entirely on one trial result and could double or collapse', credit: 1, why: 'Helix has a single make-or-break event ahead. A failed trial can wipe out most of the value in a day. Steady Grid is slow, regulated and dull, which is the point.' },
              { label: 'Helix, because medicine is a growing industry', credit: 0.3, why: 'A growing industry does not make one company with one drug a safe bet.' },
              { label: 'Steady Grid, because dividend payers never fall', credit: 0.3, why: 'Dividend payers can and do fall, and dividends can be cut.' },
              { label: 'There is no way to tell them apart', credit: 0, why: 'The numbers describe two very different risks.' },
            ],
          }),
      ],
      1: [
        ({ s }) =>
          dial({
            brief: `Hearth Foods shares cost ${usd(s.cash / 4)} each. Last year the company earned $3 of profit for every share.`,
            prompt: 'How many years of current profit are you paying for? (Price ÷ profit per share)',
            min: 0,
            max: 60,
            step: 1,
            answer: s.cash / 12,
            tol: 0.5,
            fmt: (v) => `${v} times`,
            why: `${usd(s.cash / 4)} ÷ $3 is ${s.cash / 12}. That is the price-to-earnings ratio. A high number means investors expect profits to grow; a low one means they expect little growth or see risk.`,
          }),
      ],
      2: [
        () =>
          flag({
            brief: 'Glow Cosmetics publishes its yearly letter to shareholders. Companies write these to make themselves look good.',
            prompt: 'Flag the lines that are spin: true, but chosen to make things sound better than they are.',
            doc: {
              title: 'Glow Cosmetics: Letter to Shareholders',
              sub: 'Annual report',
              skin: 'paper',
              lines: [
                { id: 'sales', l: 'Sales were $820 million, down 4% from last year.' },
                { id: 'best', l: 'Our best-ever fourth quarter for online sales in Canada.' },
                { id: 'excl', l: 'Excluding our three weakest product lines, sales grew 9%.' },
                { id: 'debt', l: 'Debt rose to $410 million to fund store openings.' },
                { id: 'fans', l: 'We have 30 million social media followers who love the brand.' },
                { id: 'div', l: 'The dividend stays at 40¢ a share.' },
              ],
            },
            issues: {
              best: 'A record in one small region and channel can hide a decline everywhere else.',
              excl: 'Leaving out the bad parts makes any business look like it is growing.',
              fans: 'Followers are not customers, and "love" is not a number.',
            },
            fine: {
              sales: 'The plain total, stated honestly, even though it is bad news.',
              debt: 'A clear fact investors need to judge risk.',
              div: 'A plain statement of what shareholders receive.',
            },
          }),
      ],
      3: [
        () =>
          pick({
            brief: 'Orbit Scooters reports a $60 million loss for the quarter. Its stock rises 15% that morning.',
            visual: <Say who="Market news">Analysts had expected a loss of $85 million. Orbit also said rides per scooter are rising.</Say>,
            prompt: 'Why would a stock rise on a big loss?',
            options: [
              { label: 'The loss was smaller than expected and the outlook improved. Stocks move on the gap between results and expectations', credit: 1, why: 'Investors had priced in a worse result. Beating that, plus a better sign for the future, lifted the price.' },
              { label: 'Losses are good for a stock', credit: 0, why: 'Losses are still bad. Smaller-than-expected losses are a pleasant surprise.' },
              { label: 'It was random', credit: 0.2, why: 'Daily moves are noisy, but a 15% jump on results day has a clear cause.' },
            ],
          }),
      ],
      4: [
        () =>
          choose({
            brief: 'Before you invest in Crisp Cola, you can ask the company two questions.',
            prompt: 'Which two would tell you the most?',
            k: 2,
            options: [
              { label: 'How are sales changing as people cut back on sugary drinks?', good: true, why: 'The biggest risk to a steady company is its main market slowly shrinking.' },
              { label: 'How much of each year’s profit goes to the dividend?', good: true, why: 'If the dividend uses up nearly all the profit, it may be cut in a bad year.' },
              { label: 'What is your favorite flavor?', good: false, why: 'Fun, but not information.' },
              { label: 'Will the stock go up this year?', good: false, why: 'No company can answer that honestly.' },
              { label: 'How many countries sell your drinks?', good: false, why: 'You already know: 140. It tells you nothing new.' },
            ],
          }),
      ],
      5: [
        () =>
          pick({
            brief: 'You own 10 shares of Crisp Cola at $100 each. Crisp announces a 2-for-1 stock split: you now hold 20 shares at $50 each.',
            prompt: 'What happened to your investment?',
            options: [
              { label: 'Nothing changed. You own the same slice of the company, cut into more pieces', credit: 1, why: '10 × $100 and 20 × $50 are both $1,000. A split changes the size of each share, not what you own.' },
              { label: 'You doubled your shares, so you are richer', credit: 0, why: 'More shares at half the price is the same value.' },
              { label: 'You lost half your money, since the price halved', credit: 0, why: 'The price halved because each share is now half as big.' },
            ],
          }),
      ],
      6: [
        () =>
          pick({
            brief: 'A year later, your $1,000 in Orbit has doubled to $2,000. It is now most of your savings.',
            prompt: 'What is the most sensible move for a ten-year goal?',
            options: [
              { label: 'Sell part of it and move that money into a low-cost index fund, so one company is no longer most of your savings', credit: 1, why: 'This is rebalancing. It locks in some gains and lowers the chance that one company’s bad year sets you back a decade.' },
              { label: 'Buy more Orbit, since it is clearly a winner', credit: 0.1, why: 'Past gains do not predict future ones, and you would be even more concentrated.' },
              { label: 'Sell everything and keep it as cash', credit: 0.4, why: 'Safe from Orbit, but ten years in cash loses ground to inflation.' },
              { label: 'Do nothing and never look at it again', credit: 0.4, why: 'Calm is good, but letting one stock become most of your money is a risk worth fixing.' },
            ],
          }),
      ],
    },
    takeaways: [
      'A price includes expectations. A great company bought at a price that assumes perfection can still be a poor investment.',
      'Runway is cash divided by monthly losses. When it runs short, current owners usually get diluted.',
      '"Adjusted" numbers and huge market sizes are marketing. Find the plain net loss and the active customers.',
      'Stocks move on surprises, not on results alone.',
    ],
  };
  return <CaseRunner def={def} seed={seed} onFinish={onFinish} addReview={addReview} />;
}
