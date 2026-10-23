'use client';
import { useGame } from '@/store/game';
import { useUI } from '@/store/ui';
import { SECURITIES, SECURITY_BY_SYMBOL, peRatio } from '@/game/market/market';
import { portfolioValue } from '@/game/finance/netWorth';
import { Section, Pie, Stat, StatGrid, Empty, LineChart } from '../../kit';
import { money, pct } from '../../format';
import { Button } from '../../common';
import { TradePanel } from '../../services/TradePanel';

const PIE_COLORS = ['#2f6bdb', '#2ebaba', '#ffcf3f', '#e1553f', '#8a5cf6', '#3cc45a', '#f06aa8', '#ff8a3d', '#4a5672'];

export function PortfolioApp() {
  const w = useGame((s) => s.world!);
  const open = useUI((s) => s.open);
  const holdings = Object.entries(w.finance.holdings).filter(([, h]) => h.shares > 0);
  const value = portfolioValue(w);
  const cost = holdings.reduce((s, [, h]) => s + h.cost, 0);
  const entry = w.difficulty === 'entry';
  const retirement = w.finance.retirement;
  const fcx = w.market.history.FCX ?? [];
  return (
    <div>
      <StatGrid>
        <Stat icon="💹" label="Portfolio value" value={money(value)} />
        <Stat icon="📊" label="Total gain/loss" value={money(value - cost, { sign: true })} tone={value >= cost ? 'good' : 'bad'} sub={cost ? pct((value - cost) / cost) : undefined} />
        <Stat icon="🏖️" label="Retirement" value={money(retirement.balance)} sub={retirement.open ? `${(retirement.pct * 100).toFixed(0)}% of pay` : 'Not set up'} />
        <Stat icon="📈" label="Market mood" value={w.market.regime === 'bull' ? '🐂 Bull' : w.market.regime === 'bear' ? '🐻 Bear' : '😐 Normal'} sub={entry ? undefined : `Reserve rate ${pct(w.market.reserveRate, 2)}`} />
      </StatGrid>
      <Section title="Whole market (FCX index), recent days">
        <LineChart series={[{ values: fcx.slice(-80), color: '#2f6bdb' }]} height={110} />
      </Section>
      <Section title="Your investments">
        {holdings.length === 0 ? (
          <Empty icon="🌱">No investments yet. Visit the Brokerage in New York to buy your first share!</Empty>
        ) : (
          <div className="row wrap" style={{ gap: 14, alignItems: 'flex-start' }}>
            <Pie slices={holdings.map(([sym, h], i) => ({ label: sym, value: h.shares * w.market.prices[sym], color: PIE_COLORS[i % PIE_COLORS.length] }))} />
            <div className="col grow" style={{ gap: 6, minWidth: 260 }}>
              {holdings.map(([sym, h], i) => {
                const s = SECURITY_BY_SYMBOL.get(sym)!;
                const v = h.shares * w.market.prices[sym];
                const g = v - h.cost;
                const pe = peRatio(w, sym);
                return (
                  <div key={sym} className="card flat row between wrap">
                    <span>
                      <span style={{ color: PIE_COLORS[i % PIE_COLORS.length] }}>■</span> {s.icon} <b>{sym}</b> <span className="small muted">{s.name}</span>
                    </span>
                    <span className="small mono">
                      {h.shares.toFixed(3)} sh · {money(v)}{' '}
                      <b className={g >= 0 ? 'good' : 'bad'}>({money(g, { sign: true })})</b>
                      {!entry && pe && <span className="muted"> · P/E {pe.toFixed(1)}</span>}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </Section>
      {w.progress.flags.brokerageApp ? (
        <TradePanel compact />
      ) : (
        <p className="small muted">After your first trade at the New York Brokerage, you can trade from your phone too.</p>
      )}
      <Section title="All securities">
        <div className="col" style={{ gap: 4 }}>
          {SECURITIES.map((s) => {
            const hist = w.market.history[s.symbol] ?? [];
            const prev = hist[Math.max(0, hist.length - 22)] ?? s.price;
            const ch = w.market.prices[s.symbol] / prev - 1;
            return (
              <div key={s.symbol} className="row between small">
                <span>
                  {s.icon} <b>{s.symbol}</b> {s.name}
                </span>
                <span className="mono">
                  {money(w.market.prices[s.symbol])} <span className={ch >= 0 ? 'good' : 'bad'}>{(ch * 100).toFixed(1)}%</span>
                </span>
              </div>
            );
          })}
        </div>
        <div className="tiny muted">% change ≈ last month</div>
      </Section>
      <Button onClick={() => open({ type: 'service', id: 'retirement' })}>🏖️ Retirement account</Button>
    </div>
  );
}
