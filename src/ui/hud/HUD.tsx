'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useGame, act } from '@/store/game';
import { useUI } from '@/store/ui';
import { useSettings, keyLabel } from '@/store/settings';
import { useScene } from '@/store/scene';
import { netWorth } from '@/game/finance/netWorth';
import { monthLabel } from '@/game/world';
import { xpForLevel } from '@/game/progress/xp';
import { currentStep } from '@/game/progress/quests';
import { recordEvent } from '@/game/progress/events';
import { hourOf } from '@/engine/Sky';
import { rt } from '@/engine/runtime';
import { virtual } from '@/engine/input';
import { interact } from '../interact';
import { money, shortMoney, cls } from '../format';
import { speak, stopSpeaking } from '../speech';
import { drawNarwhalPortrait } from '@/world/narwhalFace';
import type { Mood } from '@/game/effects';
import { CITY_META } from '@/world/cities';
import { useRide, getOff } from '@/world/ParkedVehicles';
import { Minimap } from './Minimap';
import { playSfx } from '@/engine/audio';
import { Toasts } from '../Toasts';

export function HUD() {
  const world = useGame((s) => s.world);
  const panel = useUI((s) => s.panel);
  const talking = useUI((s) => s.narwhal.length > 0);
  if (!world) return null;
  return (
    // Named layout regions (see .hud grid in globals.css): pieces flow inside their region,
    // so nothing can overlap whatever the window size.
    <div className={cls('hud', world.difficulty === 'entry' && 'entry-mode', talking && 'talking')}>
      <div className="hud-region r-tl">
        <MoneyBar />
        <QuestTracker />
      </div>
      <div className="hud-region r-tc">
        <ArrivalBanner />
        <Compass />
        <WorldActivityHud />
        <Toasts inline />
      </div>
      <div className="hud-region r-tr">
        <TopRight />
      </div>
      <div className="hud-region r-ml">
        <MenuButtons />
      </div>
      <div className="hud-region r-bc">{!panel && <InteractPrompt />}</div>
      <div className="hud-region r-br">
        {!panel && !talking && <KeyHints />}
        <FpsCounter />
      </div>
      <div className="hud-region r-dlg">
        <NarwhalDialog />
      </div>
      <TouchControls />
    </div>
  );
}

function MoneyBar() {
  const f = useGame((s) => s.world!.finance);
  const w = useGame((s) => s.world!);
  const happiness = useGame((s) => s.world!.player.happiness);
  const nw = useMemo(() => netWorth(w).total, [w]);
  const open = useUI((s) => s.open);
  const bank = f.checking + f.savings;
  const prev = useRef(f.cash + bank);
  const [flash, setFlash] = useState<'up' | 'down' | null>(null);
  useEffect(() => {
    const now = f.cash + bank;
    if (Math.abs(now - prev.current) > 0.009) {
      setFlash(now > prev.current ? 'up' : 'down');
      const t = setTimeout(() => setFlash(null), 700);
      prev.current = now;
      return () => clearTimeout(t);
    }
  }, [f.cash, bank]);
  return (
    <div className="hud-money">
      <button className={cls('pill', flash && `flash-${flash}`)} onClick={() => open({ type: 'phone', app: 'bank' })} title="Cash in your pocket">
        <span className="pill-icon">💵</span>
        <span className="pill-label">Cash</span>
        <b className="mono">{money(f.cash)}</b>
      </button>
      {(f.hasChecking || f.hasSavings) && (
        <button className="pill" onClick={() => open({ type: 'phone', app: 'bank' })} title="Checking + savings">
          <span className="pill-icon">🏦</span>
          <span className="pill-label">Bank</span>
          <b className="mono">{shortMoney(bank)}</b>
        </button>
      )}
      <button
        className="pill nw"
        onClick={() => {
          open({ type: 'phone', app: 'networth' });
          act((d, fx) => recordEvent(d, fx, { type: 'menu', target: 'networth' }));
        }}
        title="Net worth = what you own − what you owe"
      >
        <span className="pill-icon">📈</span>
        <span className="pill-label">Net worth</span>
        <b className={cls('mono', nw < 0 && 'bad')}>{shortMoney(nw)}</b>
      </button>
      <div className="pill small-pill" title={`Happiness ${happiness}/100. Above 70 boosts XP!`}>
        <span className="pill-icon">{happiness >= 75 ? '😄' : happiness >= 50 ? '🙂' : happiness >= 30 ? '😐' : '😟'}</span>
        <div className="mini-bar">
          <div style={{ width: `${happiness}%`, background: happiness >= 70 ? 'var(--good)' : happiness >= 40 ? 'var(--gold)' : 'var(--bad)' }} />
        </div>
      </div>
    </div>
  );
}

function TopRight() {
  const month = useGame((s) => s.world!.time.month);
  const t = useGame((s) => s.world!.time.t);
  const level = useGame((s) => s.world!.progress.level);
  const xp = useGame((s) => s.world!.progress.xp);
  const tickets = useGame((s) => s.world!.progress.tickets);
  const location = useScene((s) => s.location);
  const lo = xpForLevel(level);
  const hi = xpForLevel(level + 1);
  const h = hourOf(t);
  const hh = Math.floor(h);
  const ampm = hh >= 12 ? 'pm' : 'am';
  const h12 = hh % 12 === 0 ? 12 : hh % 12;
  const night = h < 6 || h >= 19;
  const weatherIcon = rt.weather === 'rain' ? '🌧️' : rt.weather === 'snow' ? '🌨️' : rt.weather === 'cloudy' ? '⛅' : rt.weather === 'fog' ? '🌫️' : rt.weather === 'haze' ? '🌤️' : night ? '🌙' : '☀️';
  return (
    <div className="hud-topright">
      <div className="hud-card">
        <div className="row between" style={{ gap: '0.5rem' }}>
          <span className="bold">
            {CITY_META[location].icon} {CITY_META[location].name}
          </span>
          <span>{weatherIcon}</span>
        </div>
        <div className="row between small" style={{ gap: '0.5rem' }}>
          <span className="pixel">{monthLabel(month)}</span>
          <span className="mono muted">
            {h12}:{String(Math.floor((h - hh) * 60 / 15) * 15).padStart(2, '0')}
            {ampm}
          </span>
        </div>
        <div className="month-bar" title="Month progress: bills, interest and paychecks happen at the end of each month">
          <div style={{ width: `${t * 100}%` }} />
        </div>
      </div>
      <div className="hud-card level">
        <div className="lvl-badge pixel">{level}</div>
        <div className="col grow" style={{ gap: 2 }}>
          <span className="tiny bold">
            Level {level} · {xp - lo}/{hi - lo} XP
          </span>
          <div className="mini-bar xp">
            <div style={{ width: `${((xp - lo) / (hi - lo)) * 100}%` }} />
          </div>
          {tickets > 0 && <span className="tiny">🎟️ {tickets} tickets</span>}
        </div>
      </div>
      <Minimap />
    </div>
  );
}

function QuestTracker() {
  const w = useGame((s) => s.world!);
  const hints = useSettings((s) => s.hints);
  const cs = useMemo(() => currentStep(w), [w]);
  const say = useUI((s) => s.sayNarwhal);
  const daily = w.progress.daily.list;
  if (!cs && !daily.length) return null;
  const entry = w.difficulty === 'entry';
  return (
    <div className="hud-quest">
      {cs && (
        <button
          className="quest-card"
          onClick={() => {
            playSfx('pop');
            const lines = entry && cs.step.entrySay ? cs.step.entrySay : cs.step.say;
            say(lines?.[lines.length - 1] ?? cs.step.text, 'talking');
          }}
          title="Click for a hint from Narwhal"
        >
          <div className="tiny muted bold">
            {cs.quest.icon} {cs.quest.title} · {cs.index + 1}/{cs.quest.steps.length}
          </div>
          <div className="bold">{entry && cs.step.entryText ? cs.step.entryText : cs.step.text}</div>
          {cs.step.goal.type === 'move' && (
            <div className="mini-bar" style={{ marginTop: 4 }}>
              <div style={{ width: `${Math.min(100, (cs.progress / (cs.step.goal.value ?? 1)) * 100)}%` }} />
            </div>
          )}
          {hints && <div className="tiny muted">💡 Tap for a hint · follow the ✨ light</div>}
        </button>
      )}
    </div>
  );
}

function Compass() {
  const [state, setState] = useState<{ angle: number; dist: number; label?: string } | null>(null);
  const hints = useSettings((s) => s.hints);
  useEffect(() => {
    const id = setInterval(() => {
      const g = rt.goal;
      if (!g) return setState(null);
      const dx = g.x - rt.player.x;
      const dz = g.z - rt.player.z;
      const dist = Math.hypot(dx, dz);
      // Angle relative to camera forward
      const camF = Math.atan2(-Math.sin(rt.camYaw), -Math.cos(rt.camYaw));
      const ang = Math.atan2(dx, dz) - camF;
      setState({ angle: -ang, dist, label: g.label });
    }, 120);
    return () => clearInterval(id);
  }, []);
  if (!state || !hints || state.dist < 4) return null;
  return (
    <div className="hud-compass" aria-label={`Goal ${Math.round(state.dist)} meters away`}>
      <div className="arrow" style={{ transform: `rotate(${state.angle}rad)` }}>
        ▲
      </div>
      <span className="tiny bold">
        {state.label ? `${state.label} · ` : ''}
        {Math.round(state.dist)}m
      </span>
    </div>
  );
}

function InteractPrompt() {
  const prompt = useUI((s) => s.prompt);
  const key = useSettings((s) => s.keys.interact);
  const riding = useRide((s) => s.riding);
  if (riding) {
    return (
      <div className="hud-prompt">
        <button className="prompt-btn" onClick={() => getOff()}>
          <kbd>{keyLabel(key)}</kbd> Get off
        </button>
      </div>
    );
  }
  if (!prompt) return null;
  return (
    <div className="hud-prompt">
      <button className="prompt-btn" onClick={() => interact(rt.nearTrigger)}>
        <kbd>{keyLabel(key)}</kbd> {prompt.icon} {prompt.text}
      </button>
    </div>
  );
}

export function NarwhalPortrait({ mood, size = 96 }: { mood: Mood; size?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const g = c.getContext('2d')!;
    drawNarwhalPortrait(g, c.width, mood);
  }, [mood]);
  return <canvas ref={ref} width={size * 2} height={size * 2} style={{ width: size, height: size }} aria-label={`NextGen Narwhal looking ${mood}`} />;
}

function NarwhalDialog() {
  const line = useUI((s) => s.narwhal[0]);
  const count = useUI((s) => s.narwhal.length);
  const next = useUI((s) => s.nextNarwhal);
  const clear = useUI((s) => s.clearNarwhal);
  const readAloud = useSettings((s) => s.readAloud);
  const [shown, setShown] = useState('');
  const reduced = useSettings((s) => s.reducedMotion);
  // Typewriter
  useEffect(() => {
    if (!line) return;
    if (reduced) return setShown(line.text);
    setShown('');
    let i = 0;
    const id = setInterval(() => {
      i += 2;
      setShown(line.text.slice(0, i));
      if (i >= line.text.length) clearInterval(id);
    }, 16);
    if (readAloud) speak(line.text);
    return () => clearInterval(id);
  }, [line, readAloud, reduced]);
  useEffect(() => {
    if (!line) return;
    const h = (e: KeyboardEvent) => {
      if ((e.code === 'Enter' || e.code === 'Space') && !useUI.getState().panel) {
        if (shown.length < line.text.length) setShown(line.text);
        else {
          stopSpeaking();
          next();
        }
        e.preventDefault();
      }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [line, shown, next]);
  if (!line) return null;
  const speaker = line.text.match(/^([A-Z][\w .']+): “/);
  return (
    <div className="hud-dialog" role="dialog" aria-live="polite">
      <div className="dialog-portrait">
        <NarwhalPortrait mood={line.mood} />
      </div>
      <div className="dialog-body">
        <div className="row between">
          <b className="pixel" style={{ color: 'var(--teal-dark)' }}>
            {speaker ? speaker[1] : 'NextGen Narwhal'}
          </b>
          <div className="row" style={{ gap: 4 }}>
            <button className="btn icon small ghost" title="Read aloud" onClick={() => speak(line.text)}>
              🔊
            </button>
            {count > 1 && (
              <button className="btn small ghost" onClick={() => (stopSpeaking(), clear())} title="Skip all">
                Skip all
              </button>
            )}
          </div>
        </div>
        <p className="dialog-text">{shown}</p>
        {line.choices ? (
          <div className="row wrap">
            {line.choices.map((c) => (
              <button
                key={c.label}
                className="btn small primary"
                onClick={() => {
                  next();
                  c.onPick();
                }}
              >
                {c.label}
              </button>
            ))}
          </div>
        ) : (
          <div className="row" style={{ justifyContent: 'flex-end' }}>
            <button
              className="btn small primary"
              onClick={() => {
                playSfx('click');
                if (shown.length < line.text.length) setShown(line.text);
                else {
                  stopSpeaking();
                  next();
                }
              }}
            >
              {count > 1 ? `Next ▶ (${count - 1})` : 'Got it! ✓'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function MenuButtons() {
  const open = useUI((s) => s.open);
  const panel = useUI((s) => s.panel);
  const keys = useSettings((s) => s.keys);
  const btns: { icon: string; label: string; key: string; onClick: () => void }[] = [
    {
      icon: '📱',
      label: 'FinPhone',
      key: keys.phone,
      onClick: () => {
        open({ type: 'phone' });
        act((d, fx) => recordEvent(d, fx, { type: 'menu', target: 'phone' }));
      },
    },
    { icon: '🗺️', label: 'Map', key: keys.map, onClick: () => open({ type: 'map' }) },
    { icon: '🎒', label: 'Bag', key: keys.inventory, onClick: () => open({ type: 'phone', app: 'bag' }) },
    { icon: '⏸️', label: 'Pause', key: keys.pause, onClick: () => open({ type: 'pause' }) },
  ];
  if (panel) return null;
  return (
    <div className="hud-menu">
      {btns.map((b) => (
        <button key={b.label} className="menu-btn" onClick={() => (playSfx('pop'), b.onClick())} title={`${b.label} (${keyLabel(b.key)})`}>
          <span className="menu-icon">{b.icon}</span>
          <span className="menu-label">{b.label}</span>
          <kbd>{keyLabel(b.key)}</kbd>
        </button>
      ))}
    </div>
  );
}

function KeyHints() {
  const k = useSettings((s) => s.keys);
  const riding = useRide((s) => s.riding);
  const hints = riding
    ? [
        [`${keyLabel(k.forward)}/${keyLabel(k.back)}`, 'Gas / reverse'],
        [`${keyLabel(k.left)}/${keyLabel(k.right)}`, 'Steer'],
        [keyLabel(k.jump), 'Brake · fly up'],
        [keyLabel(k.sprint), 'Boost · fly down'],
        [keyLabel(k.interact), 'Get off'],
      ]
    : [
        [`${keyLabel(k.forward)}${keyLabel(k.left)}${keyLabel(k.back)}${keyLabel(k.right)}`, 'Move'],
        [keyLabel(k.sprint), 'Sprint'],
        [keyLabel(k.jump), 'Jump'],
        [keyLabel(k.interact), 'Interact'],
        ['Drag', 'Look'],
        ['Click', 'Walk there'],
      ];
  return (
    <div className="hud-keys" aria-hidden>
      {hints.map(([key, label]) => (
        <span key={label}>
          <kbd>{key}</kbd> {label}
        </span>
      ))}
    </div>
  );
}

/** On-screen joystick + buttons for touch devices. */
function TouchControls() {
  const [touch, setTouch] = useState(false);
  const base = useRef<{ x: number; y: number; id: number } | null>(null);
  const [knob, setKnob] = useState({ x: 0, y: 0 });
  useEffect(() => {
    const on = () => setTouch(true);
    window.addEventListener('touchstart', on, { once: true });
    return () => window.removeEventListener('touchstart', on);
  }, []);
  if (!touch) return null;
  return (
    <>
      <div
        className="joystick"
        onPointerDown={(e) => {
          (e.target as HTMLElement).setPointerCapture(e.pointerId);
          base.current = { x: e.clientX, y: e.clientY, id: e.pointerId };
        }}
        onPointerMove={(e) => {
          const b = base.current;
          if (!b || b.id !== e.pointerId) return;
          const dx = Math.max(-50, Math.min(50, e.clientX - b.x));
          const dy = Math.max(-50, Math.min(50, e.clientY - b.y));
          setKnob({ x: dx, y: dy });
          virtual.x = dx / 50;
          virtual.y = -dy / 50;
          virtual.sprint = Math.hypot(dx, dy) > 45;
        }}
        onPointerUp={() => {
          base.current = null;
          setKnob({ x: 0, y: 0 });
          virtual.x = virtual.y = 0;
          virtual.sprint = false;
        }}
      >
        <div className="knob" style={{ transform: `translate(${knob.x}px, ${knob.y}px)` }} />
      </div>
      <div className="touch-buttons">
        <button
          className="touch-btn"
          onPointerDown={() => (virtual.jump = true)}
          onPointerUp={() => (virtual.jump = false)}
          onPointerLeave={() => (virtual.jump = false)}
        >
          ⤒
        </button>
        <button className="touch-btn gold" onClick={() => interact(rt.nearTrigger)}>
          E
        </button>
      </div>
    </>
  );
}

function WorldActivityHud() {
  const wa = useUI((s) => s.worldActivity);
  if (!wa) return null;
  const d = (wa.data ?? {}) as { title?: string; lines?: string[]; timeLeft?: number };
  return (
    <div className="hud-activity">
      <b className="pixel">{d.title ?? 'Activity'}</b>
      {typeof d.timeLeft === 'number' && <div className="pixel big">⏱️ {Math.ceil(d.timeLeft)}s</div>}
      {(d.lines ?? []).map((l, i) => (
        <div key={i} className="small">
          {l}
        </div>
      ))}
    </div>
  );
}

function FpsCounter() {
  const show = useSettings((s) => s.showFps);
  const fps = useUI((s) => s.fps);
  if (!show) return null;
  return <div className="hud-fps mono">{fps} fps</div>;
}

/** "Welcome to …" title card shown for a few seconds after arriving in a city. */
function ArrivalBanner() {
  const location = useScene((s) => s.location);
  const interior = useScene((s) => s.interior);
  const loading = useUI((s) => s.loading.active);
  const [show, setShow] = useState<string | null>(null);
  const [skip, setSkip] = useState(false);
  const last = useRef<string | null>(null);
  useEffect(() => {
    if (interior || loading) return;
    if (last.current === location) return;
    last.current = location;
    setShow(location);
    const fly = !!(rt.flyover || rt.flyoverPending);
    setSkip(fly);
    const t = setTimeout(() => setShow(null), fly ? 7000 : 4200);
    return () => clearTimeout(t);
  }, [location, interior, loading]);
  if (!show) return null;
  const meta = CITY_META[show as keyof typeof CITY_META];
  return (
    <div className="arrival-banner" aria-live="polite">
      <div className="arrival-kicker">{show === 'park' ? 'Home base' : 'Welcome to'}</div>
      <div className="pixel arrival-name">{meta.name}</div>
      <div className="arrival-sub">{meta.theme}</div>
      {skip && <div className="arrival-skip">Press any key to skip</div>}
    </div>
  );
}
