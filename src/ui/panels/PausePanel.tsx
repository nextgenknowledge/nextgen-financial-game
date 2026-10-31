'use client';
import { useState } from 'react';
import { useUI } from '@/store/ui';
import { useGame, act } from '@/store/game';
import { Button, Confirm, Modal, Toggle } from '../common';
import { SettingsModal } from '../SettingsModal';
import { quitToWorlds, saveNow } from '../startWorld';
import { downloadText, setGlobal } from '@/save/db';
import { FEEDBACK_FORM } from '../hud/RatingPrompt';
import { exportFileName, serializeWorld } from '@/save/format';
import { capture } from '../startWorld';
import { buildTeacherReport } from '@/game/progress/report';
import type { Difficulty } from '@/game/types';

export function PausePanel() {
  const close = useUI((s) => s.close);
  const open = useUI((s) => s.open);
  const world = useGame((s) => s.world)!;
  const [settings, setSettings] = useState(false);
  const [quit, setQuit] = useState(false);
  const [diff, setDiff] = useState<Difficulty | null>(null);
  const [withNick, setWithNick] = useState(false);
  const pushToast = useUI((s) => s.pushToast);
  return (
    <Modal onClose={close} title="⏸️ Paused">
      <div className="col" style={{ gap: '0.7rem' }}>
        <Button variant="primary" size="big" block onClick={close}>
          ▶ Resume
        </Button>
        <div className="row" style={{ gap: '0.6rem' }}>
          <Button block onClick={() => setSettings(true)}>
            ⚙️ Settings
          </Button>
          <Button block onClick={() => open({ type: 'learn' })}>
            📚 Learn menu
          </Button>
        </div>
        <div className="card flat col" style={{ gap: '0.5rem' }}>
          <b>World options · {world.name}</b>
          <div className="row between wrap">
            <span className="small">Difficulty</span>
            <Toggle
              value={world.difficulty}
              options={[
                { value: 'entry', label: '🌱 Entry (6–13)' },
                { value: 'advanced', label: '🚀 Advanced (13–18)' },
              ]}
              onChange={(v) => v !== world.difficulty && setDiff(v)}
            />
          </div>
          <div className="row wrap" style={{ gap: '0.5rem' }}>
            <Button
              size="small"
              onClick={async () => {
                await saveNow(true);
                pushToast({ text: 'Game saved!', icon: '💾', tone: 'good' });
              }}
            >
              💾 Save now
            </Button>
            <Button
              size="small"
              onClick={async () => {
                await saveNow(false);
                const w = useGame.getState().world!;
                let thumb: string | null = null;
                try {
                  thumb = capture.fn?.() ?? null;
                } catch {
                  thumb = null;
                }
                downloadText(exportFileName(w), serializeWorld(w, thumb));
              }}
            >
              📤 Export world
            </Button>
            <Button
              size="small"
              onClick={() => {
                const w = useGame.getState().world!;
                const { html } = buildTeacherReport(w, { includeNickname: withNick });
                downloadText(`fin-city-report-${new Date().toISOString().slice(0, 10)}.html`, html, 'text/html');
              }}
            >
              🍎 Teacher/parent report
            </Button>
            <a className="btn small gold" href={FEEDBACK_FORM} target="_blank" rel="noopener noreferrer" onClick={() => setGlobal('ratingPrompt', 'rated').catch(() => {})}>
              ⭐ Rate & review
            </a>
            <label className="tiny row" style={{ gap: 4, alignItems: 'center' }}>
              <input type="checkbox" checked={withNick} onChange={(e) => setWithNick(e.target.checked)} /> include nickname in report
            </label>
          </div>
        </div>
        <Button variant="danger" block onClick={() => setQuit(true)}>
          🚪 Save & quit to worlds
        </Button>
      </div>
      {settings && <SettingsModal onClose={() => setSettings(false)} />}
      {quit && (
        <Confirm
          title="Quit to worlds?"
          text="Your world will be saved first."
          confirmLabel="Save & quit"
          onCancel={() => setQuit(false)}
          onConfirm={() => quitToWorlds()}
        />
      )}
      {diff && (
        <Confirm
          title={`Switch to ${diff === 'entry' ? 'Entry' : 'Advanced'}?`}
          text={
            diff === 'advanced'
              ? 'Advanced adds credit cards, credit scores, taxes, P/E ratios, amortization and harder questions with a calculator. Your money and progress stay the same.'
              : 'Entry uses simpler questions, bigger hints and turns off credit cards, taxes and credit scores. Your money and progress stay the same.'
          }
          confirmLabel="Switch"
          onCancel={() => setDiff(null)}
          onConfirm={() => {
            act((w) => {
              w.difficulty = diff;
              if (diff === 'entry') {
                // Fold Advanced-only balances into simple ones so nothing is lost
                if (w.finance.card.balance > 0) w.finance.loans.push({ id: `conv_${Date.now()}`, kind: 'personal', name: 'Card balance (converted)', principal: w.finance.card.balance, balance: w.finance.card.balance, apr: 0, termMonths: 6, payment: Math.ceil(w.finance.card.balance / 6), monthsPaid: 0, startMonth: w.time.month, missed: 0 });
                w.finance.card = { ...w.finance.card, open: false, balance: 0 };
              }
            });
            // A paused activity belongs to the old difficulty's building
            useUI.getState().setRun(null);
            setDiff(null);
            pushToast({ text: `Difficulty: ${diff === 'entry' ? 'Entry' : 'Advanced'}`, icon: '🔁', tone: 'good' });
          }}
        />
      )}
    </Modal>
  );
}
