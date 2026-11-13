import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { Bill, CartItem, DailyReport, MenuItem, Problem, Walkout } from '../types';

const svc = {
  reportProblem: vi.fn(),
  decideProblem: vi.fn(),
  markWalkout: vi.fn(),
  decideWalkout: vi.fn(),
  fetchDecisions: vi.fn(),
  fetchDailyReport: vi.fn(),
  fetchMyShiftReport: vi.fn(),
};
vi.mock('../services/problemService', () => ({
  reportProblem: (...a: unknown[]) => svc.reportProblem(...a),
  decideProblem: (...a: unknown[]) => svc.decideProblem(...a),
  markWalkout: (...a: unknown[]) => svc.markWalkout(...a),
  decideWalkout: (...a: unknown[]) => svc.decideWalkout(...a),
  fetchDecisions: () => svc.fetchDecisions(),
  fetchDailyReport: (...a: unknown[]) => svc.fetchDailyReport(...a),
  fetchMyShiftReport: () => svc.fetchMyShiftReport(),
}));
const fetchBills = vi.fn();
vi.mock('../services/billService', () => ({ fetchBills: () => fetchBills() }));
vi.mock('../utils/push', () => ({
  pushSupported: () => false,
  fetchPushKey: vi.fn(),
  enablePush: vi.fn(),
}));

import DishProblemButton from './DishProblemButton';
import DecisionsScreen from './DecisionsScreen';
import ReportsScreen from './ReportsScreen';

const problem = (id: string, extra: Partial<Problem> = {}): Problem => ({
  id,
  order_id: 'o1',
  order_item_id: 'i1',
  item_name: 'Tibs',
  quantity: 1,
  table_number: '5',
  reason: 'undercooked',
  note: 'pink inside',
  reported_at: '',
  reported_by_name: 'Abebe',
  ready_by_name: 'Tigist',
  served_by_name: 'Abebe',
  decision: null,
  fault: null,
  decided_by_name: '',
  removed_amount: null,
  ...extra,
});

const walkout = (id: string): Walkout => ({
  bill_id: id,
  table_number: '7',
  amount: 600,
  waiter_name: 'Bereket',
  marked_by_name: 'Bereket',
  walkout_at: '',
  decision: null,
  note: '',
  decided_by_name: '',
});

beforeEach(() => {
  Object.values(svc).forEach((f) => f.mockReset());
  fetchBills.mockReset().mockResolvedValue([]);
});
afterEach(cleanup);

describe('DishProblemButton', () => {
  it('sends the reason and note to the manager', async () => {
    svc.reportProblem.mockResolvedValue(problem('p1'));
    render(<DishProblemButton orderId="o1" itemId="i1" dishName="Tibs" />);

    fireEvent.click(screen.getByText('Report problem'));
    const form = screen.getByRole('form', { name: 'What is wrong with Tibs?' });
    fireEvent.change(within(form).getByLabelText('Report problem'), { target: { value: 'foreign_object' } });
    fireEvent.change(within(form).getByLabelText('Note'), { target: { value: 'hair' } });
    fireEvent.submit(form);

    await waitFor(() => expect(svc.reportProblem).toHaveBeenCalledWith('o1', 'i1', 'foreign_object', 'hair'));
    expect(await screen.findByText('Sent to the manager')).toBeTruthy();
  });

  it('shows why reporting failed and can be closed', async () => {
    svc.reportProblem.mockRejectedValue(new Error('this bill belongs to another waiter'));
    render(<DishProblemButton orderId="o1" itemId="i1" dishName="Tibs" />);

    fireEvent.click(screen.getByText('Report problem'));
    fireEvent.submit(screen.getByRole('form'));
    expect((await screen.findByRole('alert')).textContent).toBe('this bill belongs to another waiter');

    fireEvent.click(screen.getByText('Cancel'));
    expect(screen.getByText('Report problem')).toBeTruthy();
  });
});

describe('DecisionsScreen', () => {
  it('shows problems with everyone involved and decides remove from bill with the fault', async () => {
    svc.fetchDecisions.mockResolvedValueOnce({ problems: [problem('p1')], walkouts: [] }).mockResolvedValue({ problems: [], walkouts: [] });
    svc.decideProblem.mockResolvedValue(problem('p1', { decision: 'remove_from_bill', fault: 'kitchen' }));
    render(<DecisionsScreen refreshSignal={0} />);

    const card = await screen.findByTestId('problem-p1');
    expect(card.textContent).toContain('Table 5: 1× Tibs');
    expect(card.textContent).toContain('Undercooked · pink inside');
    expect(card.textContent).toContain('Readied by Tigist · served by Abebe · reported by Abebe');

    fireEvent.click(within(card).getByLabelText('Remove from bill'));
    fireEvent.change(within(card).getByLabelText('Who was at fault'), { target: { value: 'kitchen' } });
    fireEvent.submit(card);

    await waitFor(() => expect(svc.decideProblem).toHaveBeenCalledWith('p1', 'remove_from_bill', 'kitchen'));
    expect(await screen.findByText('Nothing waiting for you.')).toBeTruthy();
  });

  it('decides a walkout with a note', async () => {
    svc.fetchDecisions.mockResolvedValue({ problems: [], walkouts: [walkout('b7')] });
    svc.decideWalkout.mockResolvedValue(walkout('b7'));
    render(<DecisionsScreen refreshSignal={0} currency="ETB" />);

    const card = await screen.findByTestId('walkout-b7');
    expect(card.textContent).toContain('Table 7 left without paying');
    expect(card.textContent).toContain('waiter Bereket');

    fireEvent.change(within(card).getByLabelText('Note (optional)'), { target: { value: 'first time' } });
    fireEvent.click(within(card).getByText('Restaurant takes the loss'));
    await waitFor(() => expect(svc.decideWalkout).toHaveBeenCalledWith('b7', 'restaurant_loss', 'first time'));
  });

  it('explains plainly when a paid bill cannot lose a dish', async () => {
    svc.fetchDecisions.mockResolvedValue({ problems: [problem('p1')], walkouts: [] });
    svc.decideProblem.mockRejectedValue(new Error('the bill cannot do that in its current state'));
    render(<DecisionsScreen refreshSignal={0} />);

    const card = await screen.findByTestId('problem-p1');
    fireEvent.click(within(card).getByLabelText('Remove from bill'));
    fireEvent.change(within(card).getByLabelText('Who was at fault'), { target: { value: 'none' } });
    fireEvent.submit(card);
    expect((await screen.findByRole('alert')).textContent).toBe(
      'This bill is already paid or closed, so the dish cannot be taken off it. Choose Remake instead.'
    );
  });

  it('chooses nothing for the manager: Decide waits for a decision and who was at fault', async () => {
    svc.fetchDecisions.mockResolvedValue({ problems: [problem('p1')], walkouts: [] });
    render(<DecisionsScreen refreshSignal={0} />);

    const card = await screen.findByTestId('problem-p1');
    const decide = within(card).getByRole('button', { name: 'Decide' }) as HTMLButtonElement;
    expect(within(card).getAllByRole('radio').some((r) => (r as HTMLInputElement).checked)).toBe(false);
    expect((within(card).getByLabelText('Who was at fault') as HTMLSelectElement).value).toBe('');
    expect(decide.disabled).toBe(true);

    fireEvent.click(within(card).getByLabelText('Remake'));
    expect(decide.disabled).toBe(true);
    fireEvent.change(within(card).getByLabelText('Who was at fault'), { target: { value: 'waiter' } });
    expect(decide.disabled).toBe(false);
    expect(svc.decideProblem).not.toHaveBeenCalled();
  });

  it('shows when the dish was started, readied, served and reported', async () => {
    svc.fetchDecisions.mockResolvedValue({
      problems: [problem('p1', { reported_at: '2026-11-05T09:30:00Z', started_at: '2026-11-05T09:00:00Z', ready_at: '2026-11-05T09:12:00Z', served_at: null })],
      walkouts: [],
    });
    render(<DecisionsScreen refreshSignal={0} />);

    const times = within(await screen.findByTestId('problem-p1')).getByTestId('problem-times').textContent || '';
    expect(times).toMatch(/^Started .+ · ready .+ · served — · reported .+$/);
    expect(times).not.toContain('Started —');
  });

  it('lists dishes past their prep time and bills unpaid too long, and reports the count', async () => {
    const NOW = Date.parse('2026-11-05T10:00:00Z');
    const dish = { id: 'tibs', name: 'Tibs', price: 100, imageUrl: '', description: '', tags: [], available: true, categoryId: 'c' } as MenuItem;
    const cooking = (orderId: string, startedMinAgo: number): CartItem => ({
      item: dish, quantity: 2, orderId, status: 'preparing', tableNumber: '4', placedAt: NOW - 40 * 60_000, startedAt: NOW - startedMinAgo * 60_000, targetMinutes: 15,
    });
    const bill = (id: string, extra: Partial<Bill>): Bill => ({
      id, tenant_id: 't', table_id: null, table_number: '8', waiter_id: 'w', waiter_name: 'Abebe', status: 'bill_requested', total_amount: 500,
      amount_paid: 0, amount_owed: 500, requested_at: null, collected_at: null, confirmed_at: null, created_at: '', closed_at: null, payments: [], ...extra,
    });
    svc.fetchDecisions.mockResolvedValue({ problems: [problem('p1')], walkouts: [walkout('b7')] });
    fetchBills.mockResolvedValue([
      bill('old-ask', { requested_at: new Date(NOW - 25 * 60_000).toISOString() }),
      bill('new-ask', { requested_at: new Date(NOW - 5 * 60_000).toISOString() }),
      bill('slow-confirm', { status: 'collected', amount_paid: 500, amount_owed: 0, collected_at: new Date(NOW - 16 * 60_000).toISOString() }),
    ]);
    const onLoaded = vi.fn();
    render(<DecisionsScreen refreshSignal={0} currency="ETB" kitchenOrders={[cooking('late', 17), cooking('fine', 5)]} onLoaded={onLoaded} now={NOW} />);

    const late = await screen.findByRole('region', { name: 'Late dishes' });
    expect(late.textContent).toContain('Table 4: cooking for 17 min (target 15 min)');
    expect(screen.queryByTestId('late-fine')).toBeNull();
    const unpaid = await screen.findByRole('region', { name: 'Unpaid bills' });
    await waitFor(() => expect(unpaid.textContent).toContain('Table 8 asked for the bill 25 min ago'));
    expect(unpaid.textContent).toContain('collected 16 min ago, not confirmed by the cashier');
    expect(screen.queryByTestId('unpaid-new-ask')).toBeNull();
    await waitFor(() => expect(onLoaded).toHaveBeenCalledWith({ problems: [problem('p1')], walkouts: [walkout('b7')] }));
  });
});

describe('ReportsScreen', () => {
  const report: DailyReport = {
    date: '2026-11-05',
    sales_by_method: [
      { method: 'cash', payments: 3, amount: 1200 },
      { method: 'telebirr', payments: 1, amount: 270 },
    ],
    sales_total: 1470,
    waiters: [{ waiter_id: 'w1', waiter_name: 'Abebe', bills: 4, sales: 1530, collected: 1470, confirmed: 1200, collected_not_confirmed: 270, walkouts: 1 }],
    walkouts: [walkout('b7')],
    removed_dishes: [problem('p1', { decision: 'remove_from_bill', fault: 'kitchen', removed_amount: 450 })],
    kitchen: [{ item_name: 'Tibs', orders: 3, avg_minutes: 18.5, target_minutes: 15, late: 2 }],
    open_bills: [{ bill_id: 'b9', table_number: '3', status: 'bill_requested', waiter_name: 'Abebe', total_amount: 300, amount_paid: 100 }],
  };

  it('shows every part of the day', async () => {
    svc.fetchDailyReport.mockResolvedValue(report);
    render(<ReportsScreen currency="ETB" />);

    const sales = await screen.findByRole('region', { name: 'Sales by payment method' });
    expect(sales.textContent).toContain('Cash');
    expect(sales.textContent).toContain('Total collected');
    expect(screen.getByRole('region', { name: 'Waiters' }).textContent).toContain('Abebe');
    const losses = screen.getByRole('region', { name: 'Losses' });
    expect(losses.textContent).toContain('Table 7 left without paying');
    expect(losses.textContent).toContain('Table 5: 1× Tibs');
    expect(losses.textContent).toContain('Kitchen');
    expect(screen.getByRole('region', { name: 'Kitchen times' }).textContent).toContain('18:30');
    expect(screen.getByRole('region', { name: 'Kitchen times' }).textContent).toContain('15:00');
    // Headings on every table, and the day's total loss: walkout 600 + removed dish 450
    expect(sales.querySelector('thead')?.textContent).toBe('Paid byPaymentsAmount');
    expect(losses.querySelectorAll('thead')).toHaveLength(2);
    expect(screen.getByTestId('losses-total').textContent).toContain('1,050');
    // Remakes only appear when the server sends them
    expect(screen.queryByText('Dishes cooked again')).toBeNull();
    expect(screen.getByRole('region', { name: 'Bills still open' }).textContent).toContain('Bill asked');
  });

  it('lists dishes cooked again when the server sends them', async () => {
    svc.fetchDailyReport.mockResolvedValue({ ...report, remade_dishes: [problem('p2', { item_name: 'Shiro', reason: 'cold', decision: 'remake', fault: 'waiter' })] });
    render(<ReportsScreen currency="ETB" />);

    const losses = await screen.findByRole('region', { name: 'Losses' });
    expect(losses.textContent).toContain('Dishes cooked again');
    expect(losses.textContent).toContain('Table 5: 1× Shiro');
    expect(losses.textContent).toContain('ColdWaiter');
  });

  it('labels each value for the phone card layout', async () => {
    svc.fetchDailyReport.mockResolvedValue(report);
    render(<ReportsScreen currency="ETB" />);

    const waiters = await screen.findByRole('region', { name: 'Waiters' });
    const labels = Array.from(waiters.querySelectorAll('tbody td')).map((td) => td.getAttribute('data-label'));
    expect(labels).toEqual(['Waiter', 'Bills', 'Sales', 'Collected', 'Confirmed', 'Not confirmed', 'Walkouts']);
  });

  it('loads another day when the date changes', async () => {
    svc.fetchDailyReport.mockResolvedValue({ ...report, sales_by_method: [], walkouts: [], removed_dishes: [], kitchen: [], open_bills: [], waiters: [] });
    render(<ReportsScreen />);
    await waitFor(() => expect(svc.fetchDailyReport).toHaveBeenCalledTimes(1));

    fireEvent.change(screen.getByLabelText('Day'), { target: { value: '2026-11-01' } });

    await waitFor(() => expect(svc.fetchDailyReport).toHaveBeenLastCalledWith('2026-11-01'));
    expect((await screen.findAllByText('Nothing for this day.')).length).toBeGreaterThan(0);
  });
});
