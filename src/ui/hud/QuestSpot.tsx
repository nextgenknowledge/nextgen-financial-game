'use client';
import { useEffect, useState } from 'react';
import { useUI } from '@/store/ui';
import { useGame } from '@/store/game';
import { currentStep } from '@/game/progress/quests';
import { isTouch } from '../touch';

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Lights up the HUD element the current quest step is talking about. Play carries on around it. */
export function QuestSpot() {
  const [box, setBox] = useState<Box | null>(null);

  useEffect(() => {
    const id = setInterval(() => {
      const ui = useUI.getState();
      const w = useGame.getState().world;
      const phone = ui.panel?.type === 'phone' ? ui.panel : null;
      const step = w && (!ui.panel || phone) && !ui.tour && !ui.run && !ui.loading.active ? currentStep(w)?.step : null;
      // With the phone open, light up the app to tap; on its screen there's nothing left to point at
      const selector = phone
        ? step?.appSpot && !phone.app && `[data-app="${step.appSpot}"]`
        : step && (isTouch() ? step.touchSpot ?? step.spot : step.spot);
      const r = selector ? document.querySelector(selector)?.getBoundingClientRect() : null;
      setBox((old) => {
        if (!r || !r.width) return null;
        const next = { x: r.left - 6, y: r.top - 6, w: r.width + 12, h: r.height + 12 };
        return old && old.x === next.x && old.y === next.y && old.w === next.w && old.h === next.h ? old : next;
      });
    }, 200);
    return () => clearInterval(id);
  }, []);

  if (!box) return null;
  return <div className="quest-spot" style={{ left: box.x, top: box.y, width: box.w, height: box.h }} />;
}
