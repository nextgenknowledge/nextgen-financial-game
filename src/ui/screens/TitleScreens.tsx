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
        <span>A NextGen Knowledge game · Everything stays on this device</span>
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
                Pixelify Sans (SIL Open Font License), bundled locally. All 3D models, music and sound effects are
                generated in code for this game. See CREDITS.md for full details.
              </span>
              <b style={{ marginTop: '0.6rem' }}>Privacy</b>
              <span className="muted small">
                No accounts, no ads, no analytics, no chat. Your worlds are saved only in this browser.
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
