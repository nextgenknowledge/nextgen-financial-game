'use client';
import { useUI } from '@/store/ui';
import { cls } from './format';

/** Toast notifications. In game they sit inside the HUD layout (`inline`) so they never cover other HUD pieces. */
export function Toasts({ inline = false }: { inline?: boolean }) {
  const toasts = useUI((s) => s.toasts);
  return (
    <div className={cls('toasts', inline && 'inline')} aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={`toast ${t.tone ?? 'info'}`}>
          {t.icon && <span className="toast-icon">{t.icon}</span>}
          <span>{t.text}</span>
        </div>
      ))}
    </div>
  );
}
