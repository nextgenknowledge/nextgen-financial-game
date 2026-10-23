'use client';
import { useEffect } from 'react';
import { useUI } from '@/store/ui';
import { useGame, act } from '@/store/game';
import { recordEvent } from '@/game/progress/events';
import { Modal } from '../common';
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
  return (
    <Modal onClose={close} size="wide" className="phone" title={def ? `${def.icon} ${def.name}` : '📱 FinPhone'} subtitle={def ? 'FinPhone' : 'Your money, accounts and progress'}>
      {app && (
        <button className="link-btn" style={{ alignSelf: 'flex-start', marginBottom: 6 }} onClick={() => (playSfx('click'), open({ type: 'phone' }))}>
          ◀ All apps
        </button>
      )}
      <div className="phone-screen">
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
      </div>
    </Modal>
  );
}
