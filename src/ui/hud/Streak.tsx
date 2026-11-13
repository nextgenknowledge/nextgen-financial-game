'use client';
/**
 * Daily streak: the first calm moment of each day counts the visit (src/game/progress/streak.ts),
 * pays its XP and money and shows an animated reward card. The XP calendar (from the streak
 * button on the middle left, or the card) shows every day played and the XP earned on it.
 */
import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { act, useGame } from '@/store/game';
import { useUI } from '@/store/ui';
import { playSfx } from '@/engine/audio';
import { checkIn, dayKey, liveStreak, streakReward, type CheckIn, type StreakState } from '@/game/progress/streak';
import { Button, Modal } from '../common';

/** Seconds of calm play before the card shows, so it never lands on top of a loading screen. */
const SETTLE = 2;

export function openStreakCalendar() {
  playSfx('pop');
  useUI.setState({ streakCal: true });
}

/** Watches for a new day (on loading a world, or past midnight) and pays the streak. */
export function StreakWatcher() {
  const show = useUI((s) => s.streakShow);
  const cal = useUI((s) => s.streakCal);

  useEffect(() => {
    let calm = 0;
    const id = setInterval(() => {
      const ui = useUI.getState();
      const w = useGame.getState().world;
      if (!w || ui.screen !== 'game' || ui.loading.active || document.visibilityState !== 'visible') {
        calm = 0;
        return;
      }
      if (w.progress.streak?.last === dayKey() || ui.streakShow) return;
      // A calm moment: no menu, tour, activity, Narwhal speech, furniture moving or other card.
      // The first-day tutorial gets to finish first.
      const busy =
        ui.panel || ui.tour || ui.run || ui.decor || ui.narwhal.length || ui.worldActivity || ui.rating || ui.costSummary || ui.streakCal;
      const tutorial = w.progress.quests.active.some((q) => q.id === 'q1-welcome');
      if (busy || tutorial) {
        calm = 0;
        return;
      }
      if (++calm < SETTLE) return;
      let got: CheckIn | null = null;
      act((d, fx) => {
        got = checkIn(d, fx);
      });
      if (got) useUI.setState({ streakShow: got });
    }, 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <>
      {show && <StreakCard got={show} />}
      {cal && <StreakCalendar />}
    </>
  );
}

/** Counts from `from` up to `to` once `delay` ms have passed. */
function useCountUp(from: number, to: number, delay: number, ms = 700) {
  const [v, setV] = useState(from);
  useEffect(() => {
    let raf = 0;
    const t0 = performance.now() + delay;
    const step = (now: number) => {
      const k = Math.min(1, Math.max(0, (now - t0) / ms));
      setV(Math.round(from + (to - from) * (1 - Math.pow(1 - k, 3))));
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [from, to, delay, ms]);
  return v;
}

const SPARKS = Array.from({ length: 16 }, (_, i) => {
  const a = (i / 16) * Math.PI * 2;
  const r = 70 + (i % 3) * 22;
  return { x: Math.round(Math.cos(a) * r), y: Math.round(Math.sin(a) * r), d: (i % 4) * 60, c: ['#ffcf3f', '#f08a3a', '#e5533d', '#fffdf6'][i % 4] };
});

function StreakCard({ got }: { got: CheckIn }) {
  const count = useCountUp(Math.max(0, got.count - 1), got.count, 450, 500);
  const xp = useCountUp(0, got.xp, 1300);
  const cash = useCountUp(0, got.cash, 1500);
  const next = streakReward(got.count + 1);
  // Where today sits in the current block of seven, and which days of it are already lit
  const slot = ((got.count - 1) % 7) + 1;

  useEffect(() => {
    playSfx('star');
    const t1 = setTimeout(() => playSfx('levelup'), 450);
    const t2 = setTimeout(() => {
      playSfx('coin');
      useUI.getState().burst();
    }, 1300);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, []);

  const close = () => useUI.setState({ streakShow: null });
  const line = got.milestone
    ? `A full week! Today's rewards are doubled.`
    : got.restarted
      ? `A fresh start! Your best is ${got.best} days. Come back tomorrow to build it up again.`
      : got.count === 1
        ? 'Day one! Come back tomorrow to start a streak.'
        : `${got.count} days in a row. Keep it going tomorrow!`;

  return (
    <Modal title="Daily streak" accent="gold" onClose={close} className="streak-modal">
      <div className={got.milestone ? 'streak-card milestone' : 'streak-card'}>
        <div className="streak-hero" aria-hidden="true">
          <div className="streak-rays">
            {Array.from({ length: 8 }, (_, i) => (
              <span key={i} style={{ '--r': `${i * 45}deg` } as CSSProperties} />
            ))}
          </div>
          {SPARKS.map((s, i) => (
            <span
              key={i}
              className="streak-spark"
              style={{ '--x': `${s.x}px`, '--y': `${s.y}px`, '--d': `${400 + s.d}ms`, background: s.c } as CSSProperties}
            />
          ))}
          <span className="streak-flame">🔥</span>
        </div>
        <div className="streak-count" aria-live="polite">
          <b key={count} className="pixel">
            {count}
          </b>
          <span className="pixel">day streak</span>
        </div>
        <ol className="streak-week" aria-label={`Day ${slot} of 7 this week`}>
          {Array.from({ length: 7 }, (_, i) => {
            const n = i + 1;
            const state = n < slot ? 'lit' : n === slot ? 'today' : 'next';
            return (
              <li key={n} className={`streak-pip ${state}`} style={{ '--d': `${200 + i * 90}ms` } as CSSProperties}>
                <span className="pip-icon">{n === 7 ? '🎁' : n <= slot ? '🔥' : ''}</span>
                <span className="pip-day">{n}</span>
              </li>
            );
          })}
        </ol>
        <div className="streak-rewards">
          <span className="streak-chip xp" style={{ '--d': '1200ms' } as CSSProperties}>
            <span className="chip-icon">⭐</span> +{xp} XP
          </span>
          <span className="streak-chip cash" style={{ '--d': '1400ms' } as CSSProperties}>
            <span className="chip-icon">🪙</span> +${cash}
          </span>
        </div>
        <p className="streak-line">{line}</p>
        <p className="tiny muted streak-next">
          Tomorrow: +{next.xp} XP and +${next.cash}
          {next.milestone ? ' (week bonus!)' : ''}
        </p>
        <div className="row wrap streak-actions">
          <Button variant="gold" size="big" onClick={close}>
            Collect
          </Button>
          <Button
            onClick={() => {
              close();
              openStreakCalendar();
            }}
          >
            📅 XP calendar
          </Button>
        </div>
      </div>
    </Modal>
  );
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

/** 0 for a day not played, then 1 to 4 by XP earned. */
function heat(xp: number) {
  if (xp <= 0) return 0;
  if (xp < 60) return 1;
  if (xp < 150) return 2;
  if (xp < 300) return 3;
  return 4;
}

function StreakCalendar() {
  const s: StreakState = useGame((g) => g.world!.progress.streak) ?? { last: '', count: 0, best: 0, days: {} };
  const today = dayKey();
  const [month, setMonth] = useState(() => {
    const d = new Date();
    return { y: d.getFullYear(), m: d.getMonth() };
  });
  const [picked, setPicked] = useState<string>(today);
  const close = () => useUI.setState({ streakCal: false });

  const cells = useMemo(() => {
    const first = new Date(month.y, month.m, 1).getDay();
    const len = new Date(month.y, month.m + 1, 0).getDate();
    const out: (string | null)[] = Array.from({ length: first }, () => null);
    for (let d = 1; d <= len; d++) out.push(dayKey(new Date(month.y, month.m, d, 12)));
    return out;
  }, [month]);

  const inMonth = Object.entries(s.days).filter(([k]) => k.startsWith(`${month.y}-${String(month.m + 1).padStart(2, '0')}`));
  const monthXp = inMonth.reduce((n, [, v]) => n + v.xp, 0);
  const played = inMonth.filter(([, v]) => v.xp > 0 || v.streak > 0).length;
  const live = liveStreak(s, today);
  const shift = (by: number) => {
    playSfx('click');
    setMonth(({ y, m }) => {
      const d = new Date(y, m + by, 1);
      return { y: d.getFullYear(), m: d.getMonth() };
    });
  };
  const atNow = month.y === new Date().getFullYear() && month.m === new Date().getMonth();
  const day = s.days[picked];
  const [py, pm, pd] = picked.split('-').map(Number);

  return (
    <Modal title="XP calendar" accent="gold" onClose={close} className="streak-cal-modal">
      <div className="streak-stats">
        <div className="streak-stat now">
          <span className="ss-icon">🔥</span>
          <b className="pixel">{live}</b>
          <span>day streak</span>
        </div>
        <div className="streak-stat">
          <span className="ss-icon">🏆</span>
          <b className="pixel">{s.best}</b>
          <span>best streak</span>
        </div>
        <div className="streak-stat">
          <span className="ss-icon">⭐</span>
          <b className="pixel">{monthXp.toLocaleString()}</b>
          <span>XP this month</span>
        </div>
        <div className="streak-stat">
          <span className="ss-icon">📅</span>
          <b className="pixel">{played}</b>
          <span>days played</span>
        </div>
      </div>
      <div className="cal-head">
        <button className="cal-nav" aria-label="Previous month" onClick={() => shift(-1)}>
          ‹
        </button>
        <h3>
          {MONTHS[month.m]} {month.y}
        </h3>
        <button className="cal-nav" aria-label="Next month" disabled={atNow} onClick={() => shift(1)}>
          ›
        </button>
      </div>
      <div className="cal-grid" role="grid">
        {WEEKDAYS.map((d, i) => (
          <span key={`h${i}`} className="cal-wd">
            {d}
          </span>
        ))}
        {cells.map((k, i) => {
          if (!k) return <span key={`e${i}`} className="cal-cell empty" />;
          const v = s.days[k];
          const xp = v?.xp ?? 0;
          const cls = ['cal-cell', `h${heat(xp)}`, k === today && 'today', k > today && 'future', v?.streak && 'streaked', k === picked && 'picked']
            .filter(Boolean)
            .join(' ');
          return (
            <button
              key={k}
              className={cls}
              style={{ '--d': `${i * 18}ms` } as CSSProperties}
              disabled={k > today}
              aria-label={`${k}: ${xp} XP`}
              onClick={() => setPicked(k)}
            >
              <span className="cal-num">{Number(k.slice(8))}</span>
              {v?.streak ? <span className="cal-flame">🔥</span> : null}
              {xp > 0 && <span className="cal-xp">{xp >= 1000 ? `${(xp / 1000).toFixed(1)}k` : xp}</span>}
            </button>
          );
        })}
      </div>
      <div className="cal-legend tiny">
        <span>Less XP</span>
        {[1, 2, 3, 4].map((h) => (
          <span key={h} className={`cal-key h${h}`} />
        ))}
        <span>More XP</span>
        <span className="cal-legend-flame">🔥 streak day</span>
      </div>
      <div className="cal-detail small">
        <b>
          {MONTHS[pm - 1]} {pd}, {py}
        </b>
        {day && (day.xp > 0 || day.streak > 0) ? (
          <span>
            {day.xp.toLocaleString()} XP earned
            {day.streak > 0 && (
              <>
                {' '}
                ({day.bonus} XP and ${day.cash} from day {day.streak} of your streak)
              </>
            )}
          </span>
        ) : (
          <span className="muted">{picked === today ? 'Nothing earned yet today.' : 'You did not play this day.'}</span>
        )}
      </div>
      <p className="tiny muted" style={{ margin: '8px 0 0' }}>
        Play every day to grow your streak. Rewards climb each day, and every 7th day doubles them. Miss a day and the streak starts again.
      </p>
    </Modal>
  );
}
