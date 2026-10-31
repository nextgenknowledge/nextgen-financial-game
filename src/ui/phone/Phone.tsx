'use client';
import { useEffect, useMemo } from 'react';
import { useUI } from '@/store/ui';
import { useGame, act } from '@/store/game';
import { recordEvent } from '@/game/progress/events';
import { hourOf } from '@/engine/Sky';
import { playSfx } from '@/engine/audio';
import { BankApp } from './apps/BankApp';
import { GoalsApp } from './apps/GoalsApp';
import { NetWorthApp } from './apps/NetWorthApp';
import { PortfolioApp } from './apps/PortfolioApp';
import { BillsApp } from './apps/BillsApp';
import { BagApp } from './apps/BagApp';
import { QuestsApp } from './apps/QuestsApp';
import { BadgesApp } from './apps/BadgesApp';
import { CreditApp } from './apps/CreditApp';
import { TaxesApp } from './apps/TaxesApp';
import { NewsApp } from './apps/NewsApp';
import { CalculatorApp } from './apps/CalculatorApp';
import { LeaderboardApp } from './apps/LeaderboardApp';
import { xpForLevel } from '@/game/progress/xp';
import { netWorth } from '@/game/finance/netWorth';
import { monthLabel } from '@/game/world';
import { shortMoney } from '../format';

interface AppDef {
  id: string;
  name: string;
  icon: string;
  color: string;
  advanced?: boolean;
  needs?: (w: NonNullable<ReturnType<typeof useGame.getState>['world']>) => boolean;
}

export const APPS: AppDef[] = [
  { id: 'bank', name: 'Bank', icon: '🏦', color: '#2ebaba' },
  { id: 'goals', name: 'Goals', icon: '🎯', color: '#ffcf3f' },
  { id: 'networth', name: 'Net Worth', icon: '📈', color: '#3cc45a' },
  { id: 'portfolio', name: 'Investing', icon: '💹', color: '#2f6bdb' },
  { id: 'bills', name: 'Bills', icon: '🧾', color: '#e1553f' },
  { id: 'bag', name: 'My Stuff', icon: '🎒', color: '#8a5cf6' },
  { id: 'quests', name: 'Quests', icon: '📜', color: '#ff8a3d' },
  { id: 'badges', name: 'Badges', icon: '🏅', color: '#f06aa8' },
  { id: 'leaderboard', name: 'Leaderboard', icon: '🏆', color: '#c9952a' },
  { id: 'news', name: 'News', icon: '📰', color: '#4a5672' },
  { id: 'credit', name: 'Credit', icon: '💳', color: '#1f4fae', advanced: true },
  { id: 'taxes', name: 'Taxes', icon: '🏛️', color: '#3a6b4a', advanced: true },
  { id: 'calc', name: 'Calculator', icon: '🧮', color: '#24397a' },
  { id: 'learn', name: 'Learn', icon: '📚', color: '#8a3f2e' },
  { id: 'map', name: 'Map', icon: '🗺️', color: '#2f9a6a' },
  { id: 'settings', name: 'Settings', icon: '⚙️', color: '#7a7f8f' },
];

export function Phone({ app, arg }: { app?: string; arg?: string }) {
  const close = useUI((s) => s.close);
  const open = useUI((s) => s.open);
  const difficulty = useGame((s) => s.world!.difficulty);
  const claimable = useGame((s) => [...s.world!.progress.daily.list, ...s.world!.progress.weekly.list].filter((c) => !c.claimed).length);

  useEffect(() => {
    if (app) act((d, fx) => recordEvent(d, fx, { type: 'menu', target: app }));
  }, [app]);

  const go = (id: string) => {
    playSfx('pop');
    if (id === 'learn') return open({ type: 'learn' });
    if (id === 'map') return open({ type: 'map' });
    if (id === 'settings') return open({ type: 'settings' });
    open({ type: 'phone', app: id });
  };

  const def = APPS.find((a) => a.id === app);
  const t = useGame((s) => s.world!.time.t);
  const h = hourOf(t);
  const clock = `${Math.floor(h) % 12 || 12}:${String(Math.floor((h % 1) * 60)).padStart(2, '0')}`;
  // Escape closes the phone (it isn't a modal, so it handles this itself)
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        close();
      }
    };
    window.addEventListener('keydown', k, true);
    return () => window.removeEventListener('keydown', k, true);
  }, [close]);
  return (
    <div className="finphone-dock">
      <div className="modal finphone" role="dialog" aria-label="FinPhone">
        <div className="fp-top">
          <span className="fp-speaker" />
        </div>
        <div className="fp-status">
          <span>{clock}</span>
          <span>FinPhone</span>
          <span className="fp-battery" aria-hidden="true">
            <span />
          </span>
        </div>
        <div className="fp-bar">
          {app ? (
            <button className="fp-back" onClick={() => (playSfx('click'), open({ type: 'phone' }))} aria-label="All apps">
              ◀
            </button>
          ) : (
            <span className="fp-back placeholder" />
          )}
          <b className="fp-title">{def ? `${def.icon} ${def.name}` : 'Home'}</b>
          <button className="fp-close" onClick={() => (playSfx('click'), close())} aria-label="Close FinPhone">
            ✕
          </button>
        </div>
      <div className="phone-screen">
        {!app && <PhoneProfile />}
        {!app && (
          <div className="app-grid">
            {APPS.filter((a) => !a.advanced || difficulty === 'advanced').map((a) => (
              <button key={a.id} className="app-icon" onClick={() => go(a.id)}>
                <span className="app-tile" style={{ background: a.color }}>
                  {a.icon}
                  {a.id === 'quests' && claimable > 0 && <span className="app-badge">{claimable}</span>}
                </span>
                <span className="app-name">{a.name}</span>
              </button>
            ))}
          </div>
        )}
        {app === 'bank' && <BankApp />}
        {app === 'goals' && <GoalsApp />}
        {app === 'networth' && <NetWorthApp />}
        {app === 'portfolio' && <PortfolioApp />}
        {app === 'bills' && <BillsApp />}
        {app === 'bag' && <BagApp tab={arg} />}
        {app === 'quests' && <QuestsApp />}
        {app === 'badges' && <BadgesApp />}
        {app === 'credit' && <CreditApp />}
        {app === 'taxes' && <TaxesApp />}
        {app === 'news' && <NewsApp />}
        {app === 'calc' && <CalculatorApp />}
        {app === 'leaderboard' && <LeaderboardApp />}
      </div>
        <button className="fp-home" onClick={() => (playSfx('click'), app ? open({ type: 'phone' }) : close())} aria-label={app ? 'Home' : 'Close FinPhone'} />
      </div>
    </div>
  );
}

/* Top of the phone's home screen: level and XP, happiness, net worth and the date
   (these used to sit on the main screen). */
function PhoneProfile() {
  const w = useGame((s) => s.world!);
  const open = useUI((s) => s.open);
  const nw = useMemo(() => netWorth(w).total, [w]);
  const { level, xp } = w.progress;
  const lo = xpForLevel(level);
  const hi = xpForLevel(level + 1);
  const happy = w.player.happiness;
  return (
    <div className="fp-profile">
      <div className="fp-profile-top">
        <span className="fp-lvl">{level}</span>
        <div className="fp-profile-text">
          <b>{w.nickname}</b>
          <span>{monthLabel(w.time.month)}</span>
        </div>
      </div>
      <div className="fp-stat">
        <span>XP</span>
        <span className="fp-meter">
          <span style={{ width: `${Math.max(0, Math.min(100, ((xp - lo) / (hi - lo)) * 100))}%`, background: 'var(--px-gold, #f2c94c)' }} />
        </span>
        <span className="fp-num">
          {xp - lo}/{hi - lo}
        </span>
      </div>
      <div className="fp-stat" title="Above 70 boosts XP!">
        <span>Happy</span>
        <span className="fp-meter">
          <span style={{ width: `${happy}%`, background: happy >= 70 ? 'var(--good)' : happy >= 40 ? 'var(--gold)' : 'var(--bad)' }} />
        </span>
        <span className="fp-num">{happy}</span>
      </div>
      <button className="fp-networth" onClick={() => (playSfx('pop'), open({ type: 'phone', app: 'networth' }))}>
        <span>Net worth</span>
        <b className={nw < 0 ? 'bad' : ''}>{shortMoney(nw)}</b>
      </button>
    </div>
  );
}
