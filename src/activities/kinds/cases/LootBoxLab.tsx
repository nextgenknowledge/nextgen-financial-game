'use client';
/**
 * Loot Box Lab (Advanced, Arcade). Open real boxes with published odds, then work out what the
 * rare skin truly costs, why a losing streak changes nothing, and how the store is built to keep
 * you opening.
 */
import { useState } from 'react';
import type { KindProps } from '../../types';
import type { Rng } from '@/game/rng';
import { Button } from '@/ui/common';
import { playSfx } from '@/engine/audio';
import { cls } from '@/ui/format';
import { ProHead, Stats, Table, usd } from '../pro/kit';
import { CaseRunner, dial, flag, pick, type CaseDef } from './kit';

const PRICE = 2.5;
const BUDGET = 50;
type Tier = 'common' | 'rare' | 'epic' | 'legend';
const ICON: Record<Tier, string> = { common: '🧢', rare: '🛡️', epic: '💎', legend: '⭐' };
const NAME: Record<Tier, string> = { common: 'Common', rare: 'Rare', epic: 'Epic', legend: 'Legendary' };

interface S {
  opened: Tier[];
}

function roll(rng: Rng): Tier {
  const x = rng.next();
  return x < 0.01 ? 'legend' : x < 0.06 ? 'epic' : x < 0.21 ? 'rare' : 'common';
}

function Opener({ s, rng, done }: { s: S; rng: Rng; done: () => void }) {
  const [, tick] = useState(0);
  const spent = s.opened.length * PRICE;
  const left = BUDGET - spent;
  const open = (n: number) => {
    for (let k = 0; k < n && s.opened.length * PRICE < BUDGET; k++) s.opened.push(roll(rng));
    playSfx(s.opened.slice(-n).includes('legend') ? 'levelup' : 'pop');
    tick((t) => t + 1);
  };
  const count = (t: Tier) => s.opened.filter((x) => x === t).length;
  return (
    <div className="cs-step">
      <ProHead kicker="Star Raiders · Item shop" title="Neon Dragon crates" sub="You have $50 of birthday money in the game. The Legendary Neon Dragon skin only comes from crates. Open as many or as few as you like, then stop." />
      <Stats items={[['Spent', usd(spent, 2)], ['Left', usd(left, 2), left <= 0 ? 'bad' : undefined], ['Crates opened', s.opened.length], ['Legendary', count('legend'), count('legend') ? 'good' : undefined]]} />
      <section className="pro-panel">
        <h4>Your crates</h4>
        {s.opened.length === 0 ? (
          <p className="small muted">Nothing opened yet. Each crate costs {usd(PRICE, 2)}.</p>
        ) : (
          <div className="lb-grid">
            {s.opened.map((t, i) => (
              <div key={i} className={cls('lb-box', t)} title={NAME[t]}>
                {ICON[t]}
              </div>
            ))}
          </div>
        )}
        <p className="lb-odds">Published odds per crate: Common 79% · Rare 15% · Epic 5% · Legendary 1%</p>
        <div className="row wrap" style={{ gap: 8 }}>
          <Button variant="blue" disabled={left < PRICE} onClick={() => open(1)}>
            Open 1 ({usd(PRICE, 2)})
          </Button>
          <Button variant="blue" disabled={left < PRICE * 5} onClick={() => open(5)}>
            Open 5 ({usd(PRICE * 5, 2)})
          </Button>
          <Button variant="gold" onClick={done}>
            {s.opened.length === 0 ? 'Walk away without opening any ▶' : 'Stop here ▶'}
          </Button>
        </div>
      </section>
    </div>
  );
}

export default function LootBoxLab({ seed, onFinish, addReview }: KindProps) {
  const def: CaseDef<S> = {
    kicker: 'Coin Arcade · Loot box lab',
    init: () => ({ opened: [] }),
    steps: [
      () =>
        pick({
          brief: 'Star Raiders sells crates for $2.50. The Legendary Neon Dragon skin has published odds of 1% per crate.',
          prompt: 'About how many crates does it take to get one?',
          options: [
            { label: 'About 100 on average, but it could take 20 or 400. Nothing is guaranteed', credit: 1, why: 'A 1% chance means 100 crates ($250) on average. About one player in three still has no Legendary after 100, and one in seven after 200.' },
            { label: 'Exactly 100. After 99 misses the next one must hit', credit: 0.1, why: 'Each crate is a fresh 1% roll. The game does not count your misses, so 100 is an average, never a promise.' },
            { label: 'About 50, since the odds improve as you go', credit: 0, why: 'The odds do not improve. Every crate is 1%, the first and the five-hundredth.' },
            { label: 'One or two if you are having a lucky day', credit: 0, why: 'Possible, at 1% each. Planning on luck is how a $5 idea becomes a $100 evening.' },
          ],
        }),
      () => ({ kind: 'custom', weight: 0, render: (done, { s, rng }) => <Opener s={s} rng={rng} done={() => done(1)} /> }),
      ({ s }) => {
        const n = s.opened.length;
        const got = s.opened.includes('legend');
        return pick({
          brief:
            n === 0
              ? 'You walked away without spending anything. Your friend opened 20 crates in a row with no Legendary and is about to buy more.'
              : got
                ? `You opened ${n} crates for ${usd(n * PRICE, 2)} and pulled a Legendary, well ahead of the odds. Your friend opened 20 in a row with nothing and is about to buy more.`
                : `You opened ${n} crates for ${usd(n * PRICE, 2)} with no Legendary. Your friend also has 20 misses in a row and is about to buy more.`,
          visual: <div className="cs-say"><b>Friend</b><span>Twenty misses in a row. I am due. The next one basically has to hit.</span></div>,
          prompt: 'What is the chance their next crate is Legendary?',
          ordered: true,
          options: [
            { label: '1%, the same as every other crate', credit: 1, why: 'Crates have no memory. Believing a win is "due" after a losing streak is the gambler’s fallacy, and it is the thought that keeps people buying.' },
            { label: 'About 20%, one for each miss', credit: 0, why: 'Misses do not add up into a better chance. The roll is 1% each time, however long the streak.' },
            { label: 'Higher than 1%, but nobody knows how much', credit: 0.1, why: 'It is exactly 1%. The odds are published and do not move with your history.' },
            { label: 'Lower than 1%, since they are clearly unlucky', credit: 0, why: 'There is no such thing as an unlucky account. The roll is 1%, independent of the past.' },
          ],
        });
      },
      () =>
        dial({
          brief: 'The lab ran the numbers on how likely you are to have at least one Legendary after a given number of crates.',
          visual: <Table head={['Crates opened, at $2.50 each', 'Chance of at least one Legendary']} rows={[['20', '18%'], ['50', '39%'], ['100', '63%'], ['200', '87%'], ['300', '95%']]} />,
          prompt: 'How much must you be ready to spend to be 95% sure of getting the skin?',
          min: 0,
          max: 1500,
          step: 25,
          answer: 750,
          tol: 25,
          fmt: (v) => usd(v),
          why: '300 crates at $2.50 is $750, and one buyer in twenty still comes away with nothing. The sticker says $2.50; the real price of "nearly sure" is three hundred times that.',
        }),
      () =>
        flag({
          brief: 'Look at how the crate store is designed. Some of these features exist to help you, and some exist to keep you spending.',
          prompt: 'Flag the features designed to make you spend more than you planned.',
          doc: {
            title: 'Star Raiders Store',
            sub: 'Crate screen',
            skin: 'screen',
            lines: [
              { id: 'gems', l: 'Crates are priced in Gems (280 each). Gems are sold in packs of 500 or 1,200', r: '$4.99 / $9.99' },
              { id: 'odds', l: 'Odds shown for every item tier', r: 'Legendary 1%' },
              { id: 'timer', l: '"Dragon Week ends in 09:59!" The countdown restarts each time the store is opened', r: 'Limited' },
              { id: 'near', l: 'The spinner slows and stops one slot away from the Legendary', r: 'So close!' },
              { id: 'limit', l: 'Monthly spending limit can be set in Settings', r: 'Optional' },
              { id: 'streak', l: '"Open a crate today or lose your 7-day streak bonus"', r: 'Day 7' },
            ],
          },
          issues: {
            gems: 'A made-up currency hides the real price, and the packs never divide evenly, so there are always leftover Gems nudging you to top up.',
            timer: 'Fake urgency. A deadline that resets is not a deadline; it exists to stop you thinking it over.',
            near: 'The result was decided before the spinner moved. Showing a near miss makes a loss feel like almost winning, which is proven to keep people playing.',
            streak: 'Loss aversion: people will pay to avoid losing something they already "have", even a streak the game invented.',
          },
          fine: {
            odds: 'Showing the odds is the one feature that helps you decide. Several countries and app stores require it.',
            limit: 'A spending limit protects you. Notice that it is optional and tucked away in Settings.',
          },
        }),
      () =>
        pick({
          brief: 'The same Neon Dragon skin sometimes appears in the direct item shop for $18.',
          prompt: 'Why would a studio rather sell crates than the $18 skin?',
          options: [
            { label: 'Random rewards make people spend far more than a fixed price, and a few heavy spenders bring in most of the money', credit: 1, why: 'At 1% odds the average buyer pays about $250 for an $18 item. Studios call the biggest spenders "whales"; a small share of players produces most crate revenue.' },
            { label: 'Crates cost more to make, so they have to charge more', credit: 0, why: 'A crate is a random number and an animation. It costs almost nothing to make.' },
            { label: 'Players get better value from crates on average', credit: 0, why: 'On average a player pays about fourteen times the direct price for the same skin.' },
            { label: 'Skins cannot legally be sold directly', credit: 0, why: 'Direct sales are legal everywhere. Some countries restrict the crates instead.' },
          ],
        }),
      () =>
        pick({
          brief: 'You still want the Neon Dragon.',
          prompt: 'What is the smartest way to get it?',
          options: [
            { label: 'Wait for it in the direct shop and pay the $18', credit: 1, why: 'A known price for a known item. If it is worth $18 to you, buy it; if it is not, you have your answer.' },
            { label: 'Set a hard $20 crate budget and stop when it is gone', credit: 0.4, why: 'A hard limit is far better than none, but $20 buys 8 crates: about an 8% chance of the skin and a 92% chance of nothing you wanted.' },
            { label: 'Buy the 1,200 Gem pack: more Gems per dollar', credit: 0, why: 'A bulk discount on a bad deal is still a bad deal, and it leaves you with spare Gems that pull you back.' },
            { label: 'Keep opening until it drops: you have already spent so much', credit: 0, why: 'That is the sunk cost trap. Money already spent is gone either way, and it does not make the next crate any more likely to pay.' },
          ],
        }),
    ],
    alts: {
      0: [
        () =>
          pick({
            brief: 'Star Raiders crates cost $2.50. Each one has a 5% chance of an Epic item.',
            prompt: 'On average, what does one Epic item cost you?',
            options: [
              { label: 'About $50: 20 crates on average, though some players need far more', credit: 1, why: 'A 5% chance means 1 in 20 on average. 20 × $2.50 = $50. Averages hide wide swings: some get it first try, some after 60 crates.' },
              { label: '$2.50, the price of a crate', credit: 0, why: 'That is the price of a try, not of the item. Most tries give you something else.' },
              { label: 'About $12.50, since 5% is one in five', credit: 0, why: '5% is one in twenty, not one in five.' },
            ],
          }),
      ],
      2: [
        () =>
          pick({
            brief: 'Your friend just pulled a Legendary from their first crate of the day.',
            visual: <div className="cs-say"><b>Friend</b><span>I am on a hot streak! I should open ten more right now while I am lucky.</span></div>,
            prompt: 'What is the chance their next crate is Legendary?',
            ordered: true,
            options: [
              { label: '1%, the same as every other crate', credit: 1, why: 'A win does not make the next roll more likely to win. “Hot streaks” are patterns we see in randomness.' },
              { label: 'Higher, because they are on a streak', credit: 0, why: 'Each crate is independent. Luck does not carry over.' },
              { label: 'Lower, because they just used up their luck', credit: 0, why: 'There is no luck to use up. The roll is always 1%.' },
            ],
          }),
      ],
      3: [
        () =>
          dial({
            brief: 'In the store, a crate costs 280 Gems. Gems come in a pack of 1,200 for $9.99.',
            prompt: 'In real dollars, what does one crate cost when you buy the big pack?',
            min: 0,
            max: 10,
            step: 0.01,
            answer: 2.33,
            tol: 0.05,
            fmt: (v) => usd(v, 2),
            why: '$9.99 ÷ 1,200 Gems × 280 = about $2.33. The 1,200 pack buys 4 crates and leaves 80 Gems, which is not enough for a fifth, so many players top up again.',
          }),
      ],
      4: [
        () =>
          flag({
            brief: 'Another game’s store has a “Mega Bundle”. Some features help you, some are built to make you spend.',
            prompt: 'Flag the features designed to make you spend more than you planned.',
            doc: {
              title: 'Galaxy Garden Store',
              sub: 'Bundle screen',
              skin: 'screen',
              lines: [
                { id: 'worth', l: 'Mega Bundle: “Worth $100!” for only $19.99', r: '80% off' },
                { id: 'gems', l: 'Prices shown in Gems only', r: '2,000 Gems' },
                { id: 'friends', l: 'Pop-up: “3 friends just bought this!”', r: 'Popular' },
                { id: 'onetap', l: 'One-tap buy with your saved card, no confirmation', r: 'Fast' },
                { id: 'parent', l: 'Purchases need a parent’s approval (optional setting)', r: 'Off' },
                { id: 'receipt', l: 'A receipt is emailed for every purchase', r: 'On' },
              ],
            },
            issues: {
              worth: 'The “worth $100” value is made up by the seller to make $19.99 look like a bargain.',
              gems: 'A fake currency hides what you are really paying in dollars.',
              friends: 'Social pressure: seeing friends buy makes it feel normal and urgent.',
              onetap: 'Removing the pause before paying removes the moment you might change your mind.',
            },
            fine: {
              parent: 'Approval helps you, but notice that it starts switched off.',
              receipt: 'Receipts help you track spending.',
            },
          }),
      ],
      5: [
        () =>
          pick({
            brief: 'Almost every game with crates sells Gems, Coins or Crystals instead of showing dollar prices.',
            prompt: 'Why?',
            options: [
              { label: 'A second currency makes it harder to feel what you are really spending', credit: 1, why: '280 Gems feels less real than $2.33. Odd pack sizes also leave leftovers that pull you back to spend more.' },
              { label: 'Gems are cheaper to process than dollars', credit: 0, why: 'You pay in dollars either way. The Gems are a layer on top.' },
              { label: 'It is required by law', credit: 0, why: 'No law requires it. It is a design choice.' },
            ],
          }),
      ],
      6: [
        () =>
          pick({
            brief: 'Your little brother spent $80 on crates in one evening using the family’s saved card, without asking.',
            prompt: 'What is the best next step?',
            options: [
              { label: 'Request a refund through the app store, then turn on purchase approval and remove the saved card', credit: 1, why: 'App stores often refund purchases made by children without permission, especially if you ask quickly. Then fix the settings so it cannot happen again.' },
              { label: 'Delete the game and say nothing', credit: 0.2, why: 'It stops new spending but leaves the $80 lost and the saved card ready for the next game.' },
              { label: 'Let him open more crates to win back something valuable', credit: 0, why: 'Chasing losses is the trap that turns $80 into $200.' },
            ],
          }),
      ],
    },
    outcome: (s) => {
      const n = s.opened.length;
      const got = s.opened.includes('legend');
      return {
        headline: n === 0 ? 'You kept all $50' : got ? `Lucky: a Legendary in ${n} crates` : `${usd(n * PRICE, 2)} spent, no Legendary`,
        detail: (
          <>
            <h4>Your session</h4>
            <p className="small" style={{ marginTop: 0 }}>
              {n === 0
                ? 'Walking away was the only move with a guaranteed result.'
                : got
                  ? 'You beat the odds this time. Most players who spend the same get nothing, and the win is what makes people come back.'
                  : `That is the usual result: with ${n} crates the chance of a Legendary was only about ${Math.round((1 - Math.pow(0.99, n)) * 100)}%.`}
            </p>
            <Table head={['Tier', 'You got', 'Expected']} rows={(['common', 'rare', 'epic', 'legend'] as Tier[]).map((t) => [NAME[t], String(s.opened.filter((x) => x === t).length), (n * { common: 0.79, rare: 0.15, epic: 0.05, legend: 0.01 }[t]).toFixed(1)])} />
          </>
        ),
      };
    },
    takeaways: [
      'Turn odds into a price: 1% at $2.50 means about $250 on average, and $750 to be nearly sure.',
      'Random rolls have no memory. You are never "due".',
      'Fake currencies, countdowns, near misses and streaks are design choices aimed at your wallet.',
      'If a direct price exists, it is almost always the cheaper way to get the thing you actually want.',
    ],
  };
  return <CaseRunner def={def} seed={seed} onFinish={onFinish} addReview={addReview} />;
}
