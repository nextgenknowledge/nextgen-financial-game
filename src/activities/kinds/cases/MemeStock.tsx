'use client';
/**
 * Meme Stock Week (Advanced, Stock Exchange). Five trading days inside a hype cycle: read the
 * feed, decide how much to risk, decide when to get out, and see who ends up holding the bag.
 */
import type { KindProps } from '../../types';
import { C, LineChart, Table, usd } from '../pro/kit';
import { CaseRunner, Feed, dial, flag, pick, type CaseDef } from './kit';

interface S {
  cash: number;
  shares: number;
  cost: number;
  /** Closing prices, Friday before and then Monday to Friday. */
  px: number[];
  /** Profit locked in by selling. */
  realized: number;
  /** Which close the meters show. */
  day: number;
}

/** Mark which close the meters show; always true so it can lead an && chain. */
const at = (s: S, d: number): true => ((s.day = d), true);

const DAYS = ['Fri', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri'];

const buy = (amt: number) => (s: S) => {
  const n = Math.floor(amt / s.px[1]);
  s.shares += n;
  s.cost += n * s.px[1];
  s.cash -= n * s.px[1];
};

const sell = (frac: number, day: number) => (s: S) => {
  const n = Math.round(s.shares * frac);
  const avg = s.shares ? s.cost / s.shares : 0;
  s.cash += n * s.px[day];
  s.realized += n * (s.px[day] - avg);
  s.cost -= n * avg;
  s.shares -= n;
};

function Chart({ s, upTo }: { s: S; upTo: number }) {
  return <LineChart series={[{ pts: s.px.slice(0, upTo + 1), color: C.gold, label: 'GLMR' }]} fmt={(v) => usd(v, 2)} xLabel={DAYS.slice(0, upTo + 1).join(' · ')} h={180} />;
}

export default function MemeStock({ seed, onFinish, addReview }: KindProps) {
  const def: CaseDef<S> = {
    kicker: 'Stock Exchange · Meme stock week',
    init: (rng) => {
      const base = rng.pick([6, 7, 8]);
      const peak = rng.pick([3.6, 4, 4.4]);
      return { cash: 1000, shares: 0, cost: 0, realized: 0, day: 0, px: [base * 0.72, base, base * 1.55, base * 2.7, base * peak, base * rng.pick([1.3, 1.5, 1.7])].map((v) => Math.round(v * 100) / 100) };
    },
    meters: (s) => [
      ['Cash', usd(s.cash)],
      ['Shares of GLMR', String(s.shares)],
      ['GLMR price', usd(s.px[s.day], 2)],
    ],
    steps: [
      () =>
        flag({
          brief: 'Glimmer Home (GLMR) is a struggling furniture chain that lost money for three years. On Friday its stock jumped 40%, and on Sunday night your feed is full of it.',
          prompt: 'Flag the posts that are warning signs rather than information.',
          doc: {
            title: 'Trending: $GLMR',
            sub: 'Sunday 11:48 pm',
            skin: 'screen',
            lines: [
              { id: 'guar', l: '@rocketroy: GLMR to $100 is GUARANTEED. Shorts are trapped. This is free money.' },
              { id: 'short', l: '@datadana: Short interest in GLMR is 38% of shares available to trade, per the exchange report.' },
              { id: 'new', l: '@glmr_moon_2: Account created 3 days ago, 41 posts, all about GLMR.' },
              { id: 'paid', l: '@stockstarz: GLMR is my top pick!! (link in bio to my paid alerts group)' },
              { id: 'earn', l: '@newsdesk: Glimmer Home reports results on Thursday after the close.' },
              { id: 'never', l: '@diamondhandz: Anyone who sells is a traitor. We NEVER sell.' },
              { id: 'loss', l: '@glmr_ir: Glimmer lost $84 million last year on $1.1 billion of sales.' },
            ],
          },
          issues: {
            guar: 'Nothing in the stock market is guaranteed. Certainty is the language of a pitch, not a fact.',
            new: 'Brand-new accounts that post about one stock are how coordinated promotions look.',
            paid: 'The poster earns money if you follow them. That is an advertisement, not research.',
            never: 'A crowd that shames anyone for selling needs new buyers to keep the price up. Ask who sells to you.',
          },
          fine: {
            short: 'A real, checkable number. Heavy short interest is exactly why a squeeze is possible, and also why it can unwind fast.',
            earn: 'A dated, factual event. Results can move the stock sharply either way.',
            loss: 'An unpleasant fact, but a fact. It is the company you would actually own.',
          },
        }),
      ({ s }) =>
        at(s, 1) &&
        pick({
          brief: `Monday. GLMR opens at ${usd(s.px[1], 2)}. You have $1,000 saved from a summer job, and you will need $600 of it for a laptop in September.`,
          visual: <Chart s={s} upTo={1} />,
          prompt: 'How much do you put into GLMR?',
          ordered: true,
          options: [
            { label: 'Nothing. I will watch.', credit: 0.8, why: 'Perfectly sound. Watching a hype cycle from the outside teaches most of the lesson for free.' },
            { label: '$100, money I can afford to lose completely', credit: 1, why: 'Speculation is fine at a size where losing it all stings but changes nothing. The laptop money is untouchable.', apply: buy(100) },
            { label: '$400, everything except the laptop money', credit: 0.4, why: 'At least the laptop is safe, but 40% of your savings is now riding on a company that loses money.', apply: buy(400) },
            { label: 'All $1,000. Fortune favors the bold', credit: 0, why: 'Money with a job to do in September does not belong in the most volatile stock in the market this week.', apply: buy(1000) },
          ],
        }),
      ({ s }) =>
        at(s, 3) && s.shares > 0
          ? dial({
              brief: `Wednesday close: ${usd(s.px[3], 2)}. Your feed is euphoric.`,
              visual: <Chart s={s} upTo={3} />,
              prompt: `You own ${s.shares} shares bought at ${usd(s.px[1], 2)}. What are they worth now?`,
              min: 0,
              max: Math.ceil((s.shares * s.px[3] * 2) / 50) * 50,
              step: 5,
              answer: Math.round(s.shares * s.px[3]),
              tol: Math.max(10, Math.round(s.shares * s.px[3] * 0.03)),
              fmt: (v) => usd(v),
              why: `${s.shares} × ${usd(s.px[3], 2)} = ${usd(s.shares * s.px[3])}, a paper gain of ${usd(s.shares * (s.px[3] - s.px[1]))}. Paper gains are only real once you sell.`,
            })
          : pick({
              brief: `Wednesday close: ${usd(s.px[3], 2)}. Friends who bought on Monday are up ${Math.round((s.px[3] / s.px[1] - 1) * 100)}% and texting you screenshots.`,
              visual: <Chart s={s} upTo={3} />,
              prompt: 'Do you jump in now?',
              options: [
                { label: 'No. Buying after a stock has nearly tripled in three days is buying from people taking profits', credit: 1, why: 'Every share you buy is one someone else sells. On day three, the sellers are the early buyers cashing out.' },
                { label: 'Yes, with $100 I can afford to lose', credit: 0.6, why: 'The size is sensible, but the timing is the worst of the week so far. FOMO is a feeling, not a signal.', apply: (st) => { const n = Math.floor(100 / st.px[3]); st.shares += n; st.cost += n * st.px[3]; st.cash -= n * st.px[3]; } },
                { label: 'Yes, $500. It is clearly going higher', credit: 0, why: 'Nothing about a price that has already moved 170% makes it "clearly" go higher.', apply: (st) => { const n = Math.floor(500 / st.px[3]); st.shares += n; st.cost += n * st.px[3]; st.cash -= n * st.px[3]; } },
              ],
            }),
      ({ s }) =>
        at(s, 4) &&
        pick({
          brief: `Thursday afternoon: ${usd(s.px[4], 2)}, up ${Math.round((s.px[4] / s.px[1] - 1) * 100)}% on the week. Results come out after the close tonight. Nothing about the furniture business has changed.`,
          visual: <Chart s={s} upTo={4} />,
          prompt: s.shares > 0 ? 'What do you do before the close?' : 'Your friend asks what you would do with their shares. What do you say?',
          options: [
            { label: 'Sell enough to get my original money back, and let the rest ride', credit: 1, why: 'Taking your stake off the table means the worst case is now zero loss. What is left is pure upside, played with house money.', apply: s.shares > 0 ? (st) => sell(Math.min(1, st.cost / (st.shares * st.px[4])), 4)(st) : undefined },
            { label: 'Sell everything', credit: 0.9, why: 'A clean exit with a large gain. You may leave some upside behind, and that is fine.', apply: s.shares > 0 ? sell(1, 4) : undefined },
            { label: 'Hold everything. We are going to the moon', credit: 0.2, why: 'The price now depends on new buyers arriving faster than old ones leave. That cannot last, and nobody rings a bell at the top.' },
            { label: 'Buy more before results', credit: 0, why: 'Adding at the peak of a hype cycle, right before an event that could go either way, is the riskiest move on the board.', apply: s.shares > 0 ? (st) => { const n = Math.floor(Math.min(st.cash, 200) / st.px[4]); st.shares += n; st.cost += n * st.px[4]; st.cash -= n * st.px[4]; } : undefined },
          ],
        }),
      ({ s }) =>
        at(s, 5) &&
        pick({
          brief: `Friday. Glimmer reported another loss and announced it will sell 50 million new shares to raise cash. GLMR closes at ${usd(s.px[5], 2)}, down ${Math.round((1 - s.px[5] / s.px[4]) * 100)}% from Thursday.`,
          visual: (
            <>
              <Chart s={s} upTo={5} />
              <Feed posts={[{ who: 'diamondhandz', text: 'Buy the dip!! They want you to panic. HOLD.', meta: '2.1k likes' }, { who: 'rocketroy', text: 'Still guaranteed. Shorts are lying.', meta: '640 likes' }]} />
            </>
          ),
          prompt: 'Who lost the most money this week?',
          options: [
            { label: 'People who bought on Wednesday and Thursday because the price was rising', credit: 1, why: 'Late buyers paid peak prices to early buyers. A hype cycle moves money from people who arrive last to people who arrived first.' },
            { label: 'Short sellers', credit: 0.3, why: 'Shorts who covered at the peak lost heavily, but many held on and are now winning. The late retail buyers had no way out.' },
            { label: 'Glimmer Home itself', credit: 0.2, why: 'The company actually benefited: it is selling new shares at a price far above what the business is worth.' },
            { label: 'Nobody. Losses only count when you sell', credit: 0, why: 'A share bought at $30 that is now worth $10 has lost $20 whether or not you click Sell. The loss is real; only the tax treatment waits.' },
          ],
        }),
      ({ s }) =>
        pick({
          brief: s.realized > 0 ? `You sold shares this week for a profit of ${usd(s.realized)}, days after buying them.` : 'Your friend sold on Thursday for a $300 profit, five days after buying. They ask about tax.',
          visual: <Table head={['Gain on shares held', 'Taxed as']} rows={[['One year or less', 'Short-term: ordinary income, at your normal rate'], ['More than one year', 'Long-term: lower rates, often 0% for low incomes']]} />,
          prompt: 'How is that profit taxed?',
          options: [
            { label: 'As a short-term capital gain, taxed like wages. Keep some aside', credit: 1, why: 'Profits on shares held a year or less are taxed at your ordinary income rate. Trading gains are real income, and the bill arrives in April.' },
            { label: 'Not at all, because it is under $1,000', credit: 0, why: 'There is no small-gains exemption. Every realized gain is reportable, and the broker sends the tax office a copy.' },
            { label: 'At the long-term rate, which is lower', credit: 0.2, why: 'Long-term rates need more than a year of holding. Five days is the definition of short-term.' },
            { label: 'Only if it is moved to a bank account', credit: 0, why: 'The gain is taxed when the shares are sold, not when the cash leaves the brokerage.' },
          ],
        }),
    ],
    alts: {
      0: [
        () =>
          flag({
            brief: 'Glimmer Home (GLMR), a furniture chain that has lost money for three years, jumped 40% on Friday. By Sunday night, a video platform is full of it.',
            prompt: 'Flag the posts that are warning signs rather than information.',
            doc: {
              title: 'Top videos: GLMR',
              sub: 'Sunday 10:15 pm',
              skin: 'screen',
              lines: [
                { id: 'mill', l: '"How I will turn $500 into $50,000 with GLMR this week" (2.4M views)' },
                { id: 'debt', l: 'Glimmer Home has $600 million of debt due within two years, per its annual report.' },
                { id: 'code', l: '"Use my code at TradeZap for a free share!" (in every GLMR video by this creator)' },
                { id: 'vol', l: 'GLMR traded 90 million shares on Friday, ten times its normal amount.' },
                { id: 'rich', l: '"Buy now or stay poor forever. Last chance."' },
                { id: 'ceo', l: 'Glimmer’s CEO sold 200,000 shares on Friday, per a public filing.' },
              ],
            },
            issues: {
              mill: 'A promise to multiply money 100 times in a week is a fantasy built for views.',
              code: 'The creator earns a referral fee when you sign up. They profit whether GLMR rises or falls.',
              rich: 'Fear and urgency are pressure tactics, not analysis.',
            },
            fine: {
              debt: 'A real, checkable fact about the business, and a worrying one.',
              vol: 'A real number showing how much attention the stock is getting.',
              ceo: 'A public filing. Insiders selling into a spike is worth knowing.',
            },
          }),
      ],
      1: [
        ({ s }) =>
          at(s, 1) &&
          pick({
            brief: `Monday. GLMR opens at ${usd(s.px[1], 2)}. You have $1,000 in savings. $700 of it is for your car insurance, due in six weeks.`,
            visual: <Chart s={s} upTo={1} />,
            prompt: 'How much do you put into GLMR?',
            ordered: true,
            options: [
              { label: 'Nothing. I will watch.', credit: 0.8, why: 'Sound. You learn most of the lesson without risking a dollar.' },
              { label: '$100, money I can afford to lose', credit: 1, why: 'A small bet you could lose without missing the insurance payment.', apply: buy(100) },
              { label: '$300, all of my spare money', credit: 0.4, why: 'The insurance money is safe, but all your spare money now depends on one hyped stock.', apply: buy(300) },
              { label: 'All $1,000; I will win the insurance money back', credit: 0, why: 'If it falls, you cannot pay for insurance, and driving uninsured is illegal.', apply: buy(1000) },
            ],
          }),
      ],
      2: [
        ({ s }) =>
          at(s, 3) && s.shares > 0
            ? dial({
                brief: `Wednesday close: ${usd(s.px[3], 2)}. You bought at ${usd(s.px[1], 2)} on Monday.`,
                visual: <Chart s={s} upTo={3} />,
                prompt: 'By what percentage are your shares up?',
                min: 0,
                max: 300,
                step: 1,
                answer: Math.round((s.px[3] / s.px[1] - 1) * 100),
                tol: 2,
                fmt: (v) => `${v}%`,
                why: `(${usd(s.px[3], 2)} − ${usd(s.px[1], 2)}) ÷ ${usd(s.px[1], 2)} ≈ ${Math.round((s.px[3] / s.px[1] - 1) * 100)}%. A gain that fast can disappear just as fast.`,
              })
            : pick({
                brief: `Wednesday close: ${usd(s.px[3], 2)}. A classmate shows you a video: "GLMR is only getting started."`,
                visual: <Chart s={s} upTo={3} />,
                prompt: 'What is the best question to ask yourself before buying now?',
                options: [
                  { label: 'Who is selling to me at this price, and why are they happy to sell?', credit: 1, why: 'Every buyer needs a seller. After a huge run, sellers are often early buyers locking in profits.' },
                  { label: 'How high could it go?', credit: 0.1, why: 'Dreaming about the top is how people buy near it.' },
                  { label: 'How many views does the video have?', credit: 0, why: 'Popularity is not value.' },
                ],
              }),
      ],
      3: [
        ({ s }) =>
          at(s, 4) &&
          pick({
            brief: `Thursday afternoon: ${usd(s.px[4], 2)}. Results come out tonight. A friend who trades suggests a rule: sell half now, and sell the rest if it ever drops 20% from its high.`,
            visual: <Chart s={s} upTo={4} />,
            prompt: s.shares > 0 ? 'What do you do?' : 'Your cousin owns GLMR and asks your opinion. What do you say?',
            options: [
              { label: 'Sell half now and follow the rule for the rest', credit: 1, why: 'A rule made in advance protects you from deciding in a panic. Half locks in gains; the rest keeps some upside.', apply: s.shares > 0 ? sell(0.5, 4) : undefined },
              { label: 'Sell everything now', credit: 0.9, why: 'A clean exit with a big gain. Nothing wrong with that.', apply: s.shares > 0 ? sell(1, 4) : undefined },
              { label: 'Hold everything through results', credit: 0.2, why: 'Results on a money-losing company could send it either way. You would be betting the whole gain on one night.' },
              { label: 'Buy more before results', credit: 0, why: 'Adding at the peak right before uncertain news is the riskiest move available.', apply: s.shares > 0 ? (st) => { const n = Math.floor(Math.min(st.cash, 200) / st.px[4]); st.shares += n; st.cost += n * st.px[4]; st.cash -= n * st.px[4]; } : undefined },
            ],
          }),
      ],
      4: [
        ({ s }) =>
          at(s, 5) &&
          pick({
            brief: `Friday. Glimmer announced it will sell 50 million new shares to raise cash. GLMR closes at ${usd(s.px[5], 2)}, down ${Math.round((1 - s.px[5] / s.px[4]) * 100)}% from Thursday.`,
            visual: <Chart s={s} upTo={5} />,
            prompt: 'Why does selling new shares push the price down?',
            options: [
              { label: 'More shares now split the same business, so each one owns a smaller slice', credit: 1, why: 'This is dilution. The company gets cash, but each existing share represents less of the company.' },
              { label: 'Selling shares is illegal during a squeeze', credit: 0, why: 'It is legal, and companies often raise money when their price is high.' },
              { label: 'It does not affect the price', credit: 0, why: 'More supply of shares, with the same business behind them, usually pushes the price down.' },
            ],
          }),
      ],
      5: [
        () =>
          pick({
            brief: 'Your friend bought GLMR on Thursday and is now down $250. Earlier this year they made a $400 profit selling another stock.',
            visual: <Table head={['This year', 'Amount']} rows={[['Gain on another stock', '+$400'], ['Loss on GLMR if sold now', '−$250']]} />,
            prompt: 'If they sell GLMR this year, how does the loss affect their taxes?',
            options: [
              { label: 'The loss offsets part of the gain, so they are taxed on about $150 of net gain', credit: 1, why: 'Realized losses reduce realized gains in the same year. A loss is never good, but it does lower the tax bill.' },
              { label: 'Losses do not matter for tax', credit: 0, why: 'They do. Losses offset gains, and some can offset other income.' },
              { label: 'They pay tax on the full $400 anyway', credit: 0.1, why: 'Only the net gain, after losses, is taxed.' },
            ],
          }),
      ],
    },
    outcome: (s) => {
      const end = s.cash + s.shares * s.px[5];
      const r = end - 1000;
      return {
        headline: r > 0 ? `Up ${usd(r)} on the week` : r < 0 ? `Down ${usd(-r)} on the week` : 'Sat it out, money intact',
        bonus: s.cost === 0 ? 3 : r >= 0 ? 5 : r > -150 ? 0 : -8,
        detail: (
          <>
            <h4>The week in one chart</h4>
            <Chart s={s} upTo={5} />
            <p className="small" style={{ margin: 0 }}>
              You end with {usd(end)}
              {s.shares > 0 ? `, including ${s.shares} shares still worth ${usd(s.shares * s.px[5])}` : ''}. The business never changed; only the crowd did.
            </p>
          </>
        ),
      };
    },
    takeaways: [
      'In a hype cycle, money moves from the last buyers to the first ones.',
      'Speculate only with money that has no other job. Size the bet so losing it all changes nothing.',
      'Take your original stake off the table once it has multiplied. Nobody rings a bell at the top.',
      'Posts that promise certainty, shame sellers or sell alerts are marketing, not research.',
    ],
  };
  return <CaseRunner def={def} seed={seed} onFinish={onFinish} addReview={addReview} />;
}
