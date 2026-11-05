import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { onRequestPost } from '../functions/api/feedback';
import { feedbackBody, parsePrefilledLink } from '@/game/feedback';
import config from '@/data/feedbackForm.json';

const form = parsePrefilledLink(config.prefilledLink)!;
const answers = feedbackBody(form, { stars: 4, review: 'Fun!', nickname: 'Tester', mode: 'entry' }).toString();
const post = (body: string, origin = 'https://fincity.dev', extra: Record<string, string> = {}) =>
  new Request('https://fincity.dev/api/feedback', { method: 'POST', body, headers: { Origin: origin, ...extra } });

describe('rating route', () => {
  let upstream: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    upstream = vi.fn(async () => new Response('ok'));
    vi.stubGlobal('fetch', upstream);
  });
  afterEach(() => vi.unstubAllGlobals());

  it('forwards only the answers to the form', async () => {
    const res = await onRequestPost({ request: post(answers, 'https://fincity.dev', { 'CF-Connecting-IP': '1.2.3.4', Cookie: 'a=b' }) });
    expect(res.status).toBe(200);
    const [url, init] = upstream.mock.calls[0];
    expect(url).toBe(form.action);
    expect(init.body).toBe(new URLSearchParams(answers).toString());
    expect(Object.keys(init.headers)).toEqual(['Content-Type']);
  });

  it('refuses other sites, unknown fields, missing stars and oversized bodies', async () => {
    expect((await onRequestPost({ request: post(answers, 'https://evil.example') })).status).toBe(403);
    expect((await onRequestPost({ request: post(`${answers}&entry.999=x`) })).status).toBe(400);
    expect((await onRequestPost({ request: post('entry.1=x') })).status).toBe(400);
    expect((await onRequestPost({ request: post(`${answers}${'x'.repeat(9000)}`) })).status).toBe(413);
    expect(upstream).not.toHaveBeenCalled();
  });

  it('tells the player when Google refuses or asks for a sign-in', async () => {
    upstream.mockResolvedValueOnce(new Response('no', { status: 400 }));
    expect((await onRequestPost({ request: post(answers) })).status).toBe(502);
    const signIn = new Response('sign in');
    Object.defineProperties(signIn, { redirected: { value: true }, url: { value: 'https://accounts.google.com/x' } });
    upstream.mockResolvedValueOnce(signIn);
    expect((await onRequestPost({ request: post(answers) })).status).toBe(502);
  });
});
