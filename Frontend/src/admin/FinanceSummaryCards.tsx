import type { FinanceSummary } from '../types';
import { formatPrice } from '../utils/currency';
import FinancePartFailed from './FinancePartFailed';

interface FinanceSummaryCardsProps {
  /** null when the summary could not be loaded */
  summary: FinanceSummary | null;
  currency?: string;
}

/** The four headline numbers, in the same cards as Reports. */
export default function FinanceSummaryCards({ summary, currency = 'ETB' }: FinanceSummaryCardsProps) {
  if (!summary) {
    return (
      <div className="rpt-panel" role="region" aria-label="Totals">
        <FinancePartFailed />
      </div>
    );
  }

  const money = (val: number) => formatPrice(val, currency);
  const totalLoss = summary.walkout_loss + summary.removed_loss;

  const cards: { title: string; value: string; hint: string; tone?: 'good' | 'warn' | 'bad' }[] = [
    { title: 'Total Revenue', value: money(summary.sales_total), hint: `${money(summary.confirmed)} confirmed` },
    { title: 'Total Collected', value: money(summary.collected), hint: 'Received by staff', tone: summary.collected > 0 ? 'good' : undefined },
    {
      title: 'Pending Confirmation',
      value: money(summary.collected_not_confirmed),
      hint: 'Collected, not yet confirmed',
      tone: summary.collected_not_confirmed > 0 ? 'warn' : undefined,
    },
    {
      title: 'Total Losses',
      value: money(totalLoss),
      hint: `Walkouts ${money(summary.walkout_loss)} · Dishes ${money(summary.removed_loss)}`,
      tone: totalLoss > 0 ? 'bad' : undefined,
    },
  ];

  return (
    <div className="rpt-kpis">
      {cards.map((c) => (
        <div key={c.title} className={`rpt-kpi ${c.tone ? `rpt-kpi-${c.tone}` : ''}`}>
          <span className="rpt-kpi-label">{c.title}</span>
          <strong className="rpt-kpi-value">{c.value}</strong>
          <span className="rpt-kpi-hint">{c.hint}</span>
        </div>
      ))}
    </div>
  );
}
