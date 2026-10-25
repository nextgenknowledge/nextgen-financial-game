'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useUI } from '@/store/ui';
import {
  deleteWorld,
  downloadText,
  duplicateWorld,
  exportWorldText,
  importWorldText,
  listWorlds,
  loadWorld,
  renameWorld,
  saveWorld,
} from '@/save/db';
import { exportFileName, type WorldMeta } from '@/save/format';
import { createWorld, monthLabel } from '@/game/world';
import type { AvatarConfig, Difficulty } from '@/game/types';
import { Button, Confirm, Prompt } from '../common';
import { money, timeAgo } from '../format';
import { SkyBackdrop } from './TitleScreens';
import { NewGameFlow } from './NewGame';
import { startWorld } from '../startWorld';
import { playSfx } from '@/engine/audio';

export function WorldsScreen() {
  const setScreen = useUI((s) => s.setScreen);
  const pushToast = useUI((s) => s.pushToast);
  const [worlds, setWorlds] = useState<WorldMeta[] | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [renaming, setRenaming] = useState<WorldMeta | null>(null);
  const [deleting, setDeleting] = useState<WorldMeta | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const refresh = useCallback(async () => {
    try {
      const list = await listWorlds();
      setWorlds(list);
    } catch {
      setWorlds([]);
      pushToast({ text: "Saving isn't available in this browser mode (private window?).", icon: '⚠️', tone: 'bad' });
    }
  }, [pushToast]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const sel = worlds?.find((w) => w.id === selected) ?? null;

  const play = async (id: string) => {
    const w = await loadWorld(id);
    if (w) startWorld(w);
  };

  const onImport = async (file: File) => {
    try {
      const text = await file.text();
      const w = await importWorldText(text);
      pushToast({ text: `Imported "${w.name}"`, icon: '📥', tone: 'good' });
      setSelected(w.id);
      refresh();
    } catch (e) {
      pushToast({ text: (e as Error).message, icon: '⚠️', tone: 'bad' });
    }
  };

  return (
    <div className="screen start-screen worlds-start" style={{ alignItems: 'flex-start' }}>
      <SkyBackdrop />
      <div className="screen-inner st-panel st-panel-in" style={{ position: 'relative' }}>
        <div className="row between wrap" style={{ marginBottom: '1rem' }}>
          <h1 className="st-heading">Load Saved Game</h1>
          <div className="row">
            <Button onClick={() => fileRef.current?.click()} title="Import a world file">
              📥 Import
            </Button>
            <button type="button" className="st-small" onClick={() => setScreen('title')}>
              ◀ Back
            </button>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept=".json,application/json"
            style={{ display: 'none' }}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onImport(f);
              e.target.value = '';
            }}
          />
        </div>

        {worlds === null ? (
          <p>Loading worlds…</p>
        ) : (
          <div className="worlds-grid">
            <div
              className="new-world-card"
              role="button"
              tabIndex={0}
              onClick={() => {
                playSfx('pop');
                setCreating(true);
              }}
              onKeyDown={(e) => e.key === 'Enter' && setCreating(true)}
            >
              <span className="plus">＋</span>
              Create a new world
            </div>
            {worlds.map((w) => (
              <div
                key={w.id}
                className={`world-card panel ${selected === w.id ? 'selected' : ''}`}
                role="button"
                tabIndex={0}
                onClick={() => {
                  playSfx('click');
                  setSelected(w.id);
                }}
                onDoubleClick={() => play(w.id)}
                onKeyDown={(e) => e.key === 'Enter' && play(w.id)}
              >
                <div className="thumb">{w.thumbnail ? <img src={w.thumbnail} alt="" /> : <span style={{ fontSize: '3rem' }}>🏙️</span>}</div>
                <div className="body">
                  <span className="name">{w.name}</span>
                  <span className="row wrap" style={{ gap: '0.3rem' }}>
                    <span className={`chip ${w.difficulty === 'entry' ? 'teal' : 'navy'}`}>{w.difficulty === 'entry' ? 'Entry' : 'Advanced'}</span>
                    <span className="chip gold">Lv {w.level}</span>
                  </span>
                  <span className="small">
                    Net worth <b className={w.netWorth < 0 ? 'bad' : ''}>{money(w.netWorth, { cents: false })}</b>
                  </span>
                  <span className="tiny muted">
                    {w.nickname} · {monthLabel(w.month)} · {timeAgo(w.lastPlayed)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        {sel && (
          <div className="panel" style={{ position: 'sticky', bottom: '1rem', marginTop: '1.2rem', padding: '0.8rem', color: 'var(--ink)' }}>
            <div className="row wrap between">
              <b style={{ fontSize: '1.1rem' }}>{sel.name}</b>
              <div className="row wrap">
                <Button variant="gold" size="big" onClick={() => play(sel.id)}>
                  ▶ Play
                </Button>
                <Button onClick={() => setRenaming(sel)}>✏️ Rename</Button>
                <Button
                  onClick={async () => {
                    const c = await duplicateWorld(sel.id);
                    if (c) {
                      pushToast({ text: `Made a copy: ${c.name}`, icon: '📄', tone: 'good' });
                      setSelected(c.id);
                    }
                    refresh();
                  }}
                >
                  📄 Duplicate
                </Button>
                <Button
                  onClick={async () => {
                    const e = await exportWorldText(sel.id);
                    if (e) {
                      downloadText(exportFileName(e.world), e.text);
                      pushToast({ text: 'World exported to your downloads.', icon: '📤', tone: 'good' });
                    }
                  }}
                >
                  📤 Export
                </Button>
                <Button variant="danger" onClick={() => setDeleting(sel)}>
                  🗑️ Delete
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

      {creating && (
        <CreateWorldModal
          onClose={() => setCreating(false)}
          onCreate={async (opts) => {
            const w = createWorld(opts);
            await saveWorld(w, null).catch(() => {});
            setCreating(false);
            startWorld(w);
          }}
        />
      )}
      {renaming && (
        <Prompt
          title="Rename world"
          label="World name"
          initial={renaming.name}
          onCancel={() => setRenaming(null)}
          onSubmit={async (name) => {
            await renameWorld(renaming.id, name);
            setRenaming(null);
            refresh();
          }}
        />
      )}
      {deleting && (
        <Confirm
          title="Delete this world?"
          text={
            <>
              <b>{deleting.name}</b> will be gone forever. Tip: use <b>Export</b> first if you might want it back.
            </>
          }
          confirmLabel="Delete forever"
          danger
          onCancel={() => setDeleting(null)}
          onConfirm={async () => {
            await deleteWorld(deleting.id);
            setDeleting(null);
            setSelected(null);
            refresh();
          }}
        />
      )}
    </div>
  );
}

/** Creating a world from the worlds screen uses the same steps as the title screen. */
export function CreateWorldModal({
  onClose,
  onCreate,
}: {
  onClose: () => void;
  onCreate: (o: { name: string; nickname: string; difficulty: Difficulty; avatar: AvatarConfig }) => void;
}) {
  return <NewGameFlow onCancel={onClose} onCreate={onCreate} />;
}

export { SwatchRow } from './NewGame';
