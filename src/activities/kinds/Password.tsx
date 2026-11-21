'use client';
import { useMemo, useRef, useState } from 'react';
import type { KindProps } from '../types';
import { makeRng } from '@/game/rng';
import { Button } from '@/ui/common';
import { playSfx } from '@/engine/audio';
import { act } from '@/store/game';
import { recordAnswer } from '@/game/progress/activities';

/** Rough brute-force guess space: characters^length, with penalties for dictionary words & patterns. */
export function strengthBits(pw: string): number {
  let pool = 0;
  if (/[a-z]/.test(pw)) pool += 26;
  if (/[A-Z]/.test(pw)) pool += 26;
  if (/\d/.test(pw)) pool += 10;
  if (/[^A-Za-z0-9]/.test(pw)) pool += 20;
  let bits = pw.length * Math.log2(Math.max(pool, 1));
  if (/password|1234|qwerty|abc|narwhal|fincity|letmein/i.test(pw)) bits *= 0.35;
  if (/^(.)\1+$/.test(pw)) bits *= 0.2;
  if (/\s/.test(pw) && pw.split(' ').length >= 4) bits += 8; // passphrases
  return bits;
}

const SETS = [
  ['password', 'Pizza7', 'Blue-Tiger-Rocket-Lamp', 'p@55w0rd'],
  ['123456', 'Narwhal2026', 'correct horse river cloud', 'Zq!8'],
  ['qwerty', 'Sunny123!', 'm7#Kp2!vQx9@Lw', 'abcabc'],
  ['fincity', 'IloveDogs', 'Purple Bike Ate 7 Tacos!', 'Ab1!'],
  ['letmein', 'Coin-Jar-Ocean-42', 'Tr0ub4dor', 'aaaaaaaa'],
  ['soccer', 'GoTeam!!', 'kite lemon violin anchor mango', 'Pa55'],
  ['iloveyou', 'Kitty99', 'Maple-Drum-Comet-Fern', 'b4n4n4'],
  ['111111', 'Basketball1', 'yellow moon jumps over seven fences', 'R7$k'],
  ['dragon', 'Summer2026!', 'Wq8#zL!3pX@n', 'zzzzzz'],
  ['monkey', 'Pancakes!', 'Twelve Green Owls Sing Loud', 'M1!'],
  ['abc123', 'Tacos4Life', 'Harbor-Pencil-Glacier-88', 'hi'],
  ['football', 'Mustang7', 'frog tuba candle orbit rain', 'x9$Q'],
  ['sunshine', 'Ninja_2026', '7rT!kq#Vb2@mZp', 'qqqqqqq'],
  ['princess', 'RedApple5', 'Slow Turtles Win 3 Races!', 'Ok1?'],
  ['qwerty123', 'Robot-Pizza', 'glow hammer pickle canyon', 'Bb2#'],
  ['baseball', 'Panda12', 'Violet-Rocket-Sandwich-Tide', 'A1b2'],
  ['welcome', 'Gamer4ever', 'My Cat Naps In 9 Boxes!', 'zZ9!'],
  ['shadow', 'Pizza*Party', 'k3#Lm!9pQ2&wXr', 'ccccccccc'],
  ['master', 'Tiger2020', 'orange piano bridge comet salad', 'H7&'],
  ['letmein1', 'Starfish9', 'Cloud-Ladder-Mango-Volcano', 'pw'],
  ['hello', 'HappyDays1', 'Blue Kites Fly Over 4 Hills', 'Y3$'],
  ['charlie', 'Sk8erBoi!', 'violin tunnel cactus marble beach', '11aa'],
  ['flower', 'Penguin77', 'Q!9zR#2vLm@8Tk', 'ffffffff'],
  ['pokemon', 'Chess4Win!', 'Seven Silly Geese Ate Soup', 'Rr5%'],
];

/** Order passwords from weakest to strongest. */
export default function Password({ params, onFinish, addReview, seed }: KindProps<{ rounds: number }>) {
  const rounds = useMemo(() => makeRng(seed).shuffle([...SETS]).slice(0, params.rounds), [seed, params.rounds]);
  const [r, setR] = useState(0);
  const [order, setOrder] = useState<string[]>([]);
  const [shown, setShown] = useState(false);
  const pts = useRef(0);
  const set = useMemo(() => makeRng(seed + r).shuffle([...rounds[r]]), [rounds, r, seed]);
  const correct = [...set].sort((a, b) => strengthBits(a) - strengthBits(b));
  const check = () => {
    let same = 0;
    order.forEach((p, i) => p === correct[i] && same++);
    const ok = same === correct.length;
    pts.current += same / correct.length;
    playSfx(ok ? 'correct' : 'wrong');
    act((d, fx) => recordAnswer(d, fx, { id: `pw-${r}`, topic: 'safety' }, ok));
    addReview?.({ q: `Weakest → strongest: ${set.join(', ')}`, ok, answer: correct.join(' → '), explanation: 'Length matters most. Long passphrases of random words beat short "clever" swaps like p@55w0rd, which attackers try first.' });
    setShown(true);
  };
  return (
    <div className="col" style={{ gap: 10 }}>
      <b>
        Round {r + 1}/{rounds.length}: tap the passwords from WEAKEST to STRONGEST
      </b>
      <div className="choices">
        {set.map((p) => (
          <button key={p} className={`choice ${order.includes(p) ? 'on' : ''}`} disabled={order.includes(p) || shown} onClick={() => setOrder([...order, p])}>
            <span className="choice-letter">{order.includes(p) ? order.indexOf(p) + 1 : '·'}</span>
            <span className="mono">{p}</span>
          </button>
        ))}
      </div>
      {shown ? (
        <div className="card">
          <b>Weakest → strongest:</b>
          {correct.map((p) => (
            <div key={p} className="row between small">
              <span className="mono">{p}</span>
              <span>{Math.round(strengthBits(p))} bits {strengthBits(p) < 30 ? '😱 cracked instantly' : strengthBits(p) < 50 ? '😬 weak' : strengthBits(p) < 70 ? '🙂 okay' : '💪 strong'}</span>
            </div>
          ))}
          <div className="small muted">Tip: use a long passphrase and never reuse passwords. A password manager helps!</div>
          <Button
            variant="primary"
            onClick={() => {
              if (r + 1 >= rounds.length) onFinish({ score: (pts.current / rounds.length) * 100 });
              else {
                setR(r + 1);
                setOrder([]);
                setShown(false);
              }
            }}
          >
            Next ▶
          </Button>
        </div>
      ) : (
        <div className="row">
          <Button onClick={() => setOrder([])}>Reset</Button>
          <Button variant="primary" disabled={order.length !== set.length} onClick={check}>
            Check
          </Button>
        </div>
      )}
    </div>
  );
}
