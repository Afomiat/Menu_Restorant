import type { BackendOrder, Bill, CartItem, OrderStatus } from '../types';

export interface KitchenTicket {
  orderId: string;
  tableNumber: string;
  status: OrderStatus;
  placedAt: number;
  startedAt?: number;
  targetMinutes: number;
  items: CartItem[];
  /** Set when this ticket cooks a dish again after a problem; remakes come first (unless already ready). */
  remakeOf?: string;
}

/** Groups the kitchen's dish rows into one ticket per open order. */
export function groupTickets(orders: CartItem[], defaultPrepMinutes = 15): KitchenTicket[] {
  const byOrder = new Map<string, KitchenTicket>();
  for (const row of orders) {
    const status = row.status || 'not_started';
    if (!row.orderId || status === 'complete' || status === 'cancelled' || status === 'delivered') continue;
    let ticket = byOrder.get(row.orderId);
    if (!ticket) {
      ticket = {
        orderId: row.orderId,
        tableNumber: row.tableNumber || '?',
        status,
        placedAt: row.placedAt || Date.now(),
        startedAt: row.startedAt,
        targetMinutes: row.targetMinutes || defaultPrepMinutes,
        items: [],
        remakeOf: row.remakeOf,
      };
      byOrder.set(row.orderId, ticket);
    }
    ticket.items.push(row);
  }
  return [...byOrder.values()].sort((a, b) => ticketRank(a) - ticketRank(b) || a.placedAt - b.placedAt);
}

/** Kitchen order inside a table: remakes, then cooking, then new; food already ready goes last. */
function ticketRank(ticket: KitchenTicket): number {
  if (ticket.status === 'ready') return 3;
  if (ticket.remakeOf) return 0;
  return ticket.status === 'preparing' ? 1 : 2;
}

/** What a waiter's table is waiting for. */
export type TableState = 'ready' | 'cooking' | 'ordered' | 'none';

/** Served orders stay on the waiter's table (to report a problem) but no longer wait for anything. */
export const isServed = (status: string) => status === 'delivered' || status === 'complete';

export function tableState(orders: BackendOrder[]): TableState {
  orders = orders.filter((o) => !isServed(o.status));
  if (orders.some((o) => o.status === 'ready')) return 'ready';
  if (orders.some((o) => o.status === 'preparing')) return 'cooking';
  if (orders.length > 0) return 'ordered';
  return 'none';
}

/** Changes when any bill's state or payments change; used to refresh the shift totals. */
export function billsSignature(bills: Bill[]): string {
  return bills.map((b) => `${b.id}:${b.status}:${b.amount_paid}:${b.waiter_id ?? ''}`).sort().join('|');
}

// Bill states after which a live bill banner no longer needs anyone to act
const RESOLVED_BY: Record<string, string[]> = {
  'bill:requested': ['collected', 'confirmed', 'walkout'],
  'bill:reminder': ['collected', 'confirmed', 'walkout'],
  'bill:escalated': ['collected', 'confirmed', 'walkout'],
  'bill:collected': ['confirmed', 'walkout'],
  'bill:unconfirmed': ['confirmed', 'walkout'],
};

/** True when a bill banner is out of date because the bill has moved on (for example, confirmed). */
export function isBillAlertResolved(event: string, billId: string | undefined, bills: Bill[]): boolean {
  if (!billId || !RESOLVED_BY[event]) return false;
  const bill = bills.find((b) => b.id === billId);
  return !!bill && RESOLVED_BY[event].includes(bill.status);
}
