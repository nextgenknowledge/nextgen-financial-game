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
  const close = useUI((s) => s.close);
  if (!panel) return null;
  switch (panel.type) {
    case 'pause':
      return <PausePanel />;
    case 'settings':
      return <SettingsModal onClose={close} />;
    case 'map':
      return <MapPanel />;
    case 'phone':
      return <Phone app={panel.app} arg={panel.arg} />;
    case 'activity':
      return <ActivityHost key={panel.id} id={panel.id} />;
    case 'service':
      return <ServicePanel id={panel.id} arg={panel.arg} />;
    case 'shop':
      return <ShopPanel id={panel.id} />;
    case 'learn':
      return <LearnPanel topic={panel.topic} />;
    default:
      return null;
  }
}
