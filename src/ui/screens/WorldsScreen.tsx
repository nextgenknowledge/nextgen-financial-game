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
import { createWorld, DEFAULT_AVATAR, monthLabel } from '@/game/world';
import type { AvatarConfig, Difficulty } from '@/game/types';
import { Button, Confirm, Modal, Prompt, FIN_LOGO } from '../common';
import { money, timeAgo } from '../format';
import { SkyBackdrop } from './TitleScreens';
import { AvatarPreview } from '../AvatarPreview';
import outfits from '@/data/shop/outfits.json';
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
    <div className="screen" style={{ alignItems: 'flex-start' }}>
      <SkyBackdrop />
      <div className="screen-inner" style={{ position: 'relative' }}>
        <div className="row between wrap" style={{ marginBottom: '1rem' }}>
          <h1 className="screen-title">
            <img src={FIN_LOGO} alt="" /> Your Worlds
          </h1>
          <div className="row">
            <Button onClick={() => fileRef.current?.click()} title="Import a world file">
              📥 Import
            </Button>
            <Button onClick={() => setScreen('title')}>← Back</Button>
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

const FUN_NAMES = ['Coin Cove', 'Piggy Bank Bay', 'Dollar Dunes', 'Savings Springs', 'Budget Bluffs', 'Penny Peaks', 'Interest Isle'];
const FUN_NICKS = ['CoinCaptain', 'PennyPilot', 'SavvySaver', 'BudgetBoss', 'StockStar', 'NickelNinja', 'DimeDiver'];

export function CreateWorldModal({
  onClose,
  onCreate,
}: {
  onClose: () => void;
  onCreate: (o: { name: string; nickname: string; difficulty: Difficulty; avatar: AvatarConfig }) => void;
}) {
  const [name, setName] = useState(() => FUN_NAMES[Math.floor(Math.random() * FUN_NAMES.length)]);
  const [nickname, setNickname] = useState(() => FUN_NICKS[Math.floor(Math.random() * FUN_NICKS.length)] + Math.floor(Math.random() * 90 + 10));
  const [difficulty, setDifficulty] = useState<Difficulty>('entry');
  const [avatar, setAvatar] = useState<AvatarConfig>({ ...DEFAULT_AVATAR });
  const [step, setStep] = useState(0);
  const C = outfits.colors;
  const patch = (p: Partial<AvatarConfig>) => setAvatar((a) => ({ ...a, ...p }));

  return (
    <Modal onClose={onClose} title={step === 0 ? 'Create a world' : 'Make your character'} size="wide">
      {step === 0 ? (
        <div className="col" style={{ gap: '1rem' }}>
          <div className="row wrap" style={{ gap: '1rem', alignItems: 'flex-start' }}>
            <label className="field grow" style={{ minWidth: 220 }}>
              World name
              <input className="input" value={name} maxLength={40} onChange={(e) => setName(e.target.value)} />
            </label>
            <label className="field grow" style={{ minWidth: 220 }}>
              Your nickname
              <input className="input" value={nickname} maxLength={20} onChange={(e) => setNickname(e.target.value.replace(/[^\w\- ]/g, ''))} />
              <small>🛡️ Use a fun nickname, never your real name.</small>
            </label>
          </div>
          <b>Choose a difficulty</b>
          <div className="difficulty-cards">
            <div className={`card difficulty-card ${difficulty === 'entry' ? 'on' : ''}`} role="button" tabIndex={0} onClick={() => setDifficulty('entry')}>
              <h3>🌱 Entry</h3>
              <b>Ages 6–13</b>
              <span className="small">Counting money, needs vs. wants, saving, earning, simple budgets, what banks and stocks are. Big buttons, pictures and lots of hints.</span>
            </div>
            <div className={`card difficulty-card ${difficulty === 'advanced' ? 'on' : ''}`} role="button" tabIndex={0} onClick={() => setDifficulty('advanced')}>
              <h3>🚀 Advanced</h3>
              <b>Ages 13–18</b>
              <span className="small">Compound interest, loans & amortization, credit scores, taxes, investing, P/E, retirement and business math. Real calculations with a calculator.</span>
            </div>
          </div>
          <span className="small muted">You can change difficulty later in Pause → World options.</span>
          <div className="row" style={{ justifyContent: 'flex-end' }}>
            <Button onClick={onClose}>Cancel</Button>
            <Button variant="primary" size="big" disabled={!name.trim() || !nickname.trim()} onClick={() => setStep(1)}>
              Next →
            </Button>
          </div>
        </div>
      ) : (
        <div className="row wrap" style={{ alignItems: 'flex-start', gap: '1.2rem' }}>
          <div style={{ width: 240, flexShrink: 0 }}>
            <AvatarPreview config={avatar} height={300} />
          </div>
          <div className="col grow" style={{ minWidth: 260, gap: '0.7rem' }}>
            <SwatchRow label="Skin" colors={C.skin} value={avatar.skin} onPick={(c) => patch({ skin: c })} />
            <SwatchRow label="Hair color" colors={C.hair} value={avatar.hair} onPick={(c) => patch({ hair: c })} />
            <div className="field">
              Hair style
              <div className="row wrap">
                {['Short', 'Long', 'Curly', 'Buzz', 'Bun', 'Spiky'].map((h, i) => (
                  <Button key={h} size="small" variant={avatar.hairStyle === i ? 'gold' : undefined} onClick={() => patch({ hairStyle: i })}>
                    {h}
                  </Button>
                ))}
              </div>
            </div>
            <SwatchRow label="Shirt" colors={C.shirt} value={avatar.shirt} onPick={(c) => patch({ shirt: c })} />
            <SwatchRow label="Pants" colors={C.pants} value={avatar.pants} onPick={(c) => patch({ pants: c })} />
            <SwatchRow label="Shoes" colors={C.shoes} value={avatar.shoes} onPick={(c) => patch({ shoes: c })} />
            <span className="small muted">Buy more outfits later at the Style Studio in Fin-City Park.</span>
            <div className="row" style={{ justifyContent: 'flex-end' }}>
              <Button onClick={() => setStep(0)}>← Back</Button>
              <Button variant="gold" size="big" onClick={() => onCreate({ name, nickname, difficulty, avatar })}>
                🌟 Start playing
              </Button>
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}

export function SwatchRow({ label, colors, value, onPick }: { label: string; colors: string[]; value: string; onPick: (c: string) => void }) {
  return (
    <div className="field">
      {label}
      <div className="swatches">
        {colors.map((c) => (
          <button
            key={c}
            type="button"
            aria-label={`${label} ${c}`}
            className={`swatch ${value === c ? 'on' : ''}`}
            style={{ background: c }}
            onClick={() => {
              playSfx('click');
              onPick(c);
            }}
          />
        ))}
      </div>
    </div>
  );
}
