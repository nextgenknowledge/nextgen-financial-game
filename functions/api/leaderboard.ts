/**
 * Cloudflare Pages Function at /api/leaderboard. School networks and Chromebooks often block
 * Google links from accounts outside the district, so players talk to fincity.dev and this
 * passes the request on to the leaderboard Google Sheet (see docs/LEADERBOARD.md). It forwards
 * only the score itself: no IP address, cookies or other headers.
 */
import config from '../../src/data/leaderboard.json';

interface Ctx {
  request: Request;
  waitUntil: (p: Promise<unknown>) => void;
}

/** Keeps a busy classroom from using up the sheet's daily limits. */
const CACHE_SECONDS = 20;
const MAX_BODY = 1024;
const MODES = ['entry', 'advanced'];
const LIVE_ORIGIN = /^https:\/\/(www\.)?fincity\.dev$/;

const edgeCache = () => (caches as unknown as { default: Cache }).default;
const cacheKey = (origin: string, mode: string) => new Request(`${origin}/api/leaderboard?difficulty=${mode}`);

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
}

export async function onRequestGet({ request, waitUntil }: Ctx) {
  const url = new URL(request.url);
  const mode = url.searchParams.get('difficulty') === 'advanced' ? 'advanced' : 'entry';
  const key = cacheKey(url.origin, mode);
  const hit = await edgeCache().match(key);
  if (hit) return hit;

  const upstream = await fetch(`${config.url}?difficulty=${mode}`).catch(() => null);
  const text = upstream?.ok ? await upstream.text() : '';
  try {
    JSON.parse(text);
  } catch {
    // Google answers with a web page when something is wrong: don't pass that on or keep it
    return json({ error: 'unavailable' }, 502);
  }
  const res = new Response(text, { headers: { 'Content-Type': 'application/json', 'Cache-Control': `public, max-age=0, s-maxage=${CACHE_SECONDS}` } });
  waitUntil(edgeCache().put(key, res.clone()));
  return res;
}

export async function onRequestPost({ request }: Ctx) {
  if (!LIVE_ORIGIN.test(request.headers.get('Origin') ?? '')) return json({ error: 'forbidden' }, 403);
  const body = await request.text();
  if (body.length > MAX_BODY) return json({ error: 'too big' }, 413);
  const upstream = await fetch(config.url, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body }).catch(() => null);
  if (!upstream?.ok) return json({ error: 'unavailable' }, 502);
  // A player's own change should show on their next look at the board
  const { origin } = new URL(request.url);
  await Promise.all(MODES.map((m) => edgeCache().delete(cacheKey(origin, m))));
  return json({ ok: true });
}
