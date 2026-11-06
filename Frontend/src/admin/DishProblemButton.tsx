import { useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import type { ProblemReason } from '../types';
import { reportProblem } from '../services/problemService';
import { t } from '../i18n/en';

const REASONS: ProblemReason[] = ['cold', 'wrong_dish', 'undercooked', 'too_slow', 'foreign_object', 'other'];

interface DishProblemButtonProps {
  orderId: string;
  itemId: string;
  dishName: string;
}

/** The waiter reports a problem with one dish; the manager decides what happens. */
export default function DishProblemButton({ orderId, itemId, dishName }: DishProblemButtonProps) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<ProblemReason>('cold');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  if (sent) {
    return <span style={{ fontSize: '12px', color: '#15803d', fontWeight: 700 }}>{t.problems.sent}</span>;
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        style={{ background: 'none', border: 'none', color: '#b45309', cursor: 'pointer', fontSize: '12px', display: 'inline-flex', alignItems: 'center', gap: '4px', padding: 0 }}
      >
        <AlertTriangle size={12} /> {t.problems.report}
      </button>
    );
  }

  return (
    <form
      aria-label={t.problems.reportTitle(dishName)}
      style={{ display: 'grid', gap: '6px', margin: '6px 0', padding: '8px', border: '1px solid #fde68a', borderRadius: '10px', background: '#fffbeb' }}
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError(null);
        try {
          await reportProblem(orderId, itemId, reason, note);
          setSent(true);
        } catch (err: unknown) {
          setError(err instanceof Error ? err.message : 'Failed');
        } finally {
          setBusy(false);
        }
      }}
    >
      <strong style={{ fontSize: '13px' }}>{t.problems.reportTitle(dishName)}</strong>
      <select className="admin-input-control" aria-label={t.problems.report} value={reason} onChange={(e) => setReason(e.target.value as ProblemReason)}>
        {REASONS.map((r) => (
          <option key={r} value={r}>
            {t.problems.reasons[r]}
          </option>
        ))}
      </select>
      <input className="admin-input-control" aria-label={t.problems.note} placeholder={t.problems.note} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} />
      <div style={{ display: 'flex', gap: '6px' }}>
        <button type="submit" className="admin-save-pill-btn" disabled={busy}>
          {t.problems.send}
        </button>
        <button type="button" className="admin-sec-pill-btn" onClick={() => setOpen(false)}>
          {t.bills.cancel}
        </button>
      </div>
      {error && (
        <span role="alert" style={{ color: '#dc2626', fontSize: '12px' }}>
          {error}
        </span>
      )}
    </form>
  );
}
