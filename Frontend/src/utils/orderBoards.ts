import type { BackendOrder, CartItem, OrderStatus } from '../types';

export interface KitchenTicket {
  orderId: string;
  tableNumber: string;
  status: OrderStatus;
  placedAt: number;
  startedAt?: number;
  targetMinutes: number;
  items: CartItem[];
  /** Set when this ticket cooks a dish again after a problem; remakes come first. */
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
  return [...byOrder.values()].sort((a, b) => Number(!!b.remakeOf) - Number(!!a.remakeOf) || a.placedAt - b.placedAt);
}

/** What a waiter's table is waiting for. */
export type TableState = 'ready' | 'cooking' | 'ordered' | 'none';

export function tableState(orders: BackendOrder[]): TableState {
  if (orders.some((o) => o.status === 'ready')) return 'ready';
  if (orders.some((o) => o.status === 'preparing')) return 'cooking';
  if (orders.length > 0) return 'ordered';
  return 'none';
}
