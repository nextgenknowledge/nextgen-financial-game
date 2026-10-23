'use client';
import { useGame } from '@/store/game';
import { Section, Stat, StatGrid, Explain } from '../../kit';
import { money, pct } from '../../format';
import { BRACKETS, STANDARD_DEDUCTION, bracketTax, marginalRate } from '@/game/finance/tax';

export function TaxesApp() {
  const w = useGame((s) => s.world!);
  const t = w.finance.tax;
  const year = Math.floor(w.time.month / 12) + 1;
  const projected = (t.ytdGross + t.ytdOther) * (12 / Math.max(1, (w.time.month % 12) + w.time.t));
  const taxable = Math.max(0, projected - STANDARD_DEDUCTION);
  return (
    <div>
      <StatGrid>
        <Stat icon="💼" label={`Year ${year} wages so far`} value={money(t.ytdGross)} />
        <Stat icon="🏛️" label="Federal tax withheld" value={money(t.ytdWithheld)} />
        <Stat icon="🧓" label="Social Security + Medicare" value={money(t.ytdFica)} />
        <Stat icon="🏙️" label="City tax" value={money(t.ytdCity)} />
        <Stat icon="📈" label="Other income (no withholding)" value={money(t.ytdOther)} sub="Interest, dividends, business, rent, gains" />
      </StatGrid>
      <Section title="Tax forms">
        {t.w2s.length === 0 ? (
          <p className="small muted">Your first FC-W2 arrives after December. File at the San Francisco Tax Office between January and April.</p>
        ) : (
          t.w2s.map((x) => (
            <div key={x.year} className="card flat row between wrap" style={{ marginBottom: 6 }}>
              <b>📄 FC-W2 · Year {x.year}</b>
              <span className="small mono">
                Wages {money(x.gross)} · Withheld {money(x.withheld)} · Other {money(x.other)}
              </span>
              <span className={`chip ${t.filed.includes(x.year) ? 'good' : 'gold'}`}>{t.filed.includes(x.year) ? 'Filed ✓' : 'Not filed'}</span>
            </div>
          ))
        )}
      </Section>
      <Section title="Fin City tax brackets (single filer)">
        <table className="kit-table">
          <thead>
            <tr>
              <th>Taxable income</th>
              <th>Rate</th>
            </tr>
          </thead>
          <tbody>
            {BRACKETS.map((b, i) => (
              <tr key={i} className={marginalRate(taxable) === b.rate ? 'hl' : ''}>
                <td>
                  {money(i === 0 ? 0 : BRACKETS[i - 1].upTo, { cents: false })} – {b.upTo === Infinity ? 'and up' : money(b.upTo, { cents: false })}
                </td>
                <td>{pct(b.rate, 0)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="small">
          At your pace this year (~{money(projected, { cents: false })}), your taxable income would be ~{money(taxable, { cents: false })}: marginal rate <b>{pct(marginalRate(taxable), 0)}</b>, effective rate{' '}
          <b>{pct(projected ? bracketTax(taxable) / projected : 0, 1)}</b>.
        </p>
        <Explain title="Marginal vs. effective rate">
          Each bracket&apos;s rate only applies to the dollars <i>inside</i> that bracket. Your marginal rate is the rate on your last dollar; your effective rate is total tax ÷ total income, always lower. That&apos;s why a raise can never make you take home less.
        </Explain>
      </Section>
    </div>
  );
}
