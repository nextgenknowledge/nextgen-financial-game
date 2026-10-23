/**
 * Teacher / parent progress report. Produces a single self-contained HTML file
 * (inline CSS + SVG, no scripts, no network). Contains no personal data: only the
 * in-game nickname, and only when the player opts to include it.
 */
import type { WorldState } from '../types';
import { TOPIC_INFO } from '../topics';
import { ACTIVITY_BY_ID } from '../activities';
import { LESSONS } from './lessons';
import { ACHIEVEMENTS } from './achievements';
import { netWorth } from '../finance/netWorth';
import { monthLabel } from '../world';

export interface TopicRow {
  topic: string;
  name: string;
  icon: string;
  correct: number;
  total: number;
  accuracy: number; // 0..1
  band: 'Mastered' | 'Proficient' | 'Developing' | 'Getting started' | 'Not yet practiced';
}

export interface ReportData {
  nickname: string | null;
  difficulty: string;
  level: number;
  playMinutes: number;
  gameMonths: number;
  answered: number;
  correct: number;
  topics: TopicRow[];
  strengths: TopicRow[];
  practice: TopicRow[];
  activities: { name: string; city: string; plays: number; best: number; stars: number }[];
  lessons: string[];
  achievements: { earned: number; total: number };
  finance: { netWorth: number; savings: number; debt: number; creditScore: number | null; history: number[] };
}

export function topicBand(correct: number, total: number): TopicRow['band'] {
  if (total === 0) return 'Not yet practiced';
  const a = correct / total;
  if (total >= 15 && a >= 0.85) return 'Mastered';
  if (total >= 8 && a >= 0.7) return 'Proficient';
  if (a >= 0.5 || total < 5) return 'Developing';
  return 'Getting started';
}

const ENTRY_ONLY = new Set(['counting', 'needs-wants']);

export function reportData(w: WorldState, opts: { includeNickname?: boolean } = {}): ReportData {
  const p = w.progress;
  const topics: TopicRow[] = Object.entries(TOPIC_INFO).map(([id, info]) => {
    const t = p.topics[id] ?? { correct: 0, total: 0 };
    return { topic: id, name: info.name, icon: info.icon, correct: t.correct, total: t.total, accuracy: t.total ? t.correct / t.total : 0, band: topicBand(t.correct, t.total) };
  });
  const practiced = topics.filter((t) => t.total > 0);
  const strengths = practiced.filter((t) => t.total >= 5 && t.accuracy >= 0.75).sort((a, b) => b.accuracy - a.accuracy || b.total - a.total).slice(0, 3);
  const practice = [
    ...practiced.filter((t) => t.total >= 3 && t.accuracy < 0.65).sort((a, b) => a.accuracy - b.accuracy),
    // Unpracticed topics, skipping the youngest-kid basics for Advanced players
    ...topics.filter((t) => t.total === 0 && (w.difficulty === 'entry' || !ENTRY_ONLY.has(t.topic))),
  ].slice(0, 3);
  const nw = netWorth(w);
  return {
    nickname: opts.includeNickname ? w.nickname : null,
    difficulty: w.difficulty === 'entry' ? 'Entry (ages 6–13)' : 'Advanced (ages 13–18)',
    level: p.level,
    playMinutes: Math.round(w.playSeconds / 60),
    gameMonths: w.time.month,
    answered: practiced.reduce((s, t) => s + t.total, 0),
    correct: practiced.reduce((s, t) => s + t.correct, 0),
    topics,
    strengths,
    practice,
    activities: Object.entries(p.activities)
      .map(([id, s]) => {
        const def = ACTIVITY_BY_ID.get(id);
        return { name: def?.name ?? id, city: def?.city ?? '', plays: s.plays, best: Math.round(s.best), stars: s.stars };
      })
      .sort((a, b) => b.plays - a.plays),
    lessons: LESSONS.filter((l) => p.lessons.includes(l.id)).map((l) => l.title),
    achievements: { earned: Object.keys(p.achievements).length, total: ACHIEVEMENTS.length },
    finance: {
      netWorth: nw.total,
      savings: nw.savings + nw.cds + nw.retirement,
      debt: nw.liabilities,
      creditScore: w.finance.credit.score,
      history: p.netWorth.map((n) => n.total),
    },
  };
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const usd = (v: number) => `${v < 0 ? '−' : ''}$${Math.abs(Math.round(v)).toLocaleString('en-US')}`;
const pctS = (v: number) => `${Math.round(v * 100)}%`;

const CITY_NAMES: Record<string, string> = {
  park: 'Park',
  'san-francisco': 'San Francisco',
  'new-york': 'New York',
  london: 'London',
  'hong-kong': 'Hong Kong',
  singapore: 'Singapore',
};

/** Conversation starters adults can use for topics that need practice. */
const DISCUSS: Record<string, string> = {
  counting: 'Pay for something small together with coins and count the change.',
  'needs-wants': 'Sort this week’s shopping list into needs and wants.',
  saving: 'Pick a savings goal and work out how many weeks it will take.',
  earning: 'Talk about jobs family members have done and what they were paid for.',
  budgeting: 'Plan a pretend $50 day out together and stay on budget.',
  shopping: 'Compare unit prices on two sizes of the same product at a store.',
  banking: 'Look at what a savings account pays and what that means per year.',
  interest: 'Use the Rule of 72 to guess how long money takes to double at 6%.',
  investing: 'Discuss why spreading money across many companies lowers risk.',
  business: 'Estimate the profit of a lemonade stand: price, costs, cups sold.',
  safety: 'Review a suspicious text or email together and spot the red flags.',
  credit: 'Talk about why paying on time matters for a credit score.',
  debt: 'Compare the total cost of two loans, not just the monthly payment.',
  taxes: 'Look at a pay stub (or a sample) and find each deduction.',
  retirement: 'Compare starting to save at 20 vs 35 using the in-game Retirement Tower.',
  insurance: 'Discuss what a deductible is and why people insure big risks.',
  economics: 'Notice a price that has gone up and talk about inflation.',
  giving: 'Choose a cause together and check that the charity is trustworthy.',
  housing: 'Talk about the costs of renting vs owning beyond the monthly payment.',
};

function sparkline(values: number[]): string {
  if (values.length < 2) return '<p class="muted">Not enough months played yet for a trend.</p>';
  const W = 520;
  const H = 110;
  const min = Math.min(0, ...values);
  const max = Math.max(...values, min + 1);
  const x = (i: number) => 8 + (i / (values.length - 1)) * (W - 16);
  const y = (v: number) => H - 10 - ((v - min) / (max - min)) * (H - 20);
  const d = values.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  return `<svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="Net worth over time"><line x1="8" x2="${W - 8}" y1="${y(0)}" y2="${y(0)}" stroke="#ccd" stroke-dasharray="4 4"/><path d="${d}" fill="none" stroke="#2f6bdb" stroke-width="3" stroke-linejoin="round"/></svg>`;
}

export function buildTeacherReport(w: WorldState, opts: { includeNickname?: boolean } = {}): { html: string; data: ReportData } {
  const r = reportData(w, opts);
  const date = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  const bandColor: Record<TopicRow['band'], string> = {
    Mastered: '#1f9d55',
    Proficient: '#3cc45a',
    Developing: '#e0a100',
    'Getting started': '#e1553f',
    'Not yet practiced': '#9aa3b5',
  };
  const topicRows = r.topics
    .slice()
    .sort((a, b) => b.total - a.total)
    .map(
      (t) => `<tr><td>${t.icon} ${esc(t.name)}</td><td class="num">${t.total}</td><td class="num">${t.total ? pctS(t.accuracy) : '-'}</td>
<td><div class="bar"><span style="width:${Math.round(t.accuracy * 100)}%;background:${bandColor[t.band]}"></span></div></td>
<td><span class="pill" style="background:${bandColor[t.band]}">${t.band}</span></td></tr>`,
    )
    .join('\n');
  const actRows = r.activities.length
    ? r.activities
        .map((a) => `<tr><td>${esc(a.name)}</td><td>${esc(CITY_NAMES[a.city] ?? a.city)}</td><td class="num">${a.plays}</td><td class="num">${a.best}</td><td>${'★'.repeat(a.stars)}${'☆'.repeat(3 - a.stars)}</td></tr>`)
        .join('\n')
    : '<tr><td colspan="5" class="muted">No activities completed yet.</td></tr>';
  const list = (items: TopicRow[], empty: string, extra?: (t: TopicRow) => string) =>
    items.length ? `<ul>${items.map((t) => `<li><b>${t.icon} ${esc(t.name)}</b>${t.total ? `, ${pctS(t.accuracy)} of ${t.total}` : ', not practiced yet'}${extra ? `<br><span class="muted">${extra(t)}</span>` : ''}</li>`).join('')}</ul>` : `<p class="muted">${empty}</p>`;

  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Fin City progress report</title>
<style>
:root{--ink:#1e2840;--muted:#6b7488;--line:#e3e7ef;--blue:#2f6bdb}
*{box-sizing:border-box}body{margin:0;background:#f5f7fb;color:var(--ink);font:15px/1.5 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
main{max-width:860px;margin:0 auto;padding:28px 18px 48px}
h1{margin:0 0 4px;font-size:26px}h2{font-size:18px;margin:28px 0 10px;border-bottom:2px solid var(--line);padding-bottom:4px}
.muted{color:var(--muted)}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px}
.card{background:#fff;border:1px solid var(--line);border-radius:12px;padding:12px 14px}
.card b{display:block;font-size:22px}.card span{font-size:12px;color:var(--muted);text-transform:uppercase;letter-spacing:.04em}
table{width:100%;border-collapse:collapse;background:#fff;border:1px solid var(--line);border-radius:12px;overflow:hidden}
th,td{padding:7px 10px;border-bottom:1px solid var(--line);text-align:left;vertical-align:middle}th{background:#eef2f9;font-size:13px}
.num{text-align:right;font-variant-numeric:tabular-nums}
.bar{height:10px;background:#eef1f6;border-radius:6px;overflow:hidden;min-width:80px}.bar span{display:block;height:100%}
.pill{color:#fff;font-size:12px;font-weight:700;padding:2px 8px;border-radius:999px;white-space:nowrap}
.two{display:grid;grid-template-columns:1fr 1fr;gap:14px}@media(max-width:640px){.two{grid-template-columns:1fr}}
ul{margin:0;padding-left:20px}li{margin:4px 0}
footer{margin-top:32px;font-size:12px;color:var(--muted)}
@media print{body{background:#fff}.card,table{break-inside:avoid}}
</style></head><body><main>
<h1>Fin City progress report</h1>
<div class="muted">${r.nickname ? `Player: <b>${esc(r.nickname)}</b> · ` : ''}${esc(r.difficulty)} · Generated ${esc(date)}</div>

<h2>At a glance</h2>
<div class="grid">
<div class="card"><span>Time played</span><b>${r.playMinutes} min</b></div>
<div class="card"><span>Questions answered</span><b>${r.answered}</b></div>
<div class="card"><span>Overall accuracy</span><b>${r.answered ? pctS(r.correct / r.answered) : '-'}</b></div>
<div class="card"><span>Player level</span><b>${r.level}</b></div>
<div class="card"><span>Activities played</span><b>${r.activities.length}</b></div>
<div class="card"><span>Lessons finished</span><b>${r.lessons.length}</b></div>
<div class="card"><span>Badges earned</span><b>${r.achievements.earned} / ${r.achievements.total}</b></div>
<div class="card"><span>In-game time</span><b>${r.gameMonths} mo</b></div>
</div>

<div class="two">
<div><h2>Strengths</h2>${list(r.strengths, 'Keep playing, strengths appear after about 5 answers in a topic.')}</div>
<div><h2>Next to practice</h2>${list(r.practice, 'Nothing flagged, great work!', (t) => esc(DISCUSS[t.topic] ?? ''))}</div>
</div>

<h2>Topics</h2>
<table><thead><tr><th>Topic</th><th class="num">Answered</th><th class="num">Accuracy</th><th></th><th>Level</th></tr></thead><tbody>
${topicRows}
</tbody></table>
<p class="muted">Mastered = 85%+ over 15+ answers · Proficient = 70%+ over 8+ answers.</p>

<h2>Activities</h2>
<table><thead><tr><th>Activity</th><th>City</th><th class="num">Plays</th><th class="num">Best score</th><th>Stars</th></tr></thead><tbody>
${actRows}
</tbody></table>

<h2>Lessons completed</h2>
${r.lessons.length ? `<ul>${r.lessons.map((l) => `<li>${esc(l)}</li>`).join('')}</ul>` : '<p class="muted">None yet. Lessons are in the Library and the phone’s Learn tab.</p>'}

<h2>In-game money habits</h2>
<p class="muted">Pretend money only. This shows how the player manages their simulated finances.</p>
<div class="grid">
<div class="card"><span>Net worth</span><b>${usd(r.finance.netWorth)}</b></div>
<div class="card"><span>Savings &amp; retirement</span><b>${usd(r.finance.savings)}</b></div>
<div class="card"><span>Debts</span><b>${usd(r.finance.debt)}</b></div>
<div class="card"><span>Credit score</span><b>${r.finance.creditScore ?? '-'}</b></div>
</div>
<div class="card" style="margin-top:10px"><span>Net worth by month${r.finance.history.length ? ` (through ${esc(monthLabel(r.gameMonths))})` : ''}</span>${sparkline(r.finance.history)}</div>

<footer>Fin City by NextGen Knowledge. Made on this device; no data was sent anywhere. The report has no personal information${r.nickname ? ' apart from the in-game nickname the player chose to include' : ''}.</footer>
</main></body></html>`;
  return { html, data: r };
}
