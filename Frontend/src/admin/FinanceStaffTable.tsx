import type { WaiterTotals } from '../types';
import { formatPrice } from '../utils/currency';

interface FinanceStaffTableProps {
  waiters: WaiterTotals[];
  currency?: string;
}

export default function FinanceStaffTable({ waiters, currency = 'ETB' }: FinanceStaffTableProps) {
  const money = (val: number) => formatPrice(val, currency);

  const totalBills = waiters.reduce((sum, w) => sum + w.bills, 0);
  const totalSales = waiters.reduce((sum, w) => sum + w.sales, 0);
  const totalCollected = waiters.reduce((sum, w) => sum + w.collected, 0);
  const totalConfirmed = waiters.reduce((sum, w) => sum + w.confirmed, 0);
  const totalPending = waiters.reduce((sum, w) => sum + w.collected_not_confirmed, 0);
  const totalWalkouts = waiters.reduce((sum, w) => sum + w.walkouts, 0);

  const cellStyle = {
    padding: '10px 14px',
    borderBottom: '1px solid #e2e8f0',
    textAlign: 'left' as const,
    fontSize: '13px',
  };

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
      }}
    >
      <div>
        <h2 style={{ fontSize: '15px', fontWeight: 700, margin: 0, color: '#0f172a' }}>Staff Billing Performance</h2>
        <span style={{ fontSize: '12px', color: '#64748b' }}>Collections and reconciliation by waiter</span>
      </div>

      {waiters.length === 0 ? (
        <div style={{ padding: '30px 0', textAlign: 'center', color: '#94a3b8', fontSize: '13px' }}>
          No staff billing activity recorded in this period.
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ borderCollapse: 'collapse', width: '100%', background: '#fff' }}>
            <thead>
              <tr style={{ backgroundColor: '#f8fafc' }}>
                <th style={{ ...cellStyle, color: '#64748b', fontWeight: 700, borderRadius: '8px 0 0 8px' }}>Staff Member</th>
                <th style={{ ...cellStyle, color: '#64748b', fontWeight: 700 }}>Bills</th>
                <th style={{ ...cellStyle, color: '#64748b', fontWeight: 700 }}>Sales</th>
                <th style={{ ...cellStyle, color: '#64748b', fontWeight: 700 }}>Collected</th>
                <th style={{ ...cellStyle, color: '#64748b', fontWeight: 700 }}>Confirmed</th>
                <th style={{ ...cellStyle, color: '#64748b', fontWeight: 700 }}>Not Confirmed</th>
                <th style={{ ...cellStyle, color: '#64748b', fontWeight: 700, borderRadius: '0 8px 8px 0' }}>Walkouts</th>
              </tr>
            </thead>
            <tbody>
              {waiters.map((w, idx) => (
                <tr key={w.waiter_id || `unassigned-${idx}`} style={{ transition: 'background-color 0.1s' }}>
                  <td style={{ ...cellStyle, fontWeight: 600, color: '#0f172a' }}>
                    {w.waiter_name || 'Unassigned / Floor'}
                  </td>
                  <td style={cellStyle}>{w.bills}</td>
                  <td style={{ ...cellStyle, fontWeight: 600 }}>{money(w.sales)}</td>
                  <td style={{ ...cellStyle, color: '#2563eb' }}>{money(w.collected)}</td>
                  <td style={{ ...cellStyle, color: '#16a34a', fontWeight: 600 }}>{money(w.confirmed)}</td>
                  <td style={{ ...cellStyle, color: w.collected_not_confirmed > 0 ? '#d97706' : '#64748b' }}>
                    {money(w.collected_not_confirmed)}
                  </td>
                  <td style={{ ...cellStyle, color: w.walkouts > 0 ? '#dc2626' : '#64748b', fontWeight: w.walkouts > 0 ? 700 : 400 }}>
                    {w.walkouts}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ backgroundColor: '#f8fafc', fontWeight: 800 }}>
                <td style={{ ...cellStyle, color: '#0f172a' }}>Total</td>
                <td style={cellStyle}>{totalBills}</td>
                <td style={cellStyle}>{money(totalSales)}</td>
                <td style={{ ...cellStyle, color: '#2563eb' }}>{money(totalCollected)}</td>
                <td style={{ ...cellStyle, color: '#16a34a' }}>{money(totalConfirmed)}</td>
                <td style={{ ...cellStyle, color: '#d97706' }}>{money(totalPending)}</td>
                <td style={{ ...cellStyle, color: totalWalkouts > 0 ? '#dc2626' : '#0f172a' }}>{totalWalkouts}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}
