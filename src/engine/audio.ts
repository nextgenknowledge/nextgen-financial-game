/**
 * Audio: sound effects are synthesized with Web Audio; the music is one bundled track that
 * streams from this site (public/music). Nothing is fetched from anywhere else.
 */
import type { SfxName } from '@/game/effects';

let ctx: AudioContext | null = null;
let musicGain: GainNode | null = null;
let sfxGain: GainNode | null = null;
let musicVol = 0.5;
/** How loud the music track sits under the sound effects at full Music volume. */
const MUSIC_LEVEL = 0.7;
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
    musicGain.gain.value = musicVol * MUSIC_LEVEL;
    musicGain.connect(master);
    sfxGain = ctx.createGain();
    sfxGain.gain.value = sfxVol * 0.6;
    sfxGain.connect(master);
  }
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  return ctx;
}

/** Call from any user gesture to unlock audio on browsers that require it. True once sound can play. */
export function unlockAudio(): boolean {
  return ensure()?.state === 'running';
}

// iOS suspends audio when the tab goes to the background or a call comes in, and only lets it
// resume inside a tap. Any later tap or key brings the sound back.
if (typeof window !== 'undefined') {
  const wake = () => {
    if (ctx && ctx.state !== 'running') ctx.resume().catch(() => {});
    if (track?.paused) syncTrack();
  };
  for (const ev of ['touchend', 'click', 'keydown']) window.addEventListener(ev, wake, { passive: true });
}

export function setVolumes(music: number, sfx: number) {
  musicVol = music;
  sfxVol = sfx;
  syncTrack();
  if (ctx && musicGain && sfxGain) {
    musicGain.gain.setTargetAtTime(music * MUSIC_LEVEL, ctx.currentTime, 0.1);
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

/*
 * One looping track (public/music/background.mp3) plays on the title screen and all through the
 * game. It streams: preload is "none", so nothing is downloaded until the first click or key
 * press starts it, and the browser fetches it a bit at a time while it plays. It runs through the
 * music gain node, so the Music volume setting works everywhere (iOS ignores audio.volume), and a
 * volume of 0 turns it off and stops the download.
 */
const TRACK_SRC = `${process.env.NEXT_PUBLIC_BASE_PATH ?? ''}/music/background.mp3`;
let track: HTMLAudioElement | null = null;
/** True while some screen wants music (title, city, building, activity). */
let musicWanted = false;

function trackElement(): HTMLAudioElement | null {
  if (track || typeof Audio === 'undefined') return track;
  const c = ensure();
  if (!c || !musicGain) return null;
  const el = new Audio();
  el.preload = 'none';
  el.loop = true;
  el.src = TRACK_SRC;
  c.createMediaElementSource(el).connect(musicGain);
  track = el;
  return el;
}

/** Plays or pauses the track to match what the game wants and the volume setting. */
function syncTrack() {
  const on = musicWanted && musicVol > 0.001;
  const el = on ? trackElement() : track;
  if (!el) return;
  if (on && el.paused) el.play().catch(() => {});
  else if (!on && !el.paused) el.pause();
}

export function playMusic(themeId: string | null) {
  // Every screen shares the one track, so moving between them never restarts it
  musicWanted = themeId !== null;
  syncTrack();
}

/** The audio context and effects bus, for the ambience engine (null until audio is unlocked). */
export function audioBus(): { ctx: AudioContext; out: GainNode } | null {
  const c = ensure();
  if (!c || !sfxGain) return null;
  return { ctx: c, out: sfxGain };
}
