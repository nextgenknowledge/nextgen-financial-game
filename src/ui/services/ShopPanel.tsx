'use client';
import { useState } from 'react';
import { useUI } from '@/store/ui';
import { useGame, act } from '@/store/game';
import { Button, Modal, ReadAloud } from '../common';
import { Section, Stat, StatGrid, Explain, Tabs } from '../kit';
import { money, pct } from '../format';
import furniture from '@/data/shop/furniture.json';
import pets from '@/data/shop/pets.json';
import property from '@/data/shop/property.json';
import { VEHICLES } from '@/game/sim/vehicleCatalog';
import { OutfitShop } from './OutfitShop';
import {
  buyFurniture,
  buyCollectible,
  adoptPet,
  buyVehicle,
  vehicleOffer,
  buyPlot,
  buildHouse,
  buyCondo,
  propertyOffer,
  currentPrice,
  upgradeProperty,
} from '@/game/finance/purchases';
import { withSalesTax } from '@/game/finance/tax';
import { available, cardAvailable } from '@/game/finance/accounts';
import type { WorldState } from '@/game/types';

const TITLES: Record<string, string> = {
  outfits: '🛍️ Outfit Shop',
  furniture: '🛋️ Furniture Store',
  collectibles: '🖼️ Collectibles & Art',
  pets: '🐾 Pet Shop',
  vehicles: '🚙 Auto Dealer',
  property: '🏡 Real Estate Office',
};

function NeedWant({ need }: { need?: boolean }) {
  return <span className={`chip ${need ? 'teal' : 'gold'}`}>{need ? 'Need' : 'Want'}</span>;
}

function PriceTag({ w, price }: { w: WorldState; price: number }) {
  const { total, tax } = withSalesTax(price, w.difficulty === 'advanced');
  return (
    <span className="mono bold">
      {money(price)}
      {tax > 0 && <span className="tiny muted"> +{money(tax)} tax = {money(total)}</span>}
    </span>
  );
}

export function ShopPanel({ id }: { id: string }) {
  const close = useUI((s) => s.close);
  const w = useGame((s) => s.world!);
  const base = id.split(':')[0];
  const [card, setCard] = useState(false);
  const method = card ? 'card' : 'auto';
  const canCard = w.difficulty === 'advanced' && w.finance.card.open;
  return (
    <Modal onClose={close} title={TITLES[base] ?? 'Shop'} size="wide">
      <div className="row between wrap" style={{ marginBottom: 8 }}>
        <span className="small">
          You can spend: <b className="mono">{money(available(w))}</b> (cash + checking)
          {canCard && (
            <>
              {' '}
              · card room <b className="mono">{money(cardAvailable(w))}</b>
            </>
          )}
        </span>
        {canCard && base !== 'property' && base !== 'pets' && (
          <Button size="small" variant={card ? 'blue' : undefined} onClick={() => setCard(!card)}>
            {card ? '💳 Paying by card' : '💵 Paying with money'}
          </Button>
        )}
      </div>
      {base === 'outfits' && <OutfitShop w={w} method={method} />}
      {base === 'furniture' && (
        <>
          <p className="small muted">Furniture makes you happy, but resells for only about 40% of what you paid.</p>
          <div className="item-grid">
            {furniture.furniture.map((f) => (
              <div key={f.id} className="item-card">
                <span style={{ fontSize: '2.2rem' }}>{f.icon}</span>
                <b className="small">{f.name}</b>
                <NeedWant need={(f as { need?: boolean }).need} />
                <PriceTag w={w} price={currentPrice(w, f.price * (w.progress.perks.includes('smart-shopper') ? 0.95 : 1))} />
                <span className="tiny">+{f.happiness} 😊{(f as { monthly?: number }).monthly ? ` · ${money((f as { monthly?: number }).monthly!)}/mo` : ''}</span>
                <Button size="small" variant="primary" onClick={() => act((d, fx) => void buyFurniture(d, fx, f.id, method))}>
                  Buy
                </Button>
              </div>
            ))}
          </div>
        </>
      )}
      {base === 'collectibles' && (
        <>
          <p className="small">
            {w.difficulty === 'entry'
              ? 'Collectibles can become worth more… or less! Nobody knows for sure.'
              : 'Collectibles and art have no earnings, their value is whatever the next buyer pays. Expected drift and volatility shown below.'}
          </p>
          <div className="item-grid">
            {furniture.collectibles.map((c) => {
              const lock = (c as { unlockLevel?: number }).unlockLevel;
              return (
                <div key={c.id} className="item-card">
                  <span style={{ fontSize: '2.2rem' }}>{c.icon}</span>
                  <b className="small">{c.name}</b>
                  <PriceTag w={w} price={currentPrice(w, c.price)} />
                  {w.difficulty === 'advanced' && (
                    <span className="tiny">
                      ~{pct(c.mu, 0)}/yr ± {pct(c.sigma, 0)}
                    </span>
                  )}
                  <Button size="small" variant="primary" disabled={!!lock && w.progress.level < lock} onClick={() => act((d, fx) => void buyCollectible(d, fx, c.id, method))}>
                    {lock && w.progress.level < lock ? `🔒 Lv ${lock}` : 'Buy'}
                  </Button>
                </div>
              );
            })}
          </div>
        </>
      )}
      {base === 'pets' && <PetShop />}
      {base === 'vehicles' && <AutoDealer card={card} />}
      {base === 'property' && <RealEstate focusPlot={id.split(':')[1]} />}
    </Modal>
  );
}

function PetShop() {
  const w = useGame((s) => s.world!);
  const [names, setNames] = useState<Record<string, string>>({});
  return (
    <>
      <div className="card tint-gold small" style={{ marginBottom: 10 }}>
        🐾 A pet is a <b>promise</b>. Before adopting, check the monthly cost, it&apos;s added to your bills every month for as long as you have your pet.
        <ReadAloud text="A pet is a promise. Before adopting, check the monthly cost. It's added to your bills every month." />
      </div>
      <div className="item-grid">
        {pets.items.map((p) => {
          const lock = (p as { unlockLevel?: number }).unlockLevel;
          return (
            <div key={p.id} className="item-card">
              <span style={{ fontSize: '2.4rem' }}>{p.icon}</span>
              <b>{p.name}</b>
              <span className="tiny muted">{p.blurb}</span>
              <span className="small">
                Adopt {money(currentPrice(w, p.adoption))} · <b>{money(p.monthly * w.market.priceIndex)}/month</b>
              </span>
              <span className="tiny">≈ {money(p.monthly * 12 * w.market.priceIndex, { cents: false })} per year</span>
              <input className="input" style={{ minHeight: 34, padding: '0.2rem 0.5rem' }} placeholder="Name your pet" maxLength={16} value={names[p.id] ?? ''} onChange={(e) => setNames({ ...names, [p.id]: e.target.value })} />
              <Button size="small" variant="primary" disabled={!!lock && w.progress.level < lock} onClick={() => act((d, fx) => void adoptPet(d, fx, p.id, names[p.id] ?? ''))}>
                {lock && w.progress.level < lock ? `🔒 Lv ${lock}` : 'Adopt'}
              </Button>
            </div>
          );
        })}
      </div>
    </>
  );
}

function AutoDealer({ card }: { card: boolean }) {
  const w = useGame((s) => s.world!);
  const entry = w.difficulty === 'entry';
  const [sel, setSel] = useState(VEHICLES[0].id);
  const v = VEHICLES.find((x) => x.id === sel)!;
  const o = vehicleOffer(w, v.id);
  const lock = v.unlockLevel && w.progress.level < v.unlockLevel;
  return (
    <div className="row wrap" style={{ gap: 14, alignItems: 'flex-start' }}>
      <div className="col" style={{ gap: 4, minWidth: 220 }}>
        {VEHICLES.map((x) => (
          <button key={x.id} className={`trade-item ${x.id === sel ? 'on' : ''}`} onClick={() => setSel(x.id)}>
            <span className="trade-icon">{x.icon}</span>
            <b className="small">{x.name}</b>
            <span className="small mono" style={{ marginLeft: 'auto' }}>
              {money(currentPrice(w, x.price), { cents: false })}
            </span>
          </button>
        ))}
      </div>
      <div className="col grow" style={{ minWidth: 280 }}>
        <h3 style={{ margin: 0 }}>
          {v.icon} {v.name}
        </h3>
        <span className="small">{v.blurb}</span>
        <StatGrid>
          <Stat label="Price" value={money(o.price, { cents: false })} />
          <Stat label="Upkeep" value={`${money(v.upkeep)}/mo`} sub="Fuel, care, parking" tone="bad" />
          <Stat label={entry ? 'Loses value' : 'Depreciation'} value={`${Math.round(v.depreciation * 100)}%/yr`} />
          <Stat label="Top speed" value={`${Math.round(v.topSpeed * 3.6)} km/h`} />
        </StatGrid>
        {lock ? (
          <div className="card tint-gold">🔒 Unlocks at level {v.unlockLevel}.</div>
        ) : (
          <div className="col" style={{ gap: 8 }}>
            <div className="card flat row between wrap">
              <span>
                <b>{card ? '💳 Pay by card' : '💵 Pay in full'}</b> <span className="small muted">Own it now, no interest.</span>
              </span>
              <Button variant="green" onClick={() => act((d, fx) => void buyVehicle(d, fx, v.id, card ? 'card' : 'cash'))}>
                Buy {money(o.price, { cents: false })}
              </Button>
            </div>
            {v.price >= 1000 && (
              <div className="card flat row between wrap">
                <span>
                  <b>📝 Auto loan</b>{' '}
                  <span className="small muted">
                    {money(o.down, { cents: false })} down, then {money(o.loan.payment)}/mo × {o.months}
                    {!entry && ` at ${pct(o.loan.apr, 2)} APR`}. Total {money(o.down + o.loan.total, { cents: false })}.
                  </span>
                </span>
                <Button variant="blue" onClick={() => act((d, fx) => void buyVehicle(d, fx, v.id, 'loan'))}>
                  Finance
                </Button>
              </div>
            )}
            {v.leaseable && (
              <div className="card flat row between wrap">
                <span>
                  <b>📄 Lease</b>{' '}
                  <span className="small muted">
                    {money(o.leaseDown, { cents: false })} to start, {money(o.lease)}/mo for {o.leaseMonths} months. Total {money(o.leaseDown + o.lease * o.leaseMonths, { cents: false })}, and then you give it back!
                  </span>
                </span>
                <Button onClick={() => act((d, fx) => void buyVehicle(d, fx, v.id, 'lease'))}>Lease</Button>
              </div>
            )}
            <Explain title="Buy, borrow or lease?">
              Paying cash costs the least overall. A loan lets you drive now but adds interest. A lease has the lowest monthly payment, but you never own the car, at the end you have nothing to sell. All cars lose value every year.
            </Explain>
          </div>
        )}
      </div>
    </div>
  );
}

function RealEstate({ focusPlot }: { focusPlot?: string }) {
  const w = useGame((s) => s.world!);
  const entry = w.difficulty === 'entry';
  const [tab, setTab] = useState<'land' | 'condos' | 'upgrades'>('land');
  const [down, setDown] = useState(0.2);
  const [houseFor, setHouseFor] = useState<string | null>(focusPlot ?? null);
  const plotsOwned = new Map(w.assets.properties.filter((p) => p.plotId).map((p) => [p.plotId!, p]));
  const DownPicker = () => (
    <div className="row wrap" style={{ gap: 6 }}>
      <span className="small bold">Down payment:</span>
      {[0.1, 0.2, 0.3, 0.5].map((d) => (
        <Button key={d} size="small" variant={down === d ? 'gold' : undefined} onClick={() => setDown(d)}>
          {d * 100}%
        </Button>
      ))}
    </div>
  );
  return (
    <div>
      <Tabs value={tab} onChange={setTab} tabs={[{ id: 'land', label: '🟩 Land & houses' }, { id: 'condos', label: '🏙️ City condos' }, { id: 'upgrades', label: '🔨 Upgrades' }]} />
      {tab !== 'upgrades' && <DownPicker />}
      {tab === 'land' && (
        <div className="col" style={{ gap: 8, marginTop: 8 }}>
          {property.plots.map((p) => {
            const owned = plotsOwned.get(p.id);
            const price = currentPrice(w, p.price);
            const off = propertyOffer(w, price, down, 15);
            return (
              <div key={p.id} className={`card ${focusPlot === p.id ? 'tint-gold' : 'flat'}`}>
                <div className="row between wrap">
                  <b>🟩 {p.name}</b>
                  <span className="mono">{owned ? `Yours · worth ${money(owned.value, { cents: false })}` : money(price, { cents: false })}</span>
                </div>
                {!owned ? (
                  <div className="row wrap" style={{ gap: 6, marginTop: 4 }}>
                    <Button size="small" variant="green" onClick={() => act((d, fx) => void buyPlot(d, fx, p.id, null))}>
                      Buy with cash
                    </Button>
                    <Button size="small" variant="blue" onClick={() => act((d, fx) => void buyPlot(d, fx, p.id, down))}>
                      {money(off.down, { cents: false })} down + {money(off.payment)}/mo (15 yr)
                    </Button>
                  </div>
                ) : owned.houseId ? (
                  <span className="small good">🏠 House built</span>
                ) : (
                  <Button size="small" variant="primary" onClick={() => setHouseFor(houseFor === p.id ? null : p.id)}>
                    🔨 Build a house
                  </Button>
                )}
                {owned && !owned.houseId && houseFor === p.id && (
                  <div className="col" style={{ gap: 6, marginTop: 6 }}>
                    {property.houses.map((h) => {
                      const cost = currentPrice(w, h.buildCost);
                      const m = propertyOffer(w, cost, down, 30);
                      const lock = (h as { unlockLevel?: number }).unlockLevel;
                      return (
                        <div key={h.id} className="card flat">
                          <div className="row between wrap">
                            <b>
                              {h.icon} {h.name}
                            </b>
                            <span className="mono">{money(cost, { cents: false })}</span>
                          </div>
                          <div className="small muted">
                            {h.blurb} Upkeep {money(h.upkeep)}/mo · rents for ~{money(h.rent, { cents: false })}/mo
                          </div>
                          {lock && w.progress.level < lock ? (
                            <span className="small">🔒 Level {lock}</span>
                          ) : (
                            <div className="row wrap" style={{ gap: 6 }}>
                              <Button size="small" variant="green" onClick={() => act((d, fx) => void buildHouse(d, fx, p.id, h.id, null))}>
                                Pay cash
                              </Button>
                              <Button size="small" variant="blue" onClick={() => act((d, fx) => void buildHouse(d, fx, p.id, h.id, down))}>
                                Mortgage: {money(m.down, { cents: false })} down + {money(m.payment)}/mo × 30 yr
                              </Button>
                            </div>
                          )}
                          {!entry && (
                            <div className="tiny muted">
                              Mortgage total interest ≈ {money(m.interest, { cents: false })} at {pct(m.apr, 2)} APR.
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
      {tab === 'condos' && (
        <div className="col" style={{ gap: 8, marginTop: 8 }}>
          {property.condos.map((c) => {
            const price = currentPrice(w, c.price);
            const m = propertyOffer(w, price, down, 30);
            const cashflow = c.rent - c.upkeep - m.payment;
            return (
              <div key={c.id} className="card flat">
                <div className="row between wrap">
                  <b>
                    {c.icon} {c.name}
                  </b>
                  <span className="mono">{money(price, { cents: false })}</span>
                </div>
                <div className="small muted">
                  {c.blurb} Rent ~{money(c.rent, { cents: false })}/mo · upkeep {money(c.upkeep)}/mo
                </div>
                {!entry && (
                  <div className="small">
                    With a mortgage ({money(m.payment)}/mo) monthly cash flow ≈ <b className={cashflow >= 0 ? 'good' : 'bad'}>{money(cashflow, { sign: true })}</b>
                  </div>
                )}
                <div className="row wrap" style={{ gap: 6 }}>
                  <Button size="small" variant="green" onClick={() => act((d, fx) => void buyCondo(d, fx, c.id, null))}>
                    Pay cash
                  </Button>
                  <Button size="small" variant="blue" onClick={() => act((d, fx) => void buyCondo(d, fx, c.id, down))}>
                    {money(m.down, { cents: false })} down + mortgage
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
      {tab === 'upgrades' && (
        <div className="col" style={{ gap: 8 }}>
          {w.assets.properties.filter((p) => p.houseId || !p.plotId).length === 0 && <span className="muted">Build or buy a home first.</span>}
          {w.assets.properties
            .filter((p) => p.houseId || !p.plotId)
            .map((p) => (
              <div key={p.uid} className="card flat">
                <b>
                  {p.houseId ? property.houses.find((h) => h.id === p.houseId)?.name : property.condos.find((c) => c.id === p.itemId)?.name} · worth {money(p.value, { cents: false })}
                </b>
                <div className="row wrap" style={{ gap: 6, marginTop: 4 }}>
                  {property.upgrades.map((u) => (
                    <Button key={u.id} size="small" onClick={() => act((d, fx) => void upgradeProperty(d, fx, p.uid, u.id))}>
                      {u.icon} {u.name} ({money(currentPrice(w, u.cost), { cents: false })}, +{money(u.valueAdd, { cents: false })} value)
                    </Button>
                  ))}
                </div>
              </div>
            ))}
        </div>
      )}
      <Section title="">
        <Explain title={entry ? 'What is a mortgage?' : 'Down payments & mortgages'}>
          {entry
            ? 'A mortgage is a big loan to buy a home. You pay a little every month for many years. A bigger down payment means smaller monthly payments!'
            : 'A larger down payment means a smaller loan, lower payments and less total interest. Property values usually rise slowly but can fall. Owners also pay upkeep and property tax (1.1%/yr).'}
        </Explain>
      </Section>
    </div>
  );
}
