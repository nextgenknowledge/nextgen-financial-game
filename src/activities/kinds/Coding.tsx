'use client';
import { useMemo, useRef, useState } from 'react';
import type { KindProps } from '../types';
import { Button } from '@/ui/common';
import { playSfx } from '@/engine/audio';
import { cls } from '@/ui/format';

type Cmd = 'F' | 'L' | 'R' | 'P' | `${number}x`;
interface Level {
  size: number;
  start: [number, number, number]; // x, y, dir (0 up, 1 right, 2 down, 3 left)
  coins: [number, number][];
  walls: [number, number][];
  par: number; // target without loops
  parLoops: number; // target with loops (a loop + its command counts as 1)
}

const LEVELS: Level[] = [
  { size: 5, start: [0, 4, 0], coins: [[0, 1]], walls: [], par: 3, parLoops: 1 },
  { size: 5, start: [0, 4, 1], coins: [[3, 4], [3, 2]], walls: [[1, 3], [2, 3]], par: 6, parLoops: 3 },
  { size: 6, start: [0, 5, 0], coins: [[0, 2], [3, 2]], walls: [[1, 3], [2, 4]], par: 7, parLoops: 3 },
  { size: 6, start: [0, 0, 1], coins: [[5, 0], [5, 5], [0, 5]], walls: [[2, 2], [3, 3]], par: 17, parLoops: 5 },
  { size: 7, start: [0, 6, 0], coins: [[0, 0], [6, 0], [6, 6]], walls: [[3, 3], [2, 2], [4, 4]], par: 20, parLoops: 5 },
];

/** A loop marker and the command it repeats count as one command. */
function cmdCount(prog: Cmd[]) {
  return prog.filter((c) => !c.endsWith('x')).length;
}

const DX = [0, 1, 0, -1];
const DY = [-1, 0, 1, 0];

function expand(prog: Cmd[], loops: boolean): ('F' | 'L' | 'R')[] {
  // "3x" repeats the NEXT command 3 times (Advanced loops)
  const out: ('F' | 'L' | 'R')[] = [];
  for (let i = 0; i < prog.length; i++) {
    const c = prog[i];
    if (c.endsWith('x')) {
      const n = parseInt(c, 10);
      const next = prog[i + 1];
      if (next && !next.endsWith('x') && next !== 'P') for (let k = 0; k < n; k++) out.push(next as 'F' | 'L' | 'R');
      i++;
    } else if (c !== 'P') out.push(c as 'F' | 'L' | 'R');
  }
  void loops;
  return out;
}

/** Program a robot with Forward/Left/Right (and loops in Advanced) to collect every coin. */
export default function Coding({ params, onFinish }: KindProps<{ levels: number; loops: boolean }>) {
  const levels = useMemo(() => LEVELS.slice(0, params.levels), [params.levels]);
  const [li, setLi] = useState(0);
  const [prog, setProg] = useState<Cmd[]>([]);
  const [bot, setBot] = useState<[number, number, number]>(levels[0].start);
  const [got, setGot] = useState<string[]>([]);
  const [running, setRunning] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const pts = useRef(0);
  const L = levels[li];

  const reset = (keepProg = true) => {
    setBot(L.start);
    setGot([]);
    setMsg(null);
    if (!keepProg) setProg([]);
  };

  const run = async () => {
    reset();
    setRunning(true);
    let [x, y, d] = L.start;
    const collected = new Set<string>();
    const steps = expand(prog, params.loops);
    for (const s of steps) {
      await new Promise((r) => setTimeout(r, 260));
      if (s === 'L') d = (d + 3) % 4;
      else if (s === 'R') d = (d + 1) % 4;
      else {
        const nx = x + DX[d];
        const ny = y + DY[d];
        if (nx < 0 || ny < 0 || nx >= L.size || ny >= L.size || L.walls.some(([wx, wy]) => wx === nx && wy === ny)) {
          playSfx('error');
          setMsg('💥 Bonk! The robot hit a wall. Edit your program and try again.');
          setRunning(false);
          return;
        }
        x = nx;
        y = ny;
        if (L.coins.some(([cx, cy]) => cx === x && cy === y) && !collected.has(`${x},${y}`)) {
          collected.add(`${x},${y}`);
          playSfx('coin');
          setGot([...collected]);
        }
      }
      setBot([x, y, d]);
    }
    setRunning(false);
    if (collected.size === L.coins.length) {
      const len = cmdCount(prog);
      const par = params.loops ? L.parLoops : L.par;
      const p = len <= par ? 1 : Math.max(0.5, 1 - (len - par) * 0.1);
      pts.current += p;
      playSfx('correct');
      setMsg(`🎉 All coins! Program length ${len} (target ${par}). ${p === 1 ? 'Perfect, efficient code earns full pay!' : 'Shorter programs pay more.'}`);
    } else setMsg(`The robot stopped with ${collected.size}/${L.coins.length} coins. Keep going!`);
  };

  const solved = got.length === L.coins.length && !running;
  const add = (c: Cmd) => !running && prog.length < 24 && setProg([...prog, c]);
  return (
    <div className="row wrap" style={{ gap: 16, alignItems: 'flex-start' }}>
      <div className="robot-grid" style={{ gridTemplateColumns: `repeat(${L.size}, 1fr)` }}>
        {Array.from({ length: L.size * L.size }, (_, i) => {
          const x = i % L.size;
          const y = Math.floor(i / L.size);
          const wall = L.walls.some(([a, b]) => a === x && b === y);
          const coin = L.coins.some(([a, b]) => a === x && b === y) && !got.includes(`${x},${y}`);
          const isBot = bot[0] === x && bot[1] === y;
          return (
            <div key={i} className={cls('robot-cell', wall && 'wall')}>
              {isBot ? <span style={{ display: 'inline-block', transform: `rotate(${bot[2] * 90}deg)` }}>🔼</span> : coin ? '🪙' : ''}
            </div>
          );
        })}
      </div>
      <div className="col grow" style={{ minWidth: 260, gap: 8 }}>
        <b>
          Puzzle {li + 1}/{levels.length} · collect every 🪙 · target: {params.loops ? L.parLoops : L.par} commands · yours: {cmdCount(prog)}
        </b>
        <div className="row wrap" style={{ gap: 6 }}>
          <Button onClick={() => add('F')}>⬆️ Forward</Button>
          <Button onClick={() => add('L')}>↩️ Turn left</Button>
          <Button onClick={() => add('R')}>↪️ Turn right</Button>
          {params.loops &&
            [2, 3, 4, 5, 6].map((n) => (
              <Button key={n} variant="blue" onClick={() => add(`${n}x` as Cmd)}>
                🔁 {n}×
              </Button>
            ))}
        </div>
        {params.loops && <div className="tiny muted">🔁 n× repeats the NEXT command n times (counts as 1 command).</div>}
        <div className="program">
          {prog.length === 0 && <span className="muted small">Your program is empty.</span>}
          {prog.map((c, i) => (
            <button key={i} className="prog-cmd" onClick={() => !running && setProg(prog.filter((_, j) => j !== i))}>
              {c === 'F' ? '⬆️' : c === 'L' ? '↩️' : c === 'R' ? '↪️' : `🔁${c}`}
            </button>
          ))}
        </div>
        {msg && <div className="card small">{msg}</div>}
        <div className="row wrap" style={{ gap: 6 }}>
          <Button variant="green" disabled={running || !prog.length} onClick={run}>
            ▶ Run
          </Button>
          <Button disabled={running} onClick={() => reset(false)}>
            Clear
          </Button>
          {solved && (
            <Button
              variant="gold"
              onClick={() => {
                if (li + 1 >= levels.length) onFinish({ score: (pts.current / levels.length) * 100 });
                else {
                  setLi(li + 1);
                  setProg([]);
                  setBot(levels[li + 1].start);
                  setGot([]);
                  setMsg(null);
                }
              }}
            >
              {li + 1 >= levels.length ? 'Get paid 💵' : 'Next puzzle ▶'}
            </Button>
          )}
          <Button size="small" variant="ghost" onClick={() => onFinish({ score: (pts.current / levels.length) * 100 })}>
            Stop & get paid
          </Button>
        </div>
      </div>
    </div>
  );
}
