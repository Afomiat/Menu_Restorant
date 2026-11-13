import { useCallback, useEffect, useState } from 'react';
import { BellRing, CheckCircle2, LogOut, Volume2, X } from 'lucide-react';
import type { BackendOrder, Bill, TableOrders } from '../types';
import { fetchMyTables, updateAdminOrderStatus } from '../services/orderService';
import { fetchBills } from '../services/billService';
import BillCard from './BillCard';
import ShiftBar from './ShiftBar';
import DishProblemButton from './DishProblemButton';
import PushButton from './PushButton';
import SoldOutButton from './SoldOutButton';
import { t } from '../i18n/en';
import { billsSignature, isServed, tableState, type TableState } from '../utils/orderBoards';

export interface ReadyAlert {
  orderId: string;
  tableNumber: string;
}

interface WaiterTablesScreenProps {
  fullName?: string;
  onLogout: () => void;
  bell: { enabled: boolean; enable: () => Promise<boolean> | boolean };
  /** Food-ready bells for this waiter, shown as banners until dismissed. */
  readyAlerts: ReadyAlert[];
  onDismissAlert: (orderId: string) => void;
  /** Changes whenever an order changes, so the screen reloads its tables. */
  refreshSignal: number;
  currency?: string;
  /** Opens the sold-out list, so a waiter told by the kitchen can mark a dish. */
  onOpenSoldOut?: () => void;
  /** How many dishes are sold out right now, shown on the button. */
  soldOutCount?: number;
  /** Gets every freshly loaded bill list, so old bill banners can clear themselves. */
  onBillsLoaded?: (bills: Bill[]) => void;
}

const STATE_STYLE: Record<TableState, { label: string; color: string; bg: string }> = {
  ready: { label: t.waiter.foodReady, color: '#15803d', bg: '#dcfce7' },
  cooking: { label: t.waiter.cooking, color: '#b45309', bg: '#fef3c7' },
  ordered: { label: t.waiter.ordered, color: '#1d4ed8', bg: '#dbeafe' },
  none: { label: t.waiter.noOrders, color: '#64748b', bg: '#f1f5f9' },
};

/** The waiter's screen (Pro): their tables, what each is waiting for, and the Served button. */
export default function WaiterTablesScreen({
  fullName,
  onLogout,
  bell,
  readyAlerts,
  onDismissAlert,
  refreshSignal,
  currency,
  onOpenSoldOut,
  soldOutCount = 0,
  onBillsLoaded,
}: WaiterTablesScreenProps) {
  const [tables, setTables] = useState<TableOrders[] | null>(null);
  const [bills, setBills] = useState<Bill[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busyOrder, setBusyOrder] = useState<string | null>(null);

  const load = useCallback(() => {
    fetchMyTables()
      .then((data) => {
        setTables(data);
        setError(null);
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Failed to load tables'));
    fetchBills()
      .then((data) => {
        setBills(data);
        onBillsLoaded?.(data);
      })
      .catch(() => setBills([]));
  }, [onBillsLoaded]);

  useEffect(() => {
    load();
  }, [load, refreshSignal]);

  // A slow refresh as a safety net when the live connection drops
  useEffect(() => {
    const id = setInterval(load, 30_000);
    return () => clearInterval(id);
  }, [load]);

  const serve = async (order: BackendOrder) => {
    setBusyOrder(order.id);
    try {
      await updateAdminOrderStatus(order.id, 'complete');
      onDismissAlert(order.id);
      load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to mark served');
    } finally {
      setBusyOrder(null);
    }
  };

  return (
    <section className="admin-kitchen-page-view" aria-label={t.waiter.title}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', marginBottom: '16px', flexWrap: 'wrap' }}>
        <div>
          <h1 className="admin-top-title" style={{ margin: 0 }}>{t.waiter.title}</h1>
          {fullName && <p style={{ margin: '2px 0 0', color: '#64748b', fontSize: '13px' }}>{fullName}</p>}
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {onOpenSoldOut && <SoldOutButton count={soldOutCount} onClick={onOpenSoldOut} />}
          {!bell.enabled && (
            <button type="button" className="admin-save-pill-btn" onClick={() => bell.enable()}>
              <Volume2 size={16} /> {t.kitchen.enableSound}
            </button>
          )}
          <button type="button" className="admin-sec-pill-btn" onClick={onLogout}>
            <LogOut size={14} /> {t.roleHome.signOut}
          </button>
        </div>
      </div>

      <ShiftBar role="waiter" currency={currency} refreshSignal={billsSignature(bills)} />
      <PushButton />

      {readyAlerts.map((alert) => (
        <div
          key={alert.orderId}
          role="alert"
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', background: '#16a34a', color: '#fff', borderRadius: '12px', padding: '12px 16px', marginBottom: '10px', fontWeight: 700 }}
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <BellRing size={18} /> {t.waiter.readyBanner(alert.tableNumber)}
          </span>
          <button type="button" onClick={() => onDismissAlert(alert.orderId)} aria-label={t.kitchen.dismiss} style={{ background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer' }}>
            <X size={18} />
          </button>
        </div>
      ))}

      {error && <p role="status" style={{ color: '#dc2626', fontSize: '13px' }}>{error}</p>}

      {tables && tables.length === 0 && <p style={{ color: '#64748b' }}>{t.waiter.empty}</p>}

      <div className="admin-kitchen-tickets-grid">
        {(tables || []).map(({ table, orders }) => {
          const state = STATE_STYLE[tableState(orders)];
          // The table's bill still in the waiter's hands (taking orders, or collected and not confirmed)
          const bill = bills.find(
            (b) => b.table_number === table.table_number && (b.status === 'open' || b.status === 'bill_requested' || b.status === 'collected')
          );
          // The bill's state next to the kitchen state, so "Bill asked" is seen without scrolling
          const billChip = !bill
            ? null
            : bill.status === 'bill_requested' || bill.status === 'collected'
              ? t.bills.status[bill.status]
              : bill.amount_paid > 0 && bill.amount_owed > 0
                ? t.waiter.partPaid
                : null;
          return (
            <div key={table.id} className="admin-kitchen-table-card" data-testid={`waiter-table-${table.table_number}`}>
              <div className="admin-kitchen-card-header">
                <strong style={{ fontSize: '17px' }}>{t.kitchen.table(table.table_number)}</strong>
                <span style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '12px', fontWeight: 800, color: state.color, background: state.bg, padding: '3px 10px', borderRadius: '999px' }}>
                    {state.label}
                  </span>
                  {billChip && (
                    <span data-testid="table-bill-chip" style={{ fontSize: '12px', fontWeight: 800, color: '#b45309', background: '#ffedd5', padding: '3px 10px', borderRadius: '999px' }}>
                      {billChip}
                    </span>
                  )}
                </span>
              </div>
              <div style={{ display: 'grid', gap: '10px', padding: '12px 16px' }}>
                {orders.map((order, i) => {
                  const served = isServed(order.status);
                  // A problem is reported once the food has reached the table (or is ready to go)
                  const canReport = served || order.status === 'ready';
                  return (
                  <div key={order.id} data-served={served || undefined} style={{ borderTop: i > 0 ? '1px solid #e2e8f0' : 'none', paddingTop: i > 0 ? '10px' : 0, opacity: served ? 0.75 : 1 }}>
                    <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '4px', display: 'flex', justifyContent: 'space-between' }}>
                      <span>{t.waiter.order(i + 1)}</span>
                      {served && <span style={{ color: '#15803d', fontWeight: 700 }}>{t.waiter.servedDone}</span>}
                    </div>
                    <ul style={{ listStyle: 'none', margin: 0, padding: 0, fontSize: '14px' }}>
                      {(order.items || []).map((it) => (
                        <li key={it.id} style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap' }}>
                          <span>
                            <strong>{it.quantity}×</strong> {it.item_name}
                          </span>
                          {canReport && <DishProblemButton orderId={order.id} itemId={it.id} dishName={it.item_name} />}
                        </li>
                      ))}
                    </ul>
                    {order.status === 'ready' && (
                      <button
                        type="button"
                        className="admin-save-pill-btn"
                        style={{ marginTop: '8px' }}
                        disabled={busyOrder === order.id}
                        onClick={() => serve(order)}
                      >
                        <CheckCircle2 size={14} /> {t.waiter.served}
                      </button>
                    )}
                  </div>
                  );
                })}
                {bill && (
                  <BillCard
                    bill={bill}
                    role="waiter"
                    currency={currency}
                    onChanged={load}
                    showTable={false}
                    tableSuggestions={(tables || []).map((tb) => tb.table.table_number)}
                  />
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
