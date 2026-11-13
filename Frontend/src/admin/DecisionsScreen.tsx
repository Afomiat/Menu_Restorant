import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Bill, CartItem, Decisions, Fault, Problem, ProblemDecision, Walkout, WalkoutDecision } from '../types';
import { decideProblem, decideWalkout, fetchDecisions } from '../services/problemService';
import { fetchBills } from '../services/billService';
import { formatPrice } from '../utils/currency';
import { groupTickets } from '../utils/orderBoards';
import { timerState } from '../utils/kitchenTimer';
import { useNow } from '../hooks/useNow';
import PushButton from './PushButton';
import { t } from '../i18n/en';

interface DecisionsScreenProps {
  currency?: string;
  refreshSignal: number;
  /** The kitchen's open dishes, for the late-dishes list. */
  kitchenOrders?: CartItem[];
  defaultPrepMinutes?: number;
  /** Settings: when an asked-for bill becomes the manager's problem, and when collected money should be confirmed. */
  billEscalationMinutes?: number;
  confirmReminderMinutes?: number;
  /** Gets every loaded list, so the sidebar can show how many decisions wait. */
  onLoaded?: (decisions: Decisions) => void;
  /** Fixed time for tests. */
  now?: number;
}

const MIN = 60_000;

const minutesSince = (iso: string | null | undefined, now: number) => (iso ? Math.floor((now - new Date(iso).getTime()) / MIN) : 0);

/**
 * The manager's Alerts (Pro): what waits for a decision (problems with dishes, walkouts),
 * and what needs following up (dishes cooking past their time, bills unpaid too long).
 */
export default function DecisionsScreen({
  currency = 'ETB',
  refreshSignal,
  kitchenOrders = [],
  defaultPrepMinutes = 15,
  billEscalationMinutes = 20,
  confirmReminderMinutes = 15,
  onLoaded,
  now: fixedNow,
}: DecisionsScreenProps) {
  const [data, setData] = useState<Decisions | null>(null);
  const [bills, setBills] = useState<Bill[]>([]);
  const [error, setError] = useState<string | null>(null);
  const tickingNow = useNow(30_000);
  const now = fixedNow ?? tickingNow;

  const load = useCallback(() => {
    fetchDecisions()
      .then((d) => {
        setData(d);
        setError(null);
        onLoaded?.(d);
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Failed to load'));
    fetchBills()
      .then(setBills)
      .catch(() => setBills([]));
  }, [onLoaded]);

  useEffect(() => {
    load();
  }, [load, refreshSignal]);

  // Dishes past their prep time (the kitchen screen shows them red)
  const late = useMemo(
    () =>
      groupTickets(kitchenOrders, defaultPrepMinutes).filter(
        (tk) => tk.status === 'preparing' && tk.startedAt && timerState(tk.startedAt, tk.targetMinutes, now).color === 'red'
      ),
    [kitchenOrders, defaultPrepMinutes, now]
  );

  // Bills the manager is alerted about: asked for and still unpaid, or collected and not confirmed
  const unpaid = useMemo(
    () =>
      bills.filter(
        (b) =>
          (b.status === 'bill_requested' && minutesSince(b.requested_at, now) >= billEscalationMinutes) ||
          (b.status === 'collected' && minutesSince(b.collected_at, now) >= confirmReminderMinutes)
      ),
    [bills, now, billEscalationMinutes, confirmReminderMinutes]
  );

  const nothing = data && data.problems.length === 0 && data.walkouts.length === 0 && late.length === 0 && unpaid.length === 0;

  return (
    <section className="admin-kitchen-page-view" aria-label={t.decisionsScreen.title}>
      <h1 className="admin-top-title" style={{ margin: '0 0 12px' }}>{t.decisionsScreen.title}</h1>
      <PushButton />
      {error && <p role="status" style={{ color: '#dc2626', fontSize: '13px' }}>{error}</p>}
      {nothing && <p style={{ color: '#64748b' }}>{t.decisionsScreen.none}</p>}

      {data && data.problems.length > 0 && (
        <section aria-label={t.decisionsScreen.problems}>
          <h2 style={sectionTitle}>{t.decisionsScreen.problems}</h2>
          <div className="admin-kitchen-tickets-grid" style={{ marginBottom: '20px' }}>
            {data.problems.map((p) => (
              <ProblemCard key={p.id} problem={p} onDecided={load} />
            ))}
          </div>
        </section>
      )}

      {data && data.walkouts.length > 0 && (
        <section aria-label={t.decisionsScreen.walkouts}>
          <h2 style={sectionTitle}>{t.decisionsScreen.walkouts}</h2>
          <div className="admin-kitchen-tickets-grid" style={{ marginBottom: '20px' }}>
            {data.walkouts.map((w) => (
              <WalkoutCard key={w.bill_id} walkout={w} currency={currency} onDecided={load} />
            ))}
          </div>
        </section>
      )}

      {late.length > 0 && (
        <section aria-label={t.decisionsScreen.late}>
          <h2 style={sectionTitle}>{t.decisionsScreen.late}</h2>
          <div className="admin-kitchen-tickets-grid" style={{ marginBottom: '20px' }}>
            {late.map((tk) => (
              <div key={tk.orderId} data-testid={`late-${tk.orderId}`} style={{ ...cardStyle, borderColor: '#fca5a5' }}>
                <strong style={{ color: '#b91c1c' }}>
                  {t.decisionsScreen.lateLine(tk.tableNumber, Math.floor((now - (tk.startedAt || now)) / MIN), tk.targetMinutes)}
                </strong>
                <span style={{ fontSize: '13px' }}>{tk.items.map((row) => `${row.quantity}× ${row.item.name}`).join(', ')}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {unpaid.length > 0 && (
        <section aria-label={t.decisionsScreen.unpaid}>
          <h2 style={sectionTitle}>{t.decisionsScreen.unpaid}</h2>
          <div className="admin-kitchen-tickets-grid">
            {unpaid.map((b) => (
              <div key={b.id} data-testid={`unpaid-${b.id}`} style={{ ...cardStyle, borderColor: '#fdba74' }}>
                <strong style={{ color: '#b45309' }}>
                  {b.status === 'collected'
                    ? t.decisionsScreen.collectedAgo(b.table_number, minutesSince(b.collected_at, now))
                    : t.decisionsScreen.askedAgo(b.table_number, minutesSince(b.requested_at, now))}
                </strong>
                <span style={{ fontSize: '13px' }}>
                  {t.decisionsScreen.waiterOwes(b.waiter_name, formatPrice(b.status === 'collected' ? b.amount_paid : b.amount_owed, currency))}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}
    </section>
  );
}

const sectionTitle = { fontSize: '15px', margin: '0 0 8px' } as const;
const cardStyle = { border: '1px solid #e2e8f0', borderRadius: '12px', padding: '12px', background: '#fff', display: 'grid', gap: '8px' } as const;

/** "18:03", or "—" when that step has not happened. */
function clock(iso?: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function ProblemCard({ problem, onDecided }: { problem: Problem; onDecided: () => void }) {
  // Nothing is chosen for the manager: the app never decides blame
  const [decision, setDecision] = useState<ProblemDecision | null>(null);
  const [fault, setFault] = useState<Fault | ''>('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ready = decision !== null && fault !== '';

  return (
    <form
      data-testid={`problem-${problem.id}`}
      aria-label={`${problem.item_name}, ${t.kitchen.table(problem.table_number)}`}
      style={cardStyle}
      onSubmit={async (e) => {
        e.preventDefault();
        if (!decision || !fault) {
          setError(t.decisionsScreen.chooseBoth);
          return;
        }
        setBusy(true);
        setError(null);
        try {
          await decideProblem(problem.id, decision, fault);
          onDecided();
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : 'Failed';
          // A paid or closed bill cannot lose a dish; say so plainly
          setError(decision === 'remove_from_bill' && /current state/i.test(message) ? t.decisionsScreen.billClosed : message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <strong>
        {t.kitchen.table(problem.table_number)}: {problem.quantity}× {problem.item_name}
      </strong>
      <span style={{ color: '#b45309', fontWeight: 700, fontSize: '13px' }}>
        {t.problems.reasons[problem.reason]}
        {problem.note && ` · ${problem.note}`}
      </span>
      <span style={{ fontSize: '12px', color: '#64748b' }}>{t.problems.people(problem.ready_by_name, problem.served_by_name, problem.reported_by_name)}</span>
      <span style={{ fontSize: '12px', color: '#64748b' }} data-testid="problem-times">
        {t.decisionsScreen.times(clock(problem.reported_at), clock(problem.started_at), clock(problem.ready_at), clock(problem.served_at))}
      </span>
      <div role="radiogroup" aria-label={t.decisionsScreen.decide} style={{ display: 'flex', gap: '12px', fontSize: '13px', flexWrap: 'wrap' }}>
        {(['remake', 'remove_from_bill'] as ProblemDecision[]).map((d) => (
          <label key={d} style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
            <input type="radio" name={`decision-${problem.id}`} checked={decision === d} onChange={() => setDecision(d)} />
            {t.problems.decisions[d]}
          </label>
        ))}
      </div>
      <label className="admin-input-label">
        {t.problems.fault}
        <select className="admin-input-control" value={fault} onChange={(e) => setFault(e.target.value as Fault)}>
          <option value="" disabled>
            {t.decisionsScreen.chooseFault}
          </option>
          {(['kitchen', 'waiter', 'none'] as Fault[]).map((f) => (
            <option key={f} value={f}>
              {t.problems.faults[f]}
            </option>
          ))}
        </select>
      </label>
      <button type="submit" className="admin-save-pill-btn" disabled={busy || !ready} style={{ opacity: ready ? 1 : 0.45, cursor: ready ? 'pointer' : 'not-allowed' }}>
        {t.decisionsScreen.decide}
      </button>
      {!ready && <span style={{ fontSize: '12px', color: '#64748b' }}>{t.decisionsScreen.chooseBoth}</span>}
      {error && (
        <span role="alert" style={{ color: '#dc2626', fontSize: '12px' }}>
          {error}
        </span>
      )}
    </form>
  );
}

function WalkoutCard({ walkout, currency, onDecided }: { walkout: Walkout; currency: string; onDecided: () => void }) {
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const decide = async (decision: WalkoutDecision) => {
    setBusy(true);
    setError(null);
    try {
      await decideWalkout(walkout.bill_id, decision, note);
      onDecided();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div data-testid={`walkout-${walkout.bill_id}`} style={cardStyle}>
      <strong>{t.walkouts.summary(walkout.table_number, formatPrice(walkout.amount, currency), walkout.waiter_name)}</strong>
      {walkout.walkout_at && (
        <span style={{ fontSize: '12px', color: '#64748b' }}>
          {t.walkouts.markedAt(clock(walkout.walkout_at), walkout.marked_by_name)}
        </span>
      )}
      <input className="admin-input-control" aria-label={t.walkouts.note} placeholder={t.walkouts.note} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} />
      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
        {(['waiter_pays', 'restaurant_loss'] as WalkoutDecision[]).map((d) => (
          <button key={d} type="button" className="admin-sec-pill-btn" disabled={busy} onClick={() => decide(d)}>
            {t.walkouts.decisions[d]}
          </button>
        ))}
      </div>
      {error && (
        <span role="alert" style={{ color: '#dc2626', fontSize: '12px' }}>
          {error}
        </span>
      )}
    </div>
  );
}
