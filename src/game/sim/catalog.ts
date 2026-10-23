/** Pure lookups over shop/asset data, plus the list of recurring monthly bills. */
import type { WorldState } from '../types';
import property from '@/data/shop/property.json';
import businesses from '@/data/shop/businesses.json';
import pets from '@/data/shop/pets.json';
import furniture from '@/data/shop/furniture.json';
import outfits from '@/data/shop/outfits.json';
import insurance from '@/data/insurance.json';
import subscriptions from '@/data/subscriptions.json';
import { vehicleDef } from './vehicleCatalog';
import { PROPERTY_TAX_RATE } from '../finance/tax';

export type HouseDef = (typeof property.houses)[number];
export type CondoDef = (typeof property.condos)[number];
export type PlotDef = (typeof property.plots)[number];
export type BusinessType = (typeof businesses.types)[number];
export type PetDef = (typeof pets.items)[number];
export type FurnitureDef = (typeof furniture.furniture)[number];
export type CollectibleDef = (typeof furniture.collectibles)[number];
export type OutfitDef = (typeof outfits.items)[number];
export interface InsurancePlan {
  id: string;
  name: string;
  premium: number;
  deductible: number;
  coverage: number;
  category: string;
  requires?: string;
}

export const houseDef = (id: string) => property.houses.find((h) => h.id === id);
export const condoDef = (id: string) => property.condos.find((h) => h.id === id);
export const plotDef = (id: string) => property.plots.find((p) => p.id === id);
export const businessType = (id: string) => businesses.types.find((b) => b.id === id);
export const petDef = (id: string) => pets.items.find((p) => p.id === id);
export const furnitureDef = (id: string) => furniture.furniture.find((p) => p.id === id);
export const collectibleDef = (id: string) => furniture.collectibles.find((p) => p.id === id);
export const outfitDef = (id: string) => outfits.items.find((p) => p.id === id);
export const subscriptionDef = (id: string) => subscriptions.items.find((s) => s.id === id);

export const INSURANCE_PLANS: InsurancePlan[] = insurance.categories.flatMap((c) =>
  c.plans.map((p) => ({ ...p, category: c.id, requires: (p as { requires?: string }).requires ?? (c as { requires?: string }).requires })),
);
export const insurancePlan = (id: string) => INSURANCE_PLANS.find((p) => p.id === id);

/** Generic lookup for any owned item id (furniture, collectible, outfit, prize). */
export function itemDef(id: string): { name: string; icon: string; price: number; kind: string } | null {
  const f = furnitureDef(id);
  if (f) return { name: f.name, icon: f.icon, price: f.price, kind: 'furniture' };
  const c = collectibleDef(id);
  if (c) return { name: c.name, icon: c.icon, price: c.price, kind: c.kind };
  const o = outfitDef(id);
  if (o) return { name: o.name, icon: o.icon, price: o.price, kind: 'outfit' };
  const p = furniture.prizes.find((x) => x.id === id);
  if (p) return { name: p.name, icon: p.icon, price: 0, kind: 'prize' };
  return null;
}

export interface Bill {
  name: string;
  amount: number;
  icon: string;
  kind: 'subscription' | 'vehicle' | 'lease' | 'pet' | 'property' | 'tax' | 'insurance' | 'furniture' | 'retirement';
  inflates: boolean;
}

/** Everything that gets charged at the end of each month. */
export function monthlyBills(w: WorldState): Bill[] {
  const out: Bill[] = [];
  for (const id of w.finance.subscriptions) {
    const s = subscriptionDef(id);
    if (s) out.push({ name: s.name, amount: s.monthly, icon: s.icon, kind: 'subscription', inflates: true });
  }
  for (const v of w.assets.vehicles) {
    const d = vehicleDef(v.itemId);
    if (!d) continue;
    out.push({ name: `${d.name} upkeep`, amount: d.upkeep, icon: d.icon, kind: 'vehicle', inflates: true });
    const lease = (v as { lease?: { payment: number; monthsLeft: number } }).lease;
    if (lease && lease.monthsLeft > 0) out.push({ name: `${d.name} lease`, amount: lease.payment, icon: '📄', kind: 'lease', inflates: false });
  }
  for (const p of w.assets.pets) {
    const d = petDef(p.itemId);
    if (d) out.push({ name: `${p.name} the ${d.name.toLowerCase()} (food & care)`, amount: d.monthly, icon: d.icon, kind: 'pet', inflates: true });
  }
  for (const p of w.assets.properties) {
    const h = p.houseId ? houseDef(p.houseId) : condoDef(p.itemId);
    if (h) out.push({ name: `${h.name} upkeep`, amount: h.upkeep, icon: '🔧', kind: 'property', inflates: true });
    if (w.difficulty === 'advanced') out.push({ name: `Property tax (${h?.name ?? 'land'})`, amount: Math.round(((p.value * PROPERTY_TAX_RATE) / 12) * 100) / 100, icon: '🏛️', kind: 'tax', inflates: false });
  }
  for (const [, planId] of Object.entries(w.finance.insurance)) {
    if (!planId) continue;
    const p = insurancePlan(planId);
    if (p) out.push({ name: `${p.name} ${p.category} insurance`, amount: p.premium, icon: '☂️', kind: 'insurance', inflates: true });
  }
  for (const it of w.assets.items) {
    const d = furnitureDef(it.itemId) as (FurnitureDef & { monthly?: number }) | undefined;
    if (d?.monthly) out.push({ name: `${d.name} upkeep`, amount: d.monthly, icon: d.icon, kind: 'furniture', inflates: true });
  }
  return out;
}

export function totalMonthlyBills(w: WorldState): number {
  return monthlyBills(w).reduce((s, b) => s + b.amount * (b.inflates ? w.market.priceIndex : 1), 0);
}
