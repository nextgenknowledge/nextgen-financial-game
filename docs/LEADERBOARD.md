# Leaderboard setup (Google Sheet)

The FinPhone has a **Leaderboard** app that ranks players by net worth, split into Entry and
Advanced. The scores live in a Google Sheet that the team owns. Until the sheet's link is added,
the app just says "coming soon" and the game makes no requests.

## What gets shared

Only when a player taps **Post my score**: their nickname, level, net worth, Entry/Advanced, and
the random id of their world (so posting again updates their row instead of adding a new one).
Never real names, world names or quiz answers. Rude nicknames are refused by the game and by the
sheet.

## Set it up (about 5 minutes)

1. Make a new Google Sheet, for example **Fin City Leaderboard**. Use an account that is allowed to
   share web apps with **Anyone** (some school accounts block this; a NextGen Knowledge account
   usually works).
2. In the sheet, open **Extensions > Apps Script**.
3. Delete the sample code, paste in everything from
   [`docs/leaderboard/leaderboard.gs`](leaderboard/leaderboard.gs), and press **Save**.
4. Click **Deploy > New deployment**. Click the gear next to "Select type" and choose **Web app**.
   - Description: `Fin City leaderboard`
   - Execute as: **Me**
   - Who has access: **Anyone**
5. Click **Deploy**, then **Authorize access** and allow it (Google warns that the app isn't
   verified because you wrote it; choose Advanced, then Go to the project).
6. Copy the **Web app URL**. It looks like
   `https://script.google.com/macros/s/AKfy.../exec`.
7. Put that link in the game, either:
   - paste it into `src/data/leaderboard.json` as the `"url"` and commit, or
   - set `NEXT_PUBLIC_LEADERBOARD_URL` in the hosting build settings (e.g. Cloudflare Pages >
     Settings > Environment variables) and redeploy.

The sheet makes its own **Scores** tab the first time someone posts.

## Looking after it

- **Remove a player:** type `x` in their **Hidden** column. They disappear from the board and
  can't post to that row again. (Deleting the row also works, but they could post again.)
- **Change the script later:** edit it, then **Deploy > Manage deployments**, edit the existing
  deployment and pick **New version**. The link stays the same.
- **Start a fresh season:** make a copy of the sheet, or clear the rows under the header.
- Anyone who has the link could post made-up scores, so treat the board as a fun class activity,
  not a contest with prizes, or keep an eye on new rows.
