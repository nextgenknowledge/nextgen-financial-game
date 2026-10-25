# Fin City

A 3D browser game by **NextGen Knowledge** that teaches financial literacy to ages 6–18.
Players explore a hub park and five cities (San Francisco, New York, London, Hong Kong and
Singapore), enter buildings, play more than 40 kinds of activity, and run a simulated financial
life of their own. NextGen Narwhal guides them through it.

- **Two modes.** *Entry* (ages 6–13) has big buttons, read-aloud, generous hints and gentle
  adaptive levels. *Advanced* (ages 13–18) uses real computations, a calculator, taxes, credit
  scores and markets.
- **Private by design.** There are no accounts, ads or game network requests. The live site at fincity.dev counts page views with Google Analytics (ad features off), only when `NEXT_PUBLIC_GA_ID` is set at build time. Saves stay in
  the browser (IndexedDB) and can be exported as files. Fonts are bundled.
- **Light enough for Chromebooks.** Low, Medium and High quality tiers, instanced crowds and
  merged voxel geometry.

The design doc is [docs/DESIGN.md](docs/DESIGN.md). It covers formulas, architecture, milestones
and the decision log.

---

## Quick start

Requires Node 20+.

```bash
npm install
```

```bash
npm run dev            # http://localhost:3100
```

| Script | What it does |
| --- | --- |
| `npm run dev` | Dev server on port 3100 |
| `npm run build` | Static export to `out/` (no server needed) |
| `npm start` | Serve `out/` locally |
| `npm test` | Unit tests: finance math, saves, expressions, simulation, questions, content |
| `npm run lint` | Type-check (`tsc --noEmit`) |
| `npm run validate-content` | Only the data/content validation tests |

### Deploying under a sub-path

The build is a static site. To host it at e.g. `https://example.org/fin-city/`, build with:

```bash
FINCITY_BASE_PATH=/fin-city npm run build
```

Then upload the `out/` folder.

---

## Project layout

```
app/                 Next.js App Router shell (layout, page, global CSS)
public/brand/        Logos and character art. Use exactly as provided; never recolor.
src/
  game/              Pure, tested game logic (no React)
    finance/         interest, loans, credit, tax, accounts, purchases, jobs, housing…
    market/          securities, ticks, trading, candlestick generator
    sim/             time, month processing, catalogs, night-market sim
    questions/       expression parser, template engine, bank loader
    progress/        xp, events, quests, challenges, achievements, lessons, report
  data/              ALL content as JSON (see "Adding content")
  store/             Zustand stores: game (immer), ui, settings, scene
  save/              IndexedDB worlds, import/export format, Hall of Fame
  engine/            audio, input, collision, voxel builder, player, vehicles, sky
  world/             3D scenes built from city JSON (outdoor, interiors, NPCs, portals…)
  ui/                HUD, phone apps, panels, services, shops, title/worlds screens
  activities/        ActivityHost + one component per activity "kind"
tests/               Vitest suites
docs/DESIGN.md       Design doc
```

### How the pieces fit

- Game rules are pure functions `(world, fx, …args)`. They mutate an immer draft through
  `act()` in `src/store/game.ts` and push side-effects (toasts, Narwhal lines, confetti, sfx)
  into `fx`. `src/ui/effects.ts` then plays them. This keeps all rules unit-testable without
  React.
- `recordEvent()` is a single event bus. It updates stats, quests, daily and weekly challenges,
  seasonal events and achievements.
- **Time:** one day/night cycle is one game month (8 real minutes by default). At month end,
  `processMonth()` runs interest, bills, loans, card statements, businesses, rent, depreciation,
  life events, the credit score, taxes and the net-worth snapshot.

---

## Adding content

Everything a designer would want to change lives in `src/data/`. After editing, run
`npm run validate-content`. It checks that every reference resolves and that each city has at
least 50 questions per difficulty.

### Questions: `src/data/questions/<city>.<entry|advanced>.json`

```jsonc
{
  "questions": [
    {
      "id": "sga-01",                 // unique across all banks
      "city": "singapore",
      "topic": "interest",            // one of the topics in src/game/topics.ts
      "difficulty": "advanced",       // "entry" | "advanced"
      "level": 2,                     // 1–5; Entry uses this for adaptive difficulty
      "type": "numeric",              // "mc" | "tf" | "numeric" | "multi" | "order"
      "prompt": "${P} at {rP:pct} compounded yearly for {t} years. Final balance?",
      "vars": {                       // randomized each time
        "P": { "min": 1000, "max": 10000, "step": 500 },
        "r": { "choices": [0.03, 0.05, 0.07] },
        "t": { "min": 5, "max": 20 }
      },
      "derived": { "rP": "r*100" },   // computed from vars
      "answerExpr": "fv(P, r, t)",    // numeric answer
      "format": "money",              // money | money0 | pct | int | years | months
      "toleranceAbs": 0.02,           // optional; toleranceRel also supported
      "explanation": "${P} × (1 + {rP:pct})^{t} = ${ANSWER}.",
      "hint": "A = P(1 + r)^t"        // optional
    },
    {
      "id": "sge-01", "city": "singapore", "topic": "saving", "difficulty": "entry", "level": 1,
      "type": "mc",
      "prompt": "Money you keep for later is called…",
      "choices": ["Savings", "A bill", "A fine"],
      "answer": 0,                    // index of the correct choice (choices are shuffled)
      "explanation": "Savings is money you put aside for later.",
      "icon": "🐷"                    // optional
    }
  ]
}
```

**Template syntax.**
- `${x}` formats `x` as money.
- `{x}` inserts the raw value.
- `{x:pct|int|money|years|months}` uses an explicit format. `pct` does **not** multiply by
  100, so add a derived `xP: "x*100"` for fractional rates.
- `{ANSWER}` / `${ANSWER}` insert the computed answer.

**Expressions** (`answerExpr`, `derived`, `choiceExprs`) support `+ - * / ^`, parentheses and:
`round floor ceil abs min max sqrt log ln exp pow`, plus finance helpers:

| Function | Meaning |
| --- | --- |
| `fv(P, i, n)` | P·(1+i)^n |
| `fvs(pmt, i, n)` | future value of n end-of-period payments |
| `pmt(P, apr, months)` | loan payment (pass the **annual** rate) |
| `totint(P, apr, months, extra?)` | total interest on an amortizing loan |
| `tax(income)` / `marginal(income)` | game tax brackets |
| `coins(amount)` | fewest coins to make an amount |

The evaluator is a small safe parser. It never uses `eval`, and identifiers resolve only to
your own vars.

Optional `media` attaches a table, chart or document (receipt, pay stub, statement) to a
question. See `QuestionMedia` in `src/game/content.ts`.

### Activities: `src/data/activities/<city>.json`

```jsonc
{
  "id": "savings-garden",
  "name": "Plant a Money Tree",
  "kind": "garden",                 // must be registered in src/activities/registry.tsx
  "icon": "🌱",
  "building": "savings-garden",     // building id in the same city
  "city": "singapore",
  "topics": ["saving", "interest"],
  "blurb": "Advanced description…",
  "entryBlurb": "Kid-friendly description…",
  "entry":    { "rounds": 3, "advanced": false },   // kind params, or null if not offered
  "advanced": { "rounds": 3, "advanced": true },
  "stars": [40, 70, 90],            // score needed for 1/2/3 stars (0–100)
  "rewards": { "cash": [20, 35, 55], "xp": [30, 50, 75] },
  "fee": 5, "tickets": [5, 10, 20]  // optional, arcade games only
}
```

Common kinds and their params:

| Kind | Params |
| --- | --- |
| `quiz` | `count`, `cities` |
| `tower` | quiz-tower variant of `quiz` |
| `sort` | `set` (from `sorts.json`) |
| `allocate` | `scenario` (from `allocate.json`) |
| `story` | `story` (from `stories.json`) |
| `memory` | `set` (`coins` or `terms`) |
| `teller` | `mode` (`count` or `reconcile`) |
| `job` | `board` |

The bespoke kinds take only simple numbers such as `rounds` or `months`. To add a new kind,
create `src/activities/kinds/MyKind.tsx`, export a default component taking
`KindProps<Params>`, call `onFinish({ score })`, and register it in `registry.tsx`.
`QuestionRounds` and `synthQ` in `QuestionSeq.tsx` make computed-question activities quick to
write.

### Cities: `src/data/cities/<city>.json`

```jsonc
{
  "id": "singapore", "name": "Singapore", "tagline": "…", "theme": "…", "music": "…", "icon": "🌳",
  "half": 100,                               // half-size of the playable square
  "ground": "#…", "palette": { … },
  "roads": [ … ], "water": [ … ], "plazas": [ … ],
  "buildings": [{
    "id": "savings-garden", "name": "Savings Garden", "icon": "🌳",
    "pos": [-44, -44], "size": [26, 20, 11],  // x,z  /  width, depth, height
    "door": "south", "style": "greenhouse",
    "colors": { "wall": "#…", "roof": "#…", "trim": "#…", "accent": "#…" },
    "blurb": "…",
    "stations": [
      { "activity": "savings-garden", "label": "Plant a Money Tree", "icon": "🌱", "npc": "gardener" },
      { "service": "cds", "label": "Open a CD", "icon": "🔒", "npc": "banker" }
    ],
    "interior": { "floor": "#…", "wall": "#…" }
  }],
  "landmarks": [ … ], "portals": [{ "to": "park", "pos": [0, 92], "rot": 180 }],
  "spawn": [0, 80, 180],
  "host": { "name": "Uncle Lim", "look": "gardener", "pos": [8, 74], "lines": [ … ], "entryLines": [ … ] },
  "filler": { "seed": 51, "density": 0.82, "minH": 12, "maxH": 50, "style": "sg" },
  "trees": …, "npcs": …, "traffic": …, "boats": …, "weather": { "rain": 0.4 }
}
```

**Station services:** `bank`, `atm`, `cds`, `loans`, `credit`, `style`, `townhall`,
`hall-of-fame`, `arcade-prizes`, `garage`, `brokerage`, `business`, `insurance`, `giving`,
`retirement`, `library`, `map`, `learn`, and `shop:<outfits|furniture|collectibles|pets|vehicles|property>`.

### Other data files

| File | Contents |
| --- | --- |
| `quests.json` | Onboarding + side quests. Steps have `goal: { type: move|jump|menu|enter|travel|talk|activity|event, target?, value?, count? }` plus Narwhal lines (`say`, `entrySay`) |
| `lessons.json` | Short slide lessons with a check question and optional perk |
| `achievements.json` | `condition: { stat, gte } \| { netWorth } \| { level } \| { topicCorrect }` |
| `challenges.json`, `seasonal.json` | Daily/weekly challenges and dated seasonal events |
| `events.json` | Monthly life events (cost ranges, weights, insurance category) |
| `insurance.json`, `subscriptions.json` | Policies and subscriptions players can buy |
| `jobs.json`, `startups.json`, `companies.json`, `news.json` | Jobs, startup pitches, market securities, headlines |
| `sorts.json`, `allocate.json`, `stories.json`, `scams.json` | Data for the matching activity kinds |
| `shop/*.json` | Outfits, furniture, collectibles, pets, vehicles, property, businesses |
| `tips.json`, `npcs.json`, `community.json` | Loading tips, NPC lines, Town Hall community projects |

---

## Saves

- Worlds are stored in IndexedDB (`src/save/db.ts`). From the Worlds screen you can create,
  load, rename, duplicate, delete, import and export them.
- The game autosaves every 30 seconds, when the tab is hidden, and when you quit.
- An exported `.fincity.json` holds the versioned `WorldState`. `migrateWorld()` upgrades older
  saves.

## Teacher / parent report

Pause → **🍎 Teacher/parent report** downloads a self-contained HTML file. It shows:
- time played, accuracy by topic with mastery bands, strengths, and topics to practice (with
  conversation starters);
- activities and lessons completed;
- an in-game money snapshot.

It contains no personal information. The nickname is included only if the box is ticked.

## Accessibility

Settings include read-aloud (Web Speech, on-device), text size, colorblind-safe palettes,
reduced motion, remappable keys, mouse sensitivity, separate volume sliders and three quality
tiers.

## Testing

```bash
npm test
```

The test files are:

| File | Covers |
| --- | --- |
| `finance.test.ts` | Interest, loans, tax, credit, accounts |
| `sim.test.ts` | Market bounds, month processing, saver-vs-spender balance |
| `expr.test.ts` | Expression parser safety and functions |
| `saves.test.ts` | IndexedDB round-trips and migration |
| `questions.test.ts` | Every template instantiates and grades, many times over |
| `content.test.ts` | Every data reference resolves, question counts, the report, candles, rent-vs-buy |

See [CREDITS.md](CREDITS.md) for credits and licences.

## Icons

The game never shows system emoji. Every emoji character in the UI is drawn by `app/fonts/fin-icons.woff`,
a colour font of the game's own 16×16 pixel icons, listed first in every font stack with a
`unicode-range` that covers only those characters. Map pins use the same designs from
`src/ui/icons/pixelIcons.ts`.

- Designs: `tools/icons/designs.py` (each icon is drawn from simple shapes; the outline is added automatically)
- Emoji → icon mapping and font build: `tools/icons/build_icon_font.py` (needs `pip install fonttools`).
  It prints the `unicode-range` for the `@font-face` rule in `app/globals.css`.
- Canvas icon data for maps: `python3 tools/icons/export_ts.py`
