import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import type { CartItem, MenuItem, OrderStatus } from '../types';
import ProKitchenBoard from './ProKitchenBoard';

const MIN = 60_000;
const NOW = 10_000_000;

const dish = (name: string): MenuItem => ({ id: name, name, price: 100, imageUrl: '', description: '', tags: [], available: true, categoryId: 'all' });
const row = (orderId: string, name: string, status: OrderStatus, extra: Partial<CartItem> = {}): CartItem => ({
  item: dish(name),
  quantity: 2,
  orderId,
  status,
  tableNumber: '5',
  placedAt: NOW - 5 * MIN,
  targetMinutes: 10,
  ...extra,
});

const makeBell = (enabled = true) => ({ enabled, enable: vi.fn(async () => true), ring: vi.fn() });

afterEach(cleanup);

function renderBoard(orders: CartItem[], opts: { role?: 'manager' | 'chef'; bell?: ReturnType<typeof makeBell>; now?: number } = {}) {
  const onOrderStatusChange = vi.fn();
  const onCancelOrder = vi.fn();
  const bell = opts.bell ?? makeBell();
  const utils = render(
    <ProKitchenBoard
      orders={orders}
      role={opts.role ?? 'chef'}
      bell={bell}
      onOrderStatusChange={onOrderStatusChange}
      onCancelOrder={onCancelOrder}
      now={opts.now ?? NOW}
    />
  );
  return { ...utils, onOrderStatusChange, onCancelOrder, bell };
}

describe('ProKitchenBoard', () => {
  it('shows one ticket per order, grouped by table, with all its dishes', () => {
    renderBoard([row('a', 'Tibs', 'not_started'), row('a', 'Shiro', 'not_started'), row('b', 'Buna', 'not_started', { tableNumber: '7' })]);

    const table5 = screen.getByTestId('kitchen-table-5');
    const ticket = within(table5).getByTestId('ticket-a');
    expect(ticket.textContent).toContain('Tibs');
    expect(ticket.textContent).toContain('Shiro');
    expect(within(ticket).getByTestId('ticket-time').textContent).toBe('New · 5m ago · 10 min');
    expect(screen.getByTestId('kitchen-table-7')).toBeTruthy();
  });

  it('starts and readies the whole order', () => {
    const { onOrderStatusChange, rerender, bell } = renderBoard([row('a', 'Tibs', 'not_started'), row('a', 'Shiro', 'not_started')]);

    fireEvent.click(screen.getByText('Start'));
    expect(onOrderStatusChange).toHaveBeenCalledWith('a', 'preparing');

    rerender(
      <ProKitchenBoard
        orders={[row('a', 'Tibs', 'preparing', { startedAt: NOW - MIN }), row('a', 'Shiro', 'preparing', { startedAt: NOW - MIN })]}
        role="chef"
        bell={bell}
        onOrderStatusChange={onOrderStatusChange}
        now={NOW}
      />
    );
    fireEvent.click(screen.getByText('Ready'));
    expect(onOrderStatusChange).toHaveBeenCalledWith('a', 'ready');
    expect(screen.queryByText('Start')).toBeNull();
  });

  it('colours the timer green, yellow and red against the target', () => {
    const cooking = (minutesAgo: number) => [row('a', 'Tibs', 'preparing', { startedAt: NOW - minutesAgo * MIN })];

    renderBoard(cooking(3));
    expect(screen.getByTestId('ticket-a').getAttribute('data-timer')).toBe('green');
    expect(screen.getByTestId('ticket-time').textContent).toBe('3:00 / 10:00');
    cleanup();

    renderBoard(cooking(8));
    expect(screen.getByTestId('ticket-a').getAttribute('data-timer')).toBe('yellow');
    cleanup();

    renderBoard(cooking(12));
    expect(screen.getByTestId('ticket-a').getAttribute('data-timer')).toBe('red');
  });

  it('lets only managers mark food served from the kitchen', () => {
    renderBoard([row('a', 'Tibs', 'ready')], { role: 'chef' });
    expect(screen.queryByText('Served')).toBeNull();
    expect(screen.getByText('Ready · waiting for the waiter')).toBeTruthy();
    cleanup();

    const { onOrderStatusChange } = renderBoard([row('a', 'Tibs', 'ready')], { role: 'manager' });
    fireEvent.click(screen.getByText('Served'));
    expect(onOrderStatusChange).toHaveBeenCalledWith('a', 'complete');
  });

  it('cancels a new order', () => {
    const { onCancelOrder } = renderBoard([row('a', 'Tibs', 'not_started')]);
    fireEvent.click(screen.getByLabelText('Cancel order'));
    expect(onCancelOrder).toHaveBeenCalledWith('a');
  });

  it('asks for one tap to enable sound', () => {
    const bell = makeBell(false);
    renderBoard([], { bell });

    fireEvent.click(screen.getByText('Tap to enable sound'));
    expect(bell.enable).toHaveBeenCalled();
    expect(screen.getByText(/No open orders/)).toBeTruthy();
  });

  it('rings for orders that arrive after the screen opened, not for ones already there', () => {
    const bell = makeBell();
    const { rerender, onOrderStatusChange } = renderBoard([row('a', 'Tibs', 'not_started')], { bell });
    expect(bell.ring).not.toHaveBeenCalled();

    rerender(
      <ProKitchenBoard
        orders={[row('a', 'Tibs', 'not_started'), row('b', 'Buna', 'not_started')]}
        role="chef"
        bell={bell}
        onOrderStatusChange={onOrderStatusChange}
        now={NOW}
      />
    );
    expect(bell.ring).toHaveBeenCalledWith('bell');
  });

  it('sounds the alert once when an order reaches its prep time', () => {
    const bell = makeBell();
    const orders = [row('a', 'Tibs', 'preparing', { startedAt: NOW - 9 * MIN })];
    const { rerender, onOrderStatusChange } = renderBoard(orders, { bell });
    expect(bell.ring).not.toHaveBeenCalled();

    const at = (now: number) => (
      <ProKitchenBoard orders={orders} role="chef" bell={bell} onOrderStatusChange={onOrderStatusChange} now={now} />
    );
    rerender(at(NOW + MIN));
    rerender(at(NOW + 2 * MIN));
    expect(bell.ring).toHaveBeenCalledTimes(1);
    expect(bell.ring).toHaveBeenCalledWith('alert');
  });
});

describe('ProKitchenBoard remakes', () => {
  it('marks a remake ticket', () => {
    renderBoard([row('r', 'Tibs', 'not_started', { remakeOf: 'first' }), row('a', 'Shiro', 'not_started')]);

    expect(within(screen.getByTestId('ticket-r')).getByText('REMAKE')).toBeTruthy();
    expect(within(screen.getByTestId('ticket-a')).queryByText('REMAKE')).toBeNull();
  });
});
