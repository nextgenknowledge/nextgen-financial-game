/** Read-aloud via the Web Speech API (runs on-device; no network). */
import { useSettings } from '@/store/settings';

/*
 * The friendliest voice the device has. Phones, tablets and computers ship several English
 * voices; the old robotic ones (and the joke voices on Macs) sound nothing like Siri, while the
 * newer "Enhanced", "Premium" and "Natural" voices and the voices behind Siri and Google
 * Assistant sound warm and human. Voices are scored and the best on-device one wins. Online-only
 * voices are left out so nothing the player reads is sent anywhere.
 */

/** Warm, natural voices by name, best first (Apple, Google, Microsoft). */
const FRIENDLY = [
  'ava', 'zoe', 'samantha', 'allison', 'susan', 'evan', 'nicky', 'joelle', 'noelle', 'serena', 'karen', 'moira', 'tessa',
  'google us english', 'google uk english female', 'aria', 'jenny', 'michelle', 'libby', 'sonia', 'natasha', 'zira',
];
/** Mac novelty and old robotic voices nobody wants reading to them. */
const ROBOTIC =
  /\b(albert|bad news|bahh|bells|boing|bubbles|cellos|deranged|good news|hysterical|jester|organ|superstar|trinoids|whisper|wobble|zarvox|fred|junior|ralph|kathy|princess|grandma|grandpa|eddy|flo|reed|rocko|sandy|shelley|espeak)\b/i;

function score(v: SpeechSynthesisVoice): number {
  const name = v.name.toLowerCase();
  let s = 0;
  if (/premium|enhanced|neural|natural|siri/.test(name)) s += 50;
  const i = FRIENDLY.findIndex((f) => name.includes(f));
  if (i >= 0) s += 30 - i;
  if (/^en[-_]us/i.test(v.lang)) s += 6;
  else if (/^en[-_](gb|au|ca|ie|nz)/i.test(v.lang)) s += 3;
  if (ROBOTIC.test(name)) s -= 100;
  return s;
}

/** English voices, friendliest first; on-device ones only when the device has any. */
export function rankVoices(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice[] {
  const all = voices.filter((v) => v.lang.toLowerCase().startsWith('en'));
  const local = all.filter((v) => v.localService);
  return (local.length ? local : all).slice().sort((a, b) => score(b) - score(a));
}

/** This device's English voices, friendliest first. */
export function englishVoices(): SpeechSynthesisVoice[] {
  return typeof speechSynthesis === 'undefined' ? [] : rankVoices(speechSynthesis.getVoices());
}

function pickVoice(): SpeechSynthesisVoice | null {
  const list = englishVoices();
  const chosen = useSettings.getState().voice;
  return (chosen && list.find((v) => v.voiceURI === chosen)) || list[0] || null;
}

const listeners = new Set<() => void>();
/** Voices load late in some browsers; call to hear when the list changes. */
export function onVoicesChanged(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
if (typeof speechSynthesis !== 'undefined') {
  speechSynthesis.onvoiceschanged = () => listeners.forEach((fn) => fn());
}

export function speechAvailable() {
  return typeof speechSynthesis !== 'undefined';
}

/** Strip emoji and markup and spell out symbols so the voice reads naturally. */
function clean(text: string) {
  return text
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, '')
    .replace(/\*\*/g, '')
    .replace(/\$([\d,]+)(?:\.(\d{2}))?/g, (_m, d: string, c?: string) =>
      c && c !== '00' ? `${d} dollars and ${Number(c)} cents` : `${d} dollars`,
    )
    .replace(/(\d)\s?%/g, '$1 percent')
    .replace(/\s*\n+\s*/g, '. ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function speak(text: string) {
  if (!speechAvailable()) return;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(clean(text));
  const v = pickVoice();
  if (v) {
    u.voice = v;
    u.lang = v.lang;
  }
  // A touch quicker and brighter than the default sounds chatty and warm rather than flat;
  // the modern natural voices already sound right at their normal pitch.
  const natural = !!v && score(v) >= 50;
  u.rate = useSettings.getState().speechRate * 1.04;
  u.pitch = natural ? 1.0 : 1.08;
  speechSynthesis.speak(u);
}

export function stopSpeaking() {
  if (speechAvailable()) speechSynthesis.cancel();
}
