import type { PaymentMethod } from '../types';
import { formatPrice } from '../utils/currency';
import FinancePartFailed from './FinancePartFailed';

interface MethodTotal {
  method: PaymentMethod;
  payments: number;
  amount: number;
}

interface FinancePaymentPieProps {
  /** null when the payment totals could not be loaded */
  methods: MethodTotal[] | null;
  walkoutLoss: number;
  removedLoss: number;
  currency?: string;
}

const METHOD_COLORS: Record<PaymentMethod, string> = {
  cash: '#10b981',
  telebirr: '#0284c7',
  cbe_birr_bank: '#8b5cf6',
};

const METHOD_LABELS: Record<PaymentMethod, string> = {
  cash: 'Cash',
  telebirr: 'Telebirr',
  cbe_birr_bank: 'CBE Birr',
};

const WALKOUT_COLOR = '#ef4444';
const REMOVED_COLOR = '#f97316';

export default function FinancePaymentPie({ methods, walkoutLoss, removedLoss, currency = 'ETB' }: FinancePaymentPieProps) {
  const money = (val: number) => formatPrice(val, currency);
  const list = methods ?? [];
  const totalPayments = list.reduce((acc, m) => acc + m.amount, 0);
  const totalVolume = totalPayments + walkoutLoss + removedLoss;
  const pct = (amount: number) => (totalVolume > 0 ? Math.round((amount / totalVolume) * 100) : 0);

  return (
    <div className="rpt-panel" role="region" aria-label="Payment Breakdown">
      <h2 className="rpt-panel-title">Payment Breakdown</h2>
      <p className="rpt-panel-hint">Collections by payment channel</p>

      {methods === null ? (
        <FinancePartFailed />
      ) : totalVolume === 0 ? (
        <p className="rpt-empty fin-empty">No payment transactions in this period.</p>
      ) : (
        <>
          <div className="rpt-split" aria-hidden="true">
            {list.map((m) =>
              m.amount > 0 ? (
                <span key={m.method} style={{ width: `${(m.amount / totalVolume) * 100}%`, background: METHOD_COLORS[m.method] || '#64748b' }} />
              ) : null
            )}
            {walkoutLoss > 0 && <span style={{ width: `${(walkoutLoss / totalVolume) * 100}%`, background: WALKOUT_COLOR }} />}
            {removedLoss > 0 && <span style={{ width: `${(removedLoss / totalVolume) * 100}%`, background: REMOVED_COLOR }} />}
          </div>

          <ul className="rpt-rows">
            {list.map((m) => (
              <li key={m.method} className="rpt-row">
                <span className="rpt-row-main">
                  <span className="rpt-dot" style={{ background: METHOD_COLORS[m.method] || '#64748b' }} />
                  <span style={{ fontWeight: 600 }}>{METHOD_LABELS[m.method] || m.method}</span>
                  <span className="rpt-muted">{m.payments} payments</span>
                </span>
                <span className="rpt-row-end">
                  <strong>{money(m.amount)}</strong>
                  <span className="rpt-muted rpt-pct">{pct(m.amount)}%</span>
                </span>
              </li>
            ))}
            {walkoutLoss > 0 && (
              <li className="rpt-row rpt-bad">
                <span className="rpt-row-main">
                  <span className="rpt-dot" style={{ background: WALKOUT_COLOR }} />
                  <span style={{ fontWeight: 600 }}>Walkout loss</span>
                </span>
                <span className="rpt-row-end">
                  <strong>{money(walkoutLoss)}</strong>
                  <span className="rpt-pct">{pct(walkoutLoss)}%</span>
                </span>
              </li>
            )}
            {removedLoss > 0 && (
              <li className="rpt-row" style={{ color: '#c2410c' }}>
                <span className="rpt-row-main">
                  <span className="rpt-dot" style={{ background: REMOVED_COLOR }} />
                  <span style={{ fontWeight: 600 }}>Removed dishes loss</span>
                </span>
                <span className="rpt-row-end">
                  <strong>{money(removedLoss)}</strong>
                  <span className="rpt-pct">{pct(removedLoss)}%</span>
                </span>
              </li>
            )}
          </ul>
        </>
      )}
    </div>
  );
}
