'use client';
import { useEffect, useState } from 'react';
import { useSettings, KEY_ACTION_LABELS, DEFAULT_KEYS, keyLabel, type KeyAction } from '@/store/settings';
import { Button, Modal, Toggle } from './common';
import { setVolumes, playSfx } from '@/engine/audio';
import { englishVoices, onVoicesChanged, speak, speechAvailable } from './speech';
import { useUI } from '@/store/ui';
import { startTour } from './hud/HudTour';

type Tab = 'game' | 'video' | 'audio' | 'access' | 'controls';

export function SettingsModal({ onClose, extra }: { onClose: () => void; extra?: React.ReactNode }) {
  const s = useSettings();
  const [tab, setTab] = useState<Tab>('game');
  const [rebinding, setRebinding] = useState<KeyAction | null>(null);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);

  // Some browsers list their voices a moment after the page loads
  useEffect(() => {
    const load = () => setVoices(englishVoices());
    load();
    return onVoicesChanged(load);
  }, []);

  useEffect(() => {
    setVolumes(s.music, s.sfx);
  }, [s.music, s.sfx]);

  useEffect(() => {
    if (!rebinding) return;
    const h = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.code !== 'Escape' || rebinding === 'pause') {
        // Don't allow two actions on one key: swap with whoever had it.
        const keys = { ...useSettings.getState().keys };
        const clash = (Object.keys(keys) as KeyAction[]).find((a) => keys[a] === e.code);
        if (clash && clash !== rebinding) keys[clash] = keys[rebinding];
        keys[rebinding] = e.code;
        s.set({ keys });
      }
      setRebinding(null);
    };
    window.addEventListener('keydown', h, true);
    return () => window.removeEventListener('keydown', h, true);
  }, [rebinding, s]);

  const tabs: { id: Tab; label: string }[] = [
    { id: 'game', label: '🎮 Game' },
    { id: 'video', label: '🖥️ Graphics' },
    { id: 'audio', label: '🔊 Sound' },
    { id: 'access', label: '♿ Accessibility' },
    { id: 'controls', label: '⌨️ Controls' },
  ];

  return (
    <Modal onClose={rebinding ? undefined : onClose} title="Settings" size="wide">
      <div className="row wrap" style={{ marginBottom: '1rem' }}>
        {tabs.map((t) => (
          <Button key={t.id} size="small" variant={tab === t.id ? 'primary' : undefined} onClick={() => setTab(t.id)}>
            {t.label}
          </Button>
        ))}
      </div>
      <div className="col" style={{ gap: '1rem' }}>
        {tab === 'game' && (
          <>
            <Row label="Narwhal hints" hint="Narwhal gives tips and points the way.">
              <Toggle value={s.hints ? 'on' : 'off'} options={[{ value: 'on', label: 'On' }, { value: 'off', label: 'Off' }]} onChange={(v) => s.set({ hints: v === 'on' })} />
            </Row>
            <Row label="Narwhal follows me" hint="Off: Narwhal stops walking beside you but still gives every instruction from the corner of the screen.">
              <Toggle value={s.narwhalFollow ? 'on' : 'off'} options={[{ value: 'on', label: 'On' }, { value: 'off', label: 'Off' }]} onChange={(v) => s.set({ narwhalFollow: v === 'on' })} />
            </Row>
            <Row label="Month length" hint="One day/night cycle is one Fin City month.">
              <Toggle
                value={String(s.monthMinutes)}
                options={[
                  { value: '5', label: '5 min' },
                  { value: '8', label: '8 min' },
                  { value: '12', label: '12 min' },
                ]}
                onChange={(v) => s.set({ monthMinutes: Number(v) })}
              />
            </Row>
            {extra}
          </>
        )}
        {tab === 'video' && (
          <>
            <Row label="Quality" hint="Low is best for Chromebooks and older laptops.">
              <Toggle
                value={s.quality}
                options={[
                  { value: 'low', label: 'Low' },
                  { value: 'medium', label: 'Medium' },
                  { value: 'high', label: 'High' },
                ]}
                onChange={(v) => s.set({ quality: v })}
              />
            </Row>
            <Row label="Auto-lower quality" hint="Switch to Low if the game gets choppy.">
              <Toggle value={s.autoQuality ? 'on' : 'off'} options={[{ value: 'on', label: 'On' }, { value: 'off', label: 'Off' }]} onChange={(v) => s.set({ autoQuality: v === 'on' })} />
            </Row>
            <Row label="Show FPS counter">
              <Toggle value={s.showFps ? 'on' : 'off'} options={[{ value: 'on', label: 'On' }, { value: 'off', label: 'Off' }]} onChange={(v) => s.set({ showFps: v === 'on' })} />
            </Row>
          </>
        )}
        {tab === 'audio' && (
          <>
            <Row label={`Music volume · ${Math.round(s.music * 100)}%`}>
              <input type="range" min={0} max={1} step={0.05} value={s.music} onChange={(e) => s.set({ music: Number(e.target.value) })} aria-label="Music volume" />
            </Row>
            <Row label={`Sound effects · ${Math.round(s.sfx * 100)}%`}>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={s.sfx}
                onChange={(e) => s.set({ sfx: Number(e.target.value) })}
                onPointerUp={() => playSfx('coin')}
                aria-label="Sound effects volume"
              />
            </Row>
          </>
        )}
        {tab === 'access' && (
          <>
            {useUI.getState().screen === 'game' && (
              <Row label="Screen tour" hint="Narwhal walks you through the buttons on the screen again.">
                <Button size="small" onClick={() => startTour()}>
                  Show the tour again
                </Button>
              </Row>
            )}
            <Row label="Read aloud automatically" hint={speechAvailable() ? 'Narwhal and questions are read out loud. Every text also has a 🔊 button.' : 'Read-aloud is not supported in this browser.'}>
              <Toggle value={s.readAloud ? 'on' : 'off'} options={[{ value: 'on', label: 'On' }, { value: 'off', label: 'Off' }]} onChange={(v) => s.set({ readAloud: v === 'on' })} />
            </Row>
            {voices.length > 1 && (
              <Row label="Voice" hint="Automatic picks the friendliest, most natural voice on this device.">
                <select
                  className="input"
                  value={s.voice}
                  onChange={(e) => {
                    s.set({ voice: e.target.value });
                    setTimeout(() => speak("Hi! I'm NextGen Narwhal. Let's grow your money!"), 0);
                  }}
                  aria-label="Reading voice"
                >
                  <option value="">Automatic ({voices[0].name})</option>
                  {voices.map((v) => (
                    <option key={v.voiceURI} value={v.voiceURI}>
                      {v.name}
                    </option>
                  ))}
                </select>
              </Row>
            )}
            <Row label={`Reading speed · ${s.speechRate.toFixed(1)}×`}>
              <div className="row">
                <input type="range" min={0.6} max={1.4} step={0.1} value={s.speechRate} onChange={(e) => s.set({ speechRate: Number(e.target.value) })} aria-label="Reading speed" />
                <Button size="small" onClick={() => speak("Hi! I'm NextGen Narwhal. Let's grow your money!")}>
                  Test
                </Button>
              </div>
            </Row>
            <Row label="Text size">
              <Toggle
                value={s.textSize}
                options={[
                  { value: 's', label: 'S' },
                  { value: 'm', label: 'M' },
                  { value: 'l', label: 'L' },
                  { value: 'xl', label: 'XL' },
                ]}
                onChange={(v) => s.set({ textSize: v })}
              />
            </Row>
            <Row label="Colorblind-safe colors" hint="Changes good/bad colors (like green/red) to safer pairs.">
              <Toggle
                value={s.colorblind}
                options={[
                  { value: 'off', label: 'Off' },
                  { value: 'deuteranopia', label: 'Red-green' },
                  { value: 'tritanopia', label: 'Blue-yellow' },
                ]}
                onChange={(v) => s.set({ colorblind: v })}
              />
            </Row>
            <Row label="Reduced motion" hint="Less camera sway, confetti and animation.">
              <Toggle value={s.reducedMotion ? 'on' : 'off'} options={[{ value: 'on', label: 'On' }, { value: 'off', label: 'Off' }]} onChange={(v) => s.set({ reducedMotion: v === 'on' })} />
            </Row>
          </>
        )}
        {tab === 'controls' && (
          <>
            <Row label={`Mouse / touch look speed · ${s.mouseSensitivity.toFixed(1)}×`}>
              <input type="range" min={0.3} max={2.5} step={0.1} value={s.mouseSensitivity} onChange={(e) => s.set({ mouseSensitivity: Number(e.target.value) })} aria-label="Look speed" />
            </Row>
            <Row label="Invert up/down look">
              <Toggle value={s.invertY ? 'on' : 'off'} options={[{ value: 'on', label: 'On' }, { value: 'off', label: 'Off' }]} onChange={(v) => s.set({ invertY: v === 'on' })} />
            </Row>
            <div className="card flat">
              <div className="row between" style={{ marginBottom: '0.5rem' }}>
                <b>Keys</b>
                <Button size="small" onClick={() => s.set({ keys: DEFAULT_KEYS })}>
                  Reset keys
                </Button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))', gap: '0.4rem' }}>
                {(Object.keys(KEY_ACTION_LABELS) as KeyAction[]).map((a) => (
                  <div key={a} className="row between" style={{ padding: '0.2rem 0' }}>
                    <span className="small bold">{KEY_ACTION_LABELS[a]}</span>
                    <Button size="small" variant={rebinding === a ? 'gold' : undefined} onClick={() => setRebinding(a)}>
                      {rebinding === a ? 'Press a key…' : keyLabel(s.keys[a])}
                    </Button>
                  </div>
                ))}
              </div>
              <p className="tiny muted" style={{ marginBottom: 0 }}>
                Arrow keys always move too. Drag with the mouse (or a finger) to look around, scroll to zoom, and click the
                ground to walk there.
              </p>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}

function Row({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="row between wrap" style={{ gap: '0.8rem' }}>
      <div className="col" style={{ gap: 0, minWidth: 200, flex: 1 }}>
        <b>{label}</b>
        {hint && <span className="small muted">{hint}</span>}
      </div>
      <div style={{ minWidth: 240 }}>{children}</div>
    </div>
  );
}
