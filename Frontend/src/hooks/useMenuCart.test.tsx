import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import type { MenuItem } from '../types';

const placeLiveOrder = vi.fn();
vi.mock('../services/orderService', async () => {
  const actual = await vi.importActual<typeof import('../services/orderService')>('../services/orderService');
  return {
    ...actual,
    placeLiveOrder: (...a: unknown[]) => placeLiveOrder(...a),
    fetchLiveOrderStatus: vi.fn(async () => null),
    undoLiveOrder: vi.fn(async () => true),
  };
});

const customerRequestBill = vi.fn();
vi.mock('../services/billService', () => ({ customerRequestBill: (...a: unknown[]) => customerRequestBill(...a) }));

import useMenuCart from './useMenuCart';

const dish = (id: string, price: number): MenuItem => ({ id, name: id, price, imageUrl: '', description: '', tags: [], available: true, categoryId: 'all' });
const tibs = dish('Tibs', 450);
const shiro = dish('Shiro', 220);
// The same array on every render, like the menu hook gives
const MENU = [tibs, shiro];

function serverOrder(id: string, items: { name: string; qty: number }[], target?: number) {
  return {
    order: {
      id,
      table_number: '5',
      status: 'pending_grace',
      created_at: new Date().toISOString(),
      target_minutes: target,
      items: items.map((it, i) => ({ id: `${id}-${i}`, menu_item_id: it.name, item_name: it.name, unit_price: 0, quantity: it.qty })),
    },
    grace_period_ends_at: new Date(Date.now() + 60_000).toISOString(),
    grace_period_seconds: 60,
  };
}

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  placeLiveOrder.mockReset();
});
afterEach(() => vi.restoreAllMocks());

async function orderTibsAndShiro(oneOrderPerCart: boolean) {
  const { result } = renderHook(() =>
    useMenuCart({ restaurantSlug: 'demo-pro', items: MENU, loading: false, tableNumber: '5', oneOrderPerCart })
  );
  act(() => {
    result.current.handleAddToOrder(tibs, 2, '');
    result.current.handleAddToOrder(shiro, 1, '');
  });
  await act(async () => {
    await result.current.handlePlaceOrder('5');
  });
  return result;
}

describe('useMenuCart sending orders', () => {
  it('sends the whole cart as one order on Pro', async () => {
    placeLiveOrder.mockResolvedValueOnce(serverOrder('o1', [{ name: 'Tibs', qty: 2 }, { name: 'Shiro', qty: 1 }], 25));

    const result = await orderTibsAndShiro(true);

    expect(placeLiveOrder).toHaveBeenCalledTimes(1);
    expect(placeLiveOrder.mock.calls[0][1].items.map((i: { item_name: string; quantity: number }) => [i.item_name, i.quantity])).toEqual([
      ['Tibs', 2],
      ['Shiro', 1],
    ]);
    // Both dishes belong to the one order and carry its cooking target
    expect(result.current.placedOrders.map((o) => [o.item.name, o.orderId, o.targetMinutes])).toEqual([
      ['Tibs', 'o1', 25],
      ['Shiro', 'o1', 25],
    ]);
    expect(result.current.cart).toHaveLength(0);
  });

  it('sends one order per dish on Basic and Plus, as before', async () => {
    placeLiveOrder
      .mockResolvedValueOnce(serverOrder('o1', [{ name: 'Tibs', qty: 2 }]))
      .mockResolvedValueOnce(serverOrder('o2', [{ name: 'Shiro', qty: 1 }]));

    const result = await orderTibsAndShiro(false);

    expect(placeLiveOrder).toHaveBeenCalledTimes(2);
    expect(result.current.placedOrders.map((o) => [o.item.name, o.orderId])).toEqual([
      ['Tibs', 'o1'],
      ['Shiro', 'o2'],
    ]);
  });

  it('undoes the whole Pro order and puts every dish back in the cart', async () => {
    placeLiveOrder.mockResolvedValueOnce(serverOrder('o1', [{ name: 'Tibs', qty: 2 }, { name: 'Shiro', qty: 1 }], 25));
    const result = await orderTibsAndShiro(true);

    await act(async () => {
      await result.current.handleUndoOrder('o1');
    });

    expect(result.current.placedOrders).toHaveLength(0);
    expect(result.current.cart.map((c) => [c.item.name, c.quantity])).toEqual([
      ['Tibs', 2],
      ['Shiro', 1],
    ]);
  });
});

describe('useMenuCart asking for the bill', () => {
  it("asks with the table's QR token and remembers it was asked", async () => {
    window.history.pushState({}, '', '/m/demo-pro?table=5&token=tok123');
    customerRequestBill.mockReset().mockResolvedValue(undefined);
    const { result } = renderHook(() => useMenuCart({ restaurantSlug: 'demo-pro', items: MENU, loading: false, tableNumber: '5' }));

    await act(async () => {
      await result.current.handleRequestBill();
    });

    expect(customerRequestBill).toHaveBeenCalledWith('demo-pro', '5', 'tok123');
    expect(result.current.billAsked).toBe(true);
    expect(result.current.billError).toBeNull();
  });

  it('still says the waiter is coming after a reload', async () => {
    window.history.pushState({}, '', '/m/demo-pro?table=5&token=tok123');
    customerRequestBill.mockReset().mockResolvedValue(undefined);
    placeLiveOrder.mockResolvedValue(serverOrder('o1', [{ name: 'Tibs', qty: 1 }], 15));
    const first = renderHook(() => useMenuCart({ restaurantSlug: 'demo-pro', items: MENU, loading: false, tableNumber: '5', oneOrderPerCart: true }));
    act(() => first.result.current.handleAddToOrder(tibs, 1, ''));
    await act(async () => {
      await first.result.current.handlePlaceOrder('5');
    });
    await act(async () => {
      await first.result.current.handleRequestBill();
    });
    first.unmount();

    // The page is opened again in the same browser: same orders, so the request is remembered
    const again = renderHook(() => useMenuCart({ restaurantSlug: 'demo-pro', items: MENU, loading: false, tableNumber: '5', oneOrderPerCart: true }));
    expect(again.result.current.billAsked).toBe(true);

    // A later visit with no orders from that meal starts fresh
    act(() => again.result.current.handleClearOrders());
    expect(again.result.current.billAsked).toBe(false);
  });

  it('keeps the reason when asking fails', async () => {
    window.history.pushState({}, '', '/m/demo-pro?table=5&token=tok123');
    customerRequestBill.mockReset().mockRejectedValue(new Error('this table has no open bill'));
    const { result } = renderHook(() => useMenuCart({ restaurantSlug: 'demo-pro', items: MENU, loading: false, tableNumber: '5' }));

    await act(async () => {
      await result.current.handleRequestBill();
    });

    expect(result.current.billAsked).toBe(false);
    expect(result.current.billError).toBe('this table has no open bill');
  });
});
