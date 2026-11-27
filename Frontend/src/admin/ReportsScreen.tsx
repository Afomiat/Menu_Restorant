import { useEffect, useState, type ReactNode } from 'react';
import { DoorOpen, MinusCircle, RotateCcw } from 'lucide-react';
import type { DailyReport, PaymentMethod } from '../types';
import { fetchDailyReport } from '../services/problemService';
import { formatPrice } from '../utils/currency';
import { todayInEthiopia } from '../utils/kitchenTimer';
import { t } from '../i18n/en';
import { SkeletonBlocks } from './Loading';

// One colour per way of paying, used in the bar and its legend
const METHOD_COLORS: Record<PaymentMethod, string> = {
  cash: '#16a34a',
  telebirr: '#2563eb',
  cbe_birr_bank: '#7c3aed',
};

const percent = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 100) : 0);

/** The manager's daily report (Pro): the day's money, each waiter, losses, kitchen times and open bills. */
export default function ReportsScreen({ currency = 'ETB' }: { currency?: string }) {
  const [date, setDate] = useState(todayInEthiopia());
  const [report, setReport] = useState<DailyReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  // The day whose report is on screen; while it differs from the picked day, the new one is loading
  const [loadedDate, setLoadedDate] = useState<string | null>(null);
  const money = (v: number) => formatPrice(v, currency);

  useEffect(() => {
    let current = true;
    fetchDailyReport(date)
      .then((r) => {
        if (!current) return;
        setReport(r);
        setLoadedDate(date);
        setError(null);
      })
      .catch((err: unknown) => {
        if (!current) return;
        setLoadedDate(date);
        setError(err instanceof Error ? err.message : 'Failed to load the report');
      });
    // A slow answer for a day no longer picked must not replace the newer one
    return () => {
      current = false;
    };
  }, [date]);
  const loading = loadedDate !== date;

  const today = todayInEthiopia();

  return (
    <section className="admin-kitchen-page-view" aria-label={t.reports.title}>
      <div className="rpt-header">
        <div>
          <h1 className="admin-top-title" style={{ margin: 0 }}>{t.reports.title}</h1>
          <p className="rpt-subtitle">{t.reports.subtitle}</p>
        </div>
        <div className="rpt-date">
          {date !== today && (
            <button type="button" className="admin-sec-pill-btn" onClick={() => setDate(today)}>
              {t.reports.today}
            </button>
          )}
          <label className="rpt-date-label">
            {t.reports.date}
            <input type="date" className="admin-input-control" value={date} max={today} onChange={(e) => e.target.value && setDate(e.target.value)} />
          </label>
        </div>
      </div>

      {error && <p role="status" style={{ color: '#dc2626', fontSize: '13px', margin: 0 }}>{error}</p>}

      {loading ? (
        <SkeletonBlocks
          kpis={4}
          sections={[{ kind: 'panel', lines: 4 }, { kind: 'panel', lines: 3 }, { kind: 'rows', count: 5 }]}
          label={t.reports.title}
        />
      ) : (
        report && !error && <ReportBody report={report} money={money} />
      )}
    </section>
  );
}

function ReportBody({ report, money }: { report: DailyReport; money: (v: number) => string }) {
  const payments = report.sales_by_method.reduce((n, m) => n + m.payments, 0);
  const confirmed = report.waiters.reduce((sum, w) => sum + w.confirmed, 0);
  const notConfirmed = report.waiters.reduce((sum, w) => sum + w.collected_not_confirmed, 0);
  const walkoutLoss = report.walkouts.reduce((sum, w) => sum + w.amount, 0);
  const removedLoss = report.removed_dishes.reduce((sum, p) => sum + (p.removed_amount || 0), 0);
  const lost = walkoutLoss + removedLoss;

  return (
    <>
      {/* The day at a glance */}
      <div className="rpt-kpis" role="region" aria-label={t.reports.summary}>
        <Kpi label={t.reports.collected} value={money(report.sales_total)} hint={t.reports.payments(payments)} />
        <Kpi label={t.reports.confirmed} value={money(confirmed)} hint={t.reports.confirmedShare(percent(confirmed, report.sales_total))} />
        <Kpi label={t.reports.notConfirmed} value={money(notConfirmed)} hint={t.reports.notConfirmedHint} tone={notConfirmed > 0 ? 'warn' : undefined} />
        <Kpi
          label={t.reports.lost}
          value={money(lost)}
          hint={t.reports.lostHint(report.walkouts.length, report.removed_dishes.length)}
          tone={lost > 0 ? 'bad' : undefined}
        />
      </div>

      <div className="rpt-two">
        <Panel title={t.reports.sales}>
          {report.sales_by_method.length === 0 ? (
            <Empty />
          ) : (
            <>
              <div className="rpt-split" aria-hidden="true">
                {report.sales_by_method.map((m) => (
                  <span key={m.method} style={{ width: `${percent(m.amount, report.sales_total)}%`, background: METHOD_COLORS[m.method] }} />
                ))}
              </div>
              <ul className="rpt-rows">
                {report.sales_by_method.map((m) => (
                  <li key={m.method} className="rpt-row">
                    <span className="rpt-row-main">
                      <span className="rpt-dot" style={{ background: METHOD_COLORS[m.method] }} />
                      {t.bills.methods[m.method]}
                      <span className="rpt-muted">{t.reports.payments(m.payments)}</span>
                    </span>
                    <span className="rpt-row-end">
                      <strong>{money(m.amount)}</strong>
                      <span className="rpt-muted rpt-pct">{percent(m.amount, report.sales_total)}%</span>
                    </span>
                  </li>
                ))}
                <li className="rpt-row rpt-row-total">
                  <span>{t.reports.salesTotal}</span>
                  <strong>{money(report.sales_total)}</strong>
                </li>
              </ul>
            </>
          )}
        </Panel>

        <Panel title={t.reports.waiters}>
          {report.waiters.length === 0 ? (
            <Empty />
          ) : (
            <ul className="rpt-rows">
              {report.waiters.map((w) => (
                <li key={w.waiter_id || 'none'} className="rpt-waiter">
                  <div className="rpt-row">
                    <span className="rpt-row-main">
                      <strong>{w.waiter_name || t.reports.noWaiter}</strong>
                      <span className="rpt-muted">{t.reports.waiterLine(w.bills, money(w.sales))}</span>
                    </span>
                    {w.walkouts > 0 && <span className="rpt-chip rpt-chip-bad">{t.reports.walkoutCount(w.walkouts)}</span>}
                  </div>
                  {w.collected > 0 && (
                    <>
                      <div className="rpt-meter" aria-hidden="true">
                        <span style={{ width: `${percent(w.confirmed, w.collected)}%` }} />
                      </div>
                      <div className="rpt-row rpt-small">
                        <span className="rpt-muted">{t.reports.waiterConfirmed(money(w.confirmed), money(w.collected))}</span>
                        {w.collected_not_confirmed > 0 && <span className="rpt-warn">{t.reports.waiterPending(money(w.collected_not_confirmed))}</span>}
                      </div>
                    </>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <Panel title={t.reports.losses}>
        {report.walkouts.length === 0 && report.removed_dishes.length === 0 && !report.remade_dishes?.length ? (
          <p className="rpt-empty">{t.reports.noLosses}</p>
        ) : (
          <>
            {report.walkouts.length > 0 && (
              <LossGroup title={t.reports.walkouts} icon={<DoorOpen size={16} />} count={report.walkouts.length} subtotal={`−${money(walkoutLoss)}`}>
                {report.walkouts.map((w) => (
                  <li key={w.bill_id} className="rpt-row rpt-loss">
                    <span className="rpt-row-main rpt-stack">
                      <span>{t.reports.walkoutLine(w.table_number, w.waiter_name)}</span>
                      <span className="rpt-muted">
                        {w.decision ? t.walkouts.decisions[w.decision] : t.reports.undecided}
                        {w.note && ` · ${w.note}`}
                      </span>
                    </span>
                    <strong className="rpt-bad">−{money(w.amount)}</strong>
                  </li>
                ))}
              </LossGroup>
            )}
            {report.removed_dishes.length > 0 && (
              <LossGroup title={t.reports.removed} icon={<MinusCircle size={16} />} count={report.removed_dishes.length} subtotal={`−${money(removedLoss)}`}>
                {report.removed_dishes.map((p) => (
                  <li key={p.id} className="rpt-row rpt-loss">
                    <span className="rpt-row-main rpt-stack">
                      <span>
                        {t.kitchen.table(p.table_number)}: {p.quantity}× {p.item_name}
                      </span>
                      <span className="rpt-muted">
                        {t.problems.reasons[p.reason] || p.reason}
                        {p.fault && ` · ${t.reports.atFault(t.problems.faults[p.fault])}`}
                      </span>
                    </span>
                    <strong className="rpt-bad">−{money(p.removed_amount || 0)}</strong>
                  </li>
                ))}
              </LossGroup>
            )}
            {report.remade_dishes && report.remade_dishes.length > 0 && (
              <LossGroup title={t.reports.remade} icon={<RotateCcw size={16} />} count={report.remade_dishes.length} tone="warn">
                {report.remade_dishes.map((p) => (
                  <li key={p.id} className="rpt-row rpt-loss rpt-loss-warn">
                    <span className="rpt-row-main rpt-stack">
                      <span>
                        {t.kitchen.table(p.table_number)}: {p.quantity}× {p.item_name}
                      </span>
                      <span className="rpt-muted">
                        {t.problems.reasons[p.reason] || p.reason}
                        {p.fault && ` · ${t.reports.atFault(t.problems.faults[p.fault])}`}
                      </span>
                    </span>
                  </li>
                ))}
              </LossGroup>
            )}
            {lost > 0 && (
              <div className="rpt-row rpt-row-total" data-testid="losses-total">
                <span>{t.reports.lossesTotal}</span>
                <strong className="rpt-bad">−{money(lost)}</strong>
              </div>
            )}
          </>
        )}
      </Panel>

      <Panel title={t.reports.kitchen} hint={t.reports.kitchenHint}>
        {report.kitchen.length === 0 ? (
          <Empty />
        ) : (
          <ul className="rpt-rows">
            {[...report.kitchen]
              .sort((a, b) => b.avg_minutes / (b.target_minutes || 1) - a.avg_minutes / (a.target_minutes || 1))
              .map((k) => {
                // The track is one and a half times the prep time; the tick marks the prep time itself
                const scale = Math.max(k.target_minutes * 1.5, k.avg_minutes, 1);
                const slow = k.avg_minutes > k.target_minutes;
                return (
                  <li key={k.item_name} className="rpt-kitchen" data-testid={`kitchen-${k.item_name}`}>
                    <div className="rpt-row">
                      <span className="rpt-row-main">
                        <strong>{k.item_name}</strong>
                        <span className="rpt-muted">{t.reports.orders(k.orders)}</span>
                      </span>
                      <span className="rpt-row-end">
                        <span className={slow ? 'rpt-warn' : 'rpt-muted'}>
                          {t.reports.kitchenLine(t.reports.minutes(k.avg_minutes), t.reports.minutes(k.target_minutes))}
                        </span>
                        {k.late > 0 && <span className="rpt-chip rpt-chip-bad">{t.reports.late(k.late)}</span>}
                      </span>
                    </div>
                    <div className="rpt-time" aria-hidden="true">
                      <span className={slow ? 'rpt-time-slow' : ''} style={{ width: `${(k.avg_minutes / scale) * 100}%` }} />
                      <i style={{ left: `${(k.target_minutes / scale) * 100}%` }} />
                    </div>
                  </li>
                );
              })}
          </ul>
        )}
      </Panel>

      <Panel title={t.reports.openBills}>
        {report.open_bills.length === 0 ? (
          <Empty />
        ) : (
          <ul className="rpt-rows">
            {report.open_bills.map((b) => (
              <li key={b.bill_id} className="rpt-row">
                <span className="rpt-row-main">
                  <strong>{t.kitchen.table(b.table_number)}</strong>
                  <span className={`rpt-chip ${b.status === 'bill_requested' ? 'rpt-chip-warn' : ''}`}>{t.bills.status[b.status]}</span>
                  <span className="rpt-muted">{b.waiter_name || t.reports.noWaiter}</span>
                </span>
                {/* A collected bill owes nothing: its money is waiting for the cashier */}
                <span className="rpt-row-end">
                  <strong>{money(b.status === 'collected' ? b.amount_paid : Math.max(0, b.total_amount - b.amount_paid))}</strong>
                  <span className="rpt-muted">{b.status === 'collected' ? t.reports.toConfirm : t.reports.owed}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </>
  );
}

function Kpi({ label, value, hint, tone }: { label: string; value: string; hint: string; tone?: 'warn' | 'bad' }) {
  return (
    <div className={`rpt-kpi ${tone ? `rpt-kpi-${tone}` : ''}`}>
      <span className="rpt-kpi-label">{label}</span>
      <strong className="rpt-kpi-value">{value}</strong>
      <span className="rpt-kpi-hint">{hint}</span>
    </div>
  );
}

function Panel({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <div className="rpt-panel" role="region" aria-label={title}>
      <h2 className="rpt-panel-title">{title}</h2>
      {hint && <p className="rpt-panel-hint">{hint}</p>}
      {children}
    </div>
  );
}

function LossGroup({
  title,
  icon,
  count,
  subtotal,
  tone = 'bad',
  children,
}: {
  title: string;
  icon: ReactNode;
  count: number;
  subtotal?: string;
  tone?: 'bad' | 'warn';
  children: ReactNode;
}) {
  return (
    <div className="rpt-group">
      <div className="rpt-group-head">
        <h3 className={`rpt-group-title rpt-group-${tone}`}>
          {icon} {title}
          <span className="rpt-count">{count}</span>
        </h3>
        {subtotal && <strong className="rpt-bad">{subtotal}</strong>}
      </div>
      <ul className="rpt-rows rpt-loss-list">{children}</ul>
    </div>
  );
}

function Empty() {
  return <p className="rpt-empty">{t.reports.nothing}</p>;
}
