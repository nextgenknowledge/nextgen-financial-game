/**
 * Procedural audio: every sound effect and music loop is synthesized with Web Audio,
 * so there are no audio files to load and nothing is fetched from the network.
 */
import type { SfxName } from '@/game/effects';
import { makeRng } from '@/game/rng';

let ctx: AudioContext | null = null;
let musicGain: GainNode | null = null;
let sfxGain: GainNode | null = null;
let musicVol = 0.5;
let sfxVol = 0.8;

function ensure(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    const master = ctx.createGain();
    master.gain.value = 0.9;
    const comp = ctx.createDynamicsCompressor();
    master.connect(comp).connect(ctx.destination);
    musicGain = ctx.createGain();
    musicGain.gain.value = musicVol * 0.35;
    musicGain.connect(master);
    sfxGain = ctx.createGain();
    sfxGain.gain.value = sfxVol * 0.6;
    sfxGain.connect(master);
  }
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  return ctx;
}

/** Call from any user gesture to unlock audio on browsers that require it. */
export function unlockAudio() {
  ensure();
}

export function setVolumes(music: number, sfx: number) {
  musicVol = music;
  sfxVol = sfx;
  if (ctx && musicGain && sfxGain) {
    musicGain.gain.setTargetAtTime(music * 0.35, ctx.currentTime, 0.1);
    sfxGain.gain.setTargetAtTime(sfx * 0.6, ctx.currentTime, 0.05);
  }
}

const midiHz = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

function tone(
  out: AudioNode,
  freq: number,
  start: number,
  dur: number,
  opts: { type?: OscillatorType; vol?: number; attack?: number; release?: number; slideTo?: number; filter?: number } = {},
) {
  const c = ctx!;
  const { type = 'triangle', vol = 0.3, attack = 0.01, release = 0.12, slideTo, filter } = opts;
  const osc = c.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, start);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, start + dur);
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, start);
  g.gain.exponentialRampToValueAtTime(vol, start + attack);
  g.gain.setValueAtTime(vol, start + Math.max(attack, dur - release));
  g.gain.exponentialRampToValueAtTime(0.0001, start + dur + release);
  let node: AudioNode = osc;
  if (filter) {
    const f = c.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = filter;
    osc.connect(f);
    node = f;
  }
  node.connect(g).connect(out);
  osc.start(start);
  osc.stop(start + dur + release + 0.05);
}

function noise(out: AudioNode, start: number, dur: number, vol = 0.2, freq = 1200) {
  const c = ctx!;
  const len = Math.floor(c.sampleRate * dur);
  const buf = c.createBuffer(1, len, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = c.createBufferSource();
  src.buffer = buf;
  const f = c.createBiquadFilter();
  f.type = 'bandpass';
  f.frequency.value = freq;
  const g = c.createGain();
  g.gain.value = vol;
  src.connect(f).connect(g).connect(out);
  src.start(start);
}

const lastPlayed: Partial<Record<SfxName, number>> = {};

export function playSfx(name: SfxName) {
  const c = ensure();
  if (!c || !sfxGain || sfxVol <= 0) return;
  const now = c.currentTime;
  // Rate-limit identical sounds so bursts don't get loud.
  if ((lastPlayed[name] ?? -1) > now - 0.05) return;
  lastPlayed[name] = now;
  const o = sfxGain;
  switch (name) {
    case 'coin':
      tone(o, midiHz(83), now, 0.06, { type: 'square', vol: 0.12, filter: 4000 });
      tone(o, midiHz(88), now + 0.06, 0.16, { type: 'square', vol: 0.12, filter: 4000 });
      break;
    case 'cash':
      [83, 88, 91, 95].forEach((n, i) => tone(o, midiHz(n), now + i * 0.05, 0.1, { type: 'triangle', vol: 0.2 }));
      noise(o, now + 0.18, 0.15, 0.08, 6000);
      break;
    case 'click':
      tone(o, 900, now, 0.03, { type: 'sine', vol: 0.15, release: 0.03 });
      break;
    case 'pop':
      tone(o, 500, now, 0.06, { type: 'sine', vol: 0.25, slideTo: 1100, release: 0.05 });
      break;
    case 'tick':
      tone(o, 1500, now, 0.02, { type: 'square', vol: 0.05, release: 0.02, filter: 3000 });
      break;
    case 'correct':
      [72, 76, 79, 84].forEach((n, i) => tone(o, midiHz(n), now + i * 0.07, 0.14, { type: 'triangle', vol: 0.22 }));
      break;
    case 'wrong':
      tone(o, midiHz(64), now, 0.14, { type: 'sine', vol: 0.2 });
      tone(o, midiHz(60), now + 0.15, 0.25, { type: 'sine', vol: 0.18 });
      break;
    case 'star':
      tone(o, midiHz(88), now, 0.25, { type: 'sine', vol: 0.18, slideTo: midiHz(100) });
      break;
    case 'levelup':
      [60, 64, 67, 72, 76, 79, 84].forEach((n, i) => tone(o, midiHz(n), now + i * 0.08, 0.2, { type: 'square', vol: 0.09, filter: 3000 }));
      [72, 76, 79].forEach((n) => tone(o, midiHz(n), now + 0.6, 0.7, { type: 'triangle', vol: 0.12 }));
      break;
    case 'unlock':
      [67, 71, 74, 79, 83].forEach((n, i) => tone(o, midiHz(n), now + i * 0.1, 0.3, { type: 'triangle', vol: 0.16 }));
      break;
    case 'whoosh':
      noise(o, now, 0.35, 0.2, 800);
      break;
    case 'portal':
      tone(o, 200, now, 0.8, { type: 'sine', vol: 0.2, slideTo: 1200 });
      tone(o, 300, now + 0.1, 0.7, { type: 'triangle', vol: 0.1, slideTo: 1600 });
      noise(o, now, 0.8, 0.08, 2000);
      break;
    case 'buy':
      tone(o, midiHz(79), now, 0.08, { type: 'triangle', vol: 0.2 });
      tone(o, midiHz(84), now + 0.08, 0.2, { type: 'triangle', vol: 0.2 });
      noise(o, now, 0.08, 0.1, 5000);
      break;
    case 'error':
      tone(o, 180, now, 0.15, { type: 'square', vol: 0.08, filter: 900 });
      break;
    case 'bill':
      tone(o, midiHz(67), now, 0.12, { type: 'sine', vol: 0.18 });
      tone(o, midiHz(63), now + 0.12, 0.2, { type: 'sine', vol: 0.16 });
      break;
    case 'jump':
      tone(o, 300, now, 0.1, { type: 'sine', vol: 0.08, slideTo: 520 });
      break;
    case 'door':
      noise(o, now, 0.12, 0.12, 400);
      tone(o, midiHz(76), now + 0.05, 0.1, { type: 'sine', vol: 0.1 });
      break;
    case 'horn':
      tone(o, 330, now, 0.3, { type: 'sawtooth', vol: 0.06, filter: 1200 });
      tone(o, 415, now, 0.3, { type: 'sawtooth', vol: 0.05, filter: 1200 });
      break;
  }
}

/* ───────── Music ───────── */

interface Theme {
  bpm: number;
  root: number; // midi
  scale: number[];
  prog: number[]; // scale degrees (0-based) per bar
  lead: OscillatorType;
  pad: OscillatorType;
  swing: number;
  density: number; // 0..1 chance of a melody note per 8th
  seed: number;
  sevenths?: boolean;
}

const MAJ = [0, 2, 4, 5, 7, 9, 11];
const MIN = [0, 2, 3, 5, 7, 8, 10];
const PENTA = [0, 2, 4, 7, 9];

export const THEMES: Record<string, Theme> = {
  title: { bpm: 92, root: 60, scale: MAJ, prog: [0, 5, 3, 4], lead: 'triangle', pad: 'sine', swing: 0, density: 0.45, seed: 11 },
  park: { bpm: 100, root: 62, scale: MAJ, prog: [0, 3, 4, 0, 5, 3, 1, 4], lead: 'triangle', pad: 'sine', swing: 0.08, density: 0.5, seed: 3 },
  'new-york': { bpm: 108, root: 58, scale: MAJ, prog: [1, 4, 0, 5], lead: 'triangle', pad: 'sine', swing: 0.22, density: 0.55, seed: 7, sevenths: true },
  london: { bpm: 96, root: 65, scale: MAJ, prog: [0, 4, 5, 3, 0, 3, 4, 4], lead: 'sine', pad: 'triangle', swing: 0, density: 0.5, seed: 21 },
  'hong-kong': { bpm: 104, root: 63, scale: PENTA, prog: [0, 3, 4, 2], lead: 'triangle', pad: 'sine', swing: 0.05, density: 0.6, seed: 5 },
  'san-francisco': { bpm: 84, root: 57, scale: MIN, prog: [0, 5, 2, 6], lead: 'sine', pad: 'triangle', swing: 0.15, density: 0.4, seed: 13, sevenths: true },
  singapore: { bpm: 88, root: 64, scale: MAJ, prog: [0, 5, 3, 4, 0, 2, 3, 4], lead: 'sine', pad: 'sine', swing: 0, density: 0.35, seed: 17 },
  interior: { bpm: 90, root: 60, scale: MAJ, prog: [0, 3, 0, 4], lead: 'sine', pad: 'sine', swing: 0.1, density: 0.3, seed: 29, sevenths: true },
  activity: { bpm: 116, root: 62, scale: PENTA, prog: [0, 3, 4, 3], lead: 'square', pad: 'triangle', swing: 0, density: 0.5, seed: 31 },
};

let currentTheme: string | null = null;
let schedTimer: ReturnType<typeof setInterval> | null = null;
let musicBus: GainNode | null = null;
let nextBarTime = 0;
let barIndex = 0;
let night = false;

export function setNight(isNight: boolean) {
  night = isNight;
}

function degreeToMidi(theme: Theme, degree: number, octave = 0): number {
  const s = theme.scale;
  const oct = Math.floor(degree / s.length);
  const idx = ((degree % s.length) + s.length) % s.length;
  return theme.root + s[idx] + 12 * (oct + octave);
}

function scheduleBar(theme: Theme, t0: number) {
  const c = ctx!;
  const beat = 60 / theme.bpm;
  const bus = musicBus!;
  const deg = theme.prog[barIndex % theme.prog.length];
  const rng = makeRng(theme.seed * 1000 + (barIndex % (theme.prog.length * 2)));
  const soft = night ? 0.7 : 1;
  // Pad chord
  const chord = [0, 2, 4, ...(theme.sevenths ? [6] : [])].map((d) => degreeToMidi(theme, deg + d, -1));
  for (const n of chord) tone(bus, midiHz(n), t0, beat * 4 - 0.1, { type: theme.pad, vol: 0.05 * soft, attack: 0.4, release: 0.6, filter: 1400 });
  // Bass
  tone(bus, midiHz(degreeToMidi(theme, deg, -2)), t0, beat * 1.5, { type: 'sine', vol: 0.16 * soft, release: 0.2 });
  tone(bus, midiHz(degreeToMidi(theme, deg + 4, -2)), t0 + beat * 2, beat * 1.5, { type: 'sine', vol: 0.12 * soft, release: 0.2 });
  // Melody: random walk on chord-friendly degrees
  let cur = deg + 7;
  for (let i = 0; i < 8; i++) {
    if (rng.next() > theme.density * (night ? 0.7 : 1)) continue;
    cur += rng.pick([-2, -1, -1, 0, 1, 1, 2]);
    if (cur < deg + 4) cur = deg + 5;
    if (cur > deg + 12) cur = deg + 10;
    const swing = i % 2 === 1 ? theme.swing * beat : 0;
    const t = t0 + (i * beat) / 2 + swing;
    tone(bus, midiHz(degreeToMidi(theme, cur)), t, beat * 0.42, { type: theme.lead, vol: 0.07 * soft, release: 0.15, filter: 2600 });
  }
  // Soft percussion: hat on off-beats
  if (!night) for (let i = 0; i < 4; i++) noise(bus, t0 + i * beat + beat / 2 + theme.swing * beat, 0.04, 0.025, 8000);
}

export function playMusic(themeId: string | null) {
  const c = ensure();
  if (!c || !musicGain) return;
  if (themeId === currentTheme) return;
  currentTheme = themeId;
  if (schedTimer) clearInterval(schedTimer);
  schedTimer = null;
  if (musicBus) {
    const old = musicBus;
    old.gain.setTargetAtTime(0.0001, c.currentTime, 0.4);
    setTimeout(() => old.disconnect(), 2500);
    musicBus = null;
  }
  if (!themeId) return;
  const theme = THEMES[themeId] ?? THEMES.park;
  musicBus = c.createGain();
  musicBus.gain.setValueAtTime(0.0001, c.currentTime);
  musicBus.gain.setTargetAtTime(1, c.currentTime + 0.2, 0.8);
  musicBus.connect(musicGain);
  nextBarTime = c.currentTime + 0.25;
  barIndex = 0;
  const barLen = (60 / theme.bpm) * 4;
  schedTimer = setInterval(() => {
    if (!ctx || !musicBus) return;
    while (nextBarTime < ctx.currentTime + 1.2) {
      scheduleBar(theme, nextBarTime);
      nextBarTime += barLen;
      barIndex++;
    }
  }, 300);
}
