import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { DailyReport, Problem, Walkout } from '../types';

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

beforeEach(() => Object.values(svc).forEach((f) => f.mockReset()));
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

  it('shows why a decision was refused', async () => {
    svc.fetchDecisions.mockResolvedValue({ problems: [problem('p1')], walkouts: [] });
    svc.decideProblem.mockRejectedValue(new Error('the bill cannot do that in its current state'));
    render(<DecisionsScreen refreshSignal={0} />);

    fireEvent.submit(await screen.findByTestId('problem-p1'));
    expect((await screen.findByRole('alert')).textContent).toBe('the bill cannot do that in its current state');
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
    expect(screen.getByRole('region', { name: 'Kitchen times' }).textContent).toContain('18.5 min');
    expect(screen.getByRole('region', { name: 'Bills still open' }).textContent).toContain('Bill asked');
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
