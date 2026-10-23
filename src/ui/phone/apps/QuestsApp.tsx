'use client';
import { useGame, act } from '@/store/game';
import { QUEST_BY_ID, QUESTS } from '@/game/progress/quests';
import { challengeDef, claimChallenge } from '@/game/progress/challenges';
import { seasonalProgress, claimSeasonal } from '@/game/progress/seasonal';
import { Section, Empty } from '../../kit';
import { Button, ProgressBar } from '../../common';

export function QuestsApp() {
  const w = useGame((s) => s.world!);
  const entry = w.difficulty === 'entry';
  const season = seasonalProgress(w);
  return (
    <div>
      <Section title="👑 Legendary quests">
        <p className="small muted" style={{ marginTop: 0 }}>Long journeys with prizes you can't buy anywhere. They track themselves while you play.</p>
        <div className="col" style={{ gap: 8 }}>
          {QUESTS.filter((q) => q.epic && (!q.difficulty || q.difficulty === w.difficulty)).map((q) => {
            const done = w.progress.quests.completed.includes(q.id);
            const a = w.progress.quests.active.find((x) => x.id === q.id);
            const stepIdx = done ? q.steps.length : a?.step ?? 0;
            return (
              <div key={q.id} className={`epic-card ${done ? 'done' : ''}`}>
                <div className="row" style={{ gap: 10 }}>
                  <span className="epic-icon">{q.icon}</span>
                  <div className="col grow" style={{ gap: 2 }}>
                    <b>{q.title}</b>
                    <span className="tiny muted">Prize: {q.prize}</span>
                  </div>
                  <span className={`chip ${done ? 'good' : 'gold'}`}>{done ? 'Complete' : `${stepIdx}/${q.steps.length}`}</span>
                </div>
                <div className="epic-steps">
                  {q.steps.map((s, i) => (
                    <div key={s.id} className={`epic-step ${i < stepIdx ? 'past' : i === stepIdx ? 'now' : ''}`}>
                      <span className="epic-dot">{i < stepIdx ? '✓' : i + 1}</span>
                      <span className="small">{s.text}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </Section>
      {season && (
        <Section title={`${season.def.icon} Event: ${season.def.name}`}>
          <p className="small">{season.def.text}</p>
          <div className="card tint-gold">
            <b>{season.def.challenge.text}</b>
            <ProgressBar value={season.progress} max={season.def.challenge.count} color="var(--gold)" />
            <div className="row between" style={{ marginTop: 6 }}>
              <span className="small">
                Reward: {season.def.reward.cash ? `$${season.def.reward.cash} · ` : ''}
                {season.def.reward.xp} XP{season.def.reward.title ? ` · title "${season.def.reward.title}"` : ''}
              </span>
              <Button size="small" variant="gold" disabled={season.claimed || season.progress < season.def.challenge.count} onClick={() => act((d, fx) => claimSeasonal(d, fx))}>
                {season.claimed ? 'Claimed ✓' : 'Claim'}
              </Button>
            </div>
          </div>
        </Section>
      )}
      <Section title="📅 Daily challenges">
        <ChallengeList list={w.progress.daily.list} />
        <div className="tiny muted">New ones every day.</div>
      </Section>
      <Section title="🗓️ Weekly challenges">
        <ChallengeList list={w.progress.weekly.list} />
      </Section>
      <Section title="📜 Active quests">
        {w.progress.quests.active.length === 0 && <Empty icon="🌟">All quests done! Daily challenges keep coming.</Empty>}
        {w.progress.quests.active.map((a) => {
          const q = QUEST_BY_ID.get(a.id);
          if (!q || q.epic) return null;
          return (
            <div key={a.id} className="card flat" style={{ marginBottom: 6 }}>
              <b>
                {q.icon} {q.title}
              </b>
              <ol className="small" style={{ margin: '4px 0 0', paddingLeft: '1.2rem' }}>
                {q.steps.map((s, i) => (
                  <li key={s.id} style={{ opacity: i < a.step ? 0.5 : 1, fontWeight: i === a.step ? 800 : 600 }}>
                    {i < a.step ? '✅ ' : i === a.step ? '👉 ' : ''}
                    {entry && s.entryText ? s.entryText : s.text}
                  </li>
                ))}
              </ol>
            </div>
          );
        })}
      </Section>
      <Section title="✅ Completed">
        <div className="row wrap" style={{ gap: 6 }}>
          {w.progress.quests.completed.map((id) => {
            const q = QUEST_BY_ID.get(id);
            return q ? (
              <span key={id} className="chip">
                {q.icon} {q.title}
              </span>
            ) : null;
          })}
          {!w.progress.quests.completed.length && <span className="muted small">None yet.</span>}
        </div>
      </Section>
    </div>
  );
}

function ChallengeList({ list }: { list: { id: string; progress: number; claimed: boolean }[] }) {
  if (!list.length) return <Empty icon="📅">Challenges appear after you start playing.</Empty>;
  return (
    <div className="col" style={{ gap: 6 }}>
      {list.map((c) => {
        const d = challengeDef(c.id);
        if (!d) return null;
        const done = c.progress >= d.count;
        return (
          <div key={c.id} className={`card ${done ? 'tint-green' : 'flat'}`}>
            <div className="row between">
              <b>
                {d.icon} {d.text}
              </b>
              <span className="small mono">
                {Math.floor(c.progress)}/{d.count}
              </span>
            </div>
            <ProgressBar value={c.progress} max={d.count} color={done ? 'var(--good)' : 'var(--teal)'} />
            <div className="row between" style={{ marginTop: 4 }}>
              <span className="tiny">
                Reward: {d.reward.cash ? `$${d.reward.cash} + ` : ''}
                {d.reward.xp} XP
              </span>
              <Button size="small" variant="gold" disabled={!done || c.claimed} onClick={() => act((w, fx) => claimChallenge(w, fx, c.id))}>
                {c.claimed ? 'Claimed ✓' : 'Claim'}
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
