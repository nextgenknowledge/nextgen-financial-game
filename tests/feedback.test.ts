import { describe, expect, it } from 'vitest';
import { feedbackBody, parsePrefilledLink, ratingDue } from '@/game/feedback';
import { createWorld } from '@/game/world';
import { buyOutfit } from '@/game/finance/purchases';
import { STARTER } from '@/game/starter';
import config from '@/data/feedbackForm.json';

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
  it('is connected to the team form, with every question the form needs', () => {
    const f = parsePrefilledLink(config.prefilledLink)!;
    expect(f.action).toBe('https://docs.google.com/forms/d/e/1FAIpQLScggc8o4_XvvHshd4HBKBh8va9s70V7suW1k1Fg9x4aRYOqxQ/formResponse');
    expect(Object.fromEntries(feedbackBody(f, { stars: 4, review: 'Fun', nickname: 'CoinCaptain42', mode: 'entry' }))).toEqual({
      'entry.1416837256': '4',
      'entry.2004043812': 'Fun',
      'entry.1907891543': 'CoinCaptain42',
    });
  });
  it('never leaves the required name blank', () => {
    const f = parsePrefilledLink(config.prefilledLink)!;
    expect(feedbackBody(f, { stars: 5, review: '', nickname: '  ', mode: '' }).get('entry.1907891543')).toBe('Player');
  });
  it('rejects links that are not a form or have no star question', () => {
    expect(parsePrefilledLink('')).toBeNull();
    expect(parsePrefilledLink('https://example.com/forms/d/x/viewform?entry.1=5')).toBeNull();
    expect(parsePrefilledLink('https://docs.google.com/forms/d/e/X/viewform?entry.1=review')).toBeNull();
  });
});

describe('when the rating card asks', () => {
  const world = () => createWorld({ name: 'T', nickname: 'T', difficulty: 'entry', seed: 1 });
  it('waits for ten minutes and a good moment', () => {
    const w = world();
    w.playSeconds = 3600;
    expect(ratingDue(w)).toBe(false);
    w.progress.activities['first-quiz'] = { best: 70, stars: 2, plays: 1, last: 0 };
    expect(ratingDue(w)).toBe(false);
    w.progress.activities['first-quiz'].stars = 3;
    expect(ratingDue(w)).toBe(true);
    w.playSeconds = 599;
    expect(ratingDue(w)).toBe(false);
  });
  it('counts a first purchase as a good moment', () => {
    const w = world();
    w.playSeconds = 600;
    expect(buyOutfit(w, [], STARTER.outfit.id)).toBe(true);
    expect(ratingDue(w)).toBe(true);
  });
});
