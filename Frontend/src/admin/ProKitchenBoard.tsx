import { useEffect, useMemo, useRef } from 'react';
import { BellRing, ChefHat, CheckCircle2, Play, Volume2, X } from 'lucide-react';
import type { CartItem, OrderStatus, StaffRole } from '../types';
import { useNow } from '../hooks/useNow';
import { formatDuration, formatWaited, timerState, type TimerColor } from '../utils/kitchenTimer';
import { canManage } from '../utils/roles';
import { groupTickets, type KitchenTicket } from '../utils/orderBoards';
import SoldOutButton from './SoldOutButton';
import { t } from '../i18n/en';

interface ProKitchenBoardProps {
  orders: CartItem[];
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
    if (seenRef.current === null) {
      seenRef.current = new Set(tickets.map((tk) => tk.orderId));
      return;
    }
    const seen = seenRef.current;
    if (tickets.some((tk) => !seen.has(tk.orderId) && tk.status === 'not_started')) bell.ring('bell');
    tickets.forEach((tk) => seen.add(tk.orderId));
  }, [tickets, bell]);

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

  return (
    <section className="admin-kitchen-page-view" aria-label={t.kitchen.title}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', marginBottom: '18px', flexWrap: 'wrap' }}>
        <h1 className="admin-top-title" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
          <ChefHat size={24} /> {t.kitchen.title}
        </h1>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {onOpenSoldOut && (
            <SoldOutButton count={soldOutCount} onClick={onOpenSoldOut} />
          )}
          {!bell.enabled && (
            <button type="button" className="admin-save-pill-btn" onClick={() => bell.enable()}>
              <Volume2 size={16} /> {t.kitchen.enableSound}
            </button>
          )}
        </div>
      </div>

      {tables.length === 0 ? (
        <p style={{ color: '#64748b', fontSize: '15px' }}>{t.kitchen.empty}</p>
      ) : (
        <div className="admin-kitchen-tickets-grid">
          {tables.map(([tableNumber, tableTickets]) => (
            <div key={tableNumber} className="admin-kitchen-table-card" data-testid={`kitchen-table-${tableNumber}`}>
              <div className="admin-kitchen-card-header">
                <strong style={{ fontSize: '17px' }}>{t.kitchen.table(tableNumber)}</strong>
              </div>
              <div style={{ display: 'grid', gap: '12px', padding: '14px 16px' }}>
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
    </section>
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
      // Food already cooked waits for the waiter: dimmed and last, so the chef's eye goes to what still needs cooking
      style={{ border: `2px solid ${borderColor}`, borderRadius: '12px', padding: '12px', background: isReady ? '#f8fafc' : '#fff', opacity: isReady ? 0.65 : 1 }}
    >
      {ticket.remakeOf && (
        <span style={{ display: 'inline-block', marginBottom: '6px', fontSize: '11px', fontWeight: 800, color: '#fff', background: '#b91c1c', padding: '2px 8px', borderRadius: '999px' }}>
          {t.kitchen.remake}
        </span>
      )}
      <ul style={{ listStyle: 'none', margin: '0 0 10px', padding: 0, display: 'grid', gap: '4px' }}>
        {ticket.items.map((row, i) => (
          <li key={`${row.item.id}-${i}`} style={{ fontSize: '14px', color: '#0f172a' }}>
            <strong>{row.quantity}×</strong> {row.item.name}
            {row.notes && <span style={{ color: '#b45309' }}> · {row.notes}</span>}
          </li>
        ))}
      </ul>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '13px', fontWeight: 700, color: timer ? TIMER_COLORS[timer.color] : '#475569' }} data-testid="ticket-time">
          {ticket.status === 'not_started' && t.kitchen.waiting(formatWaited(ticket.placedAt, now), ticket.targetMinutes)}
          {timer && `${formatDuration(timer.elapsedMs)} / ${ticket.targetMinutes}:00`}
          {ticket.status === 'preparing' && !timer && t.kitchen.cooking}
          {ticket.status === 'ready' && t.kitchen.readyWaiting}
        </span>

        <div style={{ display: 'flex', gap: '6px' }}>
          {ticket.status === 'not_started' && (
            <>
              <button type="button" className="admin-save-pill-btn" onClick={() => onStatus('preparing')}>
                <Play size={14} /> {t.kitchen.start}
              </button>
              {onCancel && (
                <button type="button" className="admin-sec-pill-btn" onClick={onCancel} aria-label={t.kitchen.cancel}>
                  <X size={14} />
                </button>
              )}
            </>
          )}
          {ticket.status === 'preparing' && (
            <button type="button" className="admin-save-pill-btn" onClick={() => onStatus('ready')}>
              <BellRing size={14} /> {t.kitchen.ready}
            </button>
          )}
          {ticket.status === 'ready' && canServe && (
            <button type="button" className="admin-sec-pill-btn" onClick={() => onStatus('complete')}>
              <CheckCircle2 size={14} /> {t.kitchen.served}
            </button>
          )}
        </div>
      </div>
    </article>
  );
}
