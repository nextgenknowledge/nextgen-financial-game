/**
 * City soundscapes, synthesized live (no audio files). A few continuous "beds" (traffic rumble,
 * wind, rain, fountain, room murmur) fade with the scene, the hour and the weather; on top of them
 * each place schedules its own little sounds: New York horns and sirens, London's bells on the
 * hour, Hong Kong tram bells, San Francisco cable cars and foghorns, Singapore birdsong and
 * cicadas, park birds and crickets. Footsteps follow the player and change with the surface.
 */
import { audioBus } from './audio';
import { rt } from './runtime';
import { hourOf } from './Sky';
import { getWorld } from '@/store/game';
import { useScene } from '@/store/scene';
import { isPaused } from '@/store/ui';
import { BUILDING_INTERIOR } from '@/world/interiors/furnish';

type Bed = { src: AudioBufferSourceNode; filter: BiquadFilterNode; gain: GainNode };

let running = false;
let timer: ReturnType<typeof setInterval> | null = null;
let beds: Record<string, Bed> = {};
let bus: GainNode | null = null;
let lastHour = -1;
let stepT = 0;
let lastPos = { x: 0, z: 0 };

function noiseBuffer(ctx: AudioContext, brown: boolean) {
  const len = ctx.sampleRate * 3;
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  let last = 0;
  for (let i = 0; i < len; i++) {
    const w = Math.random() * 2 - 1;
    if (brown) {
      last = (last + 0.02 * w) / 1.02;
      d[i] = last * 3.5;
    } else d[i] = w;
  }
  return buf;
}

function makeBed(ctx: AudioContext, out: AudioNode, type: BiquadFilterType, freq: number, q: number, brown: boolean): Bed {
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer(ctx, brown);
  src.loop = true;
  const filter = ctx.createBiquadFilter();
  filter.type = type;
  filter.frequency.value = freq;
  filter.Q.value = q;
  const gain = ctx.createGain();
  gain.gain.value = 0;
  src.connect(filter).connect(gain).connect(out);
  src.start();
  return { src, filter, gain };
}

/* ───────── One-shot sounds ───────── */

function osc(ctx: AudioContext, out: AudioNode, type: OscillatorType, f0: number, f1: number, t: number, dur: number, vol: number, attack = 0.01) {
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f0, t);
  o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(vol, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(out);
  o.start(t);
  o.stop(t + dur + 0.05);
}

/** A struck bell: a few inharmonic partials with a long decay. */
function bell(ctx: AudioContext, out: AudioNode, f: number, t: number, vol: number, decay = 2.5) {
  for (const [k, a] of [[1, 1], [2.0, 0.5], [2.76, 0.35], [5.4, 0.18]] as const) osc(ctx, out, 'sine', f * k, f * k * 0.999, t, decay / k ** 0.3, vol * a, 0.004);
}

function burst(ctx: AudioContext, out: AudioNode, t: number, dur: number, vol: number, freq: number, q = 1) {
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer(ctx, false);
  const f = ctx.createBiquadFilter();
  f.type = 'bandpass';
  f.frequency.value = freq;
  f.Q.value = q;
  const g = ctx.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f).connect(g).connect(out);
  src.start(t);
  src.stop(t + dur + 0.05);
}

const SOUNDS = {
  horn: (c: AudioContext, o: AudioNode, t: number) => {
    const f = 380 + Math.random() * 60;
    osc(c, o, 'square', f, f, t, 0.35 + Math.random() * 0.4, 0.035);
    osc(c, o, 'square', f * 1.26, f * 1.26, t, 0.35, 0.025);
  },
  siren: (c: AudioContext, o: AudioNode, t: number) => {
    for (let k = 0; k < 4; k++) osc(c, o, 'sawtooth', 640, 960, t + k * 0.9, 0.85, 0.012, 0.2);
  },
  londonBells: (c: AudioContext, o: AudioNode, t: number, strikes: number) => {
    // Quarter chime, then the hour
    [659, 554, 587, 440].forEach((f, i) => bell(c, o, f / 2, t + i * 0.8, 0.05));
    for (let k = 0; k < strikes; k++) bell(c, o, 165, t + 4 + k * 2.2, 0.08, 3.5);
  },
  coo: (c: AudioContext, o: AudioNode, t: number) => {
    osc(c, o, 'sine', 420, 360, t, 0.25, 0.03, 0.05);
    osc(c, o, 'sine', 400, 330, t + 0.3, 0.35, 0.025, 0.05);
  },
  tramBell: (c: AudioContext, o: AudioNode, t: number) => {
    bell(c, o, 1320, t, 0.035, 0.8);
    bell(c, o, 1320, t + 0.22, 0.035, 0.8);
  },
  chatter: (c: AudioContext, o: AudioNode, t: number) => {
    for (let k = 0; k < 6; k++) burst(c, o, t + k * 0.12 + Math.random() * 0.05, 0.08, 0.02, 600 + Math.random() * 900, 4);
  },
  cableCar: (c: AudioContext, o: AudioNode, t: number) => {
    for (let k = 0; k < 5; k++) bell(c, o, 1760, t + k * 0.14 + (k > 2 ? 0.3 : 0), 0.025, 0.4);
  },
  foghorn: (c: AudioContext, o: AudioNode, t: number) => {
    osc(c, o, 'sawtooth', 98, 92, t, 2.8, 0.05, 0.4);
    osc(c, o, 'sine', 196, 184, t, 2.8, 0.03, 0.4);
  },
  gull: (c: AudioContext, o: AudioNode, t: number) => {
    for (let k = 0; k < 3; k++) osc(c, o, 'triangle', 1400, 900, t + k * 0.22, 0.2, 0.02);
  },
  bird: (c: AudioContext, o: AudioNode, t: number) => {
    const base = 2600 + Math.random() * 1600;
    const n = 2 + Math.floor(Math.random() * 4);
    for (let k = 0; k < n; k++) osc(c, o, 'sine', base, base * (Math.random() < 0.5 ? 1.3 : 0.75), t + k * 0.11, 0.09, 0.02);
  },
  koel: (c: AudioContext, o: AudioNode, t: number) => {
    for (let k = 0; k < 3; k++) osc(c, o, 'sine', 900 + k * 120, 1300 + k * 140, t + k * 0.5, 0.35, 0.03, 0.05);
  },
  thunder: (c: AudioContext, o: AudioNode, t: number) => {
    const src = c.createBufferSource();
    src.buffer = noiseBuffer(c, true);
    const g = c.createGain();
    const f = c.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 180;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.5, t + 0.15);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 4);
    src.connect(f).connect(g).connect(o);
    src.start(t);
    src.stop(t + 4.2);
  },
  keys: (c: AudioContext, o: AudioNode, t: number) => {
    for (let k = 0; k < 8; k++) burst(c, o, t + k * (0.07 + Math.random() * 0.08), 0.02, 0.025, 3500, 2);
  },
  clink: (c: AudioContext, o: AudioNode, t: number) => bell(c, o, 2400 + Math.random() * 800, t, 0.015, 0.3),
  step: (c: AudioContext, o: AudioNode, t: number, surface: string, wet: boolean) => {
    const f = surface === 'grass' ? 500 : surface === 'wood' ? 900 : 1600;
    burst(c, o, t, surface === 'grass' ? 0.08 : 0.05, surface === 'grass' ? 0.03 : 0.04, f, 1.5);
    if (wet) burst(c, o, t + 0.01, 0.07, 0.02, 3000, 0.8);
  },
};

/* ───────── The loop ───────── */

function tick() {
  const b = audioBus();
  if (!b || isPaused()) return;
  const { ctx } = b;
  if (!bus) {
    bus = ctx.createGain();
    bus.gain.value = 0.9;
    bus.connect(b.out);
    beds = {
      traffic: makeBed(ctx, bus, 'lowpass', 220, 0.7, true),
      wind: makeBed(ctx, bus, 'bandpass', 500, 0.6, false),
      rain: makeBed(ctx, bus, 'highpass', 2500, 0.5, false),
      water: makeBed(ctx, bus, 'bandpass', 1800, 0.8, false),
      room: makeBed(ctx, bus, 'bandpass', 420, 1.4, true),
      insects: makeBed(ctx, bus, 'bandpass', 5200, 8, false),
    };
  }
  const now = ctx.currentTime;
  const scene = useScene.getState();
  const city = scene.location;
  const inside = !!scene.interior;
  const w = getWorld();
  const hour = hourOf(w?.time.t ?? 0.3);
  const night = hour < 6 || hour > 20;
  const rain = rt.weather === 'rain' ? rt.weatherAmt : rt.weather === 'snow' ? 0.15 : 0;
  const isCity = city !== 'park';
  const busy = night ? 0.35 : hour < 9.5 || (hour > 16 && hour < 19) ? 1 : 0.75;
  const set = (k: string, v: number) => beds[k].gain.gain.setTargetAtTime(v, now, 0.8);
  set('traffic', inside ? 0.02 : isCity ? 0.11 * busy : 0.025);
  set('wind', inside ? 0 : 0.012 + (rt.weather === 'rain' || rt.weather === 'snow' ? rt.weatherAmt * 0.04 : 0) + (rt.weather === 'fog' ? 0.015 : 0));
  set('rain', (inside ? 0.015 : 0.07) * rain);
  beds.rain.filter.frequency.setTargetAtTime(inside ? 900 : 2500, now, 0.5);
  set('water', !inside && city === 'park' && Math.hypot(rt.player.x, rt.player.z) < 30 ? 0.03 : 0);
  set('room', inside ? 0.05 : 0);
  set('insects', !inside && night && (city === 'singapore' || city === 'park' || city === 'hong-kong') ? 0.012 : 0);
  // Cicadas pulse
  beds.insects.filter.frequency.setTargetAtTime(5000 + Math.sin(now * 3) * 400, now, 0.1);

  const chance = (p: number) => Math.random() < p;
  const out = bus;
  const at = now + Math.random() * 0.2;
  if (inside) {
    const kind = BUILDING_INTERIOR[scene.interior!] ?? '';
    if (/office|trading|newsroom|tech|service/.test(kind) && chance(0.08)) SOUNDS.keys(ctx, out, at);
    if (/restaurant|cafe|market|lounge|club/.test(kind) && chance(0.07)) SOUNDS.clink(ctx, out, at);
    if (/market|depot|warehouse/.test(kind) && chance(0.05)) SOUNDS.chatter(ctx, out, at);
  } else {
    const day = !night;
    switch (city) {
      case 'new-york':
        if (chance(0.035 * busy)) SOUNDS.horn(ctx, out, at);
        if (chance(0.004)) SOUNDS.siren(ctx, out, at);
        if (day && chance(0.02)) SOUNDS.coo(ctx, out, at);
        break;
      case 'london':
        if (day && chance(0.025)) SOUNDS.coo(ctx, out, at);
        if (chance(0.01 * busy)) SOUNDS.horn(ctx, out, at);
        break;
      case 'hong-kong':
        if (chance(0.03)) SOUNDS.tramBell(ctx, out, at);
        if (chance(0.06 * busy)) SOUNDS.chatter(ctx, out, at);
        if (chance(0.015 * busy)) SOUNDS.horn(ctx, out, at);
        break;
      case 'san-francisco':
        if (chance(0.02)) SOUNDS.cableCar(ctx, out, at);
        if (day && chance(0.02)) SOUNDS.gull(ctx, out, at);
        if (rt.weather === 'fog' && rt.weatherAmt > 0.3 && chance(0.012)) SOUNDS.foghorn(ctx, out, at);
        break;
      case 'singapore':
        if (day && chance(0.05)) SOUNDS.bird(ctx, out, at);
        if (day && chance(0.01)) SOUNDS.koel(ctx, out, at);
        if (rt.weather === 'rain' && rt.weatherAmt > 0.6 && chance(0.01)) SOUNDS.thunder(ctx, out, at);
        break;
      default:
        if (day && chance(0.07)) SOUNDS.bird(ctx, out, at);
        break;
    }
    // London: Big Ben style chimes on the hour
    const h = Math.floor(hour);
    if (city === 'london' && h !== lastHour && lastHour !== -1 && hour - h < 0.2) SOUNDS.londonBells(ctx, out, now + 0.1, ((h + 11) % 12) + 1);
    lastHour = h;
  }

  // Footsteps from how far the player moved since the last tick
  const p = rt.player;
  const moved = Math.hypot(p.x - lastPos.x, p.z - lastPos.z);
  lastPos = { x: p.x, z: p.z };
  if (!rt.vehicle && rt.grounded && moved > 0.08 && moved < 6) {
    const speed = moved / 0.25;
    stepT += 0.25;
    const interval = speed > 6 ? 0.28 : 0.42;
    while (stepT > interval) {
      stepT -= interval;
      const surface = inside ? (/library|club|restaurant|theater/.test(BUILDING_INTERIOR[scene.interior!] ?? '') ? 'wood' : 'tile') : city === 'park' && Math.abs(p.x) > 4 && Math.hypot(p.x, p.z) > 20 ? 'grass' : 'stone';
      SOUNDS.step(ctx, out, now + stepT, surface, !inside && rain > 0.2);
    }
  } else stepT = 0;
}

export function startAmbience() {
  if (running) return;
  running = true;
  timer = setInterval(tick, 250);
}

export function stopAmbience() {
  running = false;
  if (timer) clearInterval(timer);
  timer = null;
  if (bus) {
    const b = audioBus();
    if (b) bus.gain.setTargetAtTime(0, b.ctx.currentTime, 0.2);
    for (const k of Object.keys(beds)) beds[k].src.stop();
    bus.disconnect();
  }
  bus = null;
  beds = {};
}
