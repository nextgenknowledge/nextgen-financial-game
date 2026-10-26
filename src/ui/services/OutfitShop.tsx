'use client';
/**
 * Outfit Shop. Clothes are tiered from cheap basics to legendary pieces that take serious
 * saving (or investing) to afford, so they double as long-term savings goals.
 */
import { useMemo, useState } from 'react';
import { act } from '@/store/game';
import { Button, ReadAloud } from '../common';
import { Tabs } from '../kit';
import { money } from '../format';
import { AvatarPreview } from '../AvatarPreview';
import outfits from '@/data/shop/outfits.json';
import { buyOutfit, currentPrice, equipOutfit } from '@/game/finance/purchases';
import { addGoal, available } from '@/game/finance/accounts';
import type { OutfitSlot, WorldState } from '@/game/types';
import { starterPrice } from '@/game/starter';
import { StarterTag } from './StarterTag';

interface Item {
  id: string;
  name: string;
  slot: OutfitSlot;
  icon: string;
  price: number;
  tier: string;
  unlockLevel?: number;
  need?: boolean;
  blurb?: string;
  happiness: number;
}
// Prize-only pieces come from Legendary quests and never appear on the shelves
const ITEMS = (outfits.items as (Item & { prize?: boolean })[]).filter((i) => !i.prize);
const TIERS = (outfits as unknown as { tiers: Record<string, { name: string; color: string }> }).tiers;
const TIER_ORDER = ['basic', 'street', 'smart', 'business', 'legendary'];

type Filter = 'all' | OutfitSlot;
const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'top', label: '👕 Tops' },
  { id: 'bottom', label: '👖 Pants' },
  { id: 'feet', label: '👟 Shoes' },
  { id: 'hat', label: '🧢 Hats' },
  { id: 'accessory', label: '⌚ Extras' },
];

export function OutfitShop({ w, method }: { w: WorldState; method: 'auto' | 'card' }) {
  const [filter, setFilter] = useState<Filter>('all');
  const [tryOn, setTryOn] = useState<string | null>(null);
  const entry = w.difficulty === 'entry';
  // Money the player could reasonably put toward clothes: spendable cash + savings
  const saved = available(w) + w.finance.savings;
  const owned = useMemo(() => new Set(w.assets.items.map((i) => i.itemId)), [w.assets.items]);
  const tryItem = tryOn ? ITEMS.find((i) => i.id === tryOn) : undefined;
  const preview = tryItem ? { ...w.avatar, [tryItem.slot]: tryItem.id } : w.avatar;

  // The starter deal (if still unused) comes first
  const isDeal = (id: string) => starterPrice(w, 'outfit', id) !== null;
  const list = ITEMS.filter((i) => filter === 'all' || i.slot === filter).sort(
    (a, b) => Number(isDeal(b.id)) - Number(isDeal(a.id)) || TIER_ORDER.indexOf(a.tier) - TIER_ORDER.indexOf(b.tier) || a.price - b.price,
  );

  return (
    <div className="row wrap" style={{ gap: 14, alignItems: 'flex-start' }}>
      <div className="outfit-preview">
        <AvatarPreview config={preview} height={300} wave={false} />
        <div className="small" style={{ marginTop: 6 }}>
          {tryItem ? (
            <>
              Trying on <b>{tryItem.name}</b>{' '}
              <Button size="small" onClick={() => setTryOn(null)}>
                Clear
              </Button>
            </>
          ) : (
            <span className="muted">Tap “Try on” to preview anything, even the legendary stuff.</span>
          )}
        </div>
        <div className="card flat tiny" style={{ marginTop: 8 }}>
          {entry
            ? 'Fancy clothes cost a LOT. Set a savings goal and save up a little at a time!'
            : 'Premium pieces are priced like the real thing. Treat them as savings goals, or let your investments pay for them.'}
          <ReadAloud text="Fancy clothes cost a lot. Set a savings goal and save up a little at a time." />
        </div>
      </div>

      <div className="col grow" style={{ minWidth: 300, gap: 8 }}>
        <Tabs tabs={FILTERS} value={filter} onChange={setFilter} />
        <div className="item-grid">
          {list.map((o) => {
            const own = owned.has(o.id);
            const wearing = w.avatar[o.slot] === o.id;
            const deal = starterPrice(w, 'outfit', o.id);
            const price = deal ?? currentPrice(w, o.price);
            const locked = !!o.unlockLevel && w.progress.level < o.unlockLevel;
            const goal = w.finance.goals.find((g) => g.name === o.name.slice(0, 30) && !g.done);
            const progress = Math.min(1, (goal ? goal.saved : saved) / price);
            const tier = TIERS[o.tier];
            return (
              <div key={o.id} className={`item-card outfit-card tier-${o.tier}`} style={{ borderColor: tier.color }}>
                <span className="tier-tag" style={{ background: tier.color }}>
                  {tier.name}
                </span>
                <span style={{ fontSize: '2rem' }}>{o.icon}</span>
                <b className="small">{o.name}</b>
                {o.blurb && <span className="tiny muted">{o.blurb}</span>}
                {deal !== null ? <StarterTag was={currentPrice(w, o.price)} now={deal} /> : <span className="mono bold">{money(price, { cents: price < 1000 })}</span>}
                {!own && (
                  <div className="save-bar" title={goal ? 'Saved toward this goal' : 'Your cash + savings vs. the price'}>
                    <span style={{ width: `${progress * 100}%`, background: progress >= 1 ? 'var(--green)' : tier.color }} />
                    <em>{progress >= 1 ? 'You can afford it' : `${Math.floor(progress * 100)}% ${goal ? 'saved' : 'there'}`}</em>
                  </div>
                )}
                <div className="row wrap" style={{ gap: 4, justifyContent: 'center' }}>
                  <Button size="small" onClick={() => setTryOn(tryOn === o.id ? null : o.id)}>
                    {tryOn === o.id ? 'Untry' : 'Try on'}
                  </Button>
                  {own ? (
                    <Button size="small" variant={wearing ? 'gold' : undefined} onClick={() => act((d) => equipOutfit(d, o.id))}>
                      {wearing ? 'Wearing ✓' : 'Wear'}
                    </Button>
                  ) : locked ? (
                    <Button size="small" disabled>
                      🔒 Lv {o.unlockLevel}
                    </Button>
                  ) : (
                    <Button size="small" variant="primary" disabled={available(w) < price && method !== 'card'} onClick={() => act((d, fx) => void buyOutfit(d, fx, o.id, method))}>
                      Buy
                    </Button>
                  )}
                </div>
                {!own && price > 500 && !goal && (
                  <button className="link-btn tiny" onClick={() => act((d, fx) => addGoal(d, fx, o.name, o.icon, price))}>
                    🎯 Make it a savings goal
                  </button>
                )}
                {goal && <span className="tiny" style={{ color: tier.color }}>🎯 Goal: {money(goal.saved, { cents: false })} / {money(goal.target, { cents: false })}</span>}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
