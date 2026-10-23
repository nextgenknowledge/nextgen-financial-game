'use client';
import { useGame } from '@/store/game';
import { Section, Empty, Stat, StatGrid } from '../../kit';
import { HEADLINES } from '@/game/market/market';
import { monthLabel } from '@/game/world';
import { pct } from '../../format';

export function NewsApp() {
  const w = useGame((s) => s.world!);
  const entry = w.difficulty === 'entry';
  const m = w.market;
  return (
    <div>
      <StatGrid>
        <Stat label="Market" value={m.regime === 'bull' ? '🐂 Bull market' : m.regime === 'bear' ? '🐻 Bear market' : '😐 Normal'} sub={entry ? undefined : 'Bull = rising, bear = falling'} />
        <Stat label={entry ? 'Prices going up' : 'Inflation (yearly)'} value={pct(m.inflation, 1)} />
        {!entry && <Stat label="Reserve interest rate" value={pct(m.reserveRate, 2)} sub="Sets savings & loan rates" />}
        <Stat label={entry ? 'Things cost' : 'Price level since start'} value={`${((m.priceIndex - 1) * 100).toFixed(1)}% more`} />
      </StatGrid>
      <Section title="📰 Fin City Financial News">
        {m.news.length === 0 ? (
          <Empty icon="📰">No big news yet. Headlines appear as the market moves.</Empty>
        ) : (
          m.news.map((n, i) => {
            const h = HEADLINES.find((x) => x.id === n.id);
            return (
              <div key={i} className="card flat" style={{ marginBottom: 6 }}>
                <div className="row between">
                  <b>
                    {n.impact > 0.005 ? '📈' : n.impact < -0.005 ? '📉' : '➖'} {entry && h ? h.entryText : n.text}
                  </b>
                  <span className="tiny muted">{monthLabel(n.month)}</span>
                </div>
                {h && <div className="small muted">Why it matters: {h.why}</div>}
                <div className="tiny">Affects: {n.symbols.join(', ') || '-'}</div>
              </div>
            );
          })
        )}
      </Section>
    </div>
  );
}
