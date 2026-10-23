'use client';
import { useUI } from '@/store/ui';
import { PausePanel } from './PausePanel';
import { MapPanel } from './MapPanel';
import { Phone } from '../phone/Phone';
import { ActivityHost } from '@/activities/ActivityHost';
import { ServicePanel } from '../services/ServicePanel';
import { ShopPanel } from '../services/ShopPanel';
import { LearnPanel } from './LearnPanel';
import { SettingsModal } from '../SettingsModal';

export function Panels() {
  const panel = useUI((s) => s.panel);
  const run = useUI((s) => s.run);
  // A paused activity stays mounted (hidden) so it can be resumed exactly where it was
  const activity = panel?.type === 'activity' ? panel.id : null;
  const live = run?.id ?? activity;
  return (
    <>
      {live && <ActivityHost key={live} id={live} hidden={activity !== live} />}
      {panel && panel.type !== 'activity' && <PanelFor panel={panel} />}
    </>
  );
}

function PanelFor({ panel }: { panel: NonNullable<ReturnType<typeof useUI.getState>['panel']> }) {
  const close = useUI((s) => s.close);
  switch (panel.type) {
    case 'pause':
      return <PausePanel />;
    case 'settings':
      return <SettingsModal onClose={close} />;
    case 'map':
      return <MapPanel />;
    case 'phone':
      return <Phone app={panel.app} arg={panel.arg} />;
    case 'service':
      return <ServicePanel id={panel.id} arg={panel.arg} />;
    case 'shop':
      return <ShopPanel id={panel.id} />;
    case 'learn':
      return <LearnPanel topic={panel.topic} lessonId={panel.lesson} />;
    default:
      return null;
  }
}
