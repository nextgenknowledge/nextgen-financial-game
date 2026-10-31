import { describe, expect, it } from 'vitest';
import { feedbackBody, parsePrefilledLink } from '@/game/feedback';

const LINK = 'https://docs.google.com/forms/d/e/1FAIpQLSexample/viewform?usp=pp_url&entry.111=5&entry.222=review&entry.333=nickname&entry.444=Mode';

describe('in-game rating form', () => {
  it('reads the questions from a pre-filled link', () => {
    const f = parsePrefilledLink(LINK)!;
    expect(f.action).toBe('https://docs.google.com/forms/d/e/1FAIpQLSexample/formResponse');
    expect(f.stars).toEqual({ entry: 'entry.111', template: '{n}' });
    expect([f.review, f.nickname, f.mode]).toEqual(['entry.222', 'entry.333', 'entry.444']);
  });
  it('keeps the wording of a star choice like "5 stars"', () => {
    const f = parsePrefilledLink('https://docs.google.com/forms/d/e/X/viewform?entry.9=5+stars&entry.8=review')!;
    expect(feedbackBody(f, { stars: 3, review: ' Fun! ', nickname: 'Tester', mode: 'entry' }).toString()).toBe('entry.9=3+stars&entry.8=Fun%21');
  });
  it('sends the stars, review, nickname and mode', () => {
    const body = feedbackBody(parsePrefilledLink(LINK)!, { stars: 4, review: 'Loved the cities', nickname: 'CoinCaptain42', mode: 'entry' });
    expect(Object.fromEntries(body)).toEqual({ 'entry.111': '4', 'entry.222': 'Loved the cities', 'entry.333': 'CoinCaptain42', 'entry.444': 'entry' });
  });
  it('rejects links that are not a form or have no star question', () => {
    expect(parsePrefilledLink('')).toBeNull();
    expect(parsePrefilledLink('https://example.com/forms/d/x/viewform?entry.1=5')).toBeNull();
    expect(parsePrefilledLink('https://docs.google.com/forms/d/e/X/viewform?entry.1=review')).toBeNull();
  });
});
