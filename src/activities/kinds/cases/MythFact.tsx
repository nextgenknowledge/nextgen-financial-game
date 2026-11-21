'use client';
/**
 * Myth, Fact or It Depends (Advanced, Welcome Center). Money claims the way they show up in a
 * feed: confident, short and often wrong. Seven are drawn from the pool each run.
 */
import type { KindProps } from '../../types';
import { CaseRunner, Feed, pick, type CaseDef, type Post } from './kit';

type Verdict = 'fact' | 'myth' | 'depends';
interface Claim {
  post: Post;
  is: Verdict;
  /** A second verdict that earns half credit. */
  near?: Verdict;
  why: string;
}

const CLAIMS: Claim[] = [
  { post: { who: 'CreditKing', handle: '@creditking', text: 'Pro tip: always leave a small balance on your credit card. Paying it all off means the bureaus have nothing to score.', meta: '48.2k likes' }, is: 'myth', why: 'Your statement balance is reported whether or not you carry it past the due date. Paying in full builds the same history and costs no interest. Carrying a balance only pays the bank.' },
  { post: { who: 'Nia', handle: '@nia.saves', text: "Never check your credit score. Every time you look, it drops a few points.", meta: '3.1k likes' }, is: 'myth', why: 'Checking your own score is a soft inquiry and never changes it. Only hard inquiries, from applying for new credit, can shave a few points.' },
  { post: { who: 'HouseHacker', handle: '@househacker', text: 'Rent is throwing money away. Every month you rent, you are paying your landlord’s mortgage instead of your own.', meta: '112k likes' }, is: 'depends', near: 'myth', why: 'Rent buys housing and the freedom to move. Owning also has money that never comes back: loan interest, property tax, insurance, repairs and closing costs. Buying usually wins only if you stay several years.' },
  { post: { who: 'Tax Szn', handle: '@taxszn', text: 'Got a $2,400 refund!! The government basically paid me to file.', meta: '9.8k likes' }, is: 'myth', why: 'A refund is your own money. Too much was withheld from your paychecks, and the government held it for the year at zero interest.' },
  { post: { who: 'Marcus', handle: '@marcus_w', text: 'Turned down the raise. It would have pushed me into a higher tax bracket and I would take home LESS.', meta: '21k likes' }, is: 'myth', why: 'Brackets are marginal: only the dollars above the line are taxed at the higher rate. A raise never lowers take-home pay because of a bracket.' },
  { post: { who: 'StonksOnly', handle: '@stonksonly', text: 'Savings accounts are for losers. Stocks average 10% a year, so my whole emergency fund is in the market.', meta: '15k likes' }, is: 'myth', why: 'Stocks can fall 30% in the same months people lose their jobs. Emergency money has one job, to be there in full when needed. Long-term money goes in the market.' },
  { post: { who: 'Jo', handle: '@jo.b', text: 'I use my debit card for everything so I am building great credit.', meta: '860 likes' }, is: 'myth', why: 'Debit spending is your own money, so it is not reported to the credit bureaus. Only borrowing (cards, loans) and how you repay it builds a credit file.' },
  { post: { who: 'DealAlert', handle: '@dealalert', text: 'Careful with "no interest for 12 months" store cards. Be one dollar short at month 12 and they can bill you interest on the whole purchase, back to day one.', meta: '5.4k likes' }, is: 'fact', why: 'That is deferred interest, common on store financing. It is different from a true 0% APR card, where interest only starts on what is left.' },
  { post: { who: 'ReturnsDaily', handle: '@returnsdaily', text: 'This fund pays a guaranteed 2% every week with zero risk. If someone says that is a scam they just do not understand it.', meta: '2.2k likes', tone: 'ad' }, is: 'myth', why: 'Two percent a week is about 180% a year. Nothing safe pays that. "Guaranteed" plus "no risk" plus a huge return is the signature of a Ponzi scheme.' },
  { post: { who: 'Priya', handle: '@priya.invests', text: 'Someone who invests $100 a month from age 18 ends up with more at 65 than someone who invests $300 a month from age 38, at the same return.', meta: '31k likes' }, is: 'fact', why: 'At 7% a year the early starter reaches about $438,000 on $56,400 of deposits. The late starter puts in $97,200 and reaches about $287,000. Time does more work than the amount.' },
  { post: { who: 'Counselor Kim', handle: '@counselorkim', text: 'A college degree always pays for itself. Borrow whatever it takes.', meta: '4.0k likes' }, is: 'depends', near: 'myth', why: 'On average graduates earn far more, but the result depends on the cost, the major, and above all finishing. Debt without the degree is the worst outcome.' },
  { post: { who: 'Beginner Bull', handle: '@beginnerbull', text: 'You need at least a few thousand dollars before investing is even worth it.', meta: '1.7k likes' }, is: 'myth', why: 'Many brokers have no minimum and sell fractions of a share. $20 a month in a broad index fund is a real start, and the habit matters more than the amount.' },
  { post: { who: 'ScoreDoctor', handle: '@scoredoctor', text: 'Closing your oldest credit card can lower your credit score, even if you never use it.', meta: '6.6k likes' }, is: 'fact', why: 'Closing a card cuts your total credit limit, which raises your utilization, and in time it shortens your average account age. A no-fee old card is usually worth keeping open.' },
  { post: { who: 'Realtor Rick', handle: '@realtor.rick', text: 'A house is the best investment you can make. Prices only go up.', meta: '18k likes' }, is: 'myth', near: 'depends', why: 'Home prices fell about 30% nationally between 2006 and 2012, and a home also costs money every year to own. It can build wealth, but "only goes up" is how people get hurt.' },
  { post: { who: 'DebtFreeDee', handle: '@debtfreedee', text: 'Paying only the minimum on a $2,000 card balance at 24% APR can take more than 10 years to clear.', meta: '12k likes' }, is: 'fact', why: 'Minimums are set so that most of each payment covers interest. At 24% a balance that size can take well over a decade and cost more in interest than the original purchases.' },
  { post: { who: 'LuxeLife', handle: '@luxelife', text: 'Big salary = rich. If you earn six figures you are wealthy, period.', meta: '27k likes' }, is: 'myth', why: 'Wealth is net worth: what you own minus what you owe. A high earner with a big car loan, card debt and no savings can have a negative net worth.' },
  { post: { who: 'Budget Bea', handle: '@budgetbea', text: 'Everyone needs exactly 6 months of expenses saved before doing anything else.', meta: '3.9k likes' }, is: 'depends', near: 'fact', why: 'Three to six months is a common guide, but the right size depends on how steady your income is, who depends on you and any high-interest debt you should clear first.' },
  { post: { who: 'IndexIvy', handle: '@indexivy', text: 'Over 15 years, most professional stock pickers fail to beat a simple index fund.', meta: '8.1k likes' }, is: 'fact', why: 'Long-run studies find that around 9 in 10 actively managed large-company funds trail their index over 15 years, mostly because of higher fees.' },
  { post: { who: 'CoinCzar', handle: '@coinczar', text: 'Crypto is the perfect inflation hedge. When prices rise, it always rises more.', meta: '41k likes', tone: 'ad' }, is: 'myth', why: 'In 2022, inflation hit 40-year highs while the biggest cryptocurrencies fell more than 60%. It has not reliably moved with prices.' },
  { post: { who: 'Sam', handle: '@sam.helps', text: 'Co-signed my friend’s car loan. Worst case, it is his problem if he stops paying.', meta: '540 likes' }, is: 'myth', why: 'A co-signer owes the full debt. If your friend stops paying, the lender can come to you, and missed payments land on your credit report too.' },
  { post: { who: 'CarGuy', handle: '@carguy', text: 'Leasing a car is always throwing money away.', meta: '6.3k likes' }, is: 'depends', near: 'myth', why: 'Leasing usually costs more over many years, but it can suit someone who needs a reliable car for a short time or drives little. The answer depends on how long you keep cars and how far you drive.' },
  { post: { who: 'MathMoney', handle: '@mathmoney', text: 'At 3% inflation, cash under your mattress loses about half its buying power in 24 years.', meta: '14k likes' }, is: 'fact', why: 'The rule of 72: 72 ÷ 3 = 24 years for prices to double, which halves what the same cash can buy.' },
  { post: { who: 'SafeSavings', handle: '@safesavings', text: 'Anything you buy at a bank is insured, so you can never lose money there.', meta: '2.8k likes' }, is: 'myth', near: 'depends', why: 'Deposit insurance covers savings and checking up to a limit. Investments sold at a bank, like funds or shares, are not insured and can lose value.' },
  { post: { who: 'LuckyLou', handle: '@luckylou', text: 'Buying a few lottery tickets every week is my retirement plan. Someone has to win!', meta: '1.1k likes' }, is: 'myth', why: 'Lotteries pay back roughly half of what players spend, on average. The same weekly amount invested for decades would be worth far more for almost everyone.' },
  { post: { who: 'MoveSoon', handle: '@movesoon', text: 'If you might move in two years, renting is often the smarter money move.', meta: '4.4k likes' }, is: 'fact', near: 'depends', why: 'Buying and selling a home costs thousands in fees and taxes. Over a short stay, those costs usually outweigh any equity you build.' },
  { post: { who: 'ScoreTips', handle: '@scoretips', text: 'Asking for a higher credit limit can raise your score, as long as you do not spend more.', meta: '9.7k likes' }, is: 'fact', why: 'Utilization is your balance divided by your limit. A higher limit with the same spending lowers it, which helps your score.' },
  { post: { who: 'ShopNow', handle: '@shopnow', text: 'Pay-in-4 apps never touch your credit. Miss a payment, no big deal.', meta: '19k likes', tone: 'ad' }, is: 'myth', near: 'depends', why: 'More of these lenders now report to credit bureaus, and missed payments can bring late fees and be passed to debt collectors.' },
  { post: { who: 'Teen Investor', handle: '@teeninvestor', text: 'You cannot open a retirement account until you have a full-time job.', meta: '2.0k likes' }, is: 'myth', why: 'Anyone with earned income, even from a summer job, can contribute to an IRA. Under-18s can use a custodial account opened with a parent.' },
];

const LABEL: Record<Verdict, string> = { fact: 'Fact', myth: 'Myth', depends: 'It depends' };

export default function MythFact({ seed, onFinish, addReview }: KindProps) {
  const def: CaseDef<{ picked: Claim[] }> = {
    kicker: 'Welcome Center · Myth, fact or it depends',
    init: (rng) => ({ picked: rng.shuffle([...CLAIMS]).slice(0, 7) }),
    steps: Array.from({ length: 7 }, (_, i) => ({ s }: { s: { picked: Claim[] } }) => {
      const c = s.picked[i];
      return pick({
        brief: 'This just came up in your feed. Thousands of people liked it.',
        visual: <Feed posts={[c.post]} />,
        prompt: 'What is it?',
        ordered: true,
        options: (['fact', 'myth', 'depends'] as Verdict[]).map((v) => ({
          label: LABEL[v],
          credit: v === c.is ? 1 : v === c.near ? 0.5 : 0,
          why: v === c.is ? c.why : `It is closer to "${LABEL[c.is]}". ${c.why}`,
        })),
      });
    }),
    takeaways: [
      'Likes measure how confident a post sounds, not whether it is true.',
      'Ask who gains if you believe it: the bank, the seller, or the person posting.',
      '"Always" and "never" are warning words. Most real money answers depend on your numbers.',
      'When a claim is checkable (tax brackets, how scores work), check it once and you know it for life.',
    ],
  };
  return <CaseRunner def={def} seed={seed} onFinish={onFinish} addReview={addReview} />;
}
