'use client';
import { useEffect, useMemo, useState } from 'react';
import { useUI } from '@/store/ui';
import { playMusic, unlockAudio } from '@/engine/audio';
import { Button, FIN_LOGO, ORG_LOGO, NARWHAL_SHEET } from '../common';
import { SettingsModal } from '../SettingsModal';
import { makeRng } from '@/game/rng';

export function SkyBackdrop() {
  const els = useMemo(() => {
    const r = makeRng(7);
    return {
      stars: Array.from({ length: 60 }, () => ({ x: r.range(0, 100), y: r.range(0, 60), d: r.range(0, 3) })),
      clouds: Array.from({ length: 6 }, () => ({ y: r.range(5, 55), w: r.range(80, 220), dur: r.range(40, 90), delay: -r.range(0, 90) })),
      skyline: Array.from({ length: 28 }, () => r.range(25, 100)),
    };
  }, []);
  return (
    <div className="sky-bg" aria-hidden>
      {els.stars.map((s, i) => (
        <div key={i} className="star" style={{ left: `${s.x}%`, top: `${s.y}%`, animationDelay: `${s.d}s` }} />
      ))}
      {els.clouds.map((c, i) => (
        <div key={i} className="cloud" style={{ top: `${c.y}%`, width: c.w, animationDuration: `${c.dur}s`, animationDelay: `${c.delay}s` }} />
      ))}
      <div className="skyline">
        {els.skyline.map((h, i) => (
          <div key={i} style={{ height: `${h}%` }} />
        ))}
      </div>
    </div>
  );
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

export function TitleScreen() {
  const setScreen = useUI((s) => s.setScreen);
  const [settings, setSettings] = useState(false);
  useEffect(() => {
    // Browsers only allow audio after a gesture; start music on the first click.
    const start = () => {
      unlockAudio();
      playMusic('title');
    };
    window.addEventListener('pointerdown', start, { once: true });
    window.addEventListener('keydown', start, { once: true });
    return () => {
      window.removeEventListener('pointerdown', start);
      window.removeEventListener('keydown', start);
    };
  }, []);
  return (
    <div className="screen">
      <SkyBackdrop />
      <div className="title-wrap">
        <div className="pixel" style={{ letterSpacing: '0.3em', color: '#cfe0ff', fontSize: '0.95rem' }}>
          NEXTGEN KNOWLEDGE PRESENTS
        </div>
        <img className="title-logo" src={FIN_LOGO} alt="Fin City" />
        <div className="title-buttons">
          <Button
            variant="gold"
            size="huge"
            onClick={() => {
              unlockAudio();
              playMusic('title');
              setScreen('worlds');
            }}
          >
            ▶ Play
          </Button>
          <Button size="big" onClick={() => setSettings(true)}>
            ⚙️ Settings
          </Button>
          <Button size="big" onClick={() => setScreen('credits')}>
            ⭐ Credits
          </Button>
        </div>
      </div>
      <div className="title-foot">
        <img src={ORG_LOGO} alt="" />
        <span>A NextGen Knowledge game · Everything stays on this device</span>
      </div>
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
            <img src={ORG_LOGO} alt="NextGen Knowledge" style={{ width: 220, borderRadius: 12 }} />
            <img src={FIN_LOGO} alt="Fin City" style={{ width: 150 }} />
          </div>
          <p>
            <b>Fin City</b> is made by <b>NextGen Knowledge</b>, a student-led organization teaching financial literacy to
            kids and teens.
          </p>
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
