'use client';
/**
 * Crash Stories (Advanced, Quiz Tower). Each floor is a real market panic: tulips in 1637, the
 * 1929 crash, the dot-com bust, 2008 and the 2020 plunge. You make the call inside the moment,
 * then see what happened and the pattern that repeats.
 */
import type { KindProps } from '../../types';
import { C, LineChart, Table, usd } from '../pro/kit';
import { CaseRunner, Cards, Feed, Say, choose, dial, pick, type CaseDef } from './kit';

type S = Record<string, never>;

export default function CrashStories({ seed, onFinish, addReview }: KindProps) {
  const def: CaseDef<S> = {
    kicker: 'Quiz Tower · Crash stories',
    init: () => ({}),
    steps: [
      () =>
        pick({
          brief: 'Floor 1: Haarlem, the Netherlands, January 1637. In a tavern, traders buy and sell paper promises to deliver tulip bulbs next summer. The price of one rare bulb has risen about tenfold since November.',
          visual: <Say who="A trader at your table">Buy my contract today and sell it to someone else next week for more. Everyone is doing it.</Say>,
          prompt: 'What is really holding the price up?',
          options: [
            { label: 'The belief that someone else will pay even more later', credit: 1, why: 'Nobody was planting these bulbs for their flowers at that price. When buyers stopped turning up in February 1637, prices collapsed within days. Economists call it the greater-fool idea.' },
            { label: 'A shortage of tulips', credit: 0.3, why: 'Rare bulbs were scarce, but scarcity does not explain a tenfold rise in a few months. Tulips did not get ten times prettier.' },
            { label: 'Tulips were the best investment of their time', credit: 0, why: 'Many holders of contracts were left with promises nobody would honor.' },
          ],
        }),
      () =>
        dial({
          brief: 'Floor 2: New York, summer 1929. Your broker lets you buy $10,000 of stock with $1,000 of your own money. The broker lends you the other $9,000, which you must repay in full whatever happens.',
          visual: <Table head={['', 'Amount']} rows={[['Your money', '$1,000'], ['Borrowed from the broker', '$9,000'], ['Stock you own', '$10,000']]} />,
          prompt: 'The stock falls 10%. How much of your own $1,000 is left?',
          min: 0,
          max: 1000,
          step: 50,
          answer: 0,
          tol: 25,
          fmt: (v) => usd(v),
          why: 'The stock is now worth $9,000, exactly what you owe. A 10% fall wiped out 100% of your money. In October 1929, brokers demanded more cash from millions of borrowers at once, they were forced to sell, and the selling fed the crash.',
        }),
      () =>
        pick({
          brief: 'Still Floor 2. By 1930, rumors spread that banks are failing. Crowds line up to pull their savings out.',
          visual: <Cards cards={[{ icon: '🏦', title: 'Your bank in 1930', facts: [['Government insurance', 'None'], ['If it fails', 'Depositors may lose everything']] }, { icon: '🏦', title: 'Your bank today', facts: [['Government insurance', 'Up to $250,000 per depositor, per bank'], ['If it fails', 'Insured deposits are repaid']] }]} />,
          prompt: 'Why do bank runs hardly happen to ordinary savers today?',
          options: [
            { label: 'Deposit insurance, created in 1933, means insured savers get repaid even if the bank fails', credit: 1, why: 'Thousands of banks failed between 1930 and 1933. Once deposits were guaranteed, there was no reason to rush to the door, so the rush stopped.' },
            { label: 'Banks no longer lend out deposits', credit: 0, why: 'They still do; it is how banks earn money. The guarantee is what changed.' },
            { label: 'Banks today keep all money in a vault', credit: 0, why: 'Only a small share of deposits is ever held as cash.' },
          ],
        }),
      () =>
        dial({
          brief: 'Floor 3: March 2000. Companies with ".com" in their name double on their first day of trading, many with no profits. Over the next two and a half years, the tech-heavy stock index falls 78% from its peak.',
          visual: <LineChart series={[{ pts: [1000, 1800, 2700, 4000, 5000, 3600, 2400, 1900, 1400, 1100], color: C.red, label: 'Tech index' }]} xLabel="1998 to 2002" h={170} />,
          prompt: 'After a 78% fall, how much does the index have to rise to get back to its peak?',
          min: 0,
          max: 600,
          step: 5,
          answer: 355,
          tol: 15,
          fmt: (v) => `${v}%`,
          why: 'Only 22% of the value is left, and 22 must grow to 100: that is a 355% rise. Losses and gains are not symmetrical. The index took about 15 years to return to its 2000 high.',
        }),
      () =>
        pick({
          brief: 'Floor 4: 2006. Home prices have risen every year anyone can remember. Lenders offer loans with almost no checks.',
          visual: <Cards cards={[{ icon: '🏠', title: 'Loan A', sub: 'Fixed rate', facts: [['Rate', '6.5% for 30 years'], ['Payment', '$1,580, never changes']] }, { icon: '🏠', title: 'Loan B', sub: 'Teaser rate', tag: 'Popular', facts: [['Rate', '2% for 2 years, then about 8.5%'], ['Payment', '$920, then about $1,880']] }]} />,
          prompt: 'A buyer can only afford about $1,000 a month. Their broker recommends Loan B and says they can refinance before the rate jumps. What is the hidden bet?',
          options: [
            { label: 'That home prices keep rising, so a new loan is always available. When prices fell, millions could neither refinance nor sell', credit: 1, why: 'The whole plan depended on prices going up. US home prices fell about a quarter from 2006 to 2012, payments reset, and foreclosures spread into a global banking crisis.' },
            { label: 'That interest rates fall', credit: 0.4, why: 'Part of it, but the bigger bet was on house prices. Refinancing needs a home worth more than the loan.' },
            { label: 'There is no bet; refinancing is guaranteed', credit: 0, why: 'A lender decides whether to refinance. In 2008 most stopped saying yes.' },
          ],
        }),
      () =>
        pick({
          brief: 'Floor 5: March 23, 2020. A new virus has shut down cities. Stocks have fallen 34% in five weeks, the fastest crash on record. You are 17 and have $3,000 in an index fund for the long term.',
          visual: <Feed title="Your feed" posts={[{ who: 'Uncle Pete', text: 'Get OUT. This is the big one. Cash is king.', meta: '12 shares' }, { who: 'Finance teacher', text: 'Stay the course. Nobody can time the bottom.' }]} />,
          prompt: 'What do you do?',
          options: [
            { label: 'Hold, and keep adding a little each month as planned', credit: 1, why: 'The market hit bottom that very day and climbed back to a new high by August 2020. Selling turned a temporary drop into a permanent loss for many people.' },
            { label: 'Sell everything and buy back when it feels safe', credit: 0.1, why: 'It never feels safe at the bottom. Many who sold in March waited until prices were already higher than when they sold.' },
            { label: 'Put everything you have into stocks today', credit: 0.5, why: 'Bold, and in hindsight it worked. But you could not know that day was the bottom, and money you need soon should never go in.' },
          ],
        }),
      () =>
        choose({
          brief: 'Top floor. Look back at all five crashes.',
          prompt: 'Which two ingredients show up again and again?',
          k: 2,
          options: [
            { label: 'Borrowed money that forces people to sell when prices drop', good: true, why: 'Margin in 1929, teaser mortgages in 2008. Debt turns a fall into forced selling, which causes more falling.' },
            { label: 'A popular story that "this time is different"', good: true, why: 'Tulips were scarce forever, the internet changed everything, houses never fall. Each was partly true and fully overpriced.' },
            { label: 'A single villain who caused it', good: false, why: 'Crashes are crowd events. Villains make good headlines but rarely explain the size.' },
            { label: 'Bad weather', good: false, why: 'No crash here was caused by weather.' },
            { label: 'Stocks that pay dividends', good: false, why: 'Dividends had nothing to do with any of these bubbles.' },
          ],
        }),
    ],
    alts: {
      0: [
        () =>
          pick({
            brief: 'Floor 1: London, 1720. Shares in the South Sea Company, which holds a trade monopoly that has earned very little, have risen about eightfold in six months. New companies sell shares for schemes nobody fully explains.',
            visual: <Say who="A coffee-house broker">Everyone from dukes to servants is buying. The price only goes one way.</Say>,
            prompt: 'What is really holding the price up?',
            options: [
              { label: 'Excitement and the hope of selling to someone else at a higher price, not the company’s profits', credit: 1, why: 'The company’s trade earned little. When the rush stopped in late 1720, the shares lost most of their value within months, ruining many buyers.' },
              { label: 'The company’s huge trading profits', credit: 0.1, why: 'Its actual trade was small. The price had no connection to what it earned.' },
              { label: 'Rich people only buy good investments', credit: 0, why: 'Famous investors lost fortunes in this bubble too.' },
            ],
          }),
      ],
      1: [
        () =>
          dial({
            brief: 'Floor 2: New York, 1929. You buy $10,000 of stock with $2,000 of your own money and $8,000 borrowed from your broker, which you must repay in full.',
            visual: <Table head={['', 'Amount']} rows={[['Your money', '$2,000'], ['Borrowed from the broker', '$8,000'], ['Stock you own', '$10,000']]} />,
            prompt: 'The stock falls 15%. How much of your own $2,000 is left?',
            min: 0,
            max: 2000,
            step: 50,
            answer: 500,
            tol: 25,
            fmt: (v) => usd(v),
            why: 'The stock is now worth $8,500. After repaying $8,000 you have $500 left: a 15% fall cost you 75% of your money. Borrowing multiplies losses as well as gains.',
          }),
      ],
      2: [
        () =>
          pick({
            brief: 'A modern bank fails. Most of its customers are companies holding millions each, far above the $250,000 that deposit insurance covers per depositor, per bank. They rush to withdraw on the same day.',
            prompt: 'What is the lesson for an ordinary saver?',
            options: [
              { label: 'Keep savings within the insured limit at each bank, and insured money is safe even if the bank fails', credit: 1, why: 'Runs still happen where deposits are uninsured. For almost every individual, staying under the limit removes the reason to run.' },
              { label: 'Keep all your cash at home instead', credit: 0, why: 'Cash at home can be lost or stolen and is not insured at all.' },
              { label: 'Banks are no longer safe for anyone', credit: 0.1, why: 'Insured deposits were repaid. The risk was concentrated in large uninsured balances.' },
            ],
          }),
      ],
      3: [
        () =>
          dial({
            brief: 'Floor 3: From October 2007 to March 2009, a broad stock index falls about 57% during the financial crisis.',
            visual: <LineChart series={[{ pts: [1500, 1450, 1300, 1250, 1100, 900, 750, 680, 800, 1000], color: C.red, label: 'Stock index' }]} xLabel="2007 to 2009" h={170} />,
            prompt: 'After a 57% fall, how much does the index have to rise to get back to its peak?',
            min: 0,
            max: 400,
            step: 1,
            answer: 133,
            tol: 5,
            fmt: (v) => `${v}%`,
            why: '43% of the value is left, and 43 must grow to 100: a rise of about 133%. The broad index took about four years to recover.',
          }),
      ],
      4: [
        () =>
          pick({
            brief: 'Floor 4: 2005. A lender makes home loans without checking borrowers’ income, then sells the loans to big banks within weeks.',
            prompt: 'Why would a lender be so careless?',
            options: [
              { label: 'It earned a fee on each loan and passed the risk to someone else, so it did not care whether borrowers could repay', credit: 1, why: 'When the person approving a loan will not lose if it goes bad, checks get weaker. Those loans were bundled and sold around the world, spreading the damage in 2008.' },
              { label: 'Everyone always repays a home loan', credit: 0, why: 'Millions of people could not, once payments rose and prices fell.' },
              { label: 'The government required it', credit: 0.2, why: 'The main driver was profit: fees for making loans that someone else would hold.' },
            ],
          }),
      ],
      5: [
        () =>
          pick({
            brief: 'Floor 5: Monday, October 19, 1987. Stocks fall 22.6% in a single day, still the largest one-day percentage drop in US history. You hold an index fund for retirement, decades away.',
            visual: <Feed title="Evening news" posts={[{ who: 'Anchor', text: 'Panic on Wall Street. Some are comparing it to 1929.' }]} />,
            prompt: 'What do you do?',
            options: [
              { label: 'Hold and keep investing as planned', credit: 1, why: 'The market regained its pre-crash level within about two years. Long-term holders barely noticed it a decade later.' },
              { label: 'Sell before it gets worse', credit: 0.1, why: 'Selling after a record drop locks in the loss right when prices are lowest.' },
              { label: 'Borrow money to buy more', credit: 0.2, why: 'It would have worked this time, but borrowing to invest is how 1929 buyers were wiped out.' },
            ],
          }),
      ],
      6: [
        () =>
          choose({
            brief: 'Top floor. You have seen bubbles and crashes across 300 years.',
            prompt: 'Which two habits would have protected an ordinary investor in every one?',
            k: 2,
            options: [
              { label: 'Not borrowing to invest', good: true, why: 'Without debt, nobody can force you to sell at the bottom.' },
              { label: 'Spreading money widely and holding for the long term', good: true, why: 'A broad fund held for years survived every crash on this tower.' },
              { label: 'Buying whatever has risen the most recently', good: false, why: 'That is exactly how people bought at the top of each bubble.' },
              { label: 'Selling after every big fall', good: false, why: 'It turns temporary drops into permanent losses.' },
              { label: 'Following the crowd', good: false, why: 'The crowd is what inflates a bubble.' },
            ],
          }),
      ],
    },
    takeaways: [
      'Borrowing to invest magnifies losses as well as gains. A 10% fall can wipe out 100% of a margin buyer.',
      'A 50% loss needs a 100% gain to recover. Avoiding big losses matters more than catching big gains.',
      'Every bubble has a story about why this time is different.',
      'Long-term investors who held through 1987, 2008 and 2020 recovered. Sellers at the bottom often did not.',
    ],
  };
  return <CaseRunner def={def} seed={seed} onFinish={onFinish} addReview={addReview} />;
}
