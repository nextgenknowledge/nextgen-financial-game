'use client';
import { useEffect, useState } from 'react';
import { useGame, act } from '@/store/game';
import { ACHIEVEMENTS, achievementProgress, badgeTier, BADGE_TIERS } from '@/game/progress/achievements';
import { Section, Tabs } from '../../kit';
import { Button, ProgressBar } from '../../common';
import { TOPIC_INFO } from '@/game/topics';
import { getHallOfFame, type FameEntry } from '@/save/fame';
import { money } from '../../format';
import { itemDef, petDef } from '@/game/sim/catalog';
import { vehicleDef } from '@/game/sim/vehicleCatalog';

export function BadgesApp() {
  const w = useGame((s) => s.world!);
  const [tab, setTab] = useState<'skills' | 'achievements' | 'titles' | 'collection' | 'fame'>('skills');
  return (
    <div>
      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { id: 'skills', label: '🎓 Skill badges' },
          { id: 'achievements', label: `🏆 Achievements (${Object.keys(w.progress.achievements).length}/${ACHIEVEMENTS.length})` },
          { id: 'titles', label: '🏅 Titles' },
          { id: 'collection', label: '📒 Collection' },
          { id: 'fame', label: '⭐ Hall of Fame' },
        ]}
      />
      {tab === 'skills' && (
        <Section title="Skill badges by topic">
          <p className="small muted">Earn badges by answering questions correctly in each topic: Bronze at 10, Silver at 40, Gold at 100.</p>
          <div className="badge-grid">
            {Object.entries(TOPIC_INFO).map(([id, t]) => {
              const tier = badgeTier(w, id);
              const st = w.progress.topics[id];
              const next = BADGE_TIERS[tier];
              return (
                <div key={id} className={`badge-card tier-${tier}`}>
                  <div className="badge-medal" style={{ background: tier ? BADGE_TIERS[tier - 1].color : '#e8e1d0' }}>
                    {t.icon}
                  </div>
                  <b className="small">{t.name}</b>
                  <span className="tiny muted">{tier ? BADGE_TIERS[tier - 1].name : 'Not yet'}</span>
                  <span className="tiny">
                    {st ? `${st.correct}/${st.total} correct` : 'No answers yet'}
                  </span>
                  {next && <ProgressBar value={st?.correct ?? 0} max={next.at} height={8} color={next.color} />}
                </div>
              );
            })}
          </div>
        </Section>
      )}
      {tab === 'achievements' && (
        <div className="badge-grid">
          {ACHIEVEMENTS.filter((a) => (!a.advanced || w.difficulty === 'advanced') && !(a.entryOnly && w.difficulty === 'advanced')).map((a) => {
            const got = !!w.progress.achievements[a.id];
            const p = achievementProgress(w, a);
            return (
              <div key={a.id} className={`badge-card ${got ? 'tier-3' : ''}`} style={{ opacity: got ? 1 : 0.75 }}>
                <div className="badge-medal" style={{ background: got ? '#ffcf3f' : '#e8e1d0', filter: got ? 'none' : 'grayscale(1)' }}>
                  {a.icon}
                </div>
                <b className="small">{a.name}</b>
                <span className="tiny muted">{a.desc}</span>
                {!got && <ProgressBar value={p.value} max={p.target} height={8} />}
                {got && <span className="tiny good bold">Unlocked! +{a.xp} XP</span>}
              </div>
            );
          })}
        </div>
      )}
      {tab === 'titles' && (
        <Section title="Choose your title">
          <div className="row wrap" style={{ gap: 6 }}>
            {w.progress.titles.map((t) => (
              <Button key={t} size="small" variant={w.progress.activeTitle === t ? 'gold' : undefined} onClick={() => act((d) => void (d.progress.activeTitle = t))}>
                🏅 {t}
              </Button>
            ))}
          </div>
          <p className="tiny muted">Earn titles from quests, events and community projects.</p>
        </Section>
      )}
      {tab === 'collection' && <CollectionLog />}
      {tab === 'fame' && <HallOfFame />}
    </div>
  );
}

function CollectionLog() {
  const w = useGame((s) => s.world!);
  const entries = Object.keys(w.progress.collection);
  const label = (k: string) => {
    if (k.startsWith('pet:')) {
      const p = petDef(k.slice(4));
      return p ? `${p.icon} ${p.name}` : k;
    }
    if (k.startsWith('vehicle:')) {
      const v = vehicleDef(k.slice(8));
      return v ? `${v.icon} ${v.name}` : k;
    }
    if (k.startsWith('prize:')) {
      const i = itemDef(k.slice(6));
      return i ? `${i.icon} ${i.name}` : k;
    }
    if (k.startsWith('lesson:')) return `📖 ${k.slice(7)}`;
    const i = itemDef(k);
    return i ? `${i.icon} ${i.name}` : k;
  };
  return (
    <Section title={`Collection log (${entries.length})`}>
      <p className="small muted">Everything you&apos;ve ever owned, adopted, won or discovered.</p>
      <div className="row wrap" style={{ gap: 6 }}>
        {entries.map((k) => (
          <span key={k} className="chip">
            {label(k)}
          </span>
        ))}
        {!entries.length && <span className="muted small">Nothing collected yet.</span>}
      </div>
    </Section>
  );
}

export function HallOfFame() {
  const [list, setList] = useState<FameEntry[] | null>(null);
  useEffect(() => {
    getHallOfFame().then(setList);
  }, []);
  return (
    <Section title="⭐ Hall of Fame: best net worth on this device">
      {!list ? (
        <span className="muted">Loading…</span>
      ) : list.length === 0 ? (
        <span className="muted">Save a world to get on the board!</span>
      ) : (
        <ol className="fame-list">
          {list.slice(0, 15).map((e, i) => (
            <li key={e.worldId}>
              <span className="pixel">{i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`}</span>
              <b>{e.nickname}</b> <span className="muted small">({e.worldName}, {e.difficulty})</span>
              <b className="mono" style={{ marginLeft: 'auto' }}>
                {money(e.netWorth, { cents: false })}
              </b>
            </li>
          ))}
        </ol>
      )}
    </Section>
  );
}
