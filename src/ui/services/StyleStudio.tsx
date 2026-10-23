'use client';
import { useGame, act } from '@/store/game';
import { AvatarPreview } from '../AvatarPreview';
import { SwatchRow } from '../screens/WorldsScreen';
import { Button } from '../common';
import outfits from '@/data/shop/outfits.json';
import { equipOutfit } from '@/game/finance/purchases';
import { outfitDef } from '@/game/sim/catalog';
import type { AvatarConfig, OutfitSlot } from '@/game/types';
import { useUI } from '@/store/ui';

export function StyleStudio() {
  const avatar = useGame((s) => s.world!.avatar);
  const items = useGame((s) => s.world!.assets.items);
  const open = useUI((s) => s.push);
  const C = outfits.colors;
  const patch = (p: Partial<AvatarConfig>) => act((w) => void Object.assign(w.avatar, p));
  const owned = items.filter((i) => outfitDef(i.itemId));
  return (
    <div className="row wrap" style={{ gap: 16, alignItems: 'flex-start' }}>
      <div style={{ width: 240 }}>
        <AvatarPreview config={avatar} height={300} />
        <p className="tiny muted">Changing colors and hair is free. Outfits are bought at the Outfit Shop.</p>
        <Button variant="gold" block onClick={() => open({ type: 'shop', id: 'outfits' })}>
          🛍️ Outfit Shop
        </Button>
      </div>
      <div className="col grow" style={{ minWidth: 260, gap: 8 }}>
        <SwatchRow label="Skin" colors={C.skin} value={avatar.skin} onPick={(c) => patch({ skin: c })} />
        <SwatchRow label="Hair color" colors={C.hair} value={avatar.hair} onPick={(c) => patch({ hair: c })} />
        <div className="field">
          Hair style
          <div className="row wrap">
            {['Short', 'Long', 'Curly', 'Buzz', 'Bun', 'Spiky'].map((h, i) => (
              <Button key={h} size="small" variant={avatar.hairStyle === i ? 'gold' : undefined} onClick={() => patch({ hairStyle: i })}>
                {h}
              </Button>
            ))}
          </div>
        </div>
        <SwatchRow label="Shirt" colors={C.shirt} value={avatar.shirt} onPick={(c) => patch({ shirt: c })} />
        <SwatchRow label="Pants" colors={C.pants} value={avatar.pants} onPick={(c) => patch({ pants: c })} />
        <SwatchRow label="Shoes" colors={C.shoes} value={avatar.shoes} onPick={(c) => patch({ shoes: c })} />
        <div className="field">
          Your outfits
          <div className="row wrap" style={{ gap: 6 }}>
            {owned.length === 0 && <span className="small muted">None yet.</span>}
            {owned.map((i) => {
              const d = outfitDef(i.itemId)!;
              const on = avatar[d.slot as OutfitSlot] === i.itemId;
              return (
                <Button key={i.uid} size="small" variant={on ? 'gold' : undefined} onClick={() => act((w) => equipOutfit(w, i.itemId))}>
                  {d.icon} {d.name}
                </Button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
