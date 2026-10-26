'use client';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { DEFAULT_AVATAR } from '@/game/world';
import type { AvatarConfig, Difficulty } from '@/game/types';
import { playSfx } from '@/engine/audio';
import { AvatarPreview } from '../AvatarPreview';
import outfits from '@/data/shop/outfits.json';

/*
 * Starting a new game, in three steps on the title screen:
 *   1. Name your game (and pick a nickname)
 *   2. Choose your level (Entry or Advanced)
 *   3. Make your character
 */

export type NewGameOptions = { name: string; nickname: string; difficulty: Difficulty; avatar: AvatarConfig };

const NAME_MAX = 40;
const FUN_NICKS = ['CoinCaptain', 'PennyPilot', 'SavvySaver', 'BudgetBoss', 'StockStar', 'NickelNinja', 'DimeDiver'];

/** A dark pixel panel with a title and a Back button (the old title screen's panel). */
export function StartPanel({ title, onBack, wide, children }: { title: string; onBack: () => void; wide?: boolean; children: ReactNode }) {
  return (
    <div className={`st-panel st-panel-in ${wide ? 'wide' : ''}`}>
      <div className="st-panel-head">
        <h2 className="st-heading">{title}</h2>
        <button type="button" className="st-small" onClick={onBack}>
          ◀ Back
        </button>
      </div>
      {children}
    </div>
  );
}

export function NewGameFlow({ onCancel, onCreate }: { onCancel: () => void; onCreate: (o: NewGameOptions) => void }) {
  const [step, setStep] = useState<'name' | 'level' | 'look'>('name');
  const [name, setName] = useState('');
  const [nickname, setNickname] = useState(() => FUN_NICKS[Math.floor(Math.random() * FUN_NICKS.length)] + Math.floor(Math.random() * 90 + 10));
  const [difficulty, setDifficulty] = useState<Difficulty>('entry');
  const [avatar, setAvatar] = useState<AvatarConfig>({ ...DEFAULT_AVATAR });
  const nameInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (step === 'name') nameInput.current?.focus();
  }, [step]);

  // Escape steps back.
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (step === 'name') onCancel();
      else setStep(step === 'look' ? 'level' : 'name');
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [step, onCancel]);

  const ready = name.trim().length > 0 && nickname.trim().length > 0;

  return (
    <div className="st-overlay">
      {step === 'name' && (
        <StartPanel title="New Game" onBack={onCancel}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!ready) return nameInput.current?.focus();
              playSfx('pop');
              setStep('level');
            }}
          >
            <label className="st-label" htmlFor="st-game-name">
              Name your game
            </label>
            <input
              id="st-game-name"
              ref={nameInput}
              className="st-input"
              value={name}
              maxLength={NAME_MAX}
              placeholder="e.g. Maya's Money Empire"
              autoComplete="off"
              onChange={(e) => setName(e.target.value.slice(0, NAME_MAX))}
            />
            <div className="st-note row between">
              <span>Every game is saved on its own, so your other games stay safe.</span>
              <span>
                {name.length}/{NAME_MAX}
              </span>
            </div>

            <label className="st-label" htmlFor="st-nickname" style={{ marginTop: '1rem' }}>
              Your nickname
            </label>
            <input
              id="st-nickname"
              className="st-input"
              value={nickname}
              maxLength={20}
              autoComplete="off"
              onChange={(e) => setNickname(e.target.value.replace(/[^\w\- ]/g, ''))}
            />
            <div className="st-note">Use a fun nickname, never your real name.</div>

            <div className="st-perks" aria-label="What you can do in Fin City">
              {[
                ['🏠', 'Own a home', 'and decorate it'],
                ['🐶', 'Adopt a pet', 'that follows you'],
                ['🛵', 'Ride & drive', 'bikes to sports cars'],
                ['👕', 'Style your look', 'from basics to legendary'],
              ].map(([icon, title, sub]) => (
                <div key={title} className="st-perk">
                  <span className="st-perk-icon">{icon}</span>
                  <b>{title}</b>
                  <span>{sub}</span>
                </div>
              ))}
            </div>
            <div className="st-note">Every shop has one starter deal, so you can try them all early.</div>

            <button type="submit" className="st-big gold" disabled={!ready}>
              Next: choose your level ▶
            </button>
          </form>
        </StartPanel>
      )}

      {step === 'level' && (
        <LevelPicker
          title={name.trim()}
          value={difficulty}
          onChange={setDifficulty}
          onChoose={(d) => {
            setDifficulty(d);
            setStep('look');
          }}
          onBack={() => setStep('name')}
          goLabel="Next: make your character ▶"
        />
      )}

      {step === 'look' && (
        <StartPanel title="Make your character" onBack={() => setStep('level')} wide>
          <div className="st-look">
            <div className="st-look-preview">
              <AvatarPreview config={avatar} height={300} />
            </div>
            <div className="st-look-options">
              <AvatarOptions avatar={avatar} onChange={setAvatar} dark />
              <span className="st-note">You can buy more outfits later at the Style Studio in Fin-City Park.</span>
              <button type="button" className="st-big gold" onClick={() => onCreate({ name: name.trim(), nickname: nickname.trim(), difficulty, avatar })}>
                Start adventure ▶
              </button>
            </div>
          </div>
        </StartPanel>
      )}
    </div>
  );
}

/* ---------- Level picker ---------- */

export const LEVELS: Record<Difficulty, { label: string; ages: string; blurb: string; sample: { q: string; a: string } }> = {
  entry: {
    label: 'Entry',
    ages: 'Ages 6 to 13',
    blurb: 'Counting money, needs and wants, saving, earning, simple budgets, and what banks and stocks are. Big buttons, pictures and lots of hints.',
    sample: { q: 'What is a share of stock?', a: 'A small piece of ownership in a company.' },
  },
  advanced: {
    label: 'Advanced',
    ages: 'Ages 13 to 18',
    blurb: 'Compound interest, loans, credit scores, taxes, investing, P/E ratios, retirement and business math. Real calculations with a calculator.',
    sample: { q: 'A stock trades at $60 with earnings of $3 a share. What is its P/E ratio?', a: '20: investors pay $20 for each $1 of yearly earnings.' },
  },
};

const ORDER: Difficulty[] = ['entry', 'advanced'];

/** Two big cards to pick Entry or Advanced. Arrow keys switch, Enter picks. */
export function LevelPicker({
  title,
  value,
  onChange,
  onChoose,
  onBack,
  goLabel,
}: {
  title: string;
  value: Difficulty;
  onChange: (d: Difficulty) => void;
  onChoose: (d: Difficulty) => void;
  onBack: () => void;
  goLabel?: string;
}) {
  useEffect(() => {
    (document.activeElement as HTMLElement | null)?.blur?.();
  }, []);

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (['ArrowLeft', 'ArrowRight', 'a', 'd'].includes(e.key)) {
        e.preventDefault();
        playSfx('click');
        onChange(value === 'entry' ? 'advanced' : 'entry');
      } else if (e.key === 'Enter') {
        e.preventDefault();
        onChoose(value);
      }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [value, onChange, onChoose]);

  return (
    <div className="st-panel st-panel-in wide">
      <div className="st-panel-head">
        <div>
          {title && <div className="st-kicker">{title}</div>}
          <h2 className="st-heading">Choose your level</h2>
          <p className="st-text">Every quiz, quest and challenge matches the level you pick. You can change it later in Pause, World options.</p>
        </div>
        <button type="button" className="st-small" onClick={onBack}>
          ◀ Back
        </button>
      </div>

      <div className="st-levels" role="radiogroup" aria-label="Level">
        {ORDER.map((d) => {
          const info = LEVELS[d];
          const on = value === d;
          return (
            <button
              key={d}
              type="button"
              role="radio"
              aria-checked={on}
              className={`st-level ${d} ${on ? 'on' : ''}`}
              onClick={() => {
                playSfx('click');
                onChange(d);
              }}
              onDoubleClick={() => onChoose(d)}
            >
              <div className="st-level-top">
                <span className={`st-level-badge ${d}`} aria-hidden>
                  {d === 'entry' ? <EntryIcon /> : <AdvancedIcon />}
                </span>
                <div>
                  <div className="st-level-name">{info.label}</div>
                  <div className="st-level-ages">{info.ages}</div>
                </div>
                <span className="st-check" aria-hidden>
                  {on ? '✓' : ''}
                </span>
              </div>
              <p className="st-level-blurb">{info.blurb}</p>
              <div className="st-sample">
                <div className="st-sample-tag">Sample question</div>
                <div className="st-sample-q">{info.sample.q}</div>
                <div className="st-sample-a">→ {info.sample.a}</div>
              </div>
            </button>
          );
        })}
      </div>

      <button type="button" className="st-big gold" onClick={() => onChoose(value)}>
        {goLabel ?? `Play on ${LEVELS[value].label} ▶`}
      </button>
      <div className="st-note center">← → to switch · Enter to pick</div>
    </div>
  );
}

/* Small pixel drawings for the level cards (no emoji in the UI). */
function EntryIcon() {
  // A sprout
  return (
    <svg viewBox="0 0 16 16" width="40" height="40" shapeRendering="crispEdges">
      <rect x="7" y="7" width="2" height="7" fill="#1a7a37" />
      <rect x="3" y="4" width="4" height="2" fill="#7ee08f" />
      <rect x="2" y="5" width="2" height="2" fill="#7ee08f" />
      <rect x="4" y="6" width="3" height="2" fill="#3cc45a" />
      <rect x="9" y="3" width="4" height="2" fill="#7ee08f" />
      <rect x="12" y="4" width="2" height="2" fill="#7ee08f" />
      <rect x="9" y="5" width="3" height="2" fill="#3cc45a" />
      <rect x="4" y="13" width="8" height="2" fill="#8a5a2b" />
    </svg>
  );
}

function AdvancedIcon() {
  // A rising chart
  return (
    <svg viewBox="0 0 16 16" width="40" height="40" shapeRendering="crispEdges">
      <rect x="2" y="2" width="1" height="12" fill="#ffffff" />
      <rect x="2" y="13" width="12" height="1" fill="#ffffff" />
      <rect x="4" y="10" width="2" height="3" fill="#ffd23f" />
      <rect x="7" y="8" width="2" height="5" fill="#ffd23f" />
      <rect x="10" y="5" width="2" height="8" fill="#ffd23f" />
      <rect x="10" y="2" width="4" height="1" fill="#7ee8ff" />
      <rect x="13" y="2" width="1" height="3" fill="#7ee8ff" />
    </svg>
  );
}

/* ---------- Character options ---------- */

export function AvatarOptions({ avatar, onChange, dark }: { avatar: AvatarConfig; onChange: (a: AvatarConfig) => void; dark?: boolean }) {
  const C = outfits.colors;
  const patch = (p: Partial<AvatarConfig>) => onChange({ ...avatar, ...p });
  return (
    <div className={`col ${dark ? 'st-swatch-dark' : ''}`} style={{ gap: '0.7rem' }}>
      <SwatchRow label="Skin" colors={C.skin} value={avatar.skin} onPick={(c) => patch({ skin: c })} />
      <SwatchRow label="Hair color" colors={C.hair} value={avatar.hair} onPick={(c) => patch({ hair: c })} />
      <div className="field">
        Hair style
        <div className="row wrap">
          {['Short', 'Long', 'Curly', 'Buzz', 'Bun', 'Spiky'].map((h, i) => (
            <button
              key={h}
              type="button"
              className={`st-chip ${avatar.hairStyle === i ? 'on' : ''}`}
              onClick={() => {
                playSfx('click');
                patch({ hairStyle: i });
              }}
            >
              {h}
            </button>
          ))}
        </div>
      </div>
      <SwatchRow label="Shirt" colors={C.shirt} value={avatar.shirt} onPick={(c) => patch({ shirt: c })} />
      <SwatchRow label="Pants" colors={C.pants} value={avatar.pants} onPick={(c) => patch({ pants: c })} />
      <SwatchRow label="Shoes" colors={C.shoes} value={avatar.shoes} onPick={(c) => patch({ shoes: c })} />
    </div>
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
