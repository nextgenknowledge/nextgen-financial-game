'use client';
/**
 * Learning pieces used around activities: the desk briefing on the intro screen, the Concept help
 * drawer during play, tappable glossary terms in question text, and concept cards.
 */
import { useMemo, useState, type RefObject } from 'react';
import { useUI } from '@/store/ui';
import { useGame } from '@/store/game';
import { Button, ReadAloud } from '@/ui/common';
import { cls } from '@/ui/format';
import { playSfx } from '@/engine/audio';
import type { ActivityDef } from '@/game/content';
import { LESSONS } from '@/game/progress/lessons';
import { BRIEFINGS, CONCEPTS, CONCEPT_BY_ID, LESSON_FOR_CONCEPT, conceptsIn, lessonsFor, splitTerms, type Concept } from '@/game/learn';

/** Opens a lesson on top of whatever is showing; closing it returns there (an activity resumes). */
export function openLesson(id: string) {
  playSfx('pop');
  useUI.getState().push({ type: 'learn', lesson: id });
}

/** `onLesson` overrides how the lesson link opens (null hides it, e.g. inside that same lesson). */
export function ConceptCard({ concept, compact = false, onLesson }: { concept: Concept; compact?: boolean; onLesson?: ((id: string) => void) | null }) {
  const lesson = LESSON_FOR_CONCEPT.get(concept.id);
  const done = useGame((s) => (lesson ? s.world?.progress.lessons.includes(lesson.id) : false));
  return (
    <div className={cls('concept-card', compact && 'compact')}>
      <div className="row between wrap" style={{ gap: 6 }}>
        <b className="concept-term">{concept.term}</b>
        <ReadAloud text={`${concept.term}. ${concept.def} ${concept.example ?? ''}`} />
      </div>
      <p className="concept-def">{concept.def}</p>
      {concept.formula && <div className="concept-formula mono">{concept.formula}</div>}
      {concept.example && !compact && (
        <p className="concept-example">
          <span className="concept-label">Example</span> {concept.example}
        </p>
      )}
      {lesson && onLesson !== null && (
        <button className="link-btn concept-lesson" onClick={() => (onLesson ?? openLesson)(lesson.id)}>
          {done ? '✓' : '📖'} Lesson: {lesson.title}
        </button>
      )}
    </div>
  );
}

/** What to know before you start, shown on an activity's intro screen. */
export function DeskBriefing({ def, entry }: { def: ActivityDef; entry: boolean }) {
  const b = BRIEFINGS[def.id];
  const done = useGame((s) => s.world?.progress.lessons ?? []);
  if (!b) return null;
  const ideas = entry ? (b.entry ?? b.ideas) : b.ideas;
  const lessons = entry ? [] : lessonsFor(b.concepts);
  return (
    <section className="desk-briefing">
      <div className="row between wrap" style={{ gap: 6 }}>
        <span className="learn-kicker">{entry ? 'Before you start' : 'Desk briefing'}</span>
        <ReadAloud text={ideas.join(' ')} />
      </div>
      <ul className="briefing-ideas">
        {ideas.map((t) => (
          <li key={t}>{t}</li>
        ))}
      </ul>
      {!entry && b.formula && <div className="concept-formula mono">{b.formula}</div>}
      {lessons.length > 0 && (
        <div className="briefing-lessons">
          <span className="tiny muted">Lessons for this desk</span>
          <div className="row wrap" style={{ gap: 6 }}>
            {lessons.map((l) => (
              <button key={l.id} className={cls('chip', 'briefing-lesson', done.includes(l.id) && 'good')} onClick={() => openLesson(l.id)}>
                {done.includes(l.id) ? '✓' : l.icon} {l.title}
              </button>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

/**
 * Concept help during play. The first time it's opened in a run it asks to confirm, because using
 * it caps the run at 2 stars. `screen` is the activity's play area, read when the drawer opens so
 * the concepts on screen right now come first (works for every activity, no wiring needed).
 */
export function ConceptHelp({ def, entry, used, onUse, screen }: { def: ActivityDef; entry: boolean; used: boolean; onUse: () => void; screen: RefObject<HTMLElement | null> }) {
  const [open, setOpen] = useState(false);
  const [asking, setAsking] = useState(false);
  const [onScreen, setOnScreen] = useState<Concept[]>([]);
  const [query, setQuery] = useState('');
  const b = BRIEFINGS[def.id];
  // Entry players get the basic lesson on this activity's topic
  const basic = entry ? LESSONS.find((l) => def.topics.includes(l.topic as never)) : undefined;
  const deskConcepts = useMemo(() => (b?.concepts ?? []).map((id) => CONCEPT_BY_ID.get(id)).filter(Boolean) as Concept[], [b]);

  const show = () => {
    setOnScreen(entry ? [] : conceptsIn(screen.current?.innerText ?? '').slice(0, 6));
    setQuery('');
    setAsking(false);
    setOpen(true);
    onUse();
  };
  const found = query.trim().length >= 2 ? CONCEPTS.filter((c) => `${c.term} ${(c.aka ?? []).join(' ')} ${c.def}`.toLowerCase().includes(query.trim().toLowerCase())).slice(0, 8) : [];
  const rest = deskConcepts.filter((c) => !onScreen.includes(c));

  return (
    <>
      <button
        className={cls('concept-help-btn', used && 'used')}
        onClick={() => {
          playSfx('pop');
          if (used) show();
          else setAsking(true);
        }}
        title="Get help with the ideas behind this activity"
      >
        💡 {entry ? 'Help' : 'Concept help'}
      </button>
      {asking && (
        <div className="concept-ask" role="dialog" aria-label="Use Concept help?">
          <b>{entry ? 'Need a hint?' : 'Open Concept help?'}</b>
          <p className="small">Using help is fine, it&apos;s how you learn! This round can then earn at most 2 stars.</p>
          <div className="row" style={{ gap: 8, justifyContent: 'flex-end' }}>
            <Button size="small" onClick={() => setAsking(false)}>
              Not now
            </Button>
            <Button size="small" variant="primary" onClick={show}>
              Open help
            </Button>
          </div>
        </div>
      )}
      {open && (
        <aside className="concept-drawer" role="dialog" aria-label="Concept help">
          <div className="row between" style={{ gap: 8 }}>
            <b className="concept-drawer-title">💡 {entry ? 'Help' : 'Concept help'}</b>
            <button className="fp-close" aria-label="Close help" onClick={() => setOpen(false)}>
              ✕
            </button>
          </div>
          <span className="tiny muted">This round can earn at most 2 stars.</span>
          {onScreen.length > 0 && (
            <section className="col" style={{ gap: 8 }}>
              <span className="learn-kicker dark">On screen now</span>
              {onScreen.map((c) => (
                <ConceptCard key={c.id} concept={c} />
              ))}
            </section>
          )}
          {b && (
            <section className="col" style={{ gap: 6 }}>
              <span className="learn-kicker dark">{entry ? 'Remember' : 'This desk'}</span>
              <ul className="briefing-ideas">
                {(entry ? (b.entry ?? b.ideas) : b.ideas).map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
              {!entry && b.formula && <div className="concept-formula mono">{b.formula}</div>}
            </section>
          )}
          {entry && basic && (
            <Button variant="primary" onClick={() => openLesson(basic.id)}>
              📖 Learn it: {basic.title}
            </Button>
          )}
          {!entry && rest.length > 0 && (
            <section className="col" style={{ gap: 8 }}>
              <span className="learn-kicker dark">Ideas used here</span>
              {rest.map((c) => (
                <details key={c.id} className="concept-fold">
                  <summary>{c.term}</summary>
                  <ConceptCard concept={c} compact />
                </details>
              ))}
            </section>
          )}
          {!entry && (
            <section className="col" style={{ gap: 8 }}>
              <span className="learn-kicker dark">Look up a term</span>
              <input className="input" placeholder="e.g. duration, EBITDA, APR" value={query} onChange={(e) => setQuery(e.target.value)} />
              {found.map((c) => (
                <ConceptCard key={c.id} concept={c} compact />
              ))}
              {query.trim().length >= 2 && !found.length && <span className="small muted">No match. Try another word.</span>}
            </section>
          )}
        </aside>
      )}
    </>
  );
}

/**
 * Question text with each glossary term tappable for a quick definition. Free to use (it only
 * defines words); the full Concept help is what caps stars.
 */
export function TermText({ text }: { text: string }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const parts = useMemo(() => splitTerms(text), [text]);
  return (
    <>
      {parts.map((p, i) =>
        typeof p === 'string' ? (
          <span key={i}>{p}</span>
        ) : (
          <span key={i} className="term-wrap">
            <button type="button" className="term" onClick={() => setOpenId(openId === p.concept.id ? null : p.concept.id)} aria-expanded={openId === p.concept.id}>
              {p.text}
            </button>
            {openId === p.concept.id && (
              <span className="term-pop" role="tooltip">
                <b>{p.concept.term}</b> {p.concept.def}
                {p.concept.formula && <span className="mono term-formula">{p.concept.formula}</span>}
              </span>
            )}
          </span>
        ),
      )}
    </>
  );
}
