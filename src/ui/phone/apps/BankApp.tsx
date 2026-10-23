'use client';
import { useState } from 'react';
import { useGame } from '@/store/game';
import { Tabs, Section } from '../../kit';
import { AccountsSummary, TransferForm, CDsPanel, LoansPanel, CardPanel, LedgerList, MonthHistory } from '../../services/bankParts';

export function BankApp() {
  const f = useGame((s) => s.world!.finance);
  const [tab, setTab] = useState<'accounts' | 'cds' | 'loans' | 'history'>('accounts');
  return (
    <div>
      <AccountsSummary />
      {!f.hasChecking && !f.hasSavings ? (
        <p className="card tint-gold" style={{ marginTop: 12 }}>
          🏦 You don&apos;t have a bank account yet. Visit the <b>Fin City Bank</b> teller in the park to open one.
        </p>
      ) : (
        <>
          <div style={{ height: 12 }} />
          <Tabs
            value={tab}
            onChange={setTab}
            tabs={[
              { id: 'accounts', label: '↔️ Transfer' },
              { id: 'cds', label: '🔒 CDs' },
              { id: 'loans', label: '📝 Loans & card' },
              { id: 'history', label: '🧾 History' },
            ]}
          />
          {tab === 'accounts' && (
            <>
              <TransferForm allowCash={false} />
              <p className="tiny muted">Mobile banking moves money between accounts. To deposit or withdraw cash, use an ATM or the bank teller.</p>
            </>
          )}
          {tab === 'cds' && <CDsPanel />}
          {tab === 'loans' && (
            <>
              <CardPanel />
              <LoansPanel />
            </>
          )}
          {tab === 'history' && (
            <>
              <Section title="Monthly reports">
                <MonthHistory />
              </Section>
              <Section title="Recent transactions">
                <LedgerList />
              </Section>
            </>
          )}
        </>
      )}
    </div>
  );
}
