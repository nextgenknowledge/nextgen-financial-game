'use client';
import { useEffect, useMemo, useState } from 'react';
import { useUI } from '@/store/ui';
import { playMusic, playSfx, unlockAudio } from '@/engine/audio';
import { Button, FIN_LOGO, ORG_LOGO, NARWHAL_SHEET } from '../common';
import { SettingsModal } from '../SettingsModal';
import { listWorlds, loadWorld, saveWorld } from '@/save/db';
import type { WorldMeta } from '@/save/format';
import { createWorld } from '@/game/world';
import { startWorld } from '../startWorld';
import { CityBackdrop } from './CityBackdrop';
import { NewGameFlow } from './NewGame';
import playerStats from '@/data/players.json';

/** NextGen Knowledge's website. Only ever opened by the player clicking the logo; the game itself never goes online. */
export const ORG_SITE = 'https://nextgenknowledge.org';

/** The animated pixel city behind every start screen. */
export function SkyBackdrop() {
  return <CityBackdrop />;
}

/** "NextGen Knowledge presents" with the org logo, then the title. Click to skip. */
export function IntroScreen() {
  const setScreen = useUI((s) => s.setScreen);
  useEffect(() => {
    const t = setTimeout(() => setScreen('title'), 3300);
    return () => clearTimeout(t);
  }, [setScreen]);
  return (
    <div className="screen" onClick={() => setScreen('title')} style={{ cursor: 'pointer' }}>
      <SkyBackdrop />
      <div className="intro-org">
        <div className="presents">NextGen Knowledge presents</div>
        <img src={ORG_LOGO} alt="NextGen Knowledge" />
      </div>
    </div>
  );
}

/** All-time player count as a little scoreboard whose digits roll into place. */
function PlayerCount({ n }: { n: number }) {
  const [rolled, setRolled] = useState(false);
  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) {
      setRolled(true);
      return;
    }
    const t = setTimeout(() => setRolled(true), 1300);
    return () => clearTimeout(t);
  }, []);
  const text = n.toLocaleString('en-US');
  let col = 0;
  return (
    <div className="st-players">
      <span className="sr-only">{text} players so far</span>
      <span className="st-players-digits" aria-hidden>
        {text.split('').map((ch, i) => {
          if (ch === ',') return <span key={i} className="st-players-sep">,</span>;
          const d = Number(ch);
          const delay = col++ * 0.15;
          return (
            <span key={i} className="st-players-d">
              <span className="st-players-strip" style={{ transform: `translateY(-${rolled ? (d + 10) * 1.25 : 0}em)`, transitionDelay: `${delay}s` }}>
                {'01234567890123456789'.split('').map((x, j) => (
                  <span key={j}>{x}</span>
                ))}
              </span>
            </span>
          );
        })}
      </span>
      <span className="st-players-label" aria-hidden>
        <span className="st-players-live">
          <span className="st-players-dot" />
          Live
        </span>
        Players so far
      </span>
    </div>
  );
}

type MenuItem = { label: string; hint?: string; color: 'yellow' | 'blue' | 'cyan' | 'lime' | 'navy'; action: () => void };

export function TitleScreen() {
  const setScreen = useUI((s) => s.setScreen);
  const pushToast = useUI((s) => s.pushToast);
  const [settings, setSettings] = useState(false);
  const [newGame, setNewGame] = useState(false);
  const [worlds, setWorlds] = useState<WorldMeta[]>([]);
  const [selected, setSelected] = useState(0);

  useEffect(() => {
    // Browsers only allow audio after a gesture; start music on the first click. iOS Safari only
    // counts touchend and click as gestures, so listen for those too.
    const events = ['pointerdown', 'touchend', 'click', 'keydown'] as const;
    const start = () => {
      const ok = unlockAudio();
      playMusic('title');
      if (ok) events.forEach((ev) => window.removeEventListener(ev, start));
    };
    events.forEach((ev) => window.addEventListener(ev, start));
    return () => events.forEach((ev) => window.removeEventListener(ev, start));
  }, []);

  useEffect(() => {
    listWorlds()
      .then(setWorlds)
      .catch(() => setWorlds([]));
  }, []);

  const last = worlds[0] ?? null;
  const menu = useMemo(() => {
    const items: MenuItem[] = [];
    if (last) {
      items.push({
        label: 'Continue',
        hint: last.name,
        color: 'lime',
        action: async () => {
          const w = await loadWorld(last.id).catch(() => null);
          if (w) startWorld(w);
          else pushToast({ text: "Couldn't open that game.", tone: 'bad' });
        },
      });
    }
    items.push({ label: 'New Game', color: 'yellow', action: () => setNewGame(true) });
    items.push({ label: 'Load Saved Game', hint: worlds.length ? `${worlds.length} saved` : undefined, color: 'blue', action: () => setScreen('worlds') });
    items.push({ label: 'Settings', color: 'cyan', action: () => setSettings(true) });
    items.push({ label: 'Credits', color: 'navy', action: () => setScreen('credits') });
    return items;
  }, [last, worlds.length, setScreen, pushToast]);

  const index = Math.min(selected, menu.length - 1);
  const overlay = settings || newGame;

  // Arrow keys (or W/S) move, Enter picks.
  useEffect(() => {
    if (overlay) return;
    const h = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
      if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') {
        e.preventDefault();
        playSfx('click');
        setSelected((i) => (Math.min(i, menu.length - 1) + 1) % menu.length);
      } else if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') {
        e.preventDefault();
        playSfx('click');
        setSelected((i) => (Math.min(i, menu.length - 1) - 1 + menu.length) % menu.length);
      } else if (e.key === 'Enter' && !(e.target instanceof HTMLButtonElement)) {
        e.preventDefault();
        playSfx('pop');
        menu[index]?.action();
      }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [overlay, menu, index]);

  return (
    <div className="screen start-screen">
      <SkyBackdrop />
      <section className="st-content">
        <a className="st-org" href={ORG_SITE} target="_blank" rel="noopener noreferrer" title="Visit NextGen Knowledge (opens nextgenknowledge.org in a new tab)">
          <img src={ORG_LOGO} alt="NextGen Knowledge" draggable={false} />
          <span className="st-org-text">
            <span className="st-org-kicker">A game built by</span>
            <span className="st-org-name">NextGen Knowledge</span>
          </span>
        </a>
        <h1 className="st-logo-wrap">
          <img className="st-logo" src={FIN_LOGO} alt="Fin City" draggable={false} />
        </h1>
        <p className="st-tagline">Travel the world and master money on the way.</p>
        {playerStats.players > 0 && <PlayerCount n={playerStats.players} />}

        {!newGame && (
          <div className="st-menu st-panel-in" role="menu">
            {menu.map((item, i) => (
              <button
                key={item.label}
                type="button"
                role="menuitem"
                className={`st-menu-btn ${item.color} ${i === index ? 'on' : ''}`}
                onMouseEnter={() => setSelected(i)}
                onFocus={() => setSelected(i)}
                onClick={() => {
                  playSfx('pop');
                  unlockAudio();
                  item.action();
                }}
              >
                <span className="st-arrow" aria-hidden>
                  ▶
                </span>
                <span className="st-menu-text">
                  <span>{item.label}</span>
                  {item.hint && <span className="st-hint">{item.hint}</span>}
                </span>
              </button>
            ))}
          </div>
        )}

        <div className="st-words">Earn · Save · Invest · Explore</div>
      </section>
      <div className="title-foot">
        <a className="title-foot-logo" href={ORG_SITE} target="_blank" rel="noopener noreferrer" title="nextgenknowledge.org">
          <img src={ORG_LOGO} alt="NextGen Knowledge" />
        </a>
        <span>A NextGen Knowledge game · Your game saves on this device · <a href={`${process.env.NEXT_PUBLIC_BASE_PATH ?? ''}/about/`}>About Fin City</a></span>
      </div>
      {newGame && (
        <NewGameFlow
          onCancel={() => setNewGame(false)}
          onCreate={async (opts) => {
            const w = createWorld(opts);
            await saveWorld(w, null).catch(() => {});
            startWorld(w);
          }}
        />
      )}
      {settings && <SettingsModal onClose={() => setSettings(false)} />}
    </div>
  );
}

export function CreditsScreen() {
  const setScreen = useUI((s) => s.setScreen);
  return (
    <div className="screen">
      <SkyBackdrop />
      <div className="screen-inner" style={{ maxWidth: 760 }}>
        <div className="panel" style={{ padding: '1.6rem', color: 'var(--ink)' }}>
          <div className="row between">
            <h1 className="pixel" style={{ margin: 0 }}>Credits</h1>
            <Button onClick={() => setScreen('title')}>← Back</Button>
          </div>
          <div className="row" style={{ gap: '1.2rem', margin: '1rem 0', flexWrap: 'wrap' }}>
            <a href={ORG_SITE} target="_blank" rel="noopener noreferrer" title="nextgenknowledge.org">
              <img src={ORG_LOGO} alt="NextGen Knowledge" style={{ width: 220, borderRadius: 12, display: 'block' }} />
            </a>
            <img src={FIN_LOGO} alt="Fin City" style={{ width: 150 }} />
          </div>
          <p>
            <b>Fin City</b> is made by <b>NextGen Knowledge</b>, a student-led organization teaching financial literacy to
            kids and teens.
          </p>
          <div className="credits-team">
            <b>Created by</b>
            <dl>
              <dt>Lead Developer</dt>
              <dd>Esh Bompali</dd>
              <dt>Supervisor</dt>
              <dd>Svar Patel</dd>
            </dl>
          </div>
          <div className="row" style={{ alignItems: 'flex-start', gap: '1rem', flexWrap: 'wrap' }}>
            <img src={NARWHAL_SHEET} alt="NextGen Narwhal character sheet" style={{ width: 300, borderRadius: 12, border: '3px solid var(--ink)' }} />
            <div className="col grow" style={{ minWidth: 220 }}>
              <b>Starring NextGen Narwhal</b>
              <span className="muted">Your guide to money, markets and everything in between.</span>
              <b style={{ marginTop: '0.6rem' }}>Built with</b>
              <span className="muted small">
                Next.js, React, three.js, React Three Fiber, drei, Zustand, immer and idb (all MIT). Fonts: Nunito and
                Montserrat (SIL Open Font License), bundled locally. All 3D models and sound effects are
                generated in code for this game; the background music comes from the team&apos;s earlier NextGen
                Financial Hub game. See CREDITS.md for full details.
              </span>
              <b style={{ marginTop: '0.6rem' }}>Privacy</b>
              <span className="muted small">
                No accounts, no ads, no chat. Your worlds are saved only in this browser. The live site uses Google Analytics to count visits and game milestones, like finishing a first quiz, but never your nickname, world name or answers. Your nickname, level and net worth appear on the online leaderboard as you play. You can turn that off any time in the FinPhone Leaderboard app.
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
