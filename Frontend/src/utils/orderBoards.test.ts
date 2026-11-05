import { describe, expect, it } from 'vitest';
import type { BackendOrder, CartItem, MenuItem, OrderStatus } from '../types';
import { groupTickets, tableState } from './orderBoards';

const dish = (name: string): MenuItem => ({ id: name, name, price: 100, imageUrl: '', description: '', tags: [], available: true, categoryId: 'all' });
const row = (orderId: string, name: string, status: OrderStatus, extra: Partial<CartItem> = {}): CartItem => ({
  item: dish(name),
  quantity: 1,
  orderId,
  status,
  tableNumber: '5',
  placedAt: 1000,
  ...extra,
});

describe('groupTickets', () => {
  it('makes one ticket per order with all its dishes', () => {
    const tickets = groupTickets([row('a', 'Tibs', 'not_started', { targetMinutes: 25 }), row('a', 'Shiro', 'not_started', { targetMinutes: 25 })]);

    expect(tickets).toHaveLength(1);
    expect(tickets[0].items.map((r) => r.item.name)).toEqual(['Tibs', 'Shiro']);
    expect(tickets[0].targetMinutes).toBe(25);
  });

  it('leaves out served and cancelled orders and sorts oldest first', () => {
    const tickets = groupTickets([
      row('late', 'Buna', 'not_started', { placedAt: 3000 }),
      row('done', 'Tibs', 'complete'),
      row('gone', 'Shiro', 'cancelled'),
      row('early', 'Firfir', 'preparing', { placedAt: 2000, startedAt: 2500 }),
    ]);

    expect(tickets.map((tk) => tk.orderId)).toEqual(['early', 'late']);
    expect(tickets[0].startedAt).toBe(2500);
  });

  it('uses the default prep time for orders without a target', () => {
    expect(groupTickets([row('a', 'Tibs', 'not_started')], 12)[0].targetMinutes).toBe(12);
  });
});

describe('tableState', () => {
  const order = (status: OrderStatus) => ({ id: status, status }) as BackendOrder;

  it('shows the most urgent thing a table is waiting for', () => {
    expect(tableState([order('not_started'), order('ready'), order('preparing')])).toBe('ready');
    expect(tableState([order('not_started'), order('preparing')])).toBe('cooking');
    expect(tableState([order('pending_grace')])).toBe('ordered');
    expect(tableState([])).toBe('none');
  });
});
