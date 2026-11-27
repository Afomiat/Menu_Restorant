import { type ReactNode, useCallback, useEffect, useState } from 'react';
import { LogOut } from 'lucide-react';
import type { Bill, StaffRole } from '../types';
import { fetchBills } from '../services/billService';
import BillCard from './BillCard';
import ShiftBar from './ShiftBar';
import { billsSignature } from '../utils/orderBoards';
import PushButton from './PushButton';
import { formatPrice } from '../utils/currency';
import { SkeletonBlocks } from './Loading';
import { t } from '../i18n/en';

interface BillsScreenProps {
  role: StaffRole | null;
  currency?: string;
  /** Changes when a bill or order changes, so the screen reloads. */
  refreshSignal: number;
  /** Cashiers work in shifts; managers do not need the shift bar. */
  showShift?: boolean;
  /** The cashier's name and Sign out, shown in the header like the waiter's screen. */
  fullName?: string;
  onLogout?: () => void;
  /** Gets every freshly loaded list, so old bill banners can clear themselves. */
  onBillsLoaded?: (bills: Bill[]) => void;
}

/** Cashiers and managers (Pro): collected bills to confirm first, then open bills, then today's confirmed ones. */
export default function BillsScreen({ role, currency, refreshSignal, showShift = false, fullName, onLogout, onBillsLoaded }: BillsScreenProps) {
  const [bills, setBills] = useState<Bill[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    fetchBills()
      .then((data) => {
        setBills(data);
        setError(null);
        onBillsLoaded?.(data);
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Failed to load bills'));
  }, [onBillsLoaded]);

  useEffect(() => {
    load();
  }, [load, refreshSignal]);

  useEffect(() => {
    const id = setInterval(load, 30_000);
    return () => clearInterval(id);
  }, [load]);

  const all = bills || [];
  const toConfirm = all.filter((b) => b.status === 'collected');
  const open = all.filter((b) => b.status === 'open' || b.status === 'bill_requested');
  const done = all.filter((b) => b.status === 'confirmed' || b.status === 'walkout');
  const money = (v: number) => formatPrice(v, currency || 'ETB');
  const sum = (list: Bill[], pick: (b: Bill) => number) => list.reduce((n, b) => n + pick(b), 0);

  return (
    <section className="admin-kitchen-page-view" aria-label={t.bills.title}>
      <div className="rpt-header">
        <div>
          <h1 className="admin-top-title" style={{ margin: 0 }}>{t.bills.title}</h1>
          <p className="rpt-subtitle">{fullName || t.bills.subtitle}</p>
        </div>
        {onLogout && (
          <button type="button" className="admin-sec-pill-btn" onClick={onLogout}>
            <LogOut size={14} /> {t.roleHome.signOut}
          </button>
        )}
      </div>
      {showShift && <ShiftBar role={role} currency={currency} refreshSignal={billsSignature(all)} />}
      <PushButton />
      {error && <p role="status" style={{ color: '#dc2626', fontSize: '14px', margin: 0 }}>{error}</p>}

      {/* Until the first list arrives: the page's shape, not an empty page */}
      {!bills && !error && <SkeletonBlocks kpis={3} sections={[{ kind: 'cards', count: 4 }, { kind: 'rows', count: 4 }]} label={t.bills.title} />}

      {bills && (
        <div className="rpt-kpis" role="region" aria-label={t.bills.summary}>
          <div className={`rpt-kpi ${toConfirm.length > 0 ? 'rpt-kpi-warn' : ''}`}>
            <span className="rpt-kpi-label">{t.bills.summaryToConfirm}</span>
            <strong className="rpt-kpi-value">{money(sum(toConfirm, (b) => b.amount_paid))}</strong>
            <span className="rpt-kpi-hint">{t.bills.billCount(toConfirm.length)}</span>
          </div>
          <div className="rpt-kpi">
            <span className="rpt-kpi-label">{t.bills.summaryOpen}</span>
            <strong className="rpt-kpi-value">{open.length}</strong>
            <span className="rpt-kpi-hint">{t.bills.owedCount(open.length, money(sum(open, (b) => b.amount_owed)))}</span>
          </div>
          <div className="rpt-kpi">
            <span className="rpt-kpi-label">{t.bills.summaryConfirmed}</span>
            <strong className="rpt-kpi-value">{money(sum(done.filter((b) => b.status === 'confirmed'), (b) => b.amount_paid))}</strong>
            <span className="rpt-kpi-hint">{t.bills.billCount(done.filter((b) => b.status === 'confirmed').length)}</span>
          </div>
        </div>
      )}

      {bills && (
        <>
      <BillSection title={t.bills.sectionCollected} count={toConfirm.length}>
        <div className="admin-kitchen-tickets-grid">
          {toConfirm.map((bill) => (
            <BillCard key={bill.id} bill={bill} role={role} currency={currency} onChanged={load} />
          ))}
        </div>
      </BillSection>

      <BillSection title={t.bills.sectionOpen} count={open.length}>
        <div className="admin-kitchen-tickets-grid">
          {open.map((bill) => (
            <BillCard key={bill.id} bill={bill} role={role} currency={currency} onChanged={load} />
          ))}
        </div>
      </BillSection>

      {/* Today's closed bills are history: one compact row each */}
      <BillSection title={t.bills.sectionConfirmed} count={done.length}>
        <ul className="rpt-panel rpt-rows bill-done-list">
          {done.map((bill) => (
            <li key={bill.id} data-testid={`bill-${bill.id}`} className="rpt-row">
              <span className="rpt-row-main">
                <strong>{t.kitchen.table(bill.table_number)}</strong>
                <span className="rpt-muted">{bill.waiter_name || t.reports.noWaiter}</span>
                {[...new Set(bill.payments.map((p) => p.method))].map((m) => (
                  <span key={m} className={`bill-method bill-method-${m}`}>{t.bills.methods[m]}</span>
                ))}
              </span>
              <span className="rpt-row-end">
                <strong className={bill.status === 'walkout' ? 'rpt-bad' : ''}>
                  {money(bill.status === 'walkout' ? bill.total_amount : bill.amount_paid)}
                </strong>
                <span className={`bill-status bill-status-${bill.status}`}>{t.bills.status[bill.status]}</span>
              </span>
            </li>
          ))}
        </ul>
      </BillSection>
        </>
      )}
    </section>
  );
}

function BillSection({ title, count, children }: { title: string; count: number; children: ReactNode }) {
  return (
    <div className="bill-section">
      <h2 className="bill-section-title">
        {title} <span className="rpt-count">{count}</span>
      </h2>
      {count === 0 ? <p className="rpt-empty">{t.bills.none}</p> : children}
    </div>
  );
}
