/**
 * Cloudflare Pages Function at /api/feedback. School networks often block Google links from
 * accounts outside the district, so the rating card posts here and this passes the answers on to
 * the team's Google Form (see docs/FEEDBACK-FORM.md). Only the form's own questions are forwarded:
 * no IP address, cookies or other headers.
 */
import config from '../../src/data/feedbackForm.json';
import { parsePrefilledLink } from '../../src/game/feedback';

interface Ctx {
  request: Request;
}

const MAX_BODY = 8192;
const LIVE_ORIGIN = /^https:\/\/(www\.)?fincity\.dev$/;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
}

export async function onRequestPost({ request }: Ctx) {
  if (!LIVE_ORIGIN.test(request.headers.get('Origin') ?? '')) return json({ error: 'forbidden' }, 403);
  const form = parsePrefilledLink(config.prefilledLink);
  if (!form) return json({ error: 'unavailable' }, 502);
  const text = await request.text();
  if (text.length > MAX_BODY) return json({ error: 'too big' }, 413);

  const answers = new URLSearchParams(text);
  const allowed = [form.stars.entry, form.review, form.nickname, form.mode];
  if (!answers.get(form.stars.entry) || [...answers.keys()].some((k) => !allowed.includes(k))) return json({ error: 'rejected' }, 400);

  const upstream = await fetch(form.action, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: answers.toString() }).catch(() => null);
  // A form that starts asking for a sign-in sends us to accounts.google.com: nothing was saved
  if (!upstream?.ok || (upstream.redirected && !upstream.url.startsWith('https://docs.google.com/'))) return json({ error: 'unavailable' }, 502);
  return json({ ok: true });
}
