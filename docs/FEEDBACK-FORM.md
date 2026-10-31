# In-game rating form (Google Form)

Two minutes into play (and any time from **Pause > Rate & review**) players get a "Having fun?"
card: they tap 1 to 5 stars, can write a short review, and press **Submit**. The answer goes
straight into the team's Google Form without leaving the game. Their nickname and
Entry/Advanced are sent too, if the form has questions for them.

## Connect the form (2 minutes)

The game needs the form's **pre-filled link**, which tells it which question is which.

1. Make sure the form has a rating question (a 1 to 5 linear scale, or a multiple choice like
   "1 star" ... "5 stars") and a review question (short or paragraph answer). Optional: a short
   answer question for the nickname, and one for the mode.
2. In the form editor, open the three-dots menu and choose **Get pre-filled link**.
3. Fill in sample answers:
   - rating question: **5** (or "5 stars")
   - review question: the word **review**
   - nickname question (if any): the word **nickname**
   - mode question (if any): the word **mode**
4. Press **Get link**, then **Copy link**.
5. Paste it into `src/data/feedbackForm.json` as `"prefilledLink"`, commit and redeploy.

Also check the form's **Settings > Responses**: it must **not** require sign-in ("Restrict to
users in ..." off), or answers from students outside your Google domain are dropped.

Until the link is set, Submit opens the form in a new tab instead.
