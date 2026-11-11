import { useEffect, useState } from 'react';
import type { Shift, ShiftReport, StaffRole } from '../types';
import { endShift, fetchMyShift, startShift } from '../services/billService';
import { fetchMyShiftReport } from '../services/problemService';
import { formatPrice } from '../utils/currency';
import { t } from '../i18n/en';

/**
 * Start and end a shift; ending is refused while a waiter still holds unpaid bills.
 * Waiters and cashiers also see their own totals for the shift.
 */
export default function ShiftBar({
  role,
  currency = 'ETB',
  refreshSignal = '',
}: {
  role?: StaffRole | null;
  currency?: string;
  /** Changes whenever the screen's bills change, so the totals and any old error are refreshed. */
  refreshSignal?: string;
}) {
  const [shift, setShift] = useState<Shift | null>(null);
  const [totals, setTotals] = useState<ShiftReport | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchMyShift()
      .then(setShift)
      .catch(() => setShift(null));
  }, []);

  useEffect(() => {
    if (!shift || (role !== 'waiter' && role !== 'cashier')) return;
    fetchMyShiftReport()
      .then(setTotals)
      .catch(() => setTotals(null));
  }, [shift, role, refreshSignal]);

  // An old refusal ("you still have unpaid bills") no longer applies once the bills change
  useEffect(() => {
    setError(null);
  }, [refreshSignal]);

  const run = async (action: () => Promise<Shift>, after: (s: Shift) => Shift | null) => {
    setBusy(true);
    setError(null);
    try {
      setShift(after(await action()));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed');
    } finally {
      setBusy(false);
    }
  };

  const since = shift ? new Date(shift.started_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginBottom: '12px' }}>
      <span style={{ fontSize: '13px', color: '#475569', fontWeight: 600 }} data-testid="shift-status">
        {shift ? t.shift.onShift(since) : t.shift.offShift}
      </span>
      {shift ? (
        <button type="button" className="admin-sec-pill-btn" disabled={busy} onClick={() => run(endShift, () => null)}>
          {t.shift.end}
        </button>
      ) : (
        <button type="button" className="admin-save-pill-btn" disabled={busy} onClick={() => run(startShift, (s) => s)}>
          {t.shift.start}
        </button>
      )}
      {shift && totals && (
        <span style={{ fontSize: '13px', color: '#0f172a' }} data-testid="shift-totals">
          {role === 'cashier'
            ? t.myShift.confirmed(formatPrice(totals.confirmed, currency), totals.bills)
            : t.myShift.collected(formatPrice(totals.collected, currency), formatPrice(totals.not_confirmed, currency))}
        </span>
      )}
      {error && (
        <span role="alert" style={{ color: '#dc2626', fontSize: '13px' }}>
          {error}
        </span>
      )}
    </div>
  );
}
