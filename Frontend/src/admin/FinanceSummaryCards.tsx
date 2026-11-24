import { DollarSign, CheckCircle2, Clock, AlertOctagon } from 'lucide-react';
import type { FinanceSummary } from '../types';
import { formatPrice } from '../utils/currency';

interface FinanceSummaryCardsProps {
  summary: FinanceSummary;
  currency?: string;
}

export default function FinanceSummaryCards({ summary, currency = 'ETB' }: FinanceSummaryCardsProps) {
  const money = (val: number) => formatPrice(val, currency);
  const totalLoss = summary.walkout_loss + summary.removed_loss;

  const cards = [
    {
      title: 'Total Revenue',
      value: money(summary.sales_total),
      subtitle: `${money(summary.confirmed)} confirmed`,
      icon: DollarSign,
      color: '#10b981',
      bg: 'rgba(16, 185, 129, 0.1)',
    },
    {
      title: 'Total Collected',
      value: money(summary.collected),
      subtitle: 'Received by staff',
      icon: CheckCircle2,
      color: '#3b82f6',
      bg: 'rgba(59, 130, 246, 0.1)',
    },
    {
      title: 'Pending Confirmation',
      value: money(summary.collected_not_confirmed),
      subtitle: 'With waiters on floor',
      icon: Clock,
      color: '#f59e0b',
      bg: 'rgba(245, 158, 11, 0.1)',
    },
    {
      title: 'Total Losses',
      value: money(totalLoss),
      subtitle: `Walkouts: ${money(summary.walkout_loss)} · Dishes: ${money(summary.removed_loss)}`,
      icon: AlertOctagon,
      color: '#ef4444',
      bg: 'rgba(239, 68, 68, 0.1)',
    },
  ];

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
      {cards.map((c) => {
        const Icon = c.icon;
        return (
          <div
            key={c.title}
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '16px',
              border: '1px solid #e2e8f0',
              padding: '18px 20px',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '13px', fontWeight: 600, color: '#64748b' }}>{c.title}</span>
              <div
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '10px',
                  backgroundColor: c.bg,
                  color: c.color,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Icon size={18} />
              </div>
            </div>
            <div style={{ fontSize: '22px', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.5px' }}>
              {c.value}
            </div>
            <div style={{ fontSize: '12px', color: '#64748b' }}>
              {c.subtitle}
            </div>
          </div>
        );
      })}
    </div>
  );
}
