/**
 * Spending & assets: everything you can buy, finance, lease, rent out, upgrade or sell.
 */
import type { OutfitSlot, WorldState } from '../types';
import type { Fx } from '../effects';
import { spend, receive, takeLoan, loanQuote, log } from './accounts';
import { withSalesTax } from './tax';
import { leasePayment } from './loans';
import { round2 } from './interest';
import { recordEvent } from '../progress/events';
import { uid } from '../world';
import { vehicleDef } from '../sim/vehicleCatalog';
import { storeFurniture, clearHome } from '../home';
import { outfitDef, furnitureDef, collectibleDef, petDef, plotDef, houseDef, condoDef, businessType, insurancePlan, subscriptionDef, itemDef } from '../sim/catalog';
import { businessValue } from './netWorth';
import community from '@/data/community.json';
import furniture from '@/data/shop/furniture.json';
import property from '@/data/shop/property.json';

/** Price including inflation (shop prices creep up over time). */
export function currentPrice(w: WorldState, base: number) {
  return round2(base * w.market.priceIndex);
}

function boostHappiness(w: WorldState, by: number) {
  w.player.happiness = Math.min(100, Math.round(w.player.happiness + by));
  w.progress.stats.bestHappiness = Math.max(w.progress.stats.bestHappiness ?? 0, w.player.happiness);
}

/** Pay for something with optional sales tax. Returns total charged or null if declined. */
function checkout(w: WorldState, fx: Fx, price: number, desc: string, method: 'auto' | 'card' = 'auto'): number | null {
  const { total, tax } = withSalesTax(price, w.difficulty === 'advanced');
  if (!spend(w, fx, total, desc, method)) return null;
  if (tax > 0) fx.push({ type: 'toast', text: `Includes ${fmt(tax)} sales tax (6%)`, icon: '🧾', tone: 'info' });
  fx.push({ type: 'sfx', name: 'buy' });
  return total;
}

function fmt(x: number) {
  return `$${x.toLocaleString('en-US', { minimumFractionDigits: x < 100 ? 2 : 0, maximumFractionDigits: 2 })}`;
}

function levelLocked(w: WorldState, fx: Fx, lvl?: number) {
  if (lvl && w.progress.level < lvl) {
    fx.push({ type: 'toast', text: `Unlocks at level ${lvl}`, icon: '🔒', tone: 'info' });
    return true;
  }
  return false;
}

/* ───────── Outfits, furniture, collectibles ───────── */

export function buyOutfit(w: WorldState, fx: Fx, id: string, method: 'auto' | 'card' = 'auto') {
  const o = outfitDef(id);
  if (!o || w.assets.items.some((i) => i.itemId === id)) return false;
  if (levelLocked(w, fx, (o as { unlockLevel?: number }).unlockLevel)) return false;
  const price = currentPrice(w, o.price);
  if (checkout(w, fx, price, o.name, method) === null) return false;
  w.assets.items.push({ uid: uid('item'), itemId: id, value: round2(price * 0.3), price, boughtMonth: w.time.month });
  boostHappiness(w, o.happiness);
  w.progress.stats.outfitsOwned = (w.progress.stats.outfitsOwned ?? 0) + 1;
  equipOutfit(w, id);
  fx.push({ type: 'toast', text: `You bought ${o.name}! (Equipped)`, icon: o.icon, tone: 'good' });
  recordEvent(w, fx, { type: 'buy', target: id, value: price });
  return true;
}

export function equipOutfit(w: WorldState, id: string | null, slot?: OutfitSlot) {
  if (id === null && slot) {
    w.avatar[slot] = null;
    return;
  }
  const o = id ? outfitDef(id) : null;
  if (!o) return;
  const s = o.slot as OutfitSlot;
  w.avatar[s] = w.avatar[s] === id ? null : id;
}

export function buyFurniture(w: WorldState, fx: Fx, id: string, method: 'auto' | 'card' = 'auto') {
  const d = furnitureDef(id);
  if (!d) return false;
  const discount = w.progress.perks.includes('smart-shopper') ? 0.95 : 1;
  const price = currentPrice(w, d.price * discount);
  if (checkout(w, fx, price, d.name, method) === null) return false;
  w.assets.items.push({ uid: uid('item'), itemId: id, value: round2(price * 0.4), price, boughtMonth: w.time.month });
  boostHappiness(w, d.happiness);
  fx.push({ type: 'toast', text: `${d.name} delivered to your home!`, icon: d.icon, tone: 'good' });
  recordEvent(w, fx, { type: 'buy', target: id, value: price });
  return true;
}

export function buyCollectible(w: WorldState, fx: Fx, id: string, method: 'auto' | 'card' = 'auto') {
  const d = collectibleDef(id);
  if (!d) return false;
  if (levelLocked(w, fx, (d as { unlockLevel?: number }).unlockLevel)) return false;
  const price = currentPrice(w, d.price);
  if (checkout(w, fx, price, d.name, method) === null) return false;
  w.assets.items.push({ uid: uid('item'), itemId: id, value: d.price * w.market.priceIndex, price, boughtMonth: w.time.month });
  w.progress.stats.collectiblesOwned = (w.progress.stats.collectiblesOwned ?? 0) + 1;
  w.progress.collection[id] = (w.progress.collection[id] ?? 0) + 1;
  boostHappiness(w, 3);
  fx.push({ type: 'toast', text: `Added ${d.name} to your collection. Its value will change over time!`, icon: d.icon, tone: 'good' });
  recordEvent(w, fx, { type: 'buy', target: id, value: price });
  return true;
}

export function sellItem(w: WorldState, fx: Fx, itemUid: string) {
  const it = w.assets.items.find((i) => i.uid === itemUid);
  if (!it) return;
  const def = itemDef(it.itemId);
  const value = round2(it.value);
  storeFurniture(w, itemUid);
  w.assets.items = w.assets.items.filter((i) => i.uid !== itemUid);
  for (const slot of ['hat', 'top', 'accessory'] as const) if (w.avatar[slot] === it.itemId) w.avatar[slot] = null;
  if (def?.kind === 'collectible' || def?.kind === 'art') w.progress.stats.collectiblesOwned = Math.max(0, (w.progress.stats.collectiblesOwned ?? 1) - 1);
  receive(w, value, `Sold ${def?.name ?? 'item'}`);
  const gain = value - it.price;
  fx.push({ type: 'toast', text: `Sold for ${fmt(value)} (${gain >= 0 ? 'gain' : 'loss'} of ${fmt(Math.abs(gain))})`, icon: '🏷️', tone: gain >= 0 ? 'good' : 'info' });
  fx.push({ type: 'sfx', name: 'cash' });
  recordEvent(w, fx, { type: 'sell', target: it.itemId, value });
}

/* ───────── Pets ───────── */

export function adoptPet(w: WorldState, fx: Fx, id: string, name: string) {
  const d = petDef(id);
  if (!d) return false;
  if (levelLocked(w, fx, (d as { unlockLevel?: number }).unlockLevel)) return false;
  const price = currentPrice(w, d.adoption);
  if (checkout(w, fx, price, `${d.name} adoption`) === null) return false;
  w.assets.pets.push({ uid: uid('pet'), itemId: id, name: name.slice(0, 16) || d.name, boughtMonth: w.time.month });
  boostHappiness(w, d.happiness * 2);
  w.progress.collection[`pet:${id}`] = 1;
  fx.push({ type: 'narwhal', text: `Welcome home, ${name || d.name}! ${d.icon} Remember: pets cost about ${fmt(d.monthly)} every month for food and care. That's in your Bills now.`, mood: 'hyped' });
  fx.push({ type: 'confetti' });
  recordEvent(w, fx, { type: 'buy', target: id, value: price });
  return true;
}

export function rehomePet(w: WorldState, fx: Fx, petUid: string) {
  const p = w.assets.pets.find((x) => x.uid === petUid);
  if (!p) return;
  w.assets.pets = w.assets.pets.filter((x) => x.uid !== petUid);
  w.player.happiness = Math.max(0, w.player.happiness - 10);
  fx.push({ type: 'toast', text: `${p.name} went to a loving new family at the shelter.`, icon: '💔', tone: 'info' });
}

/* ───────── Vehicles ───────── */

export type PayMethod = 'cash' | 'loan' | 'lease' | 'card';

export function vehicleOffer(w: WorldState, id: string) {
  const d = vehicleDef(id)!;
  const price = currentPrice(w, d.price);
  const months = d.price > 10000 ? 60 : 24;
  const down = round2(price * 0.1);
  const loan = loanQuote(w, 'auto', price - down, months);
  const residual = price * 0.55;
  const leaseMonths = 36;
  const lease = round2(leasePayment(price, residual, leaseMonths, w.difficulty === 'entry' ? 0.06 : loan.apr));
  return { price, down, months, loan, lease, leaseMonths, leaseDown: round2(price * 0.04) };
}

export function buyVehicle(w: WorldState, fx: Fx, id: string, method: PayMethod) {
  const d = vehicleDef(id);
  if (!d) return false;
  if (levelLocked(w, fx, d.unlockLevel)) return false;
  const o = vehicleOffer(w, id);
  const ownedUid = uid('veh');
  if (method === 'cash' || method === 'card') {
    if (checkout(w, fx, o.price, d.name, method === 'card' ? 'card' : 'auto') === null) return false;
    w.assets.vehicles.push({ uid: ownedUid, itemId: id, value: o.price, price: o.price, boughtMonth: w.time.month });
  } else if (method === 'loan') {
    if (checkout(w, fx, o.down, `${d.name} down payment`) === null) return false;
    takeLoan(w, fx, 'auto', o.price - o.down, o.months, { name: `${d.name} auto loan`, collateral: ownedUid, deposit: false });
    w.assets.vehicles.push({ uid: ownedUid, itemId: id, value: o.price, price: o.price, boughtMonth: w.time.month });
  } else {
    if (!d.leaseable) return false;
    if (checkout(w, fx, o.leaseDown, `${d.name} lease signing`) === null) return false;
    w.assets.vehicles.push({ uid: ownedUid, itemId: id, value: 0, price: o.price, boughtMonth: w.time.month, leased: true, lease: { payment: o.lease, monthsLeft: o.leaseMonths } });
  }
  w.assets.activeVehicle = ownedUid;
  boostHappiness(w, d.happiness);
  w.progress.collection[`vehicle:${id}`] = 1;
  fx.push({ type: 'narwhal', text: `Congrats on your ${d.name}! ${d.icon} It's parked by the garage spot, walk up and press E to ride. It costs about ${fmt(d.upkeep)}/month to keep and loses value over time (depreciation).`, mood: 'hyped' });
  fx.push({ type: 'confetti' });
  recordEvent(w, fx, { type: 'buy', target: id, value: o.price });
  return true;
}

export function sellVehicle(w: WorldState, fx: Fx, vUid: string) {
  const v = w.assets.vehicles.find((x) => x.uid === vUid);
  if (!v) return;
  if (v.leased) {
    fx.push({ type: 'toast', text: "Leased vehicles can't be sold, you don't own them!", icon: '📄', tone: 'info' });
    return;
  }
  const value = round2(v.value * 0.9);
  w.assets.vehicles = w.assets.vehicles.filter((x) => x.uid !== vUid);
  if (w.assets.activeVehicle === vUid) w.assets.activeVehicle = w.assets.vehicles[0]?.uid ?? null;
  // Pay off any loan secured by it
  const loan = w.finance.loans.find((l) => l.collateral === vUid);
  let net = value;
  if (loan) {
    const payoff = Math.min(loan.balance, value);
    net = round2(value - payoff);
    loan.balance = round2(loan.balance - payoff);
    if (loan.balance <= 0.01) w.finance.loans = w.finance.loans.filter((l) => l.id !== loan.id);
  }
  receive(w, net, `Sold ${vehicleDef(v.itemId)?.name}`);
  fx.push({ type: 'toast', text: `Sold for ${fmt(value)} (bought for ${fmt(v.price)}). ${loan ? 'Loan paid off from the sale.' : ''}`, icon: '🏷️', tone: 'info' });
}

/* ───────── Property ───────── */

export function propertyOffer(w: WorldState, price: number, downPct: number, years: number) {
  const down = round2(price * downPct);
  const months = years * 12;
  const q = loanQuote(w, 'mortgage', price - down, months);
  return { price, down, months, ...q };
}

export function buyPlot(w: WorldState, fx: Fx, plotId: string, downPct: number | null) {
  const p = plotDef(plotId);
  if (!p || w.assets.properties.some((x) => x.plotId === plotId)) return false;
  const price = currentPrice(w, p.price);
  const propUid = uid('prop');
  if (downPct === null) {
    if (!spend(w, fx, price, p.name)) return false;
  } else {
    const o = propertyOffer(w, price, downPct, 15);
    if (!spend(w, fx, o.down, `${p.name} down payment`)) return false;
    takeLoan(w, fx, 'mortgage', price - o.down, o.months, { name: `${p.name} land loan`, collateral: propUid, deposit: false });
  }
  w.assets.properties.push({ uid: propUid, itemId: plotId, plotId, value: price, price, level: 1, rented: false, boughtMonth: w.time.month });
  fx.push({ type: 'sfx', name: 'unlock' });
  fx.push({ type: 'narwhal', text: `You own land! 🏡 Land usually grows in value slowly. Next, you can build a house on it at the Real Estate Office.`, mood: 'hyped' });
  fx.push({ type: 'confetti' });
  recordEvent(w, fx, { type: 'buy', target: plotId, value: price });
  return true;
}

export function buildHouse(w: WorldState, fx: Fx, plotId: string, houseId: string, downPct: number | null) {
  const prop = w.assets.properties.find((x) => x.plotId === plotId);
  const h = houseDef(houseId);
  if (!prop || !h || prop.houseId) return false;
  if (levelLocked(w, fx, (h as { unlockLevel?: number }).unlockLevel)) return false;
  const cost = currentPrice(w, h.buildCost);
  if (downPct === null) {
    if (!spend(w, fx, cost, `Build ${h.name}`)) return false;
  } else {
    const o = propertyOffer(w, cost, downPct, 30);
    if (!spend(w, fx, o.down, `${h.name} down payment`)) return false;
    takeLoan(w, fx, 'mortgage', cost - o.down, o.months, { name: `${h.name} mortgage`, collateral: prop.uid, deposit: false });
  }
  prop.houseId = houseId;
  prop.value = round2(prop.value + cost);
  prop.price = round2(prop.price + cost);
  if (w.player.residence === 'narwhal') w.player.residence = prop.uid;
  boostHappiness(w, h.happiness);
  fx.push({ type: 'narwhal', text: `Your ${h.name} is built! ${h.icon} You can live in it or rent it out for about ${fmt(h.rent)}/month. Homes need upkeep${w.difficulty === 'advanced' ? ' and property tax' : ''} every month.`, mood: 'hyped' });
  fx.push({ type: 'confetti' });
  recordEvent(w, fx, { type: 'buy', target: houseId, value: cost });
  recordEvent(w, fx, { type: 'build', target: houseId });
  return true;
}

export function buyCondo(w: WorldState, fx: Fx, condoId: string, downPct: number | null) {
  const c = condoDef(condoId);
  if (!c) return false;
  const price = currentPrice(w, c.price);
  const propUid = uid('prop');
  if (downPct === null) {
    if (!spend(w, fx, price, c.name)) return false;
  } else {
    const o = propertyOffer(w, price, downPct, 30);
    if (!spend(w, fx, o.down, `${c.name} down payment`)) return false;
    takeLoan(w, fx, 'mortgage', price - o.down, o.months, { name: `${c.name} mortgage`, collateral: propUid, deposit: false });
  }
  w.assets.properties.push({ uid: propUid, itemId: condoId, value: price, price, level: 1, rented: true, boughtMonth: w.time.month });
  fx.push({ type: 'narwhal', text: `You bought the ${c.name}! It's rented out to tenants for about ${fmt(c.rent)}/month. That's passive income, but upkeep and empty months happen too.`, mood: 'hyped' });
  recordEvent(w, fx, { type: 'buy', target: condoId, value: price });
  return true;
}

export function setRented(w: WorldState, fx: Fx, propUid: string, rented: boolean) {
  const p = w.assets.properties.find((x) => x.uid === propUid);
  if (!p || (!p.houseId && !condoDef(p.itemId))) return;
  p.rented = rented;
  if (rented && w.player.residence === propUid) w.player.residence = 'narwhal';
  // Tenants move into an empty home; your furniture goes back into storage
  if (rented) clearHome(w, propUid);
  fx.push({ type: 'toast', text: rented ? 'Listed for rent! Tenants pay you each month.' : 'No longer rented.', icon: '🔑', tone: 'info' });
}

export function moveIn(w: WorldState, fx: Fx, propUid: string) {
  const p = w.assets.properties.find((x) => x.uid === propUid);
  if (!p) return;
  p.rented = false;
  w.player.residence = propUid;
  fx.push({ type: 'toast', text: 'Moved in! Home sweet home.', icon: '🏠', tone: 'good' });
}

export function upgradeProperty(w: WorldState, fx: Fx, propUid: string, upgradeId: string) {
  const p = w.assets.properties.find((x) => x.uid === propUid);
  const u = property.upgrades.find((x) => x.id === upgradeId);
  if (!p || !u) return false;
  const cost = currentPrice(w, u.cost);
  if (checkout(w, fx, cost, u.name) === null) return false;
  p.level++;
  p.value = round2(p.value + (u.valueAdd ?? 0) * w.market.priceIndex);
  if ((u as { happiness?: number }).happiness) boostHappiness(w, (u as { happiness?: number }).happiness!);
  fx.push({ type: 'toast', text: `${u.name} added! Value +${fmt((u.valueAdd ?? 0) * w.market.priceIndex)}`, icon: u.icon, tone: 'good' });
  return true;
}

export function sellProperty(w: WorldState, fx: Fx, propUid: string) {
  const p = w.assets.properties.find((x) => x.uid === propUid);
  if (!p) return;
  const fees = round2(p.value * 0.06);
  let net = round2(p.value - fees);
  const loans = w.finance.loans.filter((l) => l.collateral === propUid);
  for (const l of loans) {
    const payoff = Math.min(l.balance, net);
    net = round2(net - payoff);
    w.finance.loans = w.finance.loans.filter((x) => x.id !== l.id);
  }
  // Furniture comes with you: it goes back into storage
  clearHome(w, propUid);
  w.assets.properties = w.assets.properties.filter((x) => x.uid !== propUid);
  if (w.player.residence === propUid) w.player.residence = 'narwhal';
  receive(w, net, 'Property sale');
  fx.push({ type: 'narwhal', text: `Sold for ${fmt(p.value)}. After 6% selling fees${loans.length ? ' and paying off the mortgage' : ''}, you received ${fmt(net)}.`, mood: 'talking' });
}

/* ───────── Businesses ───────── */

export function startBusiness(w: WorldState, fx: Fx, typeId: string, name: string) {
  const t = businessType(typeId);
  if (!t) return false;
  if (levelLocked(w, fx, (t as { unlockLevel?: number }).unlockLevel)) return false;
  const cost = currentPrice(w, t.cost);
  if (!spend(w, fx, cost, `Start ${t.name}`)) return false;
  w.assets.businesses.push({ uid: uid('biz'), typeId, name: name.slice(0, 24) || t.name, level: 1, staff: 0, invested: cost, profits: [], boughtMonth: w.time.month });
  fx.push({ type: 'narwhal', text: `Your ${t.name} is open! ${t.icon} At the end of each month it earns revenue and pays expenses. Profit (or loss!) goes to your account.`, mood: 'hyped' });
  fx.push({ type: 'confetti' });
  recordEvent(w, fx, { type: 'startBusiness', target: typeId, value: cost });
  return true;
}

export function upgradeBusiness(w: WorldState, fx: Fx, bizUid: string) {
  const b = w.assets.businesses.find((x) => x.uid === bizUid);
  const t = b && businessType(b.typeId);
  if (!b || !t || b.level >= t.maxLevel) return false;
  const cost = currentPrice(w, t.upgradeCost * b.level);
  if (!spend(w, fx, cost, `Upgrade ${b.name}`)) return false;
  b.level++;
  b.invested = round2(b.invested + cost);
  fx.push({ type: 'toast', text: `${b.name} upgraded to level ${b.level}!`, icon: '⬆️', tone: 'good' });
  return true;
}

export function hireStaff(w: WorldState, fx: Fx, bizUid: string, delta: 1 | -1) {
  const b = w.assets.businesses.find((x) => x.uid === bizUid);
  const t = b && businessType(b.typeId);
  if (!b || !t) return;
  const n = b.staff + delta;
  if (n < 0 || n > t.maxStaff) return;
  b.staff = n;
  fx.push({ type: 'toast', text: delta > 0 ? `Hired a worker (+${fmt(t.wage)}/month wages)` : 'Reduced staff', icon: '🧑‍🍳', tone: 'info' });
}

export function sellBusiness(w: WorldState, fx: Fx, bizUid: string) {
  const b = w.assets.businesses.find((x) => x.uid === bizUid);
  if (!b) return;
  const v = round2(businessValue(b));
  w.assets.businesses = w.assets.businesses.filter((x) => x.uid !== bizUid);
  receive(w, v, `Sold ${b.name}`);
  fx.push({ type: 'toast', text: `Sold ${b.name} for ${fmt(v)} (you invested ${fmt(b.invested)})`, icon: '🤝', tone: 'info' });
}

/* ───────── Subscriptions, insurance, donations ───────── */

export function toggleSubscription(w: WorldState, fx: Fx, id: string) {
  const s = subscriptionDef(id);
  if (!s) return;
  const subs = w.finance.subscriptions;
  if (subs.includes(id)) {
    w.finance.subscriptions = subs.filter((x) => x !== id);
    fx.push({ type: 'toast', text: `Cancelled ${s.name}. You'll save ${fmt(s.monthly)}/month (${fmt(s.monthly * 12)}/year)!`, icon: '✂️', tone: 'good' });
  } else {
    subs.push(id);
    boostHappiness(w, s.happiness * 2);
    fx.push({ type: 'toast', text: `Subscribed to ${s.name}: ${fmt(s.monthly)} every month.`, icon: s.icon, tone: 'info' });
    recordEvent(w, fx, { type: 'subscribe', target: id });
  }
}

export function setInsurance(w: WorldState, fx: Fx, category: string, planId: string | null) {
  w.finance.insurance[category] = planId;
  if (planId) {
    const p = insurancePlan(planId);
    fx.push({ type: 'toast', text: `Insured: ${p?.name} ${category} (${fmt(p?.premium ?? 0)}/month, ${fmt(p?.deductible ?? 0)} deductible)`, icon: '☂️', tone: 'good' });
    recordEvent(w, fx, { type: 'insure', target: category });
  } else fx.push({ type: 'toast', text: `Cancelled ${category} insurance.`, icon: '☂️', tone: 'info' });
}

export function donate(w: WorldState, fx: Fx, target: string, amount: number) {
  amount = round2(amount);
  if (!spend(w, fx, amount, `Donation: ${target}`)) return false;
  w.progress.stats.donated = (w.progress.stats.donated ?? 0) + amount;
  const proj = community.projects.find((p) => p.id === target);
  if (proj) {
    const before = w.progress.community[proj.id] ?? 0;
    w.progress.community[proj.id] = round2(before + amount);
    if (before < proj.cost && w.progress.community[proj.id] >= proj.cost) {
      fx.push({ type: 'narwhal', text: `The ${proj.name} is fully funded! ${proj.icon} Thanks to you, it's being built in Fin-City Park. Bonus: ${proj.bonus}.`, mood: 'hyped' });
      fx.push({ type: 'confetti' });
      if ('title' in proj && proj.title && !w.progress.titles.includes(proj.title as string)) w.progress.titles.push(proj.title as string);
    }
  }
  boostHappiness(w, Math.min(8, 2 + amount / 50));
  fx.push({ type: 'sfx', name: 'unlock' });
  recordEvent(w, fx, { type: 'donate', target, value: amount });
  return true;
}

/* ───────── Arcade prizes ───────── */

export function redeemPrize(w: WorldState, fx: Fx, id: string) {
  const p = furniture.prizes.find((x) => x.id === id);
  if (!p || w.progress.tickets < p.tickets) return false;
  w.progress.tickets -= p.tickets;
  if (p.outfit) {
    if (!w.assets.items.some((i) => i.itemId === p.outfit)) w.assets.items.push({ uid: uid('item'), itemId: p.outfit, value: 0, price: 0, boughtMonth: w.time.month });
  } else w.assets.items.push({ uid: uid('item'), itemId: p.id, value: 0, price: 0, boughtMonth: w.time.month });
  boostHappiness(w, p.happiness ?? 3);
  w.progress.collection[`prize:${id}`] = (w.progress.collection[`prize:${id}`] ?? 0) + 1;
  fx.push({ type: 'toast', text: `Redeemed ${p.name}!`, icon: p.icon, tone: 'gold' });
  fx.push({ type: 'sfx', name: 'unlock' });
  return true;
}

/* ───────── Retirement account ───────── */

export function setRetirement(w: WorldState, fx: Fx, pct: number, roth: boolean) {
  const r = w.finance.retirement;
  r.open = true;
  r.pct = Math.max(0, Math.min(0.2, pct));
  r.roth = roth;
  fx.push({ type: 'toast', text: `Retirement: saving ${(r.pct * 100).toFixed(0)}% of each paycheck (${roth ? 'Roth' : 'Traditional'}).`, icon: '🏖️', tone: 'good' });
  recordEvent(w, fx, { type: 'retirement' });
}

export function depositRetirement(w: WorldState, fx: Fx, amount: number) {
  if (!spend(w, fx, amount, 'Retirement deposit')) return false;
  w.finance.monthSpending -= amount;
  w.finance.retirement.open = true;
  w.finance.retirement.balance = round2(w.finance.retirement.balance + amount);
  w.finance.retirement.contributed = round2(w.finance.retirement.contributed + amount);
  log(w, 'Retirement deposit', amount, 'invest');
  return true;
}

export function withdrawRetirement(w: WorldState, fx: Fx, amount: number) {
  const r = w.finance.retirement;
  amount = Math.min(r.balance, round2(amount));
  if (amount <= 0) return;
  r.balance = round2(r.balance - amount);
  const penalty = w.difficulty === 'advanced' ? round2(amount * 0.1) : round2(amount * 0.05);
  const tax = w.difficulty === 'advanced' && !r.roth ? round2(amount * 0.12) : 0;
  receive(w, amount - penalty - tax, 'Early retirement withdrawal');
  fx.push({ type: 'narwhal', text: `You took ${fmt(amount)} out early. Penalty ${fmt(penalty)}${tax ? ` and ${fmt(tax)} tax` : ''}, and that money stops growing for your future. Early withdrawals are expensive!`, mood: 'disappointed' });
}
