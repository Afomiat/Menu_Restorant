import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Bill, CartItem, Decisions, Fault, Problem, ProblemDecision, Walkout, WalkoutDecision } from '../types';
import { decideProblem, decideWalkout, fetchDecisions } from '../services/problemService';
import { fetchBills } from '../services/billService';
import { formatPrice } from '../utils/currency';
import { groupTickets } from '../utils/orderBoards';
import { timerState } from '../utils/kitchenTimer';
import { useNow } from '../hooks/useNow';
import { CheckCircle2 } from 'lucide-react';
import PushButton from './PushButton';
import { BusyButton, SkeletonBlocks } from './Loading';
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
      <div className="rpt-header">
        <div>
          <h1 className="admin-top-title" style={{ margin: 0 }}>{t.decisionsScreen.title}</h1>
          <p className="rpt-subtitle">{t.decisionsScreen.subtitle}</p>
        </div>
      </div>
      <PushButton />
      {error && <p role="status" style={{ color: '#dc2626', fontSize: '14px', margin: 0 }}>{error}</p>}

      {/* Until the first answer: the page's outline */}
      {!data && !error && <SkeletonBlocks kpis={4} sections={[{ kind: 'cards', count: 2 }, { kind: 'rows', count: 3 }]} label={t.decisionsScreen.title} />}

      {data && (
        <>
          <div className="rpt-kpis" role="region" aria-label={t.decisionsScreen.summary}>
            <Counter label={t.decisionsScreen.problems} count={data.problems.length} tone="warn" />
            <Counter label={t.decisionsScreen.walkouts} count={data.walkouts.length} tone="bad" />
            <Counter label={t.decisionsScreen.late} count={late.length} tone="bad" />
            <Counter label={t.decisionsScreen.unpaid} count={unpaid.length} tone="warn" />
          </div>

          {nothing && (
            <div className="rpt-panel alr-clear">
              <CheckCircle2 size={28} />
              <div>
                <strong>{t.decisionsScreen.none}</strong>
                <p className="rpt-muted" style={{ margin: '4px 0 0' }}>{t.decisionsScreen.noneHint}</p>
              </div>
            </div>
          )}

          {data.problems.length > 0 && (
            <section aria-label={t.decisionsScreen.problems} className="bill-section">
              <h2 className="bill-section-title">
                {t.decisionsScreen.problems} <span className="rpt-count">{data.problems.length}</span>
              </h2>
              <div className="admin-kitchen-tickets-grid">
                {data.problems.map((p) => (
                  <ProblemCard key={p.id} problem={p} onDecided={load} />
                ))}
              </div>
            </section>
          )}

          {data.walkouts.length > 0 && (
            <section aria-label={t.decisionsScreen.walkouts} className="bill-section">
              <h2 className="bill-section-title">
                {t.decisionsScreen.walkouts} <span className="rpt-count">{data.walkouts.length}</span>
              </h2>
              <div className="admin-kitchen-tickets-grid">
                {data.walkouts.map((w) => (
                  <WalkoutCard key={w.bill_id} walkout={w} currency={currency} onDecided={load} />
                ))}
              </div>
            </section>
          )}

          {late.length > 0 && (
            <section aria-label={t.decisionsScreen.late} className="bill-section">
              <h2 className="bill-section-title">
                {t.decisionsScreen.late} <span className="rpt-count">{late.length}</span>
              </h2>
              <ul className="rpt-rows rpt-loss-list">
                {late.map((tk) => (
                  <li key={tk.orderId} data-testid={`late-${tk.orderId}`} className="rpt-row rpt-loss">
                    <span className="rpt-row-main rpt-stack">
                      <strong>{t.decisionsScreen.lateLine(tk.tableNumber, Math.floor((now - (tk.startedAt || now)) / MIN), tk.targetMinutes)}</strong>
                      <span className="rpt-muted">{tk.items.map((row) => `${row.quantity}× ${row.item.name}`).join(', ')}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {unpaid.length > 0 && (
            <section aria-label={t.decisionsScreen.unpaid} className="bill-section">
              <h2 className="bill-section-title">
                {t.decisionsScreen.unpaid} <span className="rpt-count">{unpaid.length}</span>
              </h2>
              <ul className="rpt-rows rpt-loss-list">
                {unpaid.map((b) => (
                  <li key={b.id} data-testid={`unpaid-${b.id}`} className="rpt-row rpt-loss rpt-loss-warn">
                    <span className="rpt-row-main rpt-stack">
                      <strong>
                        {b.status === 'collected'
                          ? t.decisionsScreen.collectedAgo(b.table_number, minutesSince(b.collected_at, now))
                          : t.decisionsScreen.askedAgo(b.table_number, minutesSince(b.requested_at, now))}
                      </strong>
                      <span className="rpt-muted">{b.waiter_name ? t.decisionsScreen.waiterName(b.waiter_name) : t.reports.noWaiter}</span>
                    </span>
                    <strong>{formatPrice(b.status === 'collected' ? b.amount_paid : b.amount_owed, currency)}</strong>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </section>
  );
}

function Counter({ label, count, tone }: { label: string; count: number; tone: 'warn' | 'bad' }) {
  return (
    <div className={`rpt-kpi ${count > 0 ? `rpt-kpi-${tone}` : ''}`}>
      <span className="rpt-kpi-label">{label}</span>
      <strong className="rpt-kpi-value">{count}</strong>
    </div>
  );
}

/** "18:03", or "—" when that step has not happened. */
function clock(iso?: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

/** A row of pill-shaped choices; still radio buttons underneath, for keyboards and screen readers. */
function Choices<T extends string>({ name, label, options, value, onChange }: { name: string; label: string; options: { value: T; label: string }[]; value: T | null | ''; onChange: (v: T) => void }) {
  return (
    <div role="radiogroup" aria-label={label} className="alr-choices">
      {options.map((o) => (
        <label key={o.value} className={`alr-choice ${value === o.value ? 'alr-choice-on' : ''}`}>
          <input type="radio" name={name} checked={value === o.value} onChange={() => onChange(o.value)} />
          {o.label}
        </label>
      ))}
    </div>
  );
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
      className="bill-card"
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
      <div className="bill-card-head">
        <strong className="bill-card-title">
          {t.kitchen.table(problem.table_number)}: {problem.quantity}× {problem.item_name}
        </strong>
        <span className="bill-status bill-status-bill_requested">{t.problems.reasons[problem.reason]}</span>
      </div>
      {problem.note && <p className="alr-note">“{problem.note}”</p>}
      <div className="alr-facts">
        <span>{t.problems.people(problem.ready_by_name, problem.served_by_name, problem.reported_by_name)}</span>
        <span data-testid="problem-times">
          {t.decisionsScreen.times(clock(problem.reported_at), clock(problem.started_at), clock(problem.ready_at), clock(problem.served_at))}
        </span>
      </div>
      <Choices
        name={`decision-${problem.id}`}
        label={t.decisionsScreen.decide}
        options={(['remake', 'remove_from_bill'] as ProblemDecision[]).map((d) => ({ value: d, label: t.problems.decisions[d] }))}
        value={decision}
        onChange={setDecision}
      />
      <div className="alr-fault">
        <span className="alr-fault-label">{t.problems.fault}</span>
        <Choices
          name={`fault-${problem.id}`}
          label={t.problems.fault}
          options={(['kitchen', 'waiter', 'none'] as Fault[]).map((f) => ({ value: f, label: t.problems.faults[f] }))}
          value={fault}
          onChange={setFault}
        />
      </div>
      <BusyButton type="submit" className="admin-save-pill-btn" busy={busy} disabled={!ready} style={{ justifySelf: 'start', opacity: ready ? 1 : 0.45 }}>
        {t.decisionsScreen.decide}
      </BusyButton>
      {!ready && <span className="rpt-muted">{t.decisionsScreen.chooseBoth}</span>}
      {error && (
        <span role="alert" style={{ color: '#dc2626', fontSize: '14px' }}>
          {error}
        </span>
      )}
    </form>
  );
}

function WalkoutCard({ walkout, currency, onDecided }: { walkout: Walkout; currency: string; onDecided: () => void }) {
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState<WalkoutDecision | null>(null);
  const [error, setError] = useState<string | null>(null);

  const decide = async (decision: WalkoutDecision) => {
    setBusy(decision);
    setError(null);
    try {
      await decideWalkout(walkout.bill_id, decision, note);
      onDecided();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div data-testid={`walkout-${walkout.bill_id}`} className="bill-card">
      <div className="bill-card-head">
        <strong className="bill-card-title">{t.walkouts.summary(walkout.table_number, formatPrice(walkout.amount, currency), walkout.waiter_name)}</strong>
      </div>
      {walkout.walkout_at && <div className="alr-facts">{t.walkouts.markedAt(clock(walkout.walkout_at), walkout.marked_by_name)}</div>}
      <input className="admin-input-control" aria-label={t.walkouts.note} placeholder={t.walkouts.note} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} />
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        {(['waiter_pays', 'restaurant_loss'] as WalkoutDecision[]).map((d) => (
          <BusyButton key={d} className="admin-sec-pill-btn" busy={busy === d} disabled={busy !== null} onClick={() => decide(d)}>
            {t.walkouts.decisions[d]}
          </BusyButton>
        ))}
      </div>
      {error && (
        <span role="alert" style={{ color: '#dc2626', fontSize: '14px' }}>
          {error}
        </span>
      )}
    </div>
  );
}
