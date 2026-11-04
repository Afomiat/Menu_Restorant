import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CartItem, MenuItem, OrderStatus } from '../types';

const patch = vi.fn();
vi.mock('./apiClient', () => ({ apiClient: { patch: (...args: unknown[]) => patch(...args) } }));

import { getRestaurantOrders, isTableActionTarget, saveRestaurantOrders, updateTableOrdersStatus } from './orderService';

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
