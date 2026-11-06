import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CartItem, MenuItem, OrderStatus } from '../types';

const patch = vi.fn();
const get = vi.fn();
vi.mock('./apiClient', () => ({
  apiClient: { patch: (...args: unknown[]) => patch(...args), get: (...args: unknown[]) => get(...args) },
}));

import {
  assignTableWaiter,
  fetchMyTables,
  getRestaurantOrders,
  isTableActionTarget,
  mapBackendOrderToCartItems,
  saveRestaurantOrders,
  updateTableOrdersStatus,
} from './orderService';
import type { BackendOrder } from '../types';

const dish: MenuItem = { id: 'tibs', name: 'Tibs', price: 300, imageUrl: '', description: '', tags: [], available: true, categoryId: 'all' };
const order = (id: string, status: OrderStatus, tableNumber = '5'): CartItem => ({
  item: dish,
  quantity: 1,
  orderId: `${id}-0000-0000-0000-000000000000`,
  status,
  tableNumber,
});

describe('isTableActionTarget', () => {
  it('only moves orders forward', () => {
    expect(isTableActionTarget(order('a', 'not_started'), '5', 'preparing')).toBe(true);
    expect(isTableActionTarget(order('a', 'ready'), '5', 'preparing')).toBe(false);
    expect(isTableActionTarget(order('a', 'preparing'), '5', 'preparing')).toBe(false);
    expect(isTableActionTarget(order('a', 'not_started'), '5', 'ready')).toBe(true);
    expect(isTableActionTarget(order('a', 'ready'), '5', 'complete')).toBe(true);
  });

  it('ignores other tables and finished orders', () => {
    expect(isTableActionTarget(order('a', 'not_started', '6'), '5', 'preparing')).toBe(false);
    expect(isTableActionTarget(order('a', 'complete'), '5', 'ready')).toBe(false);
    expect(isTableActionTarget(order('a', 'cancelled'), '5', 'preparing')).toBe(false);
  });
});

describe('updateTableOrdersStatus', () => {
  beforeEach(() => {
    localStorage.clear();
    patch.mockReset().mockResolvedValue({});
  });

  it('Start All for a second round leaves the ready dish ready', async () => {
    saveRestaurantOrders('bistro', [order('ready', 'ready'), order('coffee', 'not_started')]);

    await updateTableOrdersStatus('bistro', '5', 'preparing');

    const statuses = getRestaurantOrders('bistro').map((o) => o.status);
    expect(statuses).toEqual(['ready', 'preparing']);
    expect(patch).toHaveBeenCalledTimes(1);
    expect(patch).toHaveBeenCalledWith('/admin/orders/coffee-0000-0000-0000-000000000000/status', { status: 'preparing' });
  });
});

describe('updateTableOrdersStatus Mark All Ready and Served', () => {
  beforeEach(() => {
    localStorage.clear();
    patch.mockReset().mockResolvedValue({});
  });

  it('Mark All Ready readies new and cooking dishes but does not resend ready ones', async () => {
    saveRestaurantOrders('bistro', [order('new', 'not_started'), order('cook', 'preparing'), order('done', 'ready')]);

    await updateTableOrdersStatus('bistro', '5', 'ready');

    expect(getRestaurantOrders('bistro').map((o) => o.status)).toEqual(['ready', 'ready', 'ready']);
    expect(patch).toHaveBeenCalledTimes(2);
  });

  it('Served sends the backend status delivered and leaves other tables alone', async () => {
    saveRestaurantOrders('bistro', [order('done', 'ready'), order('other', 'ready', '6')]);

    await updateTableOrdersStatus('bistro', '5', 'complete');

    expect(getRestaurantOrders('bistro').map((o) => o.status)).toEqual(['complete', 'ready']);
    expect(patch).toHaveBeenCalledWith('/admin/orders/done-0000-0000-0000-000000000000/status', { status: 'delivered' });
    expect(patch).toHaveBeenCalledTimes(1);
  });
});

describe('Pro orders and tables', () => {
  beforeEach(() => {
    patch.mockReset();
    get.mockReset();
  });

  it('keeps the order target and start time on every dish row', () => {
    const backend = {
      id: 'o1',
      tenant_id: 't',
      table_number: '5',
      customer_session_token: '',
      status: 'preparing',
      total_amount: 670,
      grace_period_ends_at: '',
      created_at: '2026-11-05T12:00:00Z',
      target_minutes: 25,
      started_at: '2026-11-05T12:02:00Z',
      items: [
        { id: 'i1', order_id: 'o1', menu_item_id: 'tibs', item_name: 'Tibs', unit_price: 450, quantity: 1 },
        { id: 'i2', order_id: 'o1', menu_item_id: 'shiro', item_name: 'Shiro', unit_price: 220, quantity: 1 },
      ],
    } as unknown as BackendOrder;

    const rows = mapBackendOrderToCartItems(backend);

    expect(rows.map((r) => [r.orderId, r.targetMinutes, r.startedAt])).toEqual([
      ['o1', 25, Date.parse('2026-11-05T12:02:00Z')],
      ['o1', 25, Date.parse('2026-11-05T12:02:00Z')],
    ]);
  });

  it('leaves timing empty for orders without it (Basic and Plus)', () => {
    const rows = mapBackendOrderToCartItems({ id: 'o2', table_number: '1', status: 'not_started', created_at: '', total_amount: 0 } as unknown as BackendOrder);
    expect(rows[0].targetMinutes).toBeUndefined();
    expect(rows[0].startedAt).toBeUndefined();
  });

  it('assigns a waiter and loads my tables', async () => {
    patch.mockResolvedValueOnce({ data: { id: 'tb5', assigned_waiter_id: 'w1' } });
    get.mockResolvedValueOnce({ data: [{ table: { id: 'tb5' }, orders: [] }] });

    expect((await assignTableWaiter('tb5', 'w1')).assigned_waiter_id).toBe('w1');
    expect(patch).toHaveBeenCalledWith('/admin/tables/tb5/waiter', { waiter_id: 'w1' });
    expect(await fetchMyTables()).toHaveLength(1);
    expect(get).toHaveBeenCalledWith('/admin/my-tables');
  });
});

describe('remake orders', () => {
  it('keeps the order a remake replaces on every row', () => {
    const rows = mapBackendOrderToCartItems({
      id: 'r1',
      table_number: '5',
      status: 'not_started',
      created_at: '',
      total_amount: 0,
      remake_of: 'o1',
      items: [{ id: 'i', order_id: 'r1', menu_item_id: 'tibs', item_name: 'Tibs', unit_price: 0, quantity: 1 }],
    } as unknown as BackendOrder);
    expect(rows[0].remakeOf).toBe('o1');
  });
});
