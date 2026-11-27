import { useEffect, useMemo, useRef } from 'react';
import { BellRing, ChefHat, CheckCircle2, Play, Volume2, X } from 'lucide-react';
import type { CartItem, OrderStatus, StaffRole } from '../types';
import { useNow } from '../hooks/useNow';
import { formatDuration, formatWaited, timerState, type TimerColor } from '../utils/kitchenTimer';
import { canManage } from '../utils/roles';
import { groupTickets, type KitchenTicket } from '../utils/orderBoards';
import SoldOutButton from './SoldOutButton';
import { SkeletonBlocks } from './Loading';
import { t } from '../i18n/en';

interface ProKitchenBoardProps {
  orders: CartItem[];
  /** True until the first orders arrive: the board's outline instead of "No open orders". */
  loading?: boolean;
  role: StaffRole | null;
  onOrderStatusChange: (orderId: string, status: OrderStatus) => void;
  onCancelOrder?: (orderId: string) => void;
  /** The screen's bell; sound only plays after a tap enables it. */
  bell: { enabled: boolean; enable: () => Promise<boolean> | boolean; ring: (kind?: 'bell' | 'alert') => void };
  /** Default prep time, for orders placed before targets were recorded. */
  defaultPrepMinutes?: number;
  /** Opens the sold-out list; the chef marks dishes the kitchen has run out of. */
  onOpenSoldOut?: () => void;
  /** How many dishes are sold out right now, shown on the button. */
  soldOutCount?: number;
  /** Fixed time for tests; the board ticks every second otherwise. */
  now?: number;
}

const TIMER_COLORS: Record<TimerColor, string> = { green: '#16a34a', yellow: '#ca8a04', red: '#dc2626' };

export default function ProKitchenBoard({
  orders,
  loading = false,
  role,
  onOrderStatusChange,
  onCancelOrder,
  bell,
  defaultPrepMinutes = 15,
  onOpenSoldOut,
  soldOutCount = 0,
  now: fixedNow,
}: ProKitchenBoardProps) {
  const tickingNow = useNow(1000);
  const now = fixedNow ?? tickingNow;
  const tickets = useMemo(() => groupTickets(orders, defaultPrepMinutes), [orders, defaultPrepMinutes]);

  // Orders already on screen when it opened do not ring; new ones and late ones ring once
  const seenRef = useRef<Set<string> | null>(null);
  const lateRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    // The first real list (after loading) is what was already there; only later orders ring
    if (loading) return;
    if (seenRef.current === null) {
      seenRef.current = new Set(tickets.map((tk) => tk.orderId));
      return;
    }
    const seen = seenRef.current;
    if (tickets.some((tk) => !seen.has(tk.orderId) && tk.status === 'not_started')) bell.ring('bell');
    tickets.forEach((tk) => seen.add(tk.orderId));
  }, [tickets, bell, loading]);

  useEffect(() => {
    for (const tk of tickets) {
      if (tk.status !== 'preparing' || !tk.startedAt || lateRef.current.has(tk.orderId)) continue;
      if (timerState(tk.startedAt, tk.targetMinutes, now).color === 'red') {
        lateRef.current.add(tk.orderId);
        bell.ring('alert');
      }
    }
  }, [tickets, now, bell]);

  const tables = useMemo(() => {
    const grouped = new Map<string, KitchenTicket[]>();
    for (const tk of tickets) grouped.set(tk.tableNumber, [...(grouped.get(tk.tableNumber) || []), tk]);
    return [...grouped.entries()];
  }, [tickets]);

  // The board at a glance: what waits for Start, what is cooking, what is late, what waits for the waiter
  const counts = useMemo(() => {
    let fresh = 0, cooking = 0, late = 0, ready = 0;
    for (const tk of tickets) {
      if (tk.status === 'ready') ready++;
      else if (tk.status === 'preparing') {
        cooking++;
        if (tk.startedAt && timerState(tk.startedAt, tk.targetMinutes, now).color === 'red') late++;
      } else fresh++;
    }
    return { fresh, cooking, late, ready };
  }, [tickets, now]);

  return (
    <section className="admin-kitchen-page-view" aria-label={t.kitchen.title}>
      <div className="rpt-header">
        <div>
          <h1 className="admin-top-title" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
            <ChefHat size={26} /> {t.kitchen.title}
          </h1>
          <p className="rpt-subtitle">{t.kitchen.subtitle}</p>
        </div>
        <div className="wt-actions">
          {onOpenSoldOut && <SoldOutButton count={soldOutCount} onClick={onOpenSoldOut} />}
          {!bell.enabled && (
            <button type="button" className="admin-save-pill-btn" onClick={() => bell.enable()}>
              <Volume2 size={16} /> {t.kitchen.enableSound}
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <SkeletonBlocks kpis={4} sections={[{ kind: 'cards', count: 4 }]} label={t.kitchen.title} />
      ) : (
        <>
          <div className="rpt-kpis" role="region" aria-label={t.kitchen.summary}>
            <KitchenCount label={t.kitchen.countNew} value={counts.fresh} />
            <KitchenCount label={t.kitchen.countCooking} value={counts.cooking} tone={counts.cooking > 0 ? 'warn' : undefined} />
            <KitchenCount label={t.kitchen.countLate} value={counts.late} tone={counts.late > 0 ? 'bad' : undefined} />
            <KitchenCount label={t.kitchen.countReady} value={counts.ready} tone={counts.ready > 0 ? 'good' : undefined} />
          </div>

          {tables.length === 0 ? (
            <div className="rpt-panel alr-clear">
              <ChefHat size={26} />
              <strong>{t.kitchen.empty}</strong>
            </div>
          ) : (
            <div className="admin-kitchen-tickets-grid">
              {tables.map(([tableNumber, tableTickets]) => (
                <div key={tableNumber} className="bill-card kt-table" data-testid={`kitchen-table-${tableNumber}`}>
                  <div className="bill-card-head">
                    <strong className="bill-card-title">{t.kitchen.table(tableNumber)}</strong>
                    <span className="rpt-count">{tableTickets.length}</span>
                  </div>
                  <div className="kt-tickets">
                    {tableTickets.map((tk) => (
                      <Ticket
                        key={tk.orderId}
                        ticket={tk}
                        now={now}
                        canServe={canManage(role)}
                        onStatus={(status) => onOrderStatusChange(tk.orderId, status)}
                        onCancel={onCancelOrder ? () => onCancelOrder(tk.orderId) : undefined}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </section>
  );
}

function KitchenCount({ label, value, tone }: { label: string; value: number; tone?: 'warn' | 'bad' | 'good' }) {
  return (
    <div className={`rpt-kpi ${tone ? `rpt-kpi-${tone}` : ''}`}>
      <span className="rpt-kpi-label">{label}</span>
      <strong className="rpt-kpi-value">{value}</strong>
    </div>
  );
}

function Ticket({
  ticket,
  now,
  canServe,
  onStatus,
  onCancel,
}: {
  ticket: KitchenTicket;
  now: number;
  canServe: boolean;
  onStatus: (status: OrderStatus) => void;
  onCancel?: () => void;
}) {
  const timer = ticket.status === 'preparing' && ticket.startedAt ? timerState(ticket.startedAt, ticket.targetMinutes, now) : null;
  const isReady = ticket.status === 'ready';
  const borderColor = timer ? TIMER_COLORS[timer.color] : isReady ? '#16a34a' : '#e2e8f0';

  return (
    <article
      data-testid={`ticket-${ticket.orderId}`}
      data-timer={timer?.color}
      data-ready={isReady || undefined}
      className="kt-ticket"
      // Food already cooked waits for the waiter: dimmed and last, so the chef's eye goes to what still needs cooking
      style={{ borderColor, background: isReady ? '#f8fafc' : '#fff', opacity: isReady ? 0.65 : 1 }}
    >
      {ticket.remakeOf && <span className="kt-remake">{t.kitchen.remake}</span>}
      <ul className="kt-dishes">
        {ticket.items.map((row, i) => (
          <li key={`${row.item.id}-${i}`}>
            <strong>{row.quantity}×</strong> {row.item.name}
            {row.notes && <span className="kt-note"> · {row.notes}</span>}
          </li>
        ))}
      </ul>

      {/* How far into the prep time: full at the prep time, red past it */}
      {timer && (
        <div className="kt-progress" aria-hidden="true">
          <span style={{ width: `${Math.min(100, timer.ratio * 100)}%`, background: TIMER_COLORS[timer.color] }} />
        </div>
      )}

      <div className="kt-foot">
        <span className={`kt-time ${timer ? 'kt-time-live' : ''}`} style={{ color: timer ? TIMER_COLORS[timer.color] : undefined }} data-testid="ticket-time">
          {ticket.status === 'not_started' && t.kitchen.waiting(formatWaited(ticket.placedAt, now), ticket.targetMinutes)}
          {timer && `${formatDuration(timer.elapsedMs)} / ${ticket.targetMinutes}:00`}
          {ticket.status === 'preparing' && !timer && t.kitchen.cooking}
          {ticket.status === 'ready' && t.kitchen.readyWaiting}
        </span>

        <div className="kt-buttons">
          {ticket.status === 'not_started' && (
            <>
              <button type="button" className="admin-save-pill-btn" onClick={() => onStatus('preparing')}>
                <Play size={16} /> {t.kitchen.start}
              </button>
              {onCancel && (
                <button type="button" className="admin-sec-pill-btn" onClick={onCancel} aria-label={t.kitchen.cancel}>
                  <X size={16} />
                </button>
              )}
            </>
          )}
          {ticket.status === 'preparing' && (
            <button type="button" className="admin-save-pill-btn" onClick={() => onStatus('ready')}>
              <BellRing size={16} /> {t.kitchen.ready}
            </button>
          )}
          {ticket.status === 'ready' && canServe && (
            <button type="button" className="admin-sec-pill-btn" onClick={() => onStatus('complete')}>
              <CheckCircle2 size={16} /> {t.kitchen.served}
            </button>
          )}
        </div>
      </div>
    </article>
  );
}
