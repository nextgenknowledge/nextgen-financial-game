# Fin City — Design Doc & Build Plan

*A 3D browser game by NextGen Knowledge that teaches financial literacy to students aged 6–18.*

This document is the source of truth for how the game works. When something in the brief was
unspecified, the decision we made is recorded under **Decision log** at the bottom.

---

## 1. Pillars

1. **Fun first, lesson inside.** Every activity is a real game with stars, best scores and replay value.
   The money lesson is the mechanic, not a quiz bolted on top.
2. **Real consequences, never cruel.** Interest, market swings and surprise bills exist because they are
   the lessons. Cash never goes negative, late fees are small, credit can always be rebuilt, and Narwhal
   always explains what happened and what to do next.
3. **Two genuinely different games.** *Entry* (6–13) is picture-led, generous and gentle. *Advanced*
   (13–18) is a personal-finance course you play: calculators, amortization, brackets, P/E, credit scores.
4. **Data-driven.** Cities, buildings, activities, questions, shop items, events, quests, tips, lessons
   and Narwhal's lines all live in `src/data/**`. Teachers can add content without touching the engine.
5. **Runs on a school Chromebook.** Merged/instanced low-poly geometry, simple materials, Low/Med/High.
6. **Private by design.** No accounts, no network calls, no analytics. Fonts are bundled. Nicknames only.

---

## 2. Game structure

```
Title (NextGen Knowledge presents → Fin City logo)
 └─ Worlds list (create / load / rename / duplicate / delete / import / export)
     └─ World
         ├─ Fin-City Park (hub)  ──portals──►  New York · London · Hong Kong · San Francisco · Singapore
         │    └─ enterable buildings ──► interior room ──► activity stations (overlay UI)
         ├─ FinPhone (menu hub: Bank, Goals, Net Worth, Portfolio, Assets, Quests, Learn, Badges, Map, Settings)
         └─ Systems ticking in the background: time, bills, interest, market, credit, taxes, events
```

### Time
* **One day/night cycle = one Fin City month.** Default 8 real minutes (settings: 5 / 8 / 12).
  The sky, streetlights and glowing windows follow the cycle. The HUD shows `Mar · Year 2`.
* The month is split into 4 weeks (dawn, day, dusk, night) for weekly reminders.
* The **market** ticks 21 times per month (one tick ≈ one trading day ≈ 23 s at default speed).
* Time pauses while a menu, activity or the pause screen is open, so kids are never punished for reading.
* Daily/weekly challenges and seasonal events use the **real calendar**, so they feel like "today's".

### Month processing order (`processMonth`)
1. Savings interest, CD accrual/maturity, retirement growth + contributions
2. Recurring bills (subscriptions, upkeep, insurance premiums, pet care, rent), property tax (Advanced)
3. Loan & mortgage payments (autopay from checking → savings → overdraft/credit), late handling
4. Credit card statement (Advanced): interest on carried balance, minimum payment, utilization
5. Business profit, rental income, dividends (quarterly)
6. Inflation step, vehicle depreciation, collectible/art value walk
7. Random life event (≈35% chance), softened by insurance & emergency fund
8. Credit score recompute (Advanced), net-worth snapshot, Narwhal monthly summary
9. Year end (Advanced): W-2 generated, tax season opens (file by Month 4)

---

## 3. Economy formulas

All money math lives in `src/game/finance/*.ts` and is unit tested (`tests/finance.test.ts`).

| Concept | Formula |
|---|---|
| Simple interest | `I = P · r · t` |
| Compound amount | `A = P(1 + r/n)^(n·t)` |
| APY from APR | `APY = (1 + APR/n)^n − 1` |
| Monthly rate from APY | `m = (1 + APY)^(1/12) − 1` |
| Rule of 72 | `years ≈ 72 / (rate%)` |
| Loan payment | `PMT = P · i / (1 − (1+i)^−N)`, `i = APR/12` (`P/N` when `i = 0`) |
| Amortization row | `interest = bal·i; principal = PMT − interest (+ extra); bal −= principal` |
| Credit-card minimum | `max($25, 1% · balance + monthly interest)`, capped at balance |
| Future value of contributions | `FV = C · ((1+i)^N − 1)/i` |
| Real return | `(1 + nominal)/(1 + inflation) − 1` |
| Bond price change | `ΔP/P ≈ −Duration · Δyield` |
| P/E, yield | `P/E = price / EPS`, `yield = annual dividend / price` |
| Break-even units | `fixed costs / (price − variable cost per unit)` |
| Profit margin | `(revenue − costs) / revenue` |
| Business value | `3 × trailing 12-month profit` (min. 50% of money invested) |
| Depreciation | vehicles lose `annualRate/12` of value monthly, floor at 15% of price |
| Net worth | `Σ assets − Σ liabilities` (see §5) |

### Banking rates
* **Entry:** "Fin City Kids Bank pays **1% every month** on savings." Simple, visible, honest about the
  period. CDs pay 1.5%/month locked for 3 or 6 months. Loans: flat 5% fee ("borrow $100, pay back $105").
* **Advanced:** real-world style. Savings APY tracks the Fin City Reserve rate (starts 4.0%). CDs 6/12/24
  months at +0.5/+0.8/+1.0%. Credit card 24.99% APR. Loan APR = reserve rate + spread by credit tier.

### Credit score (Advanced) — `src/game/finance/credit.ts`
Range 300–850. `score = 300 + 550 · Σ wₖ fₖ` with weights from the real FICO mix:

| Factor | w | f (0..1) |
|---|---|---|
| Payment history | .35 | `(onTime + 1) / (onTime + 1 + 4·late)`, recent lates hurt more |
| Utilization | .30 | `<10%: 1 · <30%: .85 · <50%: .6 · <75%: .4 · else .2` |
| Length of history | .15 | `min(1, oldestAccountMonths / 60)` |
| New credit | .10 | `max(0, 1 − 0.15 · hardInquiriesLast12)` |
| Credit mix | .10 | revolving + installment = 1, one type = .6 |

No credit products → "No score yet". Tiers: Excellent 760+, Good 700+, Fair 640+, Poor 580+, Very poor.
Spread over reserve rate: +2 / +4 / +7 / +11 / +16 percentage points.

### Taxes (Advanced) — `src/game/finance/tax.ts`
Fictional "Fin City Revenue Service" (FCRS) using US-single-filer-style brackets:
10% to $11,925 · 12% to $48,475 · 22% to $103,350 · 24% to $197,300 · 32% to $250,525 · 35% to $626,350 · 37% above.
Standard deduction $15,000. Payroll: Social Security 6.2%, Medicare 1.45%, city tax 3% flat.
Withholding per paycheck = annualized bracket tax / pay periods. Sales tax 6%. Property tax 1.1%/yr of home value.
Filing season: Months 1–4 of each year at the SF Tax Office (do it yourself, or pay a preparer $60).

### Market — `src/game/market/*.ts`
* 14 fictional companies (8 sectors), 2 index funds, 2 bond funds.
* Each tick: market factor `m ~ N(μ_regime·dt, σ_m·√dt)`; stock log-return
  `r = β·m + ε (σᵢ√dt) + newsShock`, clamped to ±12% per tick, price floor $1.
* Regimes (bull / normal / bear) switch with small probability → market cycles.
* News events (data) push sector drift for a few ticks; Newsroom teaches reading them.
* Bond fund price: `P *= 1 − D·Δy + coupon/252`. Reserve rate drifts and is announced in news.
* EPS grows quarterly with sector growth ± noise; dividends paid quarterly.

### Balance targets (tested with the saver-vs-spender simulation in `tests/sim.test.ts`)
* First hour: ~$1,500–$3,000 earned. Bike ($120) affordable in 10 min, used car (~$4k) in ~1–2 h.
* A player who saves/invests half their income ends year 3 with ~2× the net worth of an impulse spender
  with the same income — and the impulse spender still had fun (happiness, cosmetics, pets).
* **Happiness meter (0–100):** "wants" (cosmetics, pets, decor, rides, arcade) raise it; it decays slowly.
  Happiness above 70 gives up to +15% XP. This makes fun spending genuinely valuable, so kids feel the
  trade-off instead of being told "never spend".

---

## 4. Difficulty modes

Each world stores `difficulty: 'entry' | 'advanced'`; it can be changed in Pause → World Options.
Everything difficulty-aware reads `params[difficulty]`:

* **Questions:** separate Entry and Advanced banks, each with sub-levels 1–5. Entry sub-level adapts:
  3 correct in a row → level up, 2 wrong in a row → level down (6-year-old → early middle school).
* **Activities:** every activity definition has an `entry` and `advanced` parameter block.
* **Systems:** Advanced turns on credit card, credit score, taxes, sales tax, payroll deductions,
  P/E & bond math, amortization tables, leasing, the calculator, and harder life events.
* **Presentation:** Entry uses bigger buttons, icons, short sentences, generous hints (and a free 50/50
  after a wrong answer), auto read-aloud offered. Advanced shows a calculator and formula sheet.

---

## 5. Assets & liabilities

**Assets:** cash · checking · savings · CDs · stocks/funds/bonds (market value) · retirement account ·
businesses (valuation) · land plots · homes & rentals (appraised value) · vehicles (depreciated) ·
furniture & decor (40% resale) · collectibles & art (random-walk value) · pets (no resale value — shown
for fun, valued $0, a deliberate lesson) · Startup stakes (valued at cost until resolved).

**Liabilities:** loans (personal, auto, student-style "course loan"), mortgages, credit-card balance,
unpaid bills, taxes owed.

The **Net Worth** screen shows a stacked breakdown, a line chart over months, and "biggest change this
month" with Narwhal's explanation.

---

## 6. Architecture

```
fin-city-game/
  app/                      Next.js App Router shell (static export). page.tsx loads the client game.
  public/brand/             Logos exactly as provided + Narwhal reference sheet
  src/
    data/                   ALL content (JSON) — see README for schemas
      cities/*.json         layout, buildings, landmarks, NPCs, music theme
      activities/*.json     activity definitions (entry/advanced params, rewards)
      questions/*.json      question banks per city × difficulty
      shop/*.json           vehicles, properties, furniture, pets, collectibles, art, outfits, businesses
      quests.json  dialogue.json  tips.json  events.json  achievements.json  challenges.json
      lessons.json  jobs.json  news.json  companies.json  seasonal.json  insurance.json
    game/                   Pure TypeScript rules (no React, no three) — fully unit-tested
      finance/              interest, loans, credit, tax, inflation, insurance, netWorth
      market/               market simulation, candlestick generator
      questions/            expression evaluator, template instantiation, selection, grading
      sim/                  processMonth, life events, businesses, properties
      progress/             xp/levels, quests, achievements, challenges, stats, badges
      world.ts              WorldState type + createWorld + migrations
      rng.ts                seeded RNG (mulberry32)
    store/                  Zustand stores (game world via immer, UI, settings)
    save/                   IndexedDB persistence, autosave, import/export, thumbnails
    engine/                 3D: voxel builder, player & vehicle controllers, collision, camera,
                            sky/day-night, weather, crowds, traffic, audio, input
    world/                  Scene builders: Park, City (data → geometry), Interior; Narwhal & avatar models
    ui/                     DOM overlay: screens, HUD, FinPhone apps, dialogs, toasts, read-aloud
    activities/             Activity host + one component per activity kind
  tests/                    Vitest: finance, market, questions, saves, content validation, balance
```

### Runtime flow
* `GameRoot` (client only) switches between `TitleScreen`, `WorldsScreen`, and `GameView`.
* `GameView` = R3F `<Canvas>` (scene for current location) + DOM HUD overlay.
* `useGame` (Zustand + immer) holds the **WorldState** — the exact object that is saved.
* Pure rule functions mutate an immer draft: `processMonth(draft, rng)`, `recordEvent(draft, ev)` →
  returns notifications (toasts, Narwhal lines, confetti).
* Everything that "happens" goes through **`recordEvent`** (`activityComplete`, `answer`, `deposit`,
  `buy`, `travel`, `enterBuilding`, …). Quests, achievements, challenges, badges and stats all listen
  there, so new content only needs data.

### Rendering & performance
* Static scenery is built from boxes in code and **merged into a handful of vertex-colored meshes per
  scene** (opaque, windows-emissive, glass). A whole city is ~6–12 draw calls.
* Crowds, traffic, birds, trees and lamps use **InstancedMesh**.
* `MeshLambertMaterial` everywhere (Standard on High for a few hero props), fog hides the far plane,
  shadows only on High (one small shadow map following the player).
* Cities and interiors are **lazy**: a scene's geometry is built only when you travel there.
* Quality presets: Low (dpr 0.75, no shadows, 40% crowd, short draw distance), Medium (dpr 1, 70%),
  High (dpr ≤ 2, shadows, full crowd, extra props). Auto-drop to Low if FPS < 25 for 5 s (with toast).
* Text on signs is drawn to canvas textures with the bundled Nunito font — **drei `<Text>` and drei
  environment presets are not used** because they fetch from CDNs (privacy rule: no network).

### Physics
The brief allows "Rapier (or similar)". We use a **custom kinematic collision system**
(`src/engine/collision.ts`): circle-vs-AABB push-out on XZ, stand-on-top for low boxes, gravity & jump.
Cities are flat and boxy, so this is exact, deterministic, unit-testable, ~0 KB of WASM and far cheaper on
Chromebooks than a full rigid-body engine. Vehicles use arcade models on the same colliders (car, bike,
scooter, boat restricted to water rectangles, plane with altitude).

### Saving
IndexedDB database `fincity` → stores `worlds` (full WorldState), `meta` (list cards), `global`
(settings, hall of fame). Autosave every 30 s, on month rollover, after activities, and on
`visibilitychange`. Export = `.fincity.json` (`{format, version, exportedAt, world, checksum}`);
import validates, migrates and assigns a fresh id if needed.

---

## 7. Data schemas (summary — full field docs in README)

```ts
Question { id, city, building, topic, difficulty: 'entry'|'advanced', level: 1-5,
  type: 'mc'|'tf'|'numeric'|'multi'|'order', prompt, choices?, answer, explanation, hint?,
  vars?: {name: {min,max,step}|{choices:[]}}, derived?: {name: expr},
  answerExpr?, choiceExprs?, tolerance?, unit?, format?, media?: Table|Chart|Document }

Activity { id, building, name, kind, topics[], blurb, icon,
  entry: {...kind params}, advanced: {...kind params},
  rewards: { cash:[1★,2★,3★], xp:[...] }, stars: [score for 1★, 2★, 3★] }

City { id, name, theme, colors, music, size, roads, buildings: Building[], landmarks[], water[],
  spawn, portal, npcs[], filler }
Building { id, name, icon, pos:[x,z], size:[w,d,h], style, door, interior:{theme,color},
  stations: [{activity|service, label}], npc }
ShopItem { id, category, name, price, icon, ...category fields (depreciation, upkeep, happiness…) }
Quest { id, title, giver, steps: [{ id, text, goal:{type,…}, dialogue[], marker?, reward? }], reward, unlocks }
LifeEvent { id, title, text, category, cost:[min,max] | gain, weight, requires?, insurance?, difficulty? }
Achievement { id, name, desc, icon, condition: {stat, gte} | {event, count} }
```

---

## 8. Milestones

| # | Milestone | Playable result |
|---|---|---|
| 1 | Engine, movement, title screen with logos, Worlds save system | Create/load/rename/duplicate/delete/export/import worlds; walk & jump in a test park |
| 2 | Fin-City Park, HUD, bank, NextGen Narwhal, onboarding questline | Narwhal guides you through the first hour; bank works |
| 3 | Activity framework + question engine (Entry + Advanced) | Quizzes with templated, randomized, computed questions; stars & rewards |
| 4 | Economy simulation | Time, bills, interest, market, credit, taxes, net-worth chart |
| 5 | New York & London | 12+ activities |
| 6 | Hong Kong, San Francisco & Singapore | 18+ activities, jobs, delivery driving |
| 7 | Assets & spending | Vehicles (drivable), land & houses, businesses, furniture, collectibles, pets |
| 8 | Progression | Achievements, challenges, seasonal events, hall of fame, teacher report |
| 9 | Polish | Art pass, audio, performance, accessibility, balancing |

After every milestone: `npm run lint && npm test && npm run build`, play in the browser, fix errors,
check the FPS overlay.

---

## 9. Our additions to the brief

1. **FinPhone** — a chunky in-game phone that is the one clickable home for every menu (kid friendly).
2. **Happiness meter** — makes "wants" meaningful so the spend/save trade-off is felt, not lectured.
3. **Click-to-walk** — young kids (and touch screens) can click the ground or a building marker to walk there.
4. **Adaptive sub-levels** for Entry questions so a 6-year-old and a 12-year-old both stay in the zone.
5. **Templated computational questions** with a safe expression language — teachers can write
   `answerExpr: "P*(1+r/100/n)^(n*t)"` and get infinite variants.
6. **Arcade tickets** — arcade games cost $1 a play and pay tickets for prizes: a tiny, honest lesson
   in spending on fun.
7. **Community projects** — donations at Town Hall / Giving Center visibly upgrade the park
   (fountain, flower garden, playground, Ferris wheel, fireworks).
8. **Narwhal monthly recap** — at each month change Narwhal summarizes what money came in and out.
9. **"Oops-proof" money** — cash never goes negative; shortfalls fall through
   checking → savings → (Advanced) credit card / (Entry) a friendly Narwhal IOU, with a recovery tip.
10. **Formula sheet + calculator** in Advanced, and a **"show me how"** worked solution after
    every computational question.
11. **Money Tree** — each CD you open appears as a tree in the Singapore Savings Garden that grows as it accrues.
12. **Hall of Fame** board in the park showing the best net worth across your worlds.
13. **Tax preparer option** — pay $60 to have taxes filed for you, a real-world trade-off.

---

## 10. Decision log

| Decision | Why |
|---|---|
| Game lives in `fin-city-game/` inside the website repo, built with `output: 'export'` | Can be hosted as static files on nextgenknowledge.org (GitHub Pages) without a server |
| One day/night cycle = one month | Lets real interest rates, bills and loans play out within a session |
| Entry savings pays 1%/month, stated per month | Kids see growth; the rate is honest about its period |
| Custom kinematic physics instead of Rapier | Flat boxy worlds; deterministic; tiny; faster on Chromebooks |
| Pixel font: **Pixelify Sans** (titles/badges only), body: **Nunito** | Modern-retro, readable; both bundled via @fontsource (no network) |
| Narwhal's suit badge uses a crop of the provided org logo image (not a redraw) | "Use logos exactly as provided" |
| Currency: dollars everywhere, with currency exchange as a London activity | Fewer concepts for young kids; FX taught where it fits |
| Pets are valued at $0 in net worth | Teaches that some things we love aren't financial assets |
| Retirement account is locked (Advanced: early withdrawal = 10% penalty + tax) | Mirrors real accounts |
| Time pauses in menus/activities | Reading and thinking is never punished |
| Real-calendar daily/weekly challenges | "Daily" means today, like other games kids know |
| Coins & bills are drawn as original simple shapes, not images of real currency | Originality + clarity |
