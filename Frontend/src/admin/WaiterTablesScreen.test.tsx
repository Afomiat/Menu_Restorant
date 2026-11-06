import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { BackendOrder, OrderStatus, TableOrders } from '../types';

const fetchMyTables = vi.fn();
const updateAdminOrderStatus = vi.fn();
vi.mock('../services/orderService', () => ({
  fetchMyTables: () => fetchMyTables(),
  updateAdminOrderStatus: (...a: unknown[]) => updateAdminOrderStatus(...a),
}));

const fetchBills = vi.fn();
vi.mock('../services/billService', () => ({
  fetchBills: () => fetchBills(),
  fetchMyShift: vi.fn(async () => null),
  startShift: vi.fn(),
  endShift: vi.fn(),
  requestBill: vi.fn(),
  collectBill: vi.fn(),
  confirmBill: vi.fn(),
  moveBill: vi.fn(),
  handoverBill: vi.fn(),
  fetchColleagues: vi.fn(async () => []),
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
  fetchBills.mockReset().mockResolvedValue([]);
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

describe('WaiterTablesScreen bills', () => {
  const bill = (status: string, table: string) => ({
    id: `bill-${table}-${status}`,
    tenant_id: 't',
    table_id: null,
    table_number: table,
    waiter_id: 'w1',
    waiter_name: 'Abebe',
    status,
    total_amount: 670,
    amount_paid: 0,
    amount_owed: 670,
    requested_at: null,
    collected_at: null,
    confirmed_at: null,
    created_at: '',
    closed_at: null,
    payments: [],
  });

  it("shows each table's bill still in the waiter's hands, with the shift bar", async () => {
    fetchMyTables.mockResolvedValue([table('5', [order('a', 'preparing')]), table('6', [])]);
    fetchBills.mockResolvedValue([bill('bill_requested', '5'), bill('confirmed', '6')]);
    renderScreen();

    const table5 = await screen.findByTestId('waiter-table-5');
    await waitFor(() => expect(within(table5).getByTestId('bill-bill-5-bill_requested')).toBeTruthy());
    expect(within(table5).getByText('Collect')).toBeTruthy();
    expect(within(screen.getByTestId('waiter-table-6')).queryByTestId('bill-bill-6-confirmed')).toBeNull();
    expect(screen.getByTestId('shift-status')).toBeTruthy();
  });
});

describe('WaiterTablesScreen problems', () => {
  it('offers Report problem on each dish', async () => {
    fetchMyTables.mockResolvedValue([table('5', [order('a', 'delivered' as OrderStatus), order('b', 'ready', 'Shiro')])]);
    renderScreen();

    const card = await screen.findByTestId('waiter-table-5');
    expect(within(card).getAllByText('Report problem')).toHaveLength(2);
  });
});
