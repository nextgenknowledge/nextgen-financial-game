import { describe, expect, it } from 'vitest';
import outfits from '@/data/shop/outfits.json';
import { HAIR_STYLES, bodyOf, bodyScale, fitsBody, withBody } from '@/game/look';
import { DEFAULT_AVATAR } from '@/game/world';

type Item = { id: string; slot: string; price: number; tier: string; for?: string; swap?: string };
const ITEMS = outfits.items as Item[];
const byId = new Map(ITEMS.map((i) => [i.id, i]));

describe('character bodies', () => {
  it('treats saves without a body as male with the regular build', () => {
    const old = { ...DEFAULT_AVATAR };
    delete (old as { body?: string }).body;
    expect(bodyOf(old)).toBe('male');
    expect(bodyScale(old)).toEqual({ torso: 1, limb: 1, depth: 1, height: 1 });
  });

  it('keeps the female body close to the male one', () => {
    const f = bodyScale({ body: 'female', build: 1 });
    expect(f.torso).toBeGreaterThan(0.85);
    expect(f.height).toBeGreaterThan(0.95);
  });

  it('moves the hair to a style offered for the new body', () => {
    const a = withBody({ ...DEFAULT_AVATAR, hairStyle: 5 }, 'female');
    expect(a.body).toBe('female');
    expect(HAIR_STYLES.female.map((h) => h.id)).toContain(a.hairStyle);
    // A style both bodies share is kept
    expect(withBody({ ...DEFAULT_AVATAR, hairStyle: 2 }, 'female').hairStyle).toBe(2);
  });

  it('has no duplicate hair ids per body', () => {
    for (const list of Object.values(HAIR_STYLES)) expect(new Set(list.map((h) => h.id)).size).toBe(list.length);
  });
});

describe('outfit shelves per body', () => {
  it('gives each body a full set of slots', () => {
    for (const body of ['male', 'female'] as const) {
      const slots = new Set(ITEMS.filter((i) => fitsBody(i, body)).map((i) => i.slot));
      expect([...slots].sort()).toEqual(['accessory', 'bottom', 'feet', 'hat', 'top']);
    }
  });

  it('swaps replace an item for the other body at the same price and tier', () => {
    for (const it of ITEMS.filter((i) => i.swap)) {
      const was = byId.get(it.swap!);
      expect(was, it.id).toBeTruthy();
      expect(was!.for).not.toBe(it.for);
      expect(it.price).toBe(was!.price);
      expect(it.tier).toBe(was!.tier);
      expect(it.slot).toBe(was!.slot);
    }
  });

  it('only uses known bodies', () => {
    for (const it of ITEMS) if (it.for) expect(['male', 'female']).toContain(it.for);
  });
});

describe('switching body', () => {
  it('takes off pieces cut for the other body and keeps the rest', () => {
    const a = withBody({ ...DEFAULT_AVATAR, body: 'female', hairStyle: 10, top: 'gown', bottom: 'jeans', feet: 'pumps', hat: 'cap-red' }, 'male');
    expect(a).toMatchObject({ body: 'male', hairStyle: 0, top: null, bottom: 'jeans', feet: null, hat: 'cap-red' });
  });
});
