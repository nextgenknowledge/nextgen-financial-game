'use client';
/**
 * Headline or Hype? (Advanced, Newsroom). A morning on the markets desk: separate news that moves
 * prices from clickbait, paid promotion and conflicts of interest, and put scary numbers in scale.
 */
import type { KindProps } from '../../types';
import { Table } from '../pro/kit';
import { CaseRunner, Cards, Feed, Say, dial, flag, pick, type CaseDef } from './kit';

interface S {
  from: number;
  to: number;
}

export default function HeadlineHype({ seed, onFinish, addReview }: KindProps) {
  const def: CaseDef<S> = {
    kicker: 'Newsroom · Headline or hype?',
    init: (rng) => {
      const from = rng.pick([48, 52, 64]);
      return { from, to: Math.round(from * rng.pick([0.972, 0.968, 0.975]) * 100) / 100 };
    },
    steps: [
      () =>
        flag({
          brief: 'You are the new intern on the markets desk. The editor wants only stories that tell readers something real.',
          prompt: 'Flag the items that are hype, ads or clickbait rather than news.',
          doc: {
            title: 'Morning wire',
            sub: '7:30 am',
            skin: 'screen',
            lines: [
              { id: 'fed', l: 'Central bank holds interest rates steady, signals one cut later this year.' },
              { id: 'secret', l: 'This ONE stock could make you a millionaire by Christmas (experts hate it)' },
              { id: 'recall', l: 'Velo Motors recalls 400,000 cars over brake fault; repair cost estimated at $350 million.' },
              { id: 'promo', l: '"Lumina Mining is the next 100-bagger," says newsletter. (Paid for by Lumina Mining investor relations)' },
              { id: 'jobs', l: 'Employers added 180,000 jobs last month; unemployment steady at 4.1%.' },
              { id: 'crash', l: 'Market BLOODBATH as stocks are slaughtered' },
              { id: 'earn', l: 'Hearth Foods quarterly sales up 6%, matching forecasts.' },
            ],
          },
          issues: {
            secret: 'No source, no numbers, a promise of riches and a fake villain. Every part of that headline is built for clicks.',
            promo: 'The company paid for its own praise. Promotions like this often come right before insiders sell.',
            crash: 'Violent words, no figures. Check the actual move: it is often a fall of one or two percent.',
          },
          fine: {
            fed: 'Interest rate decisions move every market. Dull to read, hugely important.',
            recall: 'Specific, sourced and sized. Investors can judge it against the company’s profits.',
            jobs: 'A key economic report with real numbers.',
            earn: 'Factual. "Matching forecasts" also tells you the stock may not move much.',
          },
        }),
      ({ s }) =>
        dial({
          brief: `The "BLOODBATH" story is about the Fintra 500 index. You check the numbers: it closed yesterday at ${s.from * 100} and today at ${Math.round(s.to * 100)}.`,
          prompt: 'How big was the fall, in percent?',
          min: 0,
          max: 10,
          step: 0.1,
          answer: Math.round(((s.from - s.to) / s.from) * 1000) / 10,
          tol: 0.15,
          fmt: (v) => `${v.toFixed(1)}%`,
          why: `(${s.from * 100} − ${Math.round(s.to * 100)}) ÷ ${s.from * 100} is about ${(((s.from - s.to) / s.from) * 100).toFixed(1)}%. A fall like that happens several times in a typical year. Big point drops sound dramatic because the index itself is a big number.`,
        }),
      () =>
        pick({
          brief: 'The central bank holds rates steady, exactly as every economist predicted. Stocks barely move.',
          visual: <Say who="Your editor">Why is there no reaction? This is the most important story of the month.</Say>,
          prompt: 'What do you tell the editor?',
          options: [
            { label: 'It was already expected, so it was already in prices. Markets move on surprises', credit: 1, why: 'Investors had bet on this outcome for weeks. The news that would have moved markets was a surprise cut or hike.' },
            { label: 'Interest rates do not affect stocks', credit: 0, why: 'They matter a great deal, which is exactly why investors had already acted on the expected decision.' },
            { label: 'Traders were not paying attention', credit: 0.1, why: 'Rate days are among the most watched events in finance.' },
          ],
        }),
      () =>
        pick({
          brief: 'A big bank’s analyst raises her price target on Nova Robotics to $500, and the stock jumps 8%.',
          visual: <Cards cards={[{ icon: '📄', title: 'Disclosures, page 14', facts: [['Our bank’s role', 'Lead adviser on Nova’s share sale last year'], ['Fees earned from Nova', '$40 million'], ['Rating history', 'Buy, Buy, Buy, Buy']] }]} />,
          prompt: 'How should a reader treat this upgrade?',
          options: [
            { label: 'With caution. The bank earns fees from Nova, and its analysts have never said Sell', credit: 1, why: 'Analysts are not always biased, but a firm paid by the company has a reason to be friendly. Disclosures exist so readers can weigh that.' },
            { label: 'As strong evidence. Bank analysts are experts', credit: 0.2, why: 'Expertise is not independence. Price targets are often missed, and conflicts are common.' },
            { label: 'Ignore it completely. Analysts are always wrong', credit: 0.3, why: 'Too strong. Research can be useful; it just should not be taken on trust.' },
          ],
        }),
      () =>
        pick({
          brief: 'A reader writes in about a post going viral.',
          visual: <Feed posts={[{ who: 'StatsBro', handle: '@statsbro', text: 'Fun fact: the market has gone up in 9 of the last 10 years when the Harbor Hawks win the championship. Hawks are in the final. Load up!', meta: '41k likes' }]} />,
          prompt: 'What is the problem with this "fact"?',
          options: [
            { label: 'It is a coincidence. With thousands of things to compare, some will line up by chance', credit: 1, why: 'Stocks go up in most years anyway. Any team that wins often will appear to "predict" a rising market. Correlation without a reason is noise.' },
            { label: 'Ten years is too short; with 30 years it would be reliable', credit: 0.3, why: 'More years would only make a coincidence look more convincing. There is no mechanism linking a sports final to company profits.' },
            { label: 'Nothing. Patterns are patterns', credit: 0, why: 'A pattern with no cause is the easiest kind to find and the least likely to continue.' },
          ],
        }),
      () =>
        pick({
          brief: 'Your last job: a reader asks how to judge any money story in the future.',
          visual: <Table head={['Headline', 'Gives a number?', 'Says who paid?', 'Names a source?']} rows={[['Velo Motors recall', 'Yes', 'Not needed', 'Yes'], ['Lumina Mining 100-bagger', 'No', 'In tiny print', 'No'], ['Market BLOODBATH', 'No', 'Not needed', 'No']]} />,
          prompt: 'Which habit protects readers best?',
          options: [
            { label: 'Find the number, the source and who benefits before reacting', credit: 1, why: 'Three questions catch almost everything above: hype has no number, promotions hide who paid, and clickbait has no source.' },
            { label: 'Only read news that agrees with what you own', credit: 0, why: 'That is how investors miss the warning signs that matter most.' },
            { label: 'Trade quickly on breaking news before others do', credit: 0.1, why: 'Professionals with faster systems have usually acted within seconds. By the time you read it, it is priced in.' },
          ],
        }),
    ],
    alts: {
      0: [
        () =>
          flag({
            brief: 'Second week on the markets desk. The editor wants only stories that tell readers something real.',
            prompt: 'Flag the items that are hype, ads or clickbait rather than news.',
            doc: {
              title: 'Afternoon wire',
              sub: '2:15 pm',
              skin: 'screen',
              lines: [
                { id: 'infl', l: 'Prices rose 2.8% over the past year, down from 3.1% the month before.' },
                { id: 'guru', l: 'Billionaire’s SECRET crypto pick revealed (link expires tonight)' },
                { id: 'merge', l: 'Brightway Telecom agrees to buy Lumo Fiber for $4.2 billion in cash.' },
                { id: 'spons', l: 'Sponsored: Why smart money is moving into Quantum Gold coins now' },
                { id: 'oil', l: 'Oil falls 3% after producers agree to pump more.' },
                { id: 'doom', l: 'Is THIS the end of the dollar? What they are not telling you' },
              ],
            },
            issues: {
              guru: 'A secret, a famous name and a deadline. All three are pressure tactics, not news.',
              spons: 'An ad dressed as an article. "Sponsored" means someone paid for it.',
              doom: 'A scary question with no facts. Headlines ending in a question mark usually have the answer "no".',
            },
            fine: {
              infl: 'A key economic number with a clear comparison.',
              merge: 'A specific deal with a price and the companies named.',
              oil: 'A sized move with a stated reason.',
            },
          }),
      ],
      1: [
        ({ s }) => {
          const a = s.from * 50;
          const b = Math.round(s.to * 50);
          return dial({
            brief: `A headline screams "Gold CRASHES!" You check the price: it was $${a.toLocaleString()} an ounce yesterday and $${b.toLocaleString()} today.`,
            prompt: 'How big was the fall, in percent?',
            min: 0,
            max: 10,
            step: 0.1,
            answer: Math.round(((a - b) / a) * 1000) / 10,
            tol: 0.15,
            fmt: (v) => `${v.toFixed(1)}%`,
            why: `($${a.toLocaleString()} − $${b.toLocaleString()}) ÷ $${a.toLocaleString()} is about ${(((a - b) / a) * 100).toFixed(1)}%. A move like that is ordinary for gold. "Crash" sells papers.`,
          });
        },
      ],
      2: [
        () =>
          pick({
            brief: 'Economists expected employers to add 200,000 jobs last month. The report shows 40,000. Stocks fall 2% within minutes.',
            visual: <Say who="Your editor">Forty thousand jobs is still growth. Why would markets fall?</Say>,
            prompt: 'What do you tell the editor?',
            options: [
              { label: 'It was far below what was expected. Markets move on the surprise, not on whether the number is positive', credit: 1, why: 'Prices already assumed 200,000. Falling 160,000 short suggested the economy was weaker than believed.' },
              { label: 'Job growth is bad for stocks', credit: 0, why: 'Usually the reverse. The problem was the shortfall against expectations.' },
              { label: 'The fall had nothing to do with the report', credit: 0.1, why: 'A 2% fall within minutes of a major report is almost always about the report.' },
            ],
          }),
      ],
      3: [
        () =>
          pick({
            brief: 'A video creator with 2 million subscribers posts "Zephyr Energy will triple this year!" The stock jumps 12%.',
            visual: <Cards cards={[{ icon: '📄', title: 'Video description, at the bottom', facts: [['Disclosure', 'I own Zephyr shares'], ['Also', 'Links to a paid trading course']] }]} />,
            prompt: 'How should a viewer treat this tip?',
            options: [
              { label: 'With suspicion. The creator profits if viewers buy and push the price up, and sells a course too', credit: 1, why: 'Someone who owns the stock benefits when followers buy. Some sell into the jump their own video causes.' },
              { label: 'As good advice, since they disclosed it honestly', credit: 0.3, why: 'Disclosure is better than hiding it, but it does not remove the conflict.' },
              { label: 'Buy fast before the price rises further', credit: 0, why: 'By the time you buy, the jump has happened, and you may be the one buying from the creator.' },
            ],
          }),
      ],
      4: [
        () =>
          pick({
            brief: 'A reader sends in a full-page ad.',
            visual: <Feed posts={[{ who: 'Summit Funds', handle: 'Sponsored', text: 'All 6 of our funds beat the market over 10 years!', meta: 'Ad' }]} />,
            prompt: 'What might the ad be hiding?',
            options: [
              { label: 'Funds that did badly may have been closed or merged away, so only the winners are left to count', credit: 1, why: 'This is survivorship bias. If Summit started 20 funds and kept the 6 that did well, the record says little about its skill.' },
              { label: 'Nothing. Beating the market for 10 years proves skill', credit: 0.2, why: 'Only if you count every fund they ever ran, not just the survivors.' },
              { label: 'That the market went down', credit: 0, why: 'Market direction does not explain the trick here.' },
            ],
          }),
      ],
      5: [
        () =>
          pick({
            brief: 'A friend forwards a screenshot: "BREAKING: Major bank to freeze all accounts Monday." No link, no outlet name.',
            prompt: 'What should you do first?',
            options: [
              { label: 'Look for the story on established news sites and the bank’s own website before believing or sharing it', credit: 1, why: 'Screenshots are easy to fake. Real news this big would be everywhere, with sources.' },
              { label: 'Withdraw your money just in case', credit: 0.1, why: 'Panic based on a fake post is how rumors cause real damage.' },
              { label: 'Share it to warn others', credit: 0, why: 'Sharing unverified scares spreads the fake further.' },
            ],
          }),
      ],
    },
    takeaways: [
      'Markets move on surprises. Expected news is usually already in the price.',
      'Turn dramatic words into percentages. A 1,000-point drop can be a normal day.',
      'Ask who paid for a story or a rating. Disclosures are there for a reason.',
      'A pattern with no cause is a coincidence, however many years it lasts.',
    ],
  };
  return <CaseRunner def={def} seed={seed} onFinish={onFinish} addReview={addReview} />;
}
