import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { onRequestGet, onRequestPost } from '../functions/api/leaderboard';
import config from '@/data/leaderboard.json';

const waitUntil = () => {};
const site = 'https://fincity.dev/api/leaderboard';
const post = (body: string, origin = 'https://fincity.dev', extra: Record<string, string> = {}) =>
  new Request(site, { method: 'POST', body, headers: { Origin: origin, ...extra } });

describe('leaderboard route', () => {
  let store: Map<string, Response>;
  let upstream: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    store = new Map();
    upstream = vi.fn(async () => new Response('{"rows":[]}'));
    vi.stubGlobal('fetch', upstream);
    vi.stubGlobal('caches', {
      default: {
        match: async (k: Request) => store.get(k.url)?.clone(),
        put: async (k: Request, r: Response) => void store.set(k.url, r),
        delete: async (k: Request) => store.delete(k.url),
      },
    });
  });
  afterEach(() => vi.unstubAllGlobals());

  it('reads the sheet once, then serves the saved board', async () => {
    const a = await onRequestGet({ request: new Request(`${site}?difficulty=advanced`), waitUntil });
    await onRequestGet({ request: new Request(`${site}?difficulty=advanced`), waitUntil });
    expect(await a.json()).toEqual({ rows: [] });
    expect(upstream).toHaveBeenCalledTimes(1);
    expect(upstream.mock.calls[0][0]).toBe(`${config.url}?difficulty=advanced`);
  });

  it("doesn't pass on or keep a Google error page", async () => {
    upstream.mockResolvedValue(new Response('<html>Sign in</html>'));
    const res = await onRequestGet({ request: new Request(site), waitUntil });
    expect(res.status).toBe(502);
    expect(store.size).toBe(0);
  });

  it('forwards only the score, and refreshes the saved board', async () => {
    await onRequestGet({ request: new Request(site), waitUntil });
    const res = await onRequestPost({ request: post('{"id":"abcd"}', 'https://fincity.dev', { 'CF-Connecting-IP': '1.2.3.4', Cookie: 'a=b' }), waitUntil });
    expect(res.status).toBe(200);
    const init = upstream.mock.calls[1][1];
    expect(init.body).toBe('{"id":"abcd"}');
    expect(Object.keys(init.headers)).toEqual(['Content-Type']);
    expect(store.size).toBe(0);
  });

  it('refuses scores from other sites and oversized bodies', async () => {
    expect((await onRequestPost({ request: post('{}', 'https://evil.example'), waitUntil })).status).toBe(403);
    expect((await onRequestPost({ request: post('x'.repeat(2000)), waitUntil })).status).toBe(413);
    expect(upstream).not.toHaveBeenCalled();
  });
});
