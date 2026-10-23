/** Read-aloud via the Web Speech API (runs on-device; no network). */
import { useSettings } from '@/store/settings';

let voice: SpeechSynthesisVoice | null = null;

function pickVoice() {
  if (typeof speechSynthesis === 'undefined') return null;
  const voices = speechSynthesis.getVoices();
  // Prefer a local (on-device) English voice.
  voice =
    voices.find((v) => v.lang.startsWith('en') && v.localService && /female|samantha|karen|zira|aria/i.test(v.name)) ??
    voices.find((v) => v.lang.startsWith('en') && v.localService) ??
    voices.find((v) => v.lang.startsWith('en')) ??
    null;
  return voice;
}

if (typeof speechSynthesis !== 'undefined') {
  speechSynthesis.onvoiceschanged = () => pickVoice();
}

export function speechAvailable() {
  return typeof speechSynthesis !== 'undefined';
}

/** Strip emoji and markup so the voice reads naturally. */
function clean(text: string) {
  return text
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, '')
    .replace(/\*\*/g, '')
    .replace(/\$([\d,]+)(?:\.(\d{2}))?/g, (_m, d: string, c?: string) =>
      c && c !== '00' ? `${d} dollars and ${Number(c)} cents` : `${d} dollars`,
    )
    .replace(/\s+/g, ' ')
    .trim();
}

export function speak(text: string) {
  if (!speechAvailable()) return;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(clean(text));
  u.rate = useSettings.getState().speechRate;
  u.pitch = 1.1;
  const v = voice ?? pickVoice();
  if (v) u.voice = v;
  speechSynthesis.speak(u);
}

export function stopSpeaking() {
  if (speechAvailable()) speechSynthesis.cancel();
}
