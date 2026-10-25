'use client';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useUI } from '@/store/ui';
import { useGame, act } from '@/store/game';
import { useSettings, keyLabel } from '@/store/settings';
import { currentStep, sayStep } from '@/game/progress/quests';
import { playSfx } from '@/engine/audio';
import { rt } from '@/engine/runtime';
import { speak, stopSpeaking } from '../speech';
import { narwhalFace } from '../narwhalArt';
import type { Mood } from '@/game/effects';

/*
 * First-play tour. The screen dims and each important part of the HUD is lit up in turn while
 * Narwhal explains it. The game stays paused (see isPaused) until the last step, then the
 * first quest line plays as usual.
 */

interface TourStep {
  /** CSS selector of the thing to light up; 'player' lights the middle of the screen. */
  target: string;
  title: string;
  entry: string;
  pro: string;
  mood: Mood;
  /** Only shown on touch screens. */
  touch?: boolean;
}

type Keys = ReturnType<typeof useSettings.getState>['keys'];

const STEPS = (k: Keys, touch: boolean): TourStep[] => [
  {
    target: 'player',
    title: 'This is you',
    entry: 'Hi! I am NextGen Narwhal. This is you, right in the middle of Fin City. Let me show you around the screen first.',
    pro: 'Welcome to Fin City. That is your character in the middle. Before you head out, here is a quick tour of the screen.',
    mood: 'hyped',
  },
  {
    target: '.narwhal-guide-body',
    title: 'NextGen Narwhal',
    entry: 'That is me! I live down here. When I have something to say, a bubble pops up. Tap me any time for a hint.',
    pro: 'I sit in the bottom left. I will flag new quests and news, and you can tap me for a hint whenever you are stuck.',
    mood: 'talking',
  },
  {
    target: '.narwhal-bubble.idle',
    title: 'Your quest',
    entry: 'This card tells you what to do next. Follow the sparkly light on the ground and it will take you there.',
    pro: 'Your current quest step lives here, with a progress bar when there is one. A light trail on the ground points the way.',
    mood: 'confident',
  },
  {
    target: '.map-corner',
    title: 'Your map',
    entry: 'This little round map shows where you are. Tap it, or press ' + keyLabel(k.map) + ', to see the whole city.',
    pro: 'The minimap shows your surroundings and the place name. Click it or press ' + keyLabel(k.map) + ' for the full city map and fast travel.',
    mood: 'confident',
  },
  {
    target: '.mini-phone',
    title: 'Your FinPhone',
    entry: 'This is your FinPhone. It shows the time, your FinBucks and your level. Open it to see your bank, quests and stuff. Press ' + keyLabel(k.phone) + '.',
    pro: 'Your FinPhone holds the bank, budget, quests, Learn hub and inventory. The screen shows the time, your cash and level. Shortcut: ' + keyLabel(k.phone) + '.',
    mood: 'talking',
  },
  {
    target: '.tl-buttons .corner-btn.square',
    title: 'Settings',
    entry: 'This gear opens Settings. You can turn on read-aloud, change the sound, or make the game run smoother.',
    pro: 'Settings: graphics quality, sound, read-aloud, controls and the length of a game month.',
    mood: 'confident',
  },
  {
    target: '.tl-buttons .corner-btn:not(.square)',
    title: 'Save & Exit',
    entry: 'The game saves by itself. When you want to stop, press Save & Exit and your world will be here next time.',
    pro: 'The game autosaves every 30 seconds. Save & Exit stores your world and takes you back to your saves.',
    mood: 'confident',
  },
  {
    target: '.joystick',
    title: 'Move around',
    entry: 'Drag this stick to walk. The round button jumps and the gold button talks to people and opens doors.',
    pro: 'Drag the stick to move. The round button jumps; the gold button interacts with people, doors and vehicles.',
    mood: 'talking',
    touch: true,
  },
  {
    target: 'player',
    title: 'Ready to play',
    entry: touch
      ? 'That is everything! Follow the sparkly light to your first quest. Have fun!'
      : 'Walk with W A S D or the arrow keys. Press ' + keyLabel(k.interact) + ' to talk to people and go through doors. That is everything. Have fun!',
    pro: touch
      ? 'That is the whole screen. Follow the light trail to your first quest.'
      : 'Move with W A S D or the arrows, hold Shift to run, and press ' + keyLabel(k.interact) + ' to interact. Follow the light trail to your first quest.',
    mood: 'hyped',
  },
];

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

function measure(target: string): Box | null {
  if (typeof window === 'undefined') return null;
  if (target === 'player') {
    const w = Math.min(220, window.innerWidth * 0.4);
    const h = Math.min(300, window.innerHeight * 0.42);
    return { x: window.innerWidth / 2 - w / 2, y: window.innerHeight * 0.52 - h / 2, w, h };
  }
  const el = document.querySelector(target);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  if (r.width < 2 || r.height < 2) return null;
  const pad = 8;
  return { x: r.left - pad, y: r.top - pad, w: r.width + pad * 2, h: r.height + pad * 2 };
}

/** Shows the tour: once for a brand-new world (see GameView), or again from Settings. */
export function startTour() {
  useUI.getState().closeAll();
  useUI.getState().clearNarwhal();
  useUI.setState({ tour: true });
}

export function HudTour() {
  const tour = useUI((s) => s.tour);
  const loading = useUI((s) => s.loading.active);
  const difficulty = useGame((s) => s.world?.difficulty ?? 'entry');
  const keys = useSettings((s) => s.keys);
  const readAloud = useSettings((s) => s.readAloud);
  const [touch, setTouch] = useState(false);
  const [i, setI] = useState(0);
  const [box, setBox] = useState<Box | null>(null);
  const [ready, setReady] = useState(false);
  const bubble = useRef<HTMLDivElement>(null);
  const [bh, setBh] = useState(180);

  useEffect(() => {
    setTouch(typeof window !== 'undefined' && (window.matchMedia?.('(pointer: coarse)').matches || 'ontouchstart' in window));
  }, []);

  // Wait for the loading screen and any arrival flyover before dimming the screen.
  useEffect(() => {
    if (!tour) return setReady(false);
    if (loading) return;
    const id = setInterval(() => {
      if (!rt.flyover && !rt.flyoverPending) {
        setReady(true);
        clearInterval(id);
      }
    }, 150);
    return () => clearInterval(id);
  }, [tour, loading]);

  const steps = useMemo(() => STEPS(keys, touch).filter((s) => !s.touch || touch), [keys, touch]);
  const step = steps[Math.min(i, steps.length - 1)];

  // Follow the target while it is lit (the HUD can reflow when the window resizes).
  useLayoutEffect(() => {
    if (!tour || !ready || !step) return;
    let raf = 0;
    const tick = () => {
      const b = measure(step.target);
      setBox((old) => (old && b && old.x === b.x && old.y === b.y && old.w === b.w && old.h === b.h ? old : b));
      raf = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(raf);
  }, [tour, ready, step]);

  const text = step ? (difficulty === 'entry' ? step.entry : step.pro) : '';
  useEffect(() => {
    if (tour && ready && readAloud && text) speak(text);
  }, [tour, ready, readAloud, text]);

  const finish = useCallback(() => {
    stopSpeaking();
    setI(0);
    useUI.setState({ tour: false });
    act((d, fx) => {
      // The first quest line waits for the first tour; a replay from Settings just closes.
      const first = !d.progress.flags.tourDone;
      d.progress.flags.tourDone = true;
      const cs = currentStep(d);
      if (first && cs) sayStep(d, fx, cs.step);
    });
  }, []);

  const go = useCallback(
    (delta: number) => {
      playSfx(delta > 0 ? 'pop' : 'click');
      stopSpeaking();
      if (i + delta >= steps.length) return finish();
      setI(Math.max(0, i + delta));
    },
    [i, steps.length, finish],
  );

  useEffect(() => {
    if (!tour || !ready) return;
    const h = (e: KeyboardEvent) => {
      if (e.code === 'Enter' || e.code === 'Space' || e.code === 'ArrowRight') go(1);
      else if (e.code === 'ArrowLeft') go(-1);
      else if (e.code === 'Escape') finish();
      else return;
      e.preventDefault();
      e.stopPropagation();
    };
    window.addEventListener('keydown', h, true);
    return () => window.removeEventListener('keydown', h, true);
  }, [tour, ready, go, finish]);

  // A target that is not on screen (e.g. the joystick before the first touch) is skipped.
  useEffect(() => {
    if (!tour || !ready || !step || step.target === 'player') return;
    const t = setTimeout(() => {
      if (!measure(step.target)) go(1);
    }, 400);
    return () => clearTimeout(t);
  }, [tour, ready, step, go]);

  useLayoutEffect(() => {
    const el = bubble.current;
    if (!el) return;
    const h = el.offsetHeight;
    if (Math.abs(h - bh) > 1) setBh(h);
  });

  if (!tour || !ready || !step) return null;
  const vw = typeof window !== 'undefined' ? window.innerWidth : 1280;
  const vh = typeof window !== 'undefined' ? window.innerHeight : 800;
  const b = box ?? { x: vw / 2, y: vh / 2, w: 0, h: 0 };
  // The bubble goes on whichever side of the light has more room.
  const bw = Math.min(400, vw - 24);
  const roomBelow = vh - (b.y + b.h + 16) - 8;
  const roomAbove = b.y - 16 - 8;
  const below = roomBelow >= bh || (roomAbove < bh && roomBelow >= roomAbove);
  const left = Math.max(12, Math.min(vw - bw - 12, b.x + b.w / 2 - bw / 2));
  // Measured height keeps the whole bubble on screen, even on a phone held sideways.
  const top = Math.max(8, Math.min(vh - bh - 8, below ? b.y + b.h + 16 : b.y - 16 - bh));
  const pos: React.CSSProperties = { top, left, width: bw, maxHeight: vh - 16 };
  const last = i >= steps.length - 1;

  return (
    <div className="hud-tour" role="dialog" aria-modal="true" aria-label="Screen tour">
      <div className="tour-light" style={{ left: b.x, top: b.y, width: b.w, height: b.h, borderRadius: step.target === 'player' ? '50%' : undefined }} />
      <div className="narwhal-bubble tour-bubble" style={pos} key={i} ref={bubble}>
        <div className="narwhal-bubble-head">
          <img src={narwhalFace(step.mood)} alt="" />
          <span>NextGen Narwhal</span>
          <span className="grow" />
          <span className="tour-count">
            {i + 1} / {steps.length}
          </span>
        </div>
        <b className="tour-title">{step.title}</b>
        <p>{text}</p>
        <div className="tour-actions">
          <button type="button" className="btn small ghost" onClick={finish}>
            Skip tour
          </button>
          <span className="grow" />
          {i > 0 && (
            <button type="button" className="btn small" onClick={() => go(-1)}>
              Back
            </button>
          )}
          <button type="button" className="btn small primary" onClick={() => go(1)} autoFocus>
            {last ? 'Start playing' : 'Next'}
          </button>
        </div>
      </div>
    </div>
  );
}

