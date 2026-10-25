# Question and activity audit (October 2026)

Content and answers only. No question or activity UI, layout or styling changed.

## What was checked

- Every bank in `src/data/questions/` (12 banks, 605 questions).
- Every multiple-choice question an activity builds in code (`src/activities/kinds/`, including the
  `VisualQuiz` desks that use `shuffled`), plus the Learn hub lesson checks (`lessons.json`) and the
  branching stories (`stories.json`).
- For each multiple-choice question: is the right answer strictly the longest choice; are choices
  real words or values; is the prompt repeated within its city and difficulty; does it sit in the
  right tier (Entry: simple and concrete, ages 6 to 13; Advanced: real calculations, ages 13 to 18).

"Longest" means strictly longer than every other choice; a tie gives nothing away. Choices are
shuffled at runtime, so only their wording matters.

## Question banks

| Bank | Questions | Choices rewritten | Prompts rewritten | Right answer longest, before | After |
|---|---|---|---|---|---|
| hong-kong.advanced | 52 | 18 | 0 | 18/25 (72%) | 6/25 (24%) |
| hong-kong.entry | 52 | 22 | 0 | 21/34 (61%) | 8/34 (23%) |
| london.advanced | 52 | 13 | 1 | 11/17 (64%) | 5/17 (29%) |
| london.entry | 52 | 19 | 2 | 17/28 (60%) | 8/28 (28%) |
| new-york.advanced | 52 | 25 | 1 | 22/28 (78%) | 7/28 (25%) |
| new-york.entry | 52 | 26 | 1 | 25/39 (64%) | 8/39 (20%) |
| park.advanced | 40 | 6 | 1 | 6/13 (46%) | 3/13 (23%) |
| park.entry | 42 | 18 | 1 | 19/24 (79%) | 1/24 (4%) |
| san-francisco.advanced | 52 | 22 | 0 | 22/28 (78%) | 10/28 (35%) |
| san-francisco.entry | 52 | 23 | 1 | 23/35 (65%) | 11/35 (31%) |
| singapore.advanced | 53 | 14 | 0 | 13/14 (92%) | 5/14 (35%) |
| singapore.entry | 54 | 18 | 2 | 19/34 (55%) | 10/34 (29%) |

Total: 224 choice sets rewritten, 10 prompts rewritten.

Prompt rewrites (near-duplicates and tier fixes):

- `pe-027` (park entry): repeated `pe-007` (change from one bill); now adds two prices, then makes change.
- `lde-19` (london entry): repeated `lde-22`; now counts the change in quarters.
- `lde-24` (london entry): repeated `lde-22` with a bigger bill; now two items, then change.
- `sfe-41` (san-francisco entry): repeated `sfe-02` (which is a job); now asks what money earned for work is called.
- `sge-49` (singapore entry): repeated `sge-18` (leave your money tree alone); now compares how long money stays in.
- `sge-51` (singapore entry): repeated `sge-16` (start saving earlier); now asks what retirement savings are for.
- `nye-27` (new-york entry): the prompt asked "which company" but the choices were news events; now "which news".
- `pa-037` (park advanced) and `lda-31` (london advanced): plain making-change drills, an Entry skill; now
  sales tax or a tip first, then change (level 1 to 2).
- `nya-52` (new-york advanced): asked two things but accepts one number; now asks only for the share count.

No single-letter choices and no exact repeated prompts were found. Pairs that look similar but test
different ideas (importing vs exporting, bull vs bear markets, yearly vs monthly compounding) were kept.

## Other questions

| Set | Rewritten | Right answer longest, before | After |
|---|---|---|---|
| Lesson checks (`lessons.json`) | 11 | 12/24 (50%) | 1/24 (4%) |
| Story decisions (`stories.json`, best choice) | 9 | 10/12 (83%) | 4/12 (33%) |
| Built in activity code (`src/activities/kinds`) | 12 questions in 10 files | 12/18 (67%) | 3/27 counting each answer branch (11%) |

Code files changed: BizStructure, BondDesk, Commodities, Dca, Deals, FranchiseDeal, ImpactDesk,
RetailAnalyst, ShortDesk, TravelDesk (choice text only).

## The guard test

`tests/questionAudit.test.ts` fails if, in any bank (each JSON bank, the lesson checks, the stories,
or all code-built questions together), the right answer is strictly the longest choice in more than
40% of multiple-choice questions, if any choice is a single letter, or if a bank repeats a prompt.
Code-built questions are found by reading the activity sources with the TypeScript parser
(`tests/helpers/codeChoices.ts`).
