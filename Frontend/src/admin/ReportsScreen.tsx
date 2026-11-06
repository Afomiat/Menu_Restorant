import { useEffect, useState, type ReactNode } from 'react';
import type { DailyReport } from '../types';
import { fetchDailyReport } from '../services/problemService';
import { formatPrice } from '../utils/currency';
import { todayInEthiopia } from '../utils/kitchenTimer';
import { t } from '../i18n/en';

/** The manager's daily report (Pro): sales, waiters, losses, kitchen times and open bills. */
export default function ReportsScreen({ currency = 'ETB' }: { currency?: string }) {
  const [date, setDate] = useState(todayInEthiopia());
  const [report, setReport] = useState<DailyReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const money = (v: number) => formatPrice(v, currency);

  useEffect(() => {
    fetchDailyReport(date)
      .then((r) => {
        setReport(r);
        setError(null);
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Failed to load the report'));
  }, [date]);

  return (
    <section className="admin-kitchen-page-view" aria-label={t.reports.title}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', marginBottom: '16px' }}>
        <h1 className="admin-top-title" style={{ margin: 0 }}>{t.reports.title}</h1>
        <label className="admin-input-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          {t.reports.date}
          <input type="date" className="admin-input-control" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} />
        </label>
      </div>
      {error && <p role="status" style={{ color: '#dc2626', fontSize: '13px' }}>{error}</p>}

      {report && (
        <div style={{ display: 'grid', gap: '20px' }}>
          <Section title={t.reports.sales}>
            <Table
              rows={report.sales_by_method.map((m) => [t.bills.methods[m.method], String(m.payments), money(m.amount)])}
              footer={[t.reports.salesTotal, '', money(report.sales_total)]}
            />
          </Section>

          <Section title={t.reports.waiters}>
            <Table
              head={t.reports.waiterColumns}
              rows={report.waiters.map((w) => [
                w.waiter_name || t.reports.noWaiter,
                String(w.bills),
                money(w.sales),
                money(w.collected),
                money(w.confirmed),
                money(w.collected_not_confirmed),
                String(w.walkouts),
              ])}
            />
          </Section>

          <Section title={t.reports.losses}>
            <h3 style={{ fontSize: '13px', margin: '0 0 4px' }}>{t.reports.walkouts}</h3>
            <Table
              rows={report.walkouts.map((w) => [
                t.walkouts.summary(w.table_number, money(w.amount), w.waiter_name),
                w.decision ? t.walkouts.decisions[w.decision] : '—',
                w.note,
              ])}
            />
            <h3 style={{ fontSize: '13px', margin: '10px 0 4px' }}>{t.reports.removed}</h3>
            <Table
              rows={report.removed_dishes.map((p) => [
                `${t.kitchen.table(p.table_number)}: ${p.quantity}× ${p.item_name}`,
                money(p.removed_amount || 0),
                p.fault ? t.problems.faults[p.fault] : '—',
              ])}
            />
          </Section>

          <Section title={t.reports.kitchen}>
            <Table
              head={t.reports.kitchenColumns}
              rows={report.kitchen.map((k) => [
                k.item_name,
                String(k.orders),
                t.reports.minutes(k.avg_minutes),
                t.reports.minutes(k.target_minutes),
                String(k.late),
              ])}
            />
          </Section>

          <Section title={t.reports.openBills}>
            <Table
              rows={report.open_bills.map((b) => [
                t.kitchen.table(b.table_number),
                t.bills.status[b.status],
                b.waiter_name || t.reports.noWaiter,
                money(b.total_amount - b.amount_paid),
              ])}
            />
          </Section>
        </div>
      )}
    </section>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div aria-label={title} role="region">
      <h2 style={{ fontSize: '15px', margin: '0 0 8px', color: '#334155' }}>{title}</h2>
      {children}
    </div>
  );
}

function Table({ head, rows, footer }: { head?: string[]; rows: string[][]; footer?: string[] }) {
  if (rows.length === 0) return <p style={{ color: '#94a3b8', fontSize: '13px', margin: 0 }}>{t.reports.nothing}</p>;
  const cell = { padding: '6px 10px', borderBottom: '1px solid #e2e8f0', textAlign: 'left' as const, fontSize: '13px' };
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ borderCollapse: 'collapse', width: '100%', background: '#fff' }}>
        {head && (
          <thead>
            <tr>
              {head.map((h) => (
                <th key={h} style={{ ...cell, color: '#64748b' }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
        )}
        <tbody>
          {rows.map((row, i) => (
            <tr key={i}>
              {row.map((c, j) => (
                <td key={j} style={cell}>
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
        {footer && (
          <tfoot>
            <tr>
              {footer.map((c, j) => (
                <td key={j} style={{ ...cell, fontWeight: 800 }}>
                  {c}
                </td>
              ))}
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}
