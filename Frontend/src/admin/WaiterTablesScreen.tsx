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
import { BusyButton, SkeletonBlocks } from './Loading';
import { formatPrice } from '../utils/currency';
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

  // Tables that need the waiter come first: food waiting, then a customer asking for the bill
  const all = tables || [];
  const billFor = (tableNumber: string) =>
    bills.find((b) => b.table_number === tableNumber && (b.status === 'open' || b.status === 'bill_requested' || b.status === 'collected'));
  const urgency = (entry: TableOrders) => {
    const bill = billFor(entry.table.table_number);
    if (tableState(entry.orders) === 'ready') return 0;
    if (bill?.status === 'bill_requested') return 1;
    if (entry.orders.some((o) => !isServed(o.status))) return 2;
    return bill ? 3 : 4;
  };
  const sorted = [...all].sort((a, b) => urgency(a) - urgency(b));
  const readyCount = all.filter((e) => tableState(e.orders) === 'ready').length;
  const askedCount = all.filter((e) => billFor(e.table.table_number)?.status === 'bill_requested').length;
  const owed = all.reduce((sum, e) => sum + (billFor(e.table.table_number)?.amount_owed || 0), 0);

  return (
    <section className="admin-kitchen-page-view" aria-label={t.waiter.title}>
      <div className="rpt-header">
        <div>
          <h1 className="admin-top-title" style={{ margin: 0 }}>{t.waiter.title}</h1>
          {fullName && <p className="rpt-subtitle">{fullName}</p>}
        </div>
        <div className="wt-actions">
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
        <div key={alert.orderId} role="alert" className="wt-ready-banner">
          <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <BellRing size={18} /> {t.waiter.readyBanner(alert.tableNumber)}
          </span>
          <button type="button" onClick={() => onDismissAlert(alert.orderId)} aria-label={t.kitchen.dismiss} className="wt-banner-close">
            <X size={18} />
          </button>
        </div>
      ))}

      {error && <p role="status" style={{ color: '#dc2626', fontSize: '14px', margin: 0 }}>{error}</p>}

      {/* Until the first answer: the page's outline */}
      {!tables && !error && <SkeletonBlocks kpis={3} sections={[{ kind: 'cards', count: 3 }]} label={t.waiter.title} />}

      {tables && tables.length === 0 && <p className="rpt-empty">{t.waiter.empty}</p>}

      {tables && tables.length > 0 && (
        <div className="rpt-kpis" role="region" aria-label={t.waiter.summary}>
          <div className={`rpt-kpi ${readyCount > 0 ? 'rpt-kpi-good' : ''}`}>
            <span className="rpt-kpi-label">{t.waiter.foodReady}</span>
            <strong className="rpt-kpi-value">{readyCount}</strong>
          </div>
          <div className={`rpt-kpi ${askedCount > 0 ? 'rpt-kpi-warn' : ''}`}>
            <span className="rpt-kpi-label">{t.waiter.billsAsked}</span>
            <strong className="rpt-kpi-value">{askedCount}</strong>
          </div>
          <div className="rpt-kpi">
            <span className="rpt-kpi-label">{t.waiter.owed}</span>
            <strong className="rpt-kpi-value">{formatPrice(owed, currency || 'ETB')}</strong>
          </div>
        </div>
      )}

      <div className="admin-kitchen-tickets-grid">
        {sorted.map(({ table, orders }) => {
          const state = STATE_STYLE[tableState(orders)];
          // The table's bill still in the waiter's hands (taking orders, or collected and not confirmed)
          const bill = billFor(table.table_number);
          // The bill's state next to the kitchen state, so "Bill asked" is seen without scrolling
          const billChip = !bill
            ? null
            : bill.status === 'bill_requested' || bill.status === 'collected'
              ? t.bills.status[bill.status]
              : bill.amount_paid > 0 && bill.amount_owed > 0
                ? t.waiter.partPaid
                : null;
          return (
            <div key={table.id} className="bill-card wt-table" data-testid={`waiter-table-${table.table_number}`}>
              <div className="bill-card-head">
                <strong className="bill-card-title">{t.kitchen.table(table.table_number)}</strong>
                <span style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  <span className="bill-status" style={{ color: state.color, background: state.bg }}>
                    {state.label}
                  </span>
                  {billChip && (
                    <span data-testid="table-bill-chip" className="bill-status bill-status-bill_requested">
                      {billChip}
                    </span>
                  )}
                </span>
              </div>
              {orders.length > 0 && (
                <ul className="wt-orders">
                  {orders.map((order, i) => {
                    const served = isServed(order.status);
                    // A problem is reported once the food has reached the table (or is ready to go)
                    const canReport = served || order.status === 'ready';
                    return (
                      <li key={order.id} data-served={served || undefined} className={`wt-order ${served ? 'wt-order-served' : ''}`}>
                        <div className="wt-order-head">
                          <span>{t.waiter.order(i + 1)}</span>
                          {served ? (
                            <span className="wt-served">{t.waiter.servedDone}</span>
                          ) : (
                            <span className={`wt-order-state wt-order-${order.status}`}>
                              {order.status === 'ready' ? t.waiter.foodReady : order.status === 'preparing' ? t.waiter.cooking : t.waiter.ordered}
                            </span>
                          )}
                        </div>
                        <ul className="wt-dishes">
                          {(order.items || []).map((it) => (
                            <li key={it.id}>
                              <span>
                                <strong>{it.quantity}×</strong> {it.item_name}
                              </span>
                              {canReport && <DishProblemButton orderId={order.id} itemId={it.id} dishName={it.item_name} />}
                            </li>
                          ))}
                        </ul>
                        {order.status === 'ready' && (
                          <BusyButton
                            className="admin-save-pill-btn"
                            style={{ justifySelf: 'start' }}
                            busy={busyOrder === order.id}
                            icon={<CheckCircle2 size={14} />}
                            onClick={() => serve(order)}
                          >
                            {t.waiter.served}
                          </BusyButton>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
              {bill && (
                <BillCard
                  bill={bill}
                  role="waiter"
                  currency={currency}
                  onChanged={load}
                  showTable={false}
                  inset
                  tableSuggestions={all.map((tb) => tb.table.table_number)}
                />
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
