'use client';
import { useState } from 'react';
import { useGame, act } from '@/store/game';
import { SECURITIES, SECURITY_BY_SYMBOL, peRatio, dividendYield } from '@/game/market/market';
import { buySecurity, sellSecurity } from '@/game/market/trade';
import { available } from '@/game/finance/accounts';
import { Button, ReadAloud } from '../common';
import { AmountPicker, Section, LineChart, Stat, StatGrid, Explain } from '../kit';
import { money, pct } from '../format';

function riskLabel(sigma: number, entry: boolean) {
  if (sigma < 0.08) return entry ? '🐢 Very steady' : 'Low risk';
  if (sigma < 0.2) return entry ? '🙂 Steady' : 'Moderate risk';
  if (sigma < 0.33) return entry ? '🎢 Bumpy' : 'Higher risk';
  return entry ? '🌪️ Wild!' : 'Very high risk';
}

export function TradePanel({ compact = false }: { compact?: boolean }) {
  const w = useGame((s) => s.world!);
  const entry = w.difficulty === 'entry';
  const [sym, setSym] = useState('FCX');
  const [amt, setAmt] = useState(0);
  const s = SECURITY_BY_SYMBOL.get(sym)!;
  const price = w.market.prices[sym];
  const hist = w.market.history[sym] ?? [price];
  const h = w.finance.holdings[sym];
  const pe = peRatio(w, sym);
  const yld = dividendYield(w, sym);
  const avail = available(w);
  // Simple moving average for Advanced
  const ma = hist.map((_, i) => {
    const sl = hist.slice(Math.max(0, i - 19), i + 1);
    return sl.reduce((a, b) => a + b, 0) / sl.length;
  });
  return (
    <Section title={compact ? '💹 Trade' : '💹 Buy & sell'} right={<ReadAloud text={entry ? s.entryBlurb : s.blurb} />}>
      <div className="trade-list">
        {SECURITIES.map((x) => {
          const hh = w.market.history[x.symbol] ?? [];
          const prev = hh[Math.max(0, hh.length - 22)] ?? x.price;
          const ch = w.market.prices[x.symbol] / prev - 1;
          return (
            <button key={x.symbol} className={`trade-item ${x.symbol === sym ? 'on' : ''}`} onClick={() => (setSym(x.symbol), setAmt(0))}>
              <span className="trade-icon">{x.icon}</span>
              <span className="col" style={{ gap: 0, alignItems: 'flex-start' }}>
                <b className="small">{x.symbol}</b>
                <span className="tiny muted">{x.kind === 'index' ? 'Index fund' : x.kind === 'bond' ? 'Bond fund' : x.sector}</span>
              </span>
              <span className="col" style={{ gap: 0, alignItems: 'flex-end', marginLeft: 'auto' }}>
                <span className="small mono">{money(w.market.prices[x.symbol])}</span>
                <span className={`tiny mono ${ch >= 0 ? 'good' : 'bad'}`}>{(ch * 100).toFixed(1)}%</span>
              </span>
            </button>
          );
        })}
      </div>
      <div className="card" style={{ marginTop: 10 }}>
        <div className="row between wrap">
          <b style={{ fontSize: '1.15rem' }}>
            {s.icon} {s.name} ({s.symbol})
          </b>
          <span className="mono big">{money(price)}</span>
        </div>
        <div className="small">{entry ? s.entryBlurb : s.blurb}</div>
        <LineChart
          height={140}
          series={[{ values: hist, color: '#2f6bdb' }, ...(entry ? [] : [{ values: ma, color: '#ff8a3d', dashed: true }])]}
        />
        {!entry && <div className="tiny muted">Blue: price (last {hist.length} trading days). Orange dashed: 20-day moving average.</div>}
        <StatGrid>
          <Stat label="Risk" value={riskLabel(s.sigma, entry)} />
          {!entry && <Stat label="P/E ratio" value={pe ? pe.toFixed(1) : '-'} sub={pe ? `EPS ${money(w.market.eps[sym])}` : 'Funds/bonds'} />}
          <Stat label={entry ? 'Pays you' : 'Dividend yield'} value={yld > 0 ? (entry ? 'a little, 4× a year' : pct(yld, 2)) : entry ? 'nothing (grows instead)' : '0%'} />
          {!entry && <Stat label="Beta" value={s.beta.toFixed(1)} sub={s.beta > 1 ? 'Swings more than the market' : s.beta < 1 ? 'Swings less than the market' : 'Moves with the market'} />}
          <Stat label="You own" value={h ? `${h.shares.toFixed(3)} sh` : '-'} sub={h ? `${money(h.shares * price)} (paid ${money(h.cost)})` : undefined} />
        </StatGrid>
        {!entry && (
          <Explain>
            P/E = price ÷ yearly earnings per share. Dividend yield = yearly dividend ÷ price. Beta compares a stock&apos;s swings to the whole market. Index funds spread your money over many companies (diversification). Bond funds fall when interest rates rise.
          </Explain>
        )}
        <AmountPicker max={avail} value={amt} onChange={setAmt} quick={[5, 10, 50, 100]} label="Invest" />
        <div className="row wrap" style={{ marginTop: 8 }}>
          <Button variant="green" disabled={amt < 1} onClick={() => (act((d, fx) => void buySecurity(d, fx, sym, amt)), setAmt(0))}>
            Buy {money(amt)}
          </Button>
          {h && (
            <>
              <Button onClick={() => act((d, fx) => void sellSecurity(d, fx, sym, 0.25))}>Sell 25%</Button>
              <Button onClick={() => act((d, fx) => void sellSecurity(d, fx, sym, 0.5))}>Sell half</Button>
              <Button variant="danger" onClick={() => act((d, fx) => void sellSecurity(d, fx, sym, 1))}>
                Sell all
              </Button>
            </>
          )}
        </div>
      </div>
      {!compact && w.market.news.length > 0 && (
        <div style={{ marginTop: 10 }}>
          <b>📰 Latest market news</b>
          {w.market.news.slice(0, 5).map((n, i) => (
            <div key={i} className="small" style={{ marginTop: 4 }}>
              {n.impact >= 0 ? '📈' : '📉'} {n.text}
            </div>
          ))}
        </div>
      )}
    </Section>
  );
}
