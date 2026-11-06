import { useCallback, useEffect, useState } from 'react';
import type { Decisions, Fault, Problem, ProblemDecision, Walkout, WalkoutDecision } from '../types';
import { decideProblem, decideWalkout, fetchDecisions } from '../services/problemService';
import { formatPrice } from '../utils/currency';
import PushButton from './PushButton';
import { t } from '../i18n/en';

interface DecisionsScreenProps {
  currency?: string;
  refreshSignal: number;
}

/** The manager's Alerts (Pro): problems with dishes and walkouts waiting for a decision. */
export default function DecisionsScreen({ currency = 'ETB', refreshSignal }: DecisionsScreenProps) {
  const [data, setData] = useState<Decisions | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    fetchDecisions()
      .then((d) => {
        setData(d);
        setError(null);
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Failed to load'));
  }, []);

  useEffect(() => {
    load();
  }, [load, refreshSignal]);

  const nothing = data && data.problems.length === 0 && data.walkouts.length === 0;

  return (
    <section className="admin-kitchen-page-view" aria-label={t.decisionsScreen.title}>
      <h1 className="admin-top-title" style={{ margin: '0 0 12px' }}>{t.decisionsScreen.title}</h1>
      <PushButton />
      {error && <p role="status" style={{ color: '#dc2626', fontSize: '13px' }}>{error}</p>}
      {nothing && <p style={{ color: '#64748b' }}>{t.decisionsScreen.none}</p>}

      {data && data.problems.length > 0 && (
        <>
          <h2 style={{ fontSize: '15px', margin: '0 0 8px' }}>{t.decisionsScreen.problems}</h2>
          <div className="admin-kitchen-tickets-grid" style={{ marginBottom: '20px' }}>
            {data.problems.map((p) => (
              <ProblemCard key={p.id} problem={p} onDecided={load} />
            ))}
          </div>
        </>
      )}

      {data && data.walkouts.length > 0 && (
        <>
          <h2 style={{ fontSize: '15px', margin: '0 0 8px' }}>{t.decisionsScreen.walkouts}</h2>
          <div className="admin-kitchen-tickets-grid">
            {data.walkouts.map((w) => (
              <WalkoutCard key={w.bill_id} walkout={w} currency={currency} onDecided={load} />
            ))}
          </div>
        </>
      )}
    </section>
  );
}

const cardStyle = { border: '1px solid #e2e8f0', borderRadius: '12px', padding: '12px', background: '#fff', display: 'grid', gap: '8px' } as const;

function ProblemCard({ problem, onDecided }: { problem: Problem; onDecided: () => void }) {
  const [decision, setDecision] = useState<ProblemDecision>('remake');
  const [fault, setFault] = useState<Fault>('kitchen');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      data-testid={`problem-${problem.id}`}
      aria-label={`${problem.item_name}, ${t.kitchen.table(problem.table_number)}`}
      style={cardStyle}
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError(null);
        try {
          await decideProblem(problem.id, decision, fault);
          onDecided();
        } catch (err: unknown) {
          setError(err instanceof Error ? err.message : 'Failed');
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
      <div role="radiogroup" aria-label={t.decisionsScreen.decide} style={{ display: 'flex', gap: '12px', fontSize: '13px' }}>
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
          {(['kitchen', 'waiter', 'none'] as Fault[]).map((f) => (
            <option key={f} value={f}>
              {t.problems.faults[f]}
            </option>
          ))}
        </select>
      </label>
      <button type="submit" className="admin-save-pill-btn" disabled={busy}>
        {t.decisionsScreen.decide}
      </button>
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
