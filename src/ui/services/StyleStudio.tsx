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
import { BODIES, BUILDS, HAIR_STYLES, bodyOf, buildOf, withBody } from '@/game/look';

export function StyleStudio() {
  const avatar = useGame((s) => s.world!.avatar);
  const items = useGame((s) => s.world!.assets.items);
  const open = useUI((s) => s.push);
  const C = outfits.colors;
  const patch = (p: Partial<AvatarConfig>) => act((w) => void Object.assign(w.avatar, p));
  const owned = items.filter((i) => outfitDef(i.itemId));
  const body = bodyOf(avatar);
  const choice = (label: string, opts: { id: number | string; label: string }[], value: number | string, pick: (id: number | string) => void) => (
    <div className="field">
      {label}
      <div className="row wrap">
        {opts.map((o) => (
          <Button key={o.id} size="small" variant={value === o.id ? 'gold' : undefined} onClick={() => pick(o.id)}>
            {o.label}
          </Button>
        ))}
      </div>
    </div>
  );
  return (
    <div className="row wrap" style={{ gap: 16, alignItems: 'flex-start' }}>
      <div style={{ width: 240 }}>
        <AvatarPreview config={avatar} height={300} />
        <p className="tiny muted">Changing your body, colors and hair is free. Outfits are bought at the Outfit Shop.</p>
        <Button variant="gold" block onClick={() => open({ type: 'shop', id: 'outfits' })}>
          🛍️ Outfit Shop
        </Button>
      </div>
      <div className="col grow" style={{ minWidth: 260, gap: 8 }}>
        {choice('Body', BODIES, body, (id) => act((w) => void Object.assign(w.avatar, withBody(w.avatar, id as 'male' | 'female'))))}
        {choice('Build', BUILDS.map((label, id) => ({ id, label })), buildOf(avatar), (id) => patch({ build: id as number }))}
        <SwatchRow label="Skin" colors={C.skin} value={avatar.skin} onPick={(c) => patch({ skin: c })} />
        <SwatchRow label="Hair color" colors={C.hair} value={avatar.hair} onPick={(c) => patch({ hair: c })} />
        {choice('Hair style', HAIR_STYLES[body], avatar.hairStyle, (id) => patch({ hairStyle: id as number }))}
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
