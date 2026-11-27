import type { WaiterTotals } from '../types';
import { formatPrice } from '../utils/currency';
import FinancePartFailed from './FinancePartFailed';

interface FinanceStaffTableProps {
  /** null when the staff totals could not be loaded */
  waiters: WaiterTotals[] | null;
  currency?: string;
}

export default function FinanceStaffTable({ waiters, currency = 'ETB' }: FinanceStaffTableProps) {
  const money = (val: number) => formatPrice(val, currency);
  const list = waiters ?? [];
  const sum = (pick: (w: WaiterTotals) => number) => list.reduce((acc, w) => acc + pick(w), 0);
  const totalWalkouts = sum((w) => w.walkouts);

  return (
    <div className="rpt-panel" role="region" aria-label="Staff Billing Performance">
      <h2 className="rpt-panel-title">Staff Billing Performance</h2>
      <p className="rpt-panel-hint">Collections and reconciliation by waiter</p>

      {waiters === null ? (
        <FinancePartFailed />
      ) : list.length === 0 ? (
        <p className="rpt-empty fin-empty">No staff billing activity recorded in this period.</p>
      ) : (
        <div className="fin-table-wrap">
          <table className="fin-table">
            <thead>
              <tr>
                <th>Staff Member</th>
                <th>Bills</th>
                <th>Sales</th>
                <th>Collected</th>
                <th>Confirmed</th>
                <th>Not Confirmed</th>
                <th>Walkouts</th>
              </tr>
            </thead>
            <tbody>
              {list.map((w, idx) => (
                <tr key={w.waiter_id || `unassigned-${idx}`}>
                  <td className="fin-name">{w.waiter_name || 'Unassigned / Floor'}</td>
                  <td>{w.bills}</td>
                  <td className="fin-strong">{money(w.sales)}</td>
                  <td>{money(w.collected)}</td>
                  <td className="fin-good">{money(w.confirmed)}</td>
                  <td className={w.collected_not_confirmed > 0 ? 'fin-warn' : 'fin-dim'}>{money(w.collected_not_confirmed)}</td>
                  <td className={w.walkouts > 0 ? 'fin-bad' : 'fin-dim'}>{w.walkouts}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td>Total</td>
                <td>{sum((w) => w.bills)}</td>
                <td>{money(sum((w) => w.sales))}</td>
                <td>{money(sum((w) => w.collected))}</td>
                <td className="fin-good">{money(sum((w) => w.confirmed))}</td>
                <td className="fin-warn">{money(sum((w) => w.collected_not_confirmed))}</td>
                <td className={totalWalkouts > 0 ? 'fin-bad' : ''}>{totalWalkouts}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}
