import { useEffect, useState } from 'react';
import type { Shift } from '../types';
import { endShift, fetchMyShift, startShift } from '../services/billService';
import { t } from '../i18n/en';

/** Start and end a shift; ending is refused while a waiter still holds unpaid bills. */
export default function ShiftBar() {
  const [shift, setShift] = useState<Shift | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchMyShift()
      .then(setShift)
      .catch(() => setShift(null));
  }, []);

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
      {error && (
        <span role="alert" style={{ color: '#dc2626', fontSize: '13px' }}>
          {error}
        </span>
      )}
    </div>
  );
}
