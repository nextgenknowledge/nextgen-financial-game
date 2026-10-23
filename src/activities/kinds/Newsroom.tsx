'use client';
import { useMemo } from 'react';
import type { KindProps } from '../types';
import { makeRng } from '@/game/rng';
import { HEADLINES, SECURITIES, affects } from '@/game/market/market';
import { QuestionRounds, synthQ } from '../QuestionSeq';

/** Headline → which company? which direction? how big? */
export default function Newsroom({ params, difficulty, onFinish, addReview, seed }: KindProps<{ rounds: number; magnitude: boolean }>) {
  const entry = difficulty === 'entry';
  const rounds = useMemo(() => {
    const rng = makeRng(seed);
    return rng
      .shuffle([...HEADLINES])
      .slice(0, params.rounds)
      .map((h) => {
        const dir = h.direction ?? (h.impact > 0.015 ? 'up' : h.impact < -0.015 ? 'down' : 'flat');
        const affected = SECURITIES.filter((s) => affects(h, s));
        const qs = [];
        if (!entry && affected.length === 1) {
          const others = rng.shuffle(SECURITIES.filter((s) => s.kind === 'stock' && s.symbol !== affected[0].symbol)).slice(0, 3);
          qs.push(
            synthQ({
              id: `news-who:${h.id}`,
              prompt: 'Which stock is most directly affected?',
              topic: 'investing',
              choices: [affected[0], ...others].map((s) => `${s.icon} ${s.name} (${s.symbol})`),
              correct: 0,
              explanation: `The headline is about ${affected[0].name}.`,
            }),
          );
        }
        const dirChoices = ['📈 Goes up', '📉 Goes down', '➖ Barely moves'];
        qs.push(
          synthQ({
            id: `news-dir:${h.id}`,
            prompt: entry ? 'Is this good news or bad news for the company? What happens to its stock?' : 'How does the stock price most likely react?',
            topic: 'investing',
            choices: dirChoices,
            correct: dir === 'up' ? 0 : dir === 'down' ? 1 : 2,
            explanation: h.why,
          }),
        );
        if (params.magnitude && dir !== 'flat') {
          const mag = Math.abs(h.impact);
          qs.push(
            synthQ({
              id: `news-mag:${h.id}`,
              prompt: 'How big is the move likely to be?',
              topic: 'investing',
              choices: ['Small (under 3%)', 'Medium (3–8%)', 'Large (over 8%)'],
              correct: mag < 0.03 ? 0 : mag <= 0.08 ? 1 : 2,
              explanation: `This kind of news moved the price about ${(mag * 100).toFixed(0)}%. Surprises about future profits move prices most; expected news is often already "priced in".`,
            }),
          );
        }
        return {
          context: (
            <div className="newspaper">
              <div className="tiny bold">FIN CITY FINANCIAL TIMES</div>
              <div className="headline">{entry ? h.entryText : h.text}</div>
            </div>
          ),
          questions: qs.map((q) => ({ ...q, choices: q.choices })),
        };
      });
  }, [seed, params.rounds, params.magnitude, entry]);
  return <QuestionRounds rounds={rounds} entry={entry} onFinish={onFinish} addReview={addReview} />;
}
