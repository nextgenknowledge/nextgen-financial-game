'use client';
/**
 * Beat the Index (Advanced, Investment Club). Draft five stocks from ten real-sounding pitches,
 * run twenty simulated years against the whole market, then find out why most pickers lose and
 * what quietly eats the returns of those who pay for help.
 */
import { useState } from 'react';
import type { KindProps } from '../../types';
import { Button } from '@/ui/common';
import { playSfx } from '@/engine/audio';
import { cls } from '@/ui/format';
import { C, LineChart, Table, gauss, usd } from '../pro/kit';
import { CaseRunner, Cards, choose, dial, pick, type CaseDef } from './kit';

const YEARS = 20;

interface Co {
  name: string;
  icon: string;
  sector: string;
  pitch: string;
}

const COS: Co[] = [
  { name: 'Vantage Chips', icon: '💻', sector: 'Tech', pitch: 'Makes processors for phones. Everyone at school says it is the future.' },
  { name: 'Cloudnest', icon: '☁️', sector: 'Tech', pitch: 'Rents out server space. Growing 40% a year.' },
  { name: 'Harbor Health', icon: '🩺', sector: 'Health', pitch: 'Runs clinics in 200 towns. Boring and steady.' },
  { name: 'Genexa Bio', icon: '🧠', sector: 'Health', pitch: 'One promising drug in trials. Could be huge.' },
  { name: 'Granary Foods', icon: '🍞', sector: 'Food', pitch: 'Bread and cereal brands in every supermarket.' },
  { name: 'Bolt Burger', icon: '🍔', sector: 'Food', pitch: 'Fast-growing burger chain with a viral menu.' },
  { name: 'Northline Rail', icon: '🚆', sector: 'Industry', pitch: 'Owns freight railways. Has existed for 120 years.' },
  { name: 'Skyforge Drones', icon: '🚁', sector: 'Industry', pitch: 'Delivery drones. Two big contracts signed last month.' },
  { name: 'Pinewood Power', icon: '⚡', sector: 'Energy', pitch: 'Electricity for three states. Pays a large dividend.' },
  { name: 'Sunspire Solar', icon: '☀️', sector: 'Energy', pitch: 'Solar panels. Stock doubled last year.' },
];

interface S {
  /** Growth of $1 each year for the market and for each company. */
  index: number[];
  paths: number[][];
  picks: number[];
}

function simulate(next: () => number) {
  const index = [1];
  const paths = COS.map(() => [1]);
  const alive = COS.map(() => true);
  // Random market years, rescaled so the 20-year total lands in a typical range (about 3.2x to
  // 4.4x, or 6% to 7.7% a year). The bumps stay random; the long-run lesson stays honest.
  const raw = Array.from({ length: YEARS }, () => Math.max(0.55, 1 + 0.07 + 0.15 * gauss(next)));
  const target = 3.2 + next() * 1.2;
  const adj = Math.pow(target / raw.reduce((a, g) => a * g, 1), 1 / YEARS);
  const growth = raw.map((g) => g * adj);
  for (let y = 1; y <= YEARS; y++) {
    const g = growth[y - 1];
    const m = g - 1;
    index.push(index[y - 1] * g);
    COS.forEach((_, i) => {
      const prev = paths[i][y - 1];
      if (!alive[i]) return void paths[i].push(0);
      // Each company carries the market plus a large company-specific swing. Same average, far
      // wider spread, so the typical single stock ends below the market.
      const r = Math.exp(Math.log(1 + m) + 0.34 * gauss(next) - 0.34 ** 2 / 2) - 1;
      const v = prev * (1 + r);
      if (v < 0.06) {
        alive[i] = false;
        paths[i].push(0);
      } else paths[i].push(v);
    });
  }
  return { index, paths };
}

function Draft({ s, done }: { s: S; done: (credit: number) => void }) {
  const [sel, setSel] = useState<number[]>([]);
  const [ran, setRan] = useState(false);
  const port = s.index.map((_, y) => sel.reduce((a, i) => a + s.paths[i][y], 0) / Math.max(1, sel.length));
  const sectors = new Set(sel.map((i) => COS[i].sector)).size;
  const beat = COS.filter((_, i) => s.paths[i][YEARS] > s.index[YEARS]).length;
  return (
    <div className="cs-step">
      <div className="cs-brief">The club gives you $10,000 of practice money to split evenly across five companies. You will hold them for 20 years against an index fund that owns the whole market.</div>
      {!ran ? (
        <>
          <div className="cs-options" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(min(230px, 100%), 1fr))' }}>
            {COS.map((c, i) => (
              <button
                key={c.name}
                type="button"
                className={cls('cs-option', sel.includes(i) && 'on')}
                onClick={() => {
                  setSel((o) => (o.includes(i) ? o.filter((x) => x !== i) : o.length >= 5 ? o : [...o, i]));
                  playSfx('click');
                }}
              >
                <span style={{ fontSize: '1.2rem' }}>{c.icon}</span> {c.name} <span className="small muted">· {c.sector}</span>
                <div className="small" style={{ fontWeight: 600, marginTop: 3 }}>{c.pitch}</div>
              </button>
            ))}
          </div>
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="small muted">{sel.length} of 5 picked</span>
            <Button
              variant="gold"
              disabled={sel.length !== 5}
              onClick={() => {
                s.picks = sel;
                setRan(true);
                playSfx(port[YEARS] > s.index[YEARS] ? 'correct' : 'pop');
              }}
            >
              Run 20 years ▶
            </Button>
          </div>
        </>
      ) : (
        <>
          <section className="pro-panel cs-evidence">
            <LineChart
              series={[
                { pts: s.index.map((v) => v * 10000), color: C.blue, label: 'Index fund' },
                { pts: port.map((v) => v * 10000), color: C.gold, label: 'Your five' },
              ]}
              fmt={(v) => usd(v)}
              xLabel="Years 0 to 20"
              h={200}
            />
            <Table
              head={['Your pick', '$2,000 became']}
              rows={sel.map((i) => [`${COS[i].icon} ${COS[i].name}`, s.paths[i][YEARS] === 0 ? 'Went bust: $0' : usd(2000 * s.paths[i][YEARS])])}
              compact
            />
          </section>
          <div className={cls('cs-reveal', port[YEARS] >= s.index[YEARS] ? 'ok' : 'mid')}>
            <b>
              Your five: {usd(port[YEARS] * 10000)}. The index: {usd(s.index[YEARS] * 10000)}.
            </b>
            <span>
              Only {beat} of the 10 companies beat the index over 20 years. {port[YEARS] >= s.index[YEARS] ? 'You were one of the lucky drafts; run it again and the result changes.' : 'Most drafts trail the index, even though every company had the same average return.'} You covered {sectors} of 5 sectors{sectors < 4 ? ', so one bad industry could sink the whole portfolio' : ''}.
            </span>
            <div className="row" style={{ justifyContent: 'flex-end' }}>
              <Button variant="gold" onClick={() => done(sectors >= 4 ? 1 : sectors === 3 ? 0.6 : 0.3)}>
                Next ▶
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default function BeatIndex({ seed, onFinish, addReview }: KindProps) {
  const def: CaseDef<S> = {
    kicker: 'Investment Club · Beat the index',
    init: (rng) => ({ ...simulate(() => rng.next()), picks: [] }),
    steps: [
      () => ({ kind: 'custom', render: (done, { s }) => <Draft s={s} done={(c) => done(c, { q: 'Draft five stocks against the index', ok: c >= 0.99, answer: 'Spread picks across at least four sectors', explanation: 'Concentrating in one industry ties your result to its luck.' })} /> }),
      ({ s }) => {
        const finals = s.paths.map((p) => p[YEARS]).sort((a, b) => b - a);
        const top2 = (finals[0] + finals[1]) / finals.reduce((a, b) => a + b, 0);
        return pick({
          brief: `Look at all ten companies, not just yours. Every one had the same expected return as the market. Yet the top two delivered ${Math.round(top2 * 100)}% of all the money the ten made together.`,
          visual: <Table head={['Company', '$1 became']} rows={[...COS.keys()].sort((a, b) => s.paths[b][YEARS] - s.paths[a][YEARS]).map((i) => [`${COS[i].icon} ${COS[i].name}`, s.paths[i][YEARS] === 0 ? 'Went bust' : usd(s.paths[i][YEARS], 2)])} compact />,
          prompt: 'Why does the typical stock trail the market, even when every stock has the same average?',
          options: [
            { label: 'A few huge winners lift the average. Most stocks land below it, and a five-stock draft usually misses the winners', credit: 1, why: 'Stock returns are lopsided: losses stop at -100% but winners can rise 1,000%. The market owns the rare giants automatically; a small portfolio usually does not.' },
            { label: 'Index funds get better prices on the same stocks', credit: 0.1, why: 'They pay the same prices. The difference comes from owning everything, including the few big winners.' },
            { label: 'The picks were bad; a smarter person would have beaten it', credit: 0.2, why: 'Every pitch was written to sound plausible. Professionals with research teams fail to beat the index most of the time, too.' },
            { label: 'The market is rigged against individual investors', credit: 0, why: 'Nothing was rigged here. Everything came from the shape of returns, not from anyone cheating.' },
          ],
        });
      },
      () =>
        dial({
          brief: 'A friendly adviser offers a managed fund that "aims to beat the market". It charges 1% a year. An index fund charges 0.05%. Say both earn 7% a year before fees, and you invest $10,000 for 30 years.',
          visual: <Table head={['Return after fees', '$1 grows to, in 30 years']} rows={[['6.95% (index fund)', '$7.51'], ['6.00% (managed fund)', '$5.74']]} />,
          prompt: 'How much more would the index fund leave you with?',
          min: 0,
          max: 40000,
          step: 250,
          answer: 17700,
          tol: 750,
          fmt: (v) => usd(v),
          why: '$10,000 × 7.51 = $75,100 against $10,000 × 5.74 = $57,400. A fee that sounds like 1% took about $17,700, nearly a quarter of the final balance, because it is charged on the growing total every single year.',
        }),
      () =>
        pick({
          brief: 'The managed fund’s brochure says it beat the market three years in a row.',
          prompt: 'How much should that sway you?',
          options: [
            { label: 'Very little. Past streaks rarely continue, and the fee is certain while the skill is not', credit: 1, why: 'Studies of funds that top the rankings find most fall back within a few years. The 1% is charged no matter what.' },
            { label: 'A lot. Three years proves skill', credit: 0, why: 'With thousands of funds, many will beat the market three years running through luck alone.' },
            { label: 'Some. Check whether the manager is still there', credit: 0.5, why: 'Sensible to check, but even a real streak is weak evidence about the next ten years.' },
          ],
        }),
      () =>
        pick({
          brief: 'Another fund company advertises: "9 of our 10 funds beat the market over the last decade."',
          visual: <Cards cards={[{ icon: '📄', title: 'The fine print', facts: [['Funds launched 10 years ago', '25'], ['Funds closed or merged since', '15'], ['Funds still open', '10']] }]} />,
          prompt: 'What is wrong with the claim?',
          options: [
            { label: 'The losers were closed and dropped from the count. Only 9 of the original 25 actually beat the market', credit: 1, why: 'This is survivorship bias. Closing poor funds and advertising the survivors makes any company look skilled.' },
            { label: 'Nothing. 90% is excellent', credit: 0, why: 'It is 90% of the funds that were allowed to survive. Of all 25 they launched, it is 36%.' },
            { label: 'Ten years is too short to judge', credit: 0.3, why: 'A decade is a reasonable test. The trick is in which funds were counted.' },
          ],
        }),
      () =>
        choose({
          brief: 'You decide on an index fund. There are dozens.',
          prompt: 'Which two features matter most?',
          k: 2,
          options: [
            { label: 'A low expense ratio, around 0.1% or less', good: true, why: 'Fees are the one return you can control, and they compound against you every year.' },
            { label: 'It tracks a broad market, with hundreds or thousands of companies', good: true, why: 'Breadth is what captures the rare huge winners and limits the damage from any one failure.' },
            { label: 'It had the best return last year', good: false, why: 'Last year’s winner among index funds is usually just the one tracking whatever sector got lucky.' },
            { label: 'It focuses on one exciting theme, like drones or AI', good: false, why: 'Theme funds are narrow bets with higher fees, the opposite of what an index fund is for.' },
            { label: 'It comes with a famous manager', good: false, why: 'An index fund does not need a star; it follows a list. Paying for a star is paying for the managed fund again.' },
          ],
        }),
    ],
    alts: {
      1: [
        ({ s }) => {
          const beat = COS.filter((_, i) => s.paths[i][YEARS] > s.index[YEARS]).length;
          return dial({
            brief: `Look at all ten companies from the club’s list. Each had the same expected return as the market over the 20 years. In the index fund, $1 became ${usd(s.index[YEARS], 2)}.`,
            visual: <Table head={['Company', '$1 became']} rows={[...COS.keys()].sort((a, b) => s.paths[b][YEARS] - s.paths[a][YEARS]).map((i) => [`${COS[i].icon} ${COS[i].name}`, s.paths[i][YEARS] === 0 ? 'Went bust' : usd(s.paths[i][YEARS], 2)])} compact />,
            prompt: 'How many of the ten beat the index?',
            min: 0,
            max: 10,
            step: 1,
            answer: beat,
            tol: 0.4,
            fmt: (v) => String(v),
            why: `${beat} of 10. ${beat <= 4 ? 'Most single stocks trail the market, because a few big winners lift the average while most land below it.' : 'This run had more winners than usual. Over many runs, most single stocks trail the market.'}`,
          });
        },
      ],
      2: [
        () => {
          const lo = Math.pow(1.0695, 40);
          const hi = Math.pow(1.0625, 40);
          const gap = Math.round((5000 * (lo - hi)) / 250) * 250;
          return dial({
            brief: 'You invest $5,000 for 40 years. An index fund charges 0.05% a year; a managed fund charges 0.75%. Both earn 7% a year before fees.',
            visual: <Table head={['Return after fees', '$1 grows to, in 40 years']} rows={[['6.95% (index fund)', usd(lo, 2)], ['6.25% (managed fund)', usd(hi, 2)]]} />,
            prompt: 'How much more would the index fund leave you with?',
            min: 0,
            max: 40000,
            step: 250,
            answer: gap,
            tol: 750,
            fmt: (v) => usd(v),
            why: `$5,000 × ${lo.toFixed(2)} = ${usd(5000 * lo)} against $5,000 × ${hi.toFixed(2)} = ${usd(5000 * hi)}. Under 1% a year still takes about ${usd(5000 * (lo - hi))}, because it is charged on a growing balance every year.`,
          });
        },
      ],
      3: [
        () =>
          pick({
            brief: 'A classmate picked five stocks last year and all of them doubled. Now they want to manage your money too.',
            prompt: 'How much does one great year tell you?',
            options: [
              { label: 'Very little. In a good market, many random picks do well, and one year is mostly luck', credit: 1, why: 'Thousands of people pick stocks every year. Some will have amazing results by chance alone.' },
              { label: 'A lot. Five out of five cannot be luck', credit: 0, why: 'In a strong year, especially in one hot sector, it easily can be.' },
              { label: 'It depends on how confident they sound', credit: 0, why: 'Confidence is not evidence.' },
            ],
          }),
      ],
      4: [
        () =>
          pick({
            brief: 'A stock newsletter’s website lists its "greatest calls": eight picks that rose more than 300%.',
            prompt: 'What should you ask before subscribing?',
            options: [
              { label: 'How did all of their picks do, including the losers, compared with an index fund?', credit: 1, why: 'Showing only the winners is survivorship bias. The full record is the only fair test.' },
              { label: 'Which of the eight is the best?', credit: 0, why: 'That still ignores everything they got wrong.' },
              { label: 'Nothing. 300% gains speak for themselves', credit: 0, why: 'Any long list of picks contains a few huge winners by chance.' },
            ],
          }),
      ],
      5: [
        () =>
          choose({
            brief: 'You have chosen a low-cost, broad index fund.',
            prompt: 'Which two habits will help it work best?',
            k: 2,
            options: [
              { label: 'Invest a set amount automatically every month', good: true, why: 'Regular investing removes the temptation to guess the right moment.' },
              { label: 'Leave it alone through downturns', good: true, why: 'Selling after falls locks in losses and misses recoveries.' },
              { label: 'Check the price several times a day', good: false, why: 'Watching every move makes panic selling more likely.' },
              { label: 'Switch to whichever fund did best last year', good: false, why: 'Chasing last year’s winner usually means buying high.' },
            ],
          }),
      ],
    },
    takeaways: [
      'A handful of giant winners drive most of the market’s gains. Owning everything is the only sure way to own them.',
      'Most professional stock pickers trail the index over long periods, mostly because of fees.',
      'A 1% yearly fee can cost about a quarter of your money over 30 years.',
      'Beware streaks and survivor statistics. Ask how many tried, not just how many won.',
    ],
  };
  return <CaseRunner def={def} seed={seed} onFinish={onFinish} addReview={addReview} />;
}
