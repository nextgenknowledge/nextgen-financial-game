'use client';
import { textFor } from '@/game/activities';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useGame, act } from '@/store/game';
import { useUI } from '@/store/ui';
import { useSettings, keyLabel } from '@/store/settings';
import { useScene } from '@/store/scene';
import { currentStep } from '@/game/progress/quests';
import { recordEvent } from '@/game/progress/events';
import { hourOf } from '@/engine/Sky';
import { rt } from '@/engine/runtime';
import { virtual } from '@/engine/input';
import { forDevice, isTouch } from '../touch';
import { interact } from '../interact';
import { money, shortMoney, cls } from '../format';
import { speak, stopSpeaking } from '../speech';
import { drawNarwhalPortrait } from '@/world/narwhalFace';
import type { Mood } from '@/game/effects';
import { CITY_META } from '@/world/cities';
import { useRide, getOff } from '@/world/ParkedVehicles';
import { Minimap } from './Minimap';
import { RatingPrompt } from './RatingPrompt';
import { APPS } from '../phone/Phone';
import { condoDef } from '@/game/sim/catalog';
import { DecorPanel } from './DecorPanel';
import { playSfx } from '@/engine/audio';
import { Toasts } from '../Toasts';
import { quitToWorlds } from '../startWorld';
import { NARWHAL_ART, narwhalFace } from '../narwhalArt';
import tips from '@/data/tips.json';
import { FinBucksCoin } from '../FinBucks';
import { netWorth } from '@/game/finance/netWorth';

export function HUD() {
  const world = useGame((s) => s.world);
  const panel = useUI((s) => s.panel);
  const talking = useUI((s) => s.narwhal.length > 0);
  const decor = useUI((s) => s.decor);
  if (!world) return null;
  return (
    // Same layout as the earlier Fin-City build: settings top left, map top right, phone bottom
    // right, Narwhal bottom left. Everything else lives in the phone.
    <div className={cls('hud', 'classic', world.difficulty === 'entry' && 'entry-mode', talking && 'talking')}>
      <div className="hud-region r-tl">
        <div className="tl-row">
          <TopLeftButtons />
          <WalletBar />
        </div>
        <WorldActivityHud />
        <ResumeRun />
      </div>
      <div className="hud-region r-tr">
        <MapCorner />
        <Compass />
        <ArrivalBanner />
        <Toasts inline />
      </div>
      <div className="hud-region r-bc">
        <DecorPanel />
        {!panel && !talking && !decor?.carrying && <InteractPrompt />}
      </div>
      <div className="hud-region r-br">
        <MiniPhone />
        <FpsCounter />
      </div>
      <div className="hud-region r-bl">
        <NarwhalDialog />
      </div>
      <QuickApps />
      <NavTips />
      <RatingPrompt />
      <TouchControls />
    </div>
  );
}

/* Top left: Settings and Save & Exit. */
function TopLeftButtons() {
  const open = useUI((s) => s.open);
  const panel = useUI((s) => s.panel);
  const [saving, setSaving] = useState(false);
  if (panel) return null;
  return (
    <div className="tl-buttons">
      <button className="corner-btn square" onClick={() => (playSfx('click'), open({ type: 'settings' }))} title="Settings" aria-label="Settings">
        ⚙️
      </button>
      <button
        className="corner-btn"
        disabled={saving}
        onClick={async () => {
          playSfx('click');
          setSaving(true);
          await quitToWorlds();
        }}
        title="Save your game and go back to your worlds"
      >
        💾 {saving ? 'Saving…' : 'Save & Exit'}
      </button>
    </div>
  );
}

/* Top left, beside the buttons: spendable FinBucks and net worth. Tap either for the details. */
function WalletBar() {
  const open = useUI((s) => s.open);
  const panel = useUI((s) => s.panel);
  const w = useGame((s) => s.world!);
  const spendable = w.finance.cash + w.finance.checking;
  const worth = useMemo(() => netWorth(w).total, [w]);
  if (panel) return null;
  const go = (app: string) => {
    playSfx('pop');
    open({ type: 'phone', app });
  };
  return (
    <div className="hud-wallet">
      <button className="wallet-pill" onClick={() => go('bank')} title="FinBucks you can spend (cash + checking). Tap for your bank." aria-label={`FinBucks: ${money(spendable)}. Open the bank.`}>
        <FinBucksCoin size="1.35em" />
        <span className="wallet-text">
          <span className="wallet-label">FinBucks</span>
          <b>{shortMoney(spendable)}</b>
        </span>
      </button>
      <button className="wallet-pill" onClick={() => go('networth')} title="Net worth: everything you own minus everything you owe. Tap for the breakdown." aria-label={`Net worth: ${money(worth)}. Open Net Worth.`}>
        <span className="wallet-icon">📈</span>
        <span className="wallet-text">
          <span className="wallet-label">Net worth</span>
          <b className={worth < 0 ? 'neg' : undefined}>{shortMoney(worth)}</b>
        </span>
      </button>
    </div>
  );
}

/* Top right: a round minimap with the place name under it. Click it (or press M) for the big map. */
function MapCorner() {
  const location = useScene((s) => s.location);
  const interior = useScene((s) => s.interior);
  const open = useUI((s) => s.open);
  return (
    <div className="map-corner">
      <Minimap />
      {/* The name doubles as a clear way into the full map, where every place has Show the way */}
      <button type="button" className="map-corner-name" onClick={() => open({ type: 'map' })}>
        {interior?.startsWith('home:') ? 'Home' : interior ? 'Inside' : CITY_META[location].name}
        <span className="map-corner-hint">{forDevice('Click for the map')}</span>
      </button>
    </div>
  );
}

/* Bottom right: a little FinPhone showing the time, your FinBucks and level. Click it (or press P). */
function MiniPhone() {
  const open = useUI((s) => s.open);
  const panel = useUI((s) => s.panel);
  const keys = useSettings((s) => s.keys);
  const cash = useGame((s) => s.world!.finance.cash);
  const level = useGame((s) => s.world!.progress.level);
  const t = useGame((s) => s.world!.time.t);
  const claimable = useGame((s) => [...s.world!.progress.daily.list, ...s.world!.progress.weekly.list].filter((c) => !c.claimed).length);
  if (panel) return null;
  const h = hourOf(t);
  const hh = Math.floor(h);
  const clock = `${hh % 12 === 0 ? 12 : hh % 12}:${String(Math.floor(((h - hh) * 60) / 15) * 15).padStart(2, '0')}`;
  return (
    <button
      className="mini-phone"
      onClick={() => {
        playSfx('pop');
        open({ type: 'phone' });
        act((d, fx) => recordEvent(d, fx, { type: 'menu', target: 'phone' }));
      }}
      title={`FinPhone (${keyLabel(keys.phone)}): bank, quests, learn, map, my stuff and more`}
      aria-label="Open FinPhone"
    >
      <span className="mp-notch" />
      <span className="mp-screen">
        <span className="mp-time">{clock}</span>
        <span className="mp-ampm">{hh >= 12 ? 'PM' : 'AM'}</span>
        <span className="mp-cash">{shortMoney(cash)}</span>
        <span className="mp-level">Lv {level}</span>
      </span>
      <kbd>{keyLabel(keys.phone)}</kbd>
      {claimable > 0 && <span className="dock-badge">{claimable}</span>}
    </button>
  );
}

/**
 * First-time tips for getting around: what a portal does, how to ride your vehicle, how to find
 * your home, and how to find your way in a new city. Each plays once per world.
 */
function NavTips() {
  useEffect(() => {
    const tip = (flag: string, text: string) => {
      const w = useGame.getState().world;
      if (!w || w.progress.flags[flag] || useUI.getState().tour) return;
      act((d) => void (d.progress.flags[flag] = true));
      useUI.getState().sayNarwhal(text, 'confident');
    };
    const id = setInterval(() => {
      const w = useGame.getState().world;
      const ui = useUI.getState();
      if (!w || ui.panel || ui.narwhal.length || ui.loading.active || rt.flyover) return;
      const near = rt.nearTrigger?.kind;
      const scene = useScene.getState();
      if (near === 'portal')
        tip('tipPortal', 'This portal takes you to another city. Press E to travel. Open the Map any time to see every city, jump to any building, or pick Show the way and follow the gold trail.');
      else if (near === 'vehicle')
        tip('tipRide', 'Your ride is here! Press E to hop on. W A S D or the arrow keys drive, and E gets you off again. Lost it? Open My Stuff in your FinPhone and tap Bring it here.');
      else if (w.assets.properties.some((pr) => (pr.houseId || condoDef(pr.itemId)) && !pr.rented))
        tip('tipHome', 'You own a home now! To get there, open My Stuff in your FinPhone, go to Property, and tap Show the way. Its front door says Go home.');
      else if (scene.location !== 'park' && !scene.interior)
        tip('tipCity', 'New city! The portal back to Fin-City Park is on your minimap. Tap the minimap to open the Map, then pick any building and tap Show the way.');
    }, 1000);
    return () => clearInterval(id);
  }, []);
  return null;
}

/** The FinPhone apps players reach for most, one tap away on the middle left. */
const QUICK_APPS = ['quests', 'bank', 'goals', 'portfolio', 'bag'];

function QuickApps() {
  const open = useUI((s) => s.open);
  const panel = useUI((s) => s.panel);
  const decor = useUI((s) => s.decor);
  const claimable = useGame((s) => [...s.world!.progress.daily.list, ...s.world!.progress.weekly.list].filter((c) => !c.claimed).length);
  if (panel || decor) return null;
  return (
    <nav className="quick-apps" aria-label="FinPhone shortcuts">
      {QUICK_APPS.map((id) => APPS.find((a) => a.id === id)!).map((a) => (
        <button
          key={a.id}
          className="qa-btn"
          title={`Open ${a.name}`}
          aria-label={`Open ${a.name}`}
          onClick={() => {
            playSfx('pop');
            open({ type: 'phone', app: a.id });
            act((d, fx) => recordEvent(d, fx, { type: 'menu', target: 'phone' }));
          }}
        >
          <span className="qa-icon" style={{ background: a.color }}>
            {a.icon}
          </span>
          <span className="qa-name">{a.name}</span>
          {a.id === 'quests' && claimable > 0 && <span className="dock-badge">{claimable}</span>}
        </button>
      ))}
    </nav>
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

/*
 * NextGen Narwhal, always in the bottom left. When Narwhal has something to say, a speech
 * bubble pops up next to them (typewriter text, read-aloud, choices). Click Narwhal any time
 * for a hint about the current quest, or a money tip.
 */
function NarwhalDialog() {
  const line = useUI((s) => s.narwhal[0]);
  const count = useUI((s) => s.narwhal.length);
  const next = useUI((s) => s.nextNarwhal);
  const clear = useUI((s) => s.clearNarwhal);
  const say = useUI((s) => s.sayNarwhal);
  const panel = useUI((s) => s.panel);
  const w = useGame((s) => s.world!);
  const readAloud = useSettings((s) => s.readAloud);
  const [shown, setShown] = useState('');
  const reduced = useSettings((s) => s.reducedMotion);
  const cs = useMemo(() => currentStep(w), [w]);
  // Clicking Narwhal tucks the quest bubble away (and back). Remembered on this device.
  const [tucked, setTucked] = useState(false);
  useEffect(() => {
    try {
      setTucked(localStorage.getItem('fc-narwhal-tucked') === '1');
    } catch {
      // Only a nicety.
    }
  }, []);
  const toggleTucked = () => {
    setTucked((v) => {
      try {
        localStorage.setItem('fc-narwhal-tucked', v ? '0' : '1');
      } catch {
        // Only a nicety.
      }
      return !v;
    });
  };
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

  // Hide behind full-screen panels.
  if (panel && !line) return null;

  const hint = () => {
    playSfx('pop');
    if (line) {
      stopSpeaking();
      return clear();
    }
    const entry = w.difficulty === 'entry';
    if (cs) {
      const lines = entry ? cs.step.entrySay ?? cs.step.say : cs.step.proSay ?? cs.step.say;
      say(lines?.[lines.length - 1] ?? forDevice(textFor(cs.step, entry ? 'entry' : 'advanced')), 'talking');
    } else {
      const t = tips.tips[Math.floor(Math.random() * tips.tips.length)];
      say(t.text, 'confident');
    }
  };

  const speaker = line?.text.match(/^([A-Z][\w .']+): “/);
  return (
    <div className={cls('narwhal-guide', line && 'speaking')}>
      <button
        type="button"
        className="narwhal-guide-body"
        onClick={() => {
          if (line || !cs) return hint();
          playSfx('click');
          toggleTucked();
        }}
        title={line ? 'Close' : cs ? (tucked ? 'Show your quest' : 'Hide your quest') : 'Ask Narwhal for a tip'}
        aria-label={line ? 'Close Narwhal' : cs ? (tucked ? 'Show your quest' : 'Hide your quest') : 'Ask Narwhal for a tip'}
      >
        <img key={line?.id ?? 'idle'} src={NARWHAL_ART} alt="NextGen Narwhal" draggable={false} />
        {!line && (tucked || !cs) && <span className="narwhal-guide-ping">{cs ? '!' : '?'}</span>}
      </button>
      {!line && cs && !tucked && (
        <button type="button" className="narwhal-bubble idle" onClick={hint} title="Tap for a hint from Narwhal">
          <span className="narwhal-bubble-head">
            <img src={narwhalFace('confident')} alt="" />
            <span>
              {cs.quest.title} · {cs.index + 1}/{cs.quest.steps.length}
            </span>
          </span>
          <span className="idle-text">{forDevice(textFor(cs.step, w.difficulty === 'entry' ? 'entry' : 'advanced'))}</span>
          {cs.step.goal.type === 'move' && (
            <span className="idle-bar">
              <span style={{ width: `${Math.min(100, (cs.progress / (cs.step.goal.value ?? 1)) * 100)}%` }} />
            </span>
          )}
          <span className="idle-hint">Tap for a hint</span>
        </button>
      )}
      {line && (
        <div className="narwhal-bubble hud-dialog" role="dialog" aria-live="polite" key={line.id}>
          <div className="narwhal-bubble-head">
            <img src={narwhalFace(line.mood)} alt="" />
            <span>{speaker ? speaker[1] : 'NextGen Narwhal'}</span>
            <span className="grow" />
            <button className="btn icon small ghost" title="Read aloud" onClick={() => speak(line.text)}>
              🔊
            </button>
            {count > 1 && (
              <button className="btn small ghost" onClick={() => (stopSpeaking(), clear())} title="Skip all">
                Skip all
              </button>
            )}
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
      )}
    </div>
  );
}

/** On-screen joystick + buttons for touch devices. */
function TouchControls() {
  // Shown straight away on touch screens; a touch laptop shows them after the first touch.
  const [touch, setTouch] = useState(isTouch);
  const base = useRef<{ x: number; y: number; id: number } | null>(null);
  const [knob, setKnob] = useState({ x: 0, y: 0 });
  const release = () => {
    base.current = null;
    setKnob({ x: 0, y: 0 });
    virtual.x = virtual.y = 0;
    virtual.sprint = false;
  };
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
        onPointerUp={release}
        // iOS cancels the touch for system gestures (notification shade, home swipe); never leave the player walking
        onPointerCancel={release}
        onLostPointerCapture={release}
      >
        <div className="knob" style={{ transform: `translate(${knob.x}px, ${knob.y}px)` }} />
      </div>
      <div className="touch-buttons">
        <button
          className="touch-btn"
          onPointerDown={() => {
            virtual.jump = true;
            if (!rt.vehicle) virtual.jumpTap = true;
          }}
          onPointerUp={() => (virtual.jump = false)}
          onPointerLeave={() => (virtual.jump = false)}
          onPointerCancel={() => (virtual.jump = false)}
          aria-label="Jump"
        >
          ⤒
        </button>
        <button className="touch-btn gold" onClick={() => interact(rt.nearTrigger)} aria-label="Interact">
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

/** An activity closed mid-play waits here, ready to pick up where it stopped. */
function ResumeRun() {
  const run = useUI((s) => s.run);
  const panel = useUI((s) => s.panel);
  if (!run || (panel?.type === 'activity' && panel.id === run.id)) return null;
  return (
    <div className="resume-run">
      <button type="button" className="resume-go" onClick={() => (playSfx('pop'), useUI.getState().open({ type: 'activity', id: run.id }))} title="Pick up where you left off">
        <span className="resume-tag">Paused</span>
        <b>Resume {run.name}</b>
      </button>
      <button type="button" className="resume-x" onClick={() => (playSfx('click'), useUI.getState().setRun(null))} title="Quit this run" aria-label="Quit this run">
        ✕
      </button>
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
