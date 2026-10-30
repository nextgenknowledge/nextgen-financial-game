# Fin City: notes for Claude

Read [README.md](README.md) for setup, layout and how to add content, and [docs/DESIGN.md](docs/DESIGN.md) for formulas, architecture and the decision log. This file holds the working rules and the current state that those don't.

## Run and check

- `npm install`, then `npm run dev` (http://localhost:3100).
- Before every commit: `npx tsc --noEmit -p .`, `npx vitest run` (185+ tests) and `npx next build`.
- Stack: Next.js 16 static export, React Three Fiber, zustand + immer, vitest.

## Rules the team agreed on

- **Private by design.** No network requests or accounts. The one exception is Google Analytics page views (`app/Analytics.tsx`), which load only when `NEXT_PUBLIC_GA_ID` is set in the production build; never send nicknames, world names or answers to it. Fonts are bundled through @fontsource (no Google Fonts, no drei `Text` or `Environment` presets, which fetch from CDNs).
- **Nicknames only**, never real names.
- **Logos and art in `public/brand/` are used exactly as provided.** Never redraw or recolor them.
- **No emojis in the UI.** Emoji characters in data are drawn by the custom pixel icon font `app/fonts/fin-icons.woff`, built from `tools/icons/designs.py` by `tools/icons/build_icon_font.py` (needs Python fontTools). An emoji that isn't in `designs.py` shows as a real emoji, so reuse icons already in the data or add a design first.
- **No em dashes in game text.**
- **Use fictional companies and brands** in activities and building names (e.g. "Harbour Futures Exchange", not a real exchange's brand). Real market indexes (S&P 500, Hang Seng index) are fine as facts.
- **Art direction:** relatively realistic with a slight retro feel from crisp pixel textures, never childish. Cities should feel busy and alive. Keep the Low, Medium and High quality tiers fast (Chromebooks).
- **UI style:** pixel-art panels with hard borders and hard shadows, no gradients. The pixel font is for headings only; small text, buttons and labels use Nunito for legibility. The FinPhone is a phone docked bottom right.
- **Testing in the browser:** make a throwaway world named `ZZ Test - delete me`, delete it afterwards, and check the delete dialog names it before confirming. Never open or change anyone's real save. Keep music muted while testing.
- Commit only when asked; never push without asking.

## Architecture worth knowing

- **Entry vs Advanced buildings.** `BuildingDef.stations` are the Advanced stations and `entryStations` the Entry ones. `BuildingDef.pro` is the Advanced identity (name, icon, blurb, style, colors, size, interiorKind). `applyDifficulty()` in `src/world/cities.ts` swaps it in place when a world loads or difficulty changes (called from `startWorld` and `GameView`).
- **Advanced twins.** An activity with `replaces: "<entry id>"` stands in for an Entry activity. Quests, challenges and seasonal events accept either (`sameActivity` in `src/game/activities.ts`). Quest steps, challenges and seasons can carry `proText` / `proSay` for Advanced wording.
- **Pro desks.** Advanced activities live in `src/activities/kinds/` (registered in `registry.tsx`). They share `src/activities/kinds/pro/kit.tsx` (charts, tables, sliders) and `VisualQuiz.tsx` (chart + question flows). Their maths is in `src/game/finance/desks.ts` and `pro.ts`, unit-tested in `tests/desks.test.ts` and `tests/pro.test.ts`.
- **Resumable activities.** Closing an activity mid-play keeps it mounted and hidden (`useUI().run`). Timers pause through `useActivityPaused` / `usePausedRef` (`src/activities/paused.ts`), and any new timed activity must use them. The HUD shows a Resume button.
- **Legendary quests** have `epic: true` in `src/data/quests.json`, start silently via `startEpics`, and award prize-only outfits.
- **Learning.** The Advanced course lives in `src/data/learn/units/*.json` (units → lessons → cards, checks and `terms`; each term is a glossary concept taught by exactly that lesson). `src/data/learn/briefings.json` has a briefing for every activity (Advanced ideas, formula and concept ids, plus `entry` wording). `src/game/learn.ts` loads it all and matches concepts in text. Activities show the briefing on their intro, a Concept help drawer during play (using it caps that run at 2 stars via `ActivityResult.maxStars`) and tappable terms in Advanced question text. `tests/learn.test.ts` fails if a new activity has no briefing or uses a concept no lesson teaches, so add both with any new desk.
- **Dev handle:** `window.__fc` (game, ui, scene, rt, act) exists in dev builds for scripted testing.

## Where things stand (October 2026)

Done: textured semi-realistic cities with distinct streets and signage per city, weather and seasons, portals and city gates, A* guide routes, pixel maps, sound, FinBucks currency, Learn hub, pixel UI theme, Legendary quests, resumable activities, and the Advanced overhaul (12 buildings with professional identities, 24 pro desks).

Natural next steps: playtest the 24 pro desks with real high schoolers and tune difficulty and scoring; more Advanced question-bank depth; a pass on Entry-mode polish.
