'use client';
import { useEffect, useMemo, useState } from 'react';
import { useGame, act } from '@/store/game';
import { useUI } from '@/store/ui';
import { useScene } from '@/store/scene';
import { furnitureDef } from '@/game/sim/catalog';
import { homeInfo, layoutOf, moveFurniture, placeFurniture, storeFurniture, storedFurniture } from '@/game/home';
import { decorTarget } from '@/world/HomeScene';
import { playSfx } from '@/engine/audio';

/*
 * Arranging furniture at home. Pick a piece from storage (or one already in the room), walk to
 * where you want it while a see-through copy shows where it will land, turn it with R and put it
 * down with E. Everything is saved with the home.
 */

/** Place, turn or cancel the piece being carried (also bound to E, R and Esc). */
export function decorAction(a: 'place' | 'turn' | 'cancel') {
  const ui = useUI.getState();
  const d = ui.decor;
  if (!d) return;
  if (a === 'cancel') {
    playSfx('click');
    ui.setDecor(d.carrying ? { ...d, carrying: null } : null);
    return;
  }
  if (!d.carrying) return;
  if (a === 'turn') {
    playSfx('click');
    ui.setDecor({ ...d, rot: (d.rot + Math.PI / 2) % (Math.PI * 2) });
    return;
  }
  if (decorTarget.problem) {
    playSfx('error');
    ui.pushToast({ text: decorTarget.problem, tone: 'info' });
    return;
  }
  let err: string | null = null;
  act((w) => {
    const inRoom = layoutOf(w.assets.properties.find((p) => p.uid === d.home)!).some((f) => f.item === d.carrying);
    err = inRoom ? moveFurniture(w, d.home, d.carrying!, decorTarget.x, decorTarget.z, d.rot) : placeFurniture(w, d.home, d.carrying!, decorTarget.x, decorTarget.z, d.rot);
  });
  if (err) {
    playSfx('error');
    ui.pushToast({ text: err, tone: 'info' });
    return;
  }
  playSfx('pop');
  ui.setDecor({ ...d, carrying: null });
}

const nameOf = (itemId: string) => furnitureDef(itemId)?.name ?? itemId;

export function DecorPanel() {
  const interior = useScene((s) => s.interior);
  const home = interior?.startsWith('home:') ? interior.slice(5) : null;
  const decor = useUI((s) => s.decor);
  const panel = useUI((s) => s.panel);
  const tour = useUI((s) => s.tour);
  const world = useGame((s) => s.world);
  const info = useMemo(() => (world && home ? homeInfo(world, home) : null), [world, home]);
  const stored = useMemo(() => (world ? storedFurniture(world) : []), [world]);
  const placed = useMemo(() => {
    if (!world || !info) return [];
    const byId = new Map(world.assets.items.map((i) => [i.uid, i]));
    return layoutOf(info.prop)
      .map((f) => byId.get(f.item))
      .filter((i): i is NonNullable<typeof i> => !!i);
  }, [world, info]);

  // Live "can it go here?" line while carrying
  const [problem, setProblem] = useState<string | null>(null);
  useEffect(() => {
    if (!decor?.carrying) return;
    const id = setInterval(() => setProblem(decorTarget.problem), 150);
    return () => clearInterval(id);
  }, [decor?.carrying]);

  // R turns the piece you're carrying
  useEffect(() => {
    if (!decor?.carrying) return;
    const h = (e: KeyboardEvent) => {
      if (e.code === 'KeyR' && !e.repeat) decorAction('turn');
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [decor?.carrying]);

  if (!home || !info || panel || tour) return null;
  const ui = useUI.getState();

  if (!decor) {
    return (
      <button type="button" className="corner-btn decor-open" onClick={() => (playSfx('pop'), ui.setDecor({ home, carrying: null, rot: 0 }))}>
        Arrange furniture
      </button>
    );
  }

  if (decor.carrying) {
    const it = world!.assets.items.find((i) => i.uid === decor.carrying);
    return (
      <div className="decor-panel" role="dialog" aria-label="Place furniture">
        <b className="decor-title">{it ? nameOf(it.itemId) : 'Furniture'}</b>
        <p className="decor-help">Walk to where you want it. R turns it, E puts it down.</p>
        <p className={problem ? 'decor-status bad' : 'decor-status ok'}>{problem ?? 'It fits here.'}</p>
        <div className="decor-row">
          <button type="button" className="btn small" onClick={() => decorAction('turn')}>
            Turn
          </button>
          <button type="button" className="btn small primary" onClick={() => decorAction('place')} disabled={!!problem}>
            Put it here
          </button>
          <button type="button" className="btn small ghost" onClick={() => decorAction('cancel')}>
            Cancel
          </button>
        </div>
      </div>
    );
  }

  const carry = (uid: string) => {
    playSfx('pop');
    const f = layoutOf(info.prop).find((x) => x.item === uid);
    ui.setDecor({ home, carrying: uid, rot: f?.rot ?? 0 });
  };
  return (
    <div className="decor-panel" role="dialog" aria-label={`Arrange your ${info.name}`}>
      <div className="decor-head">
        <b className="decor-title">Arrange your {info.name}</b>
        <button type="button" className="btn small primary" onClick={() => (playSfx('click'), ui.setDecor(null))}>
          Done
        </button>
      </div>
      {stored.length === 0 && placed.length === 0 && <p className="decor-help">Furniture you buy at the Furniture Store waits here in storage, ready to place.</p>}
      {stored.length > 0 && (
        <>
          <div className="decor-label">In storage</div>
          <ul className="decor-list">
            {stored.map((i) => (
              <li key={i.uid}>
                <span>{nameOf(i.itemId)}</span>
                <button type="button" className="btn small primary" onClick={() => carry(i.uid)}>
                  Place
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
      {placed.length > 0 && (
        <>
          <div className="decor-label">In this room</div>
          <ul className="decor-list">
            {placed.map((i) => (
              <li key={i.uid}>
                <span>{nameOf(i.itemId)}</span>
                <button type="button" className="btn small" onClick={() => carry(i.uid)}>
                  Move
                </button>
                <button
                  type="button"
                  className="btn small ghost"
                  onClick={() => {
                    playSfx('click');
                    act((w) => storeFurniture(w, i.uid));
                  }}
                >
                  Store
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
