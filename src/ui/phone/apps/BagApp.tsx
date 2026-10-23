'use client';
import { useState } from 'react';
import { useGame, act } from '@/store/game';
import { useUI } from '@/store/ui';
import { Tabs, Section, Empty } from '../../kit';
import { Button, Confirm } from '../../common';
import { money } from '../../format';
import { vehicleDef } from '@/game/sim/vehicleCatalog';
import { itemDef, outfitDef, petDef, houseDef, condoDef, plotDef, businessType } from '@/game/sim/catalog';
import { equipOutfit, sellItem, sellVehicle, rehomePet, setRented, moveIn, sellProperty } from '@/game/finance/purchases';
import { summonVehicle } from '@/world/ParkedVehicles';
import { businessValue } from '@/game/finance/netWorth';
import type { OutfitSlot } from '@/game/types';

type Tab = 'vehicles' | 'outfits' | 'stuff' | 'pets' | 'property' | 'business';

export function BagApp({ tab: initial }: { tab?: string }) {
  const w = useGame((s) => s.world!);
  const open = useUI((s) => s.open);
  const [tab, setTab] = useState<Tab>((initial as Tab) ?? 'vehicles');
  const [confirm, setConfirm] = useState<null | { text: string; go: () => void }>(null);
  const outfits = w.assets.items.filter((i) => outfitDef(i.itemId));
  const stuff = w.assets.items.filter((i) => !outfitDef(i.itemId));
  return (
    <div>
      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { id: 'vehicles', label: `🚲 Rides (${w.assets.vehicles.length})` },
          { id: 'outfits', label: `👕 Outfits (${outfits.length})` },
          { id: 'stuff', label: `🛋️ Stuff (${stuff.length})` },
          { id: 'pets', label: `🐾 Pets (${w.assets.pets.length})` },
          { id: 'property', label: `🏡 Property (${w.assets.properties.length})` },
          { id: 'business', label: `🏢 Business (${w.assets.businesses.length})` },
        ]}
      />
      {tab === 'vehicles' && (
        <Section title="Your rides">
          {w.assets.vehicles.length === 0 && <Empty icon="🚲">No vehicles yet. The Auto Dealer in the park sells bikes, scooters, cars, boats and even a seaplane.</Empty>}
          {w.assets.vehicles.map((v) => {
            const d = vehicleDef(v.itemId)!;
            const active = w.assets.activeVehicle === v.uid;
            return (
              <div key={v.uid} className={`card ${active ? 'tint-gold' : 'flat'} row between wrap`} style={{ marginBottom: 6 }}>
                <span>
                  <span style={{ fontSize: '1.4rem' }}>{d.icon}</span> <b>{d.name}</b>{' '}
                  <span className="small muted">
                    {v.leased ? `Leased · ${v.lease?.monthsLeft} months left` : `Worth ${money(v.value, { cents: false })} (paid ${money(v.price, { cents: false })})`}
                  </span>
                </span>
                <span className="row" style={{ gap: 6 }}>
                  <Button
                    size="small"
                    variant="primary"
                    onClick={() => {
                      act((d2) => void (d2.assets.activeVehicle = v.uid));
                      setTimeout(() => {
                        if (summonVehicle(v.uid, v.itemId)) useUI.getState().closeAll();
                      }, 30);
                    }}
                  >
                    📍 Bring it here
                  </Button>
                  {!v.leased && (
                    <Button size="small" variant="danger" onClick={() => setConfirm({ text: `Sell your ${d.name} for about ${money(v.value * 0.9, { cents: false })}?`, go: () => act((d2, fx) => sellVehicle(d2, fx, v.uid)) })}>
                      Sell
                    </Button>
                  )}
                </span>
              </div>
            );
          })}
        </Section>
      )}
      {tab === 'outfits' && (
        <Section title="Outfits" right={<Button size="small" onClick={() => open({ type: 'service', id: 'style' })}>🪞 Change look</Button>}>
          {outfits.length === 0 && <Empty icon="👕">Buy outfits at the Style Studio in the park.</Empty>}
          <div className="item-grid">
            {outfits.map((i) => {
              const d = outfitDef(i.itemId)!;
              const on = w.avatar[d.slot as OutfitSlot] === i.itemId;
              return (
                <button key={i.uid} className={`item-card ${on ? 'on' : ''}`} onClick={() => act((d2) => equipOutfit(d2, i.itemId))}>
                  <span style={{ fontSize: '2rem' }}>{d.icon}</span>
                  <span className="small bold">{d.name}</span>
                  <span className="tiny">{on ? '✅ Wearing' : 'Tap to wear'}</span>
                </button>
              );
            })}
          </div>
        </Section>
      )}
      {tab === 'stuff' && (
        <Section title="Furniture, collectibles & prizes">
          {stuff.length === 0 && <Empty icon="🛋️">Nothing here yet. The Furniture Store has decor, collectibles and art.</Empty>}
          {stuff.map((i) => {
            const d = itemDef(i.itemId);
            if (!d) return null;
            const changes = d.kind === 'collectible' || d.kind === 'art';
            const g = i.value - i.price;
            return (
              <div key={i.uid} className="card flat row between wrap" style={{ marginBottom: 6 }}>
                <span>
                  {d.icon} <b>{d.name}</b>{' '}
                  <span className="small muted">
                    {d.kind} · worth {money(i.value)}
                    {changes && i.price > 0 && <b className={g >= 0 ? 'good' : 'bad'}> ({money(g, { sign: true })})</b>}
                  </span>
                </span>
                {i.price > 0 && (
                  <Button size="small" onClick={() => setConfirm({ text: `Sell ${d.name} for ${money(i.value)}?`, go: () => act((d2, fx) => sellItem(d2, fx, i.uid)) })}>
                    Sell
                  </Button>
                )}
              </div>
            );
          })}
        </Section>
      )}
      {tab === 'pets' && (
        <Section title="Your pets">
          {w.assets.pets.length === 0 && <Empty icon="🐾">No pets yet. Visit the Pet Shop in the park.</Empty>}
          {w.assets.pets.map((p) => {
            const d = petDef(p.itemId)!;
            return (
              <div key={p.uid} className="card flat row between wrap" style={{ marginBottom: 6 }}>
                <span>
                  <span style={{ fontSize: '1.5rem' }}>{d.icon}</span> <b>{p.name}</b> <span className="small muted">the {d.name.toLowerCase()} · {money(d.monthly)}/month care · +{d.happiness} happiness</span>
                </span>
                <Button size="small" variant="ghost" onClick={() => setConfirm({ text: `Give ${p.name} to the shelter for a new family? You'll miss them!`, go: () => act((d2, fx) => rehomePet(d2, fx, p.uid)) })}>
                  Rehome
                </Button>
              </div>
            );
          })}
          <p className="tiny muted">Pets are worth $0 in your net worth, they&apos;re family, not investments. 💛</p>
        </Section>
      )}
      {tab === 'property' && (
        <Section title="Land & homes" right={<Button size="small" onClick={() => open({ type: 'shop', id: 'property' })}>🏡 Real estate</Button>}>
          {w.assets.properties.length === 0 && <Empty icon="🏡">You don&apos;t own property yet.</Empty>}
          {w.assets.properties.map((p) => {
            const h = p.houseId ? houseDef(p.houseId) : null;
            const c = condoDef(p.itemId);
            const plot = p.plotId ? plotDef(p.plotId) : null;
            const name = c ? c.name : `${plot?.name ?? 'Land'}${h ? ` · ${h.name}` : ' (empty lot)'}`;
            const canRent = !!h || !!c;
            const home = w.player.residence === p.uid;
            return (
              <div key={p.uid} className="card flat col" style={{ gap: 4, marginBottom: 6 }}>
                <div className="row between wrap">
                  <b>
                    {c?.icon ?? h?.icon ?? '🟩'} {name}
                  </b>
                  <span className="mono small">
                    Worth {money(p.value, { cents: false })} (paid {money(p.price, { cents: false })})
                  </span>
                </div>
                <div className="row wrap" style={{ gap: 6 }}>
                  {home && <span className="chip good">🏠 You live here</span>}
                  {p.rented && <span className="chip gold">🔑 Rented · ~{money((h?.rent ?? c?.rent ?? 0) * w.market.priceIndex, { cents: false })}/mo</span>}
                  {canRent && !p.rented && !c && (
                    <Button size="small" onClick={() => act((d2, fx) => setRented(d2, fx, p.uid, true))}>
                      Rent it out
                    </Button>
                  )}
                  {canRent && p.rented && !c && (
                    <Button size="small" onClick={() => act((d2, fx) => moveIn(d2, fx, p.uid))}>
                      Move in
                    </Button>
                  )}
                  {h && !home && !p.rented && (
                    <Button size="small" onClick={() => act((d2, fx) => moveIn(d2, fx, p.uid))}>
                      Move in
                    </Button>
                  )}
                  <Button size="small" variant="danger" onClick={() => setConfirm({ text: `Sell ${name}? Selling costs 6% in fees, and any mortgage is paid off first.`, go: () => act((d2, fx) => sellProperty(d2, fx, p.uid)) })}>
                    Sell
                  </Button>
                </div>
              </div>
            );
          })}
        </Section>
      )}
      {tab === 'business' && (
        <Section title="Your businesses" right={<Button size="small" onClick={() => open({ type: 'service', id: 'business' })}>🏢 Manage</Button>}>
          {w.assets.businesses.length === 0 && <Empty icon="🏢">No businesses yet. Start one at the Hong Kong Business Registry.</Empty>}
          {w.assets.businesses.map((b) => {
            const t = businessType(b.typeId)!;
            const last = b.profits[b.profits.length - 1];
            return (
              <div key={b.uid} className="card flat row between wrap" style={{ marginBottom: 6 }}>
                <span>
                  {t.icon} <b>{b.name}</b> <span className="small muted">Lv {b.level} · {b.staff} staff</span>
                </span>
                <span className="small mono">
                  Last month {last === undefined ? '-' : <b className={last >= 0 ? 'good' : 'bad'}>{money(last, { sign: true })}</b>} · Value {money(businessValue(b), { cents: false })}
                </span>
              </div>
            );
          })}
        </Section>
      )}
      {confirm && (
        <Confirm
          title="Are you sure?"
          text={confirm.text}
          onCancel={() => setConfirm(null)}
          onConfirm={() => {
            confirm.go();
            setConfirm(null);
          }}
        />
      )}
    </div>
  );
}
