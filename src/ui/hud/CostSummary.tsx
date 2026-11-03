'use client';
import { useUI } from '@/store/ui';
import { Button, Modal } from '../common';

const money = (x: number) => `$${x.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** Shows the full cost of a financed purchase or a pet right after buying it. */
export function CostSummaryCard() {
  const s = useUI((u) => u.costSummary);
  const close = () => useUI.setState({ costSummary: null });
  if (!s) return null;
  return (
    <Modal onClose={close} title="What this really cost" subtitle={s.name}>
      <div className="cost-rows">
        {s.rows.map((r) => (
          <div key={r.label} className={r.strong ? 'cost-row strong' : 'cost-row'}>
            <span>{r.label}</span>
            <span>{money(r.amount)}</span>
          </div>
        ))}
      </div>
      <p className="small" style={{ marginTop: 0 }}>{s.note}</p>
      <Button variant="primary" onClick={close}>Got it</Button>
    </Modal>
  );
}
