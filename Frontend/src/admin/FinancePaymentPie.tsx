import type { PaymentMethod } from '../types';
import { formatPrice } from '../utils/currency';

interface MethodTotal {
  method: PaymentMethod;
  payments: number;
  amount: number;
}

interface FinancePaymentPieProps {
  methods: MethodTotal[];
  walkoutLoss: number;
  removedLoss: number;
  currency?: string;
}

export default function FinancePaymentPie({
  methods,
  walkoutLoss,
  removedLoss,
  currency = 'ETB',
}: FinancePaymentPieProps) {
  const money = (val: number) => formatPrice(val, currency);

  const methodColors: Record<PaymentMethod, string> = {
    cash: '#10b981',
    telebirr: '#0284c7',
    cbe_birr_bank: '#8b5cf6',
  };

  const methodLabels: Record<PaymentMethod, string> = {
    cash: 'Cash',
    telebirr: 'Telebirr',
    cbe_birr_bank: 'CBE Birr',
  };

  const totalPayments = methods.reduce((acc, m) => acc + m.amount, 0);
  const totalVolume = totalPayments + walkoutLoss + removedLoss;

  return (
    <div
      style={{
        backgroundColor: '#ffffff',
        borderRadius: '16px',
        border: '1px solid #e2e8f0',
        padding: '20px',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
        flex: 1,
      }}
    >
      <div>
        <h2 style={{ fontSize: '15px', fontWeight: 700, margin: 0, color: '#0f172a' }}>Payment Breakdown</h2>
        <span style={{ fontSize: '12px', color: '#64748b' }}>Collections by payment channel</span>
      </div>

      {totalVolume === 0 ? (
        <div style={{ padding: '30px 0', textAlign: 'center', color: '#94a3b8', fontSize: '13px' }}>
          No payment transactions in this period.
        </div>
      ) : (
        <>
          {/* Multi-segment stacked bar */}
          <div style={{ height: '14px', borderRadius: '7px', display: 'flex', overflow: 'hidden', backgroundColor: '#f1f5f9' }}>
            {methods.map((m) => {
              const pct = (m.amount / totalVolume) * 100;
              if (pct <= 0) return null;
              return (
                <div
                  key={m.method}
                  style={{
                    width: `${pct}%`,
                    backgroundColor: methodColors[m.method] || '#64748b',
                    transition: 'width 0.3s ease',
                  }}
                  title={`${methodLabels[m.method]}: ${money(m.amount)} (${pct.toFixed(1)}%)`}
                />
              );
            })}
            {walkoutLoss > 0 && (
              <div
                style={{ width: `${(walkoutLoss / totalVolume) * 100}%`, backgroundColor: '#ef4444' }}
                title={`Walkouts: ${money(walkoutLoss)}`}
              />
            )}
            {removedLoss > 0 && (
              <div
                style={{ width: `${(removedLoss / totalVolume) * 100}%`, backgroundColor: '#f97316' }}
                title={`Removed dishes: ${money(removedLoss)}`}
              />
            )}
          </div>

          {/* Detailed legend list */}
          <div style={{ display: 'grid', gap: '10px' }}>
            {methods.map((m) => {
              const pct = totalVolume > 0 ? ((m.amount / totalVolume) * 100).toFixed(1) : '0';
              return (
                <div key={m.method} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '13px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ width: '10px', height: '10px', borderRadius: '3px', backgroundColor: methodColors[m.method] || '#64748b' }} />
                    <span style={{ color: '#334155', fontWeight: 600 }}>{methodLabels[m.method] || m.method}</span>
                    <span style={{ color: '#94a3b8', fontSize: '12px' }}>({m.payments} payments)</span>
                  </div>
                  <div style={{ fontWeight: 700, color: '#0f172a' }}>
                    {money(m.amount)}{' '}
                    <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 500 }}>({pct}%)</span>
                  </div>
                </div>
              );
            })}

            {walkoutLoss > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '13px', borderTop: '1px solid #f1f5f9', paddingTop: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ width: '10px', height: '10px', borderRadius: '3px', backgroundColor: '#ef4444' }} />
                  <span style={{ color: '#dc2626', fontWeight: 600 }}>Walkout Loss</span>
                </div>
                <div style={{ fontWeight: 700, color: '#dc2626' }}>
                  {money(walkoutLoss)}
                </div>
              </div>
            )}

            {removedLoss > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '13px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ width: '10px', height: '10px', borderRadius: '3px', backgroundColor: '#f97316' }} />
                  <span style={{ color: '#ea580c', fontWeight: 600 }}>Removed Dishes Loss</span>
                </div>
                <div style={{ fontWeight: 700, color: '#ea580c' }}>
                  {money(removedLoss)}
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
