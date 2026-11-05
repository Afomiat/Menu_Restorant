import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { BackendOrder, OrderStatus, TableOrders } from '../types';

const fetchMyTables = vi.fn();
const updateAdminOrderStatus = vi.fn();
vi.mock('../services/orderService', () => ({
  fetchMyTables: () => fetchMyTables(),
  updateAdminOrderStatus: (...a: unknown[]) => updateAdminOrderStatus(...a),
}));

import WaiterTablesScreen from './WaiterTablesScreen';

const order = (id: string, status: OrderStatus, dish = 'Tibs'): BackendOrder => ({
  id,
  tenant_id: 't',
  table_number: '5',
  customer_session_token: '',
  status,
  total_amount: 0,
  grace_period_ends_at: '',
  created_at: '',
  items: [{ id: `${id}-1`, order_id: id, menu_item_id: dish, item_name: dish, unit_price: 100, quantity: 2 } as never],
});

const table = (n: string, orders: BackendOrder[]): TableOrders => ({
  table: { id: `table-${n}`, tenant_id: 't', table_number: n, is_active: true },
  orders,
});

beforeEach(() => {
  fetchMyTables.mockReset();
  updateAdminOrderStatus.mockReset().mockResolvedValue(true);
});
afterEach(cleanup);

function renderScreen(props: Partial<Parameters<typeof WaiterTablesScreen>[0]> = {}) {
  const onDismissAlert = vi.fn();
  render(
    <WaiterTablesScreen
      fullName="Abebe Kebede"
      onLogout={vi.fn()}
      bell={{ enabled: true, enable: vi.fn() }}
      readyAlerts={[]}
      onDismissAlert={onDismissAlert}
      refreshSignal={0}
      {...props}
    />
  );
  return { onDismissAlert };
}

describe('WaiterTablesScreen', () => {
  it('shows each of my tables with what it is waiting for', async () => {
    fetchMyTables.mockResolvedValue([
      table('5', [order('a', 'ready'), order('b', 'preparing', 'Shiro')]),
      table('6', [order('c', 'preparing')]),
      table('7', [order('d', 'not_started')]),
      table('8', []),
    ]);
    renderScreen();

    expect(within(await screen.findByTestId('waiter-table-5')).getByText('Food ready')).toBeTruthy();
    expect(within(screen.getByTestId('waiter-table-6')).getByText('Cooking')).toBeTruthy();
    expect(within(screen.getByTestId('waiter-table-7')).getByText('Ordered')).toBeTruthy();
    expect(within(screen.getByTestId('waiter-table-8')).getByText('No open orders')).toBeTruthy();
    expect(screen.getByText('Abebe Kebede')).toBeTruthy();
  });

  it('marks food served and reloads', async () => {
    fetchMyTables.mockResolvedValueOnce([table('5', [order('a', 'ready')])]).mockResolvedValue([table('5', [])]);
    const { onDismissAlert } = renderScreen();

    fireEvent.click(await screen.findByText('Served'));

    await waitFor(() => expect(updateAdminOrderStatus).toHaveBeenCalledWith('a', 'complete'));
    await waitFor(() => expect(screen.getByText('No open orders')).toBeTruthy());
    expect(onDismissAlert).toHaveBeenCalledWith('a');
  });

  it('shows a banner for each food-ready bell until dismissed', async () => {
    fetchMyTables.mockResolvedValue([]);
    const { onDismissAlert } = renderScreen({ readyAlerts: [{ orderId: 'a', tableNumber: '5' }] });

    expect(screen.getByRole('alert').textContent).toContain('Table 5: food is ready');
    fireEvent.click(screen.getByLabelText('Dismiss'));
    expect(onDismissAlert).toHaveBeenCalledWith('a');
    expect(await screen.findByText(/No tables are assigned to you yet/)).toBeTruthy();
  });

  it('reloads when an order changes', async () => {
    fetchMyTables.mockResolvedValue([]);
    renderScreen();
    await waitFor(() => expect(fetchMyTables).toHaveBeenCalledTimes(1));

    cleanup();
    renderScreen({ refreshSignal: 1 });
    await waitFor(() => expect(fetchMyTables).toHaveBeenCalledTimes(2));
  });

  it('asks for one tap to enable sound', async () => {
    fetchMyTables.mockResolvedValue([]);
    const enable = vi.fn();
    renderScreen({ bell: { enabled: false, enable } });

    fireEvent.click(screen.getByText('Tap to enable sound'));
    expect(enable).toHaveBeenCalled();
  });
});
