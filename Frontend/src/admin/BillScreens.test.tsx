import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { Bill, BillStatus } from '../types';

const svc = {
  fetchBills: vi.fn(),
  requestBill: vi.fn(),
  collectBill: vi.fn(),
  confirmBill: vi.fn(),
  moveBill: vi.fn(),
  handoverBill: vi.fn(),
  fetchColleagues: vi.fn(),
  fetchMyShift: vi.fn(),
  startShift: vi.fn(),
  endShift: vi.fn(),
};
vi.mock('../services/billService', () => ({
  fetchBills: () => svc.fetchBills(),
  requestBill: (...a: unknown[]) => svc.requestBill(...a),
  collectBill: (...a: unknown[]) => svc.collectBill(...a),
  confirmBill: (...a: unknown[]) => svc.confirmBill(...a),
  moveBill: (...a: unknown[]) => svc.moveBill(...a),
  handoverBill: (...a: unknown[]) => svc.handoverBill(...a),
  fetchColleagues: () => svc.fetchColleagues(),
  fetchMyShift: () => svc.fetchMyShift(),
  startShift: () => svc.startShift(),
  endShift: () => svc.endShift(),
}));

const problemSvc = { markWalkout: vi.fn(), fetchMyShiftReport: vi.fn(), fetchDecisions: vi.fn(), fetchDailyReport: vi.fn() };
vi.mock('../services/problemService', () => ({
  markWalkout: (...a: unknown[]) => problemSvc.markWalkout(...a),
  fetchMyShiftReport: () => problemSvc.fetchMyShiftReport(),
  fetchDecisions: () => problemSvc.fetchDecisions(),
  fetchDailyReport: (...a: unknown[]) => problemSvc.fetchDailyReport(...a),
  reportProblem: vi.fn(),
  decideProblem: vi.fn(),
  decideWalkout: vi.fn(),
}));

import BillCard from './BillCard';
import BillsScreen from './BillsScreen';
import ShiftBar from './ShiftBar';

const bill = (id: string, status: BillStatus, extra: Partial<Bill> = {}): Bill => ({
  id,
  tenant_id: 't',
  table_id: null,
  table_number: '5',
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
  ...extra,
});

beforeEach(() => {
  Object.values(svc).forEach((f) => f.mockReset());
  svc.fetchMyShift.mockResolvedValue(null);
  Object.values(problemSvc).forEach((f) => f.mockReset());
  problemSvc.fetchMyShiftReport.mockRejectedValue(new Error('no shift yet'));
});
afterEach(cleanup);

describe('BillCard for a waiter', () => {
  it('shows the total, what is paid and what is owed', () => {
    render(
      <BillCard
        bill={bill('b1', 'bill_requested', {
          amount_paid: 300,
          amount_owed: 370,
          payments: [{ id: 'p1', amount: 300, method: 'cash', reference: '', collected_by: 'w1', collected_by_name: 'Abebe', collected_at: '' }],
        })}
        role="waiter"
        onChanged={vi.fn()}
      />
    );
    const card = screen.getByTestId('bill-b1');
    expect(card.textContent).toContain('Bill asked');
    expect(card.textContent).toContain('Owed');
    expect(card.textContent).toContain('Abebe · Cash');
    expect(screen.queryByText('Ask for bill')).toBeNull();
    expect(screen.queryByText('Confirm money received')).toBeNull();
  });

  it('asks for the bill for the customer', async () => {
    svc.requestBill.mockResolvedValue(bill('b1', 'bill_requested'));
    const onChanged = vi.fn();
    render(<BillCard bill={bill('b1', 'open')} role="waiter" onChanged={onChanged} />);

    fireEvent.click(screen.getByText('Ask for bill'));

    await waitFor(() => expect(svc.requestBill).toHaveBeenCalledWith('b1'));
    expect(onChanged).toHaveBeenCalled();
  });

  it('drops the table name inside a table card and suggests other tables to move to', () => {
    render(<BillCard bill={bill('b1', 'open')} role="waiter" onChanged={vi.fn()} showTable={false} tableSuggestions={['5', '6', 'Garden']} />);

    expect(screen.queryByText('Table 5')).toBeNull();
    expect(screen.getByText('Bill')).toBeTruthy();
    fireEvent.click(screen.getByText('Move or join table'));
    const options = Array.from(document.querySelectorAll('datalist option')).map((o) => o.getAttribute('value'));
    expect(options).toEqual(['6', 'Garden']);
  });

  it('collects by Telebirr with the reference, and by cash without one', async () => {
    svc.collectBill.mockResolvedValue(bill('b1', 'collected'));
    render(<BillCard bill={bill('b1', 'bill_requested')} role="waiter" onChanged={vi.fn()} />);

    fireEvent.click(screen.getByText('Collect'));
    const form = screen.getByRole('form', { name: 'Collect for Table 5' });
    expect((within(form).getByLabelText('Amount') as HTMLInputElement).value).toBe('670');
    expect(within(form).queryByLabelText('Transaction reference')).toBeNull();

    fireEvent.change(within(form).getByLabelText('Paid by'), { target: { value: 'telebirr' } });
    fireEvent.change(within(form).getByLabelText('Transaction reference'), { target: { value: 'TX123' } });
    fireEvent.submit(form);

    await waitFor(() => expect(svc.collectBill).toHaveBeenCalledWith('b1', { amount: 670, method: 'telebirr', reference: 'TX123' }));
  });

  it('shows the reason when collecting is refused', async () => {
    svc.collectBill.mockRejectedValue(new Error('the amount is more than the bill still owes'));
    render(<BillCard bill={bill('b1', 'open')} role="waiter" onChanged={vi.fn()} />);

    fireEvent.click(screen.getByText('Collect'));
    fireEvent.change(screen.getByLabelText('Amount'), { target: { value: '900' } });
    fireEvent.submit(screen.getByRole('form', { name: 'Collect for Table 5' }));

    expect((await screen.findByRole('alert')).textContent).toBe('the amount is more than the bill still owes');
  });

  it('moves the bill to another table', async () => {
    svc.moveBill.mockResolvedValue(bill('b1', 'open', { table_number: '6' }));
    render(<BillCard bill={bill('b1', 'open')} role="waiter" onChanged={vi.fn()} />);

    fireEvent.click(screen.getByText('Move or join table'));
    fireEvent.change(screen.getByLabelText('To table'), { target: { value: '6' } });
    fireEvent.submit(screen.getByRole('form', { name: 'Move or join table' }));

    await waitFor(() => expect(svc.moveBill).toHaveBeenCalledWith('b1', '6'));
  });

  it('hands the bill to a colleague, never back to its own waiter', async () => {
    svc.fetchColleagues.mockResolvedValue([
      { id: 'w1', full_name: 'Abebe', role: 'waiter' },
      { id: 'w2', full_name: 'Bereket', role: 'waiter' },
      { id: 'm1', full_name: 'Hana', role: 'manager' },
    ]);
    svc.handoverBill.mockResolvedValue(bill('b1', 'open', { waiter_id: 'w2' }));
    render(<BillCard bill={bill('b1', 'open')} role="waiter" onChanged={vi.fn()} />);

    fireEvent.click(screen.getByText('Hand over'));
    const select = screen.getByLabelText('Hand to') as HTMLSelectElement;
    await waitFor(() => expect(select.options.length).toBe(3));
    expect(Array.from(select.options).map((o) => o.textContent)).toEqual(['Hand to', 'Bereket (Waiter)', 'Hana (Manager)']);

    fireEvent.change(select, { target: { value: 'w2' } });
    fireEvent.submit(screen.getByRole('form', { name: 'Hand over' }));
    await waitFor(() => expect(svc.handoverBill).toHaveBeenCalledWith('b1', 'w2'));
  });
});

describe('BillCard for a cashier', () => {
  it('confirms only collected bills and cannot collect', async () => {
    svc.confirmBill.mockResolvedValue(bill('b1', 'confirmed'));
    render(<BillCard bill={bill('b1', 'collected', { amount_paid: 670, amount_owed: 0 })} role="cashier" onChanged={vi.fn()} />);

    expect(screen.queryByText('Collect')).toBeNull();
    fireEvent.click(screen.getByText('Confirm money received'));
    await waitFor(() => expect(svc.confirmBill).toHaveBeenCalledWith('b1'));
    cleanup();

    render(<BillCard bill={bill('b2', 'open')} role="cashier" onChanged={vi.fn()} />);
    expect(screen.queryByText('Confirm money received')).toBeNull();
    expect(screen.queryByText('Ask for bill')).toBeNull();
  });
});

describe('BillsScreen', () => {
  it('lists collected bills to confirm first, then open bills, then confirmed today', async () => {
    svc.fetchBills.mockResolvedValue([
      bill('open1', 'open'),
      bill('done1', 'confirmed', { amount_owed: 0 }),
      bill('coll1', 'collected', { amount_owed: 0 }),
      bill('ask1', 'bill_requested'),
    ]);
    render(<BillsScreen role="cashier" refreshSignal={0} showShift />);

    expect(await screen.findByText('Collected, waiting for you to confirm (1)')).toBeTruthy();
    expect(screen.getByText('Open bills (2)')).toBeTruthy();
    expect(screen.getByText('Confirmed today (1)')).toBeTruthy();
    const ids = Array.from(document.querySelectorAll('[data-testid^="bill-"]')).map((el) => el.getAttribute('data-testid'));
    expect(ids).toEqual(['bill-coll1', 'bill-open1', 'bill-ask1', 'bill-done1']);
    expect(screen.getByTestId('shift-status')).toBeTruthy();
  });

  it('reloads after confirming', async () => {
    svc.fetchBills.mockResolvedValueOnce([bill('coll1', 'collected', { amount_owed: 0 })]).mockResolvedValue([]);
    svc.confirmBill.mockResolvedValue(bill('coll1', 'confirmed'));
    render(<BillsScreen role="manager" refreshSignal={0} />);

    fireEvent.click(await screen.findByText('Confirm money received'));
    await waitFor(() => expect(svc.fetchBills).toHaveBeenCalledTimes(2));
    expect(screen.queryByTestId('shift-status')).toBeNull();
  });
});

describe('ShiftBar', () => {
  it('starts a shift', async () => {
    svc.startShift.mockResolvedValue({ id: 's1', user_id: 'w1', started_at: '2026-11-05T09:00:00Z', ended_at: null });
    render(<ShiftBar />);

    fireEvent.click(await screen.findByText('Start shift'));
    expect(await screen.findByText('End shift')).toBeTruthy();
    expect(screen.getByTestId('shift-status').textContent).toMatch(/^On shift since/);
  });

  it('explains why a shift cannot end', async () => {
    svc.fetchMyShift.mockResolvedValue({ id: 's1', user_id: 'w1', started_at: '2026-11-05T09:00:00Z', ended_at: null });
    svc.endShift.mockRejectedValue(new Error('you still have 1 unpaid bill(s): collect them, hand them to another waiter, or hand them to a manager'));
    render(<ShiftBar />);

    fireEvent.click(await screen.findByText('End shift'));
    expect((await screen.findByRole('alert')).textContent).toContain('1 unpaid bill');
    expect(screen.getByText('End shift')).toBeTruthy();
  });
});

describe('Walkouts on the bill card', () => {
  it('marks a walkout only after confirming', async () => {
    problemSvc.markWalkout.mockResolvedValue({ bill_id: 'b1' });
    const onChanged = vi.fn();
    render(<BillCard bill={bill('b1', 'bill_requested')} role="waiter" onChanged={onChanged} />);

    fireEvent.click(screen.getByText('Left without paying'));
    const group = screen.getByRole('group', { name: 'Left without paying' });
    expect(group.textContent).toContain('Mark Table 5 as a walkout of');
    expect(problemSvc.markWalkout).not.toHaveBeenCalled();

    fireEvent.click(within(group).getByText('Left without paying'));
    await waitFor(() => expect(problemSvc.markWalkout).toHaveBeenCalledWith('b1'));
    expect(onChanged).toHaveBeenCalled();
  });

  it('is not offered on a paid or closed bill, nor to a cashier', () => {
    render(<BillCard bill={bill('b1', 'collected', { amount_owed: 0 })} role="waiter" onChanged={vi.fn()} />);
    expect(screen.queryByText('Left without paying')).toBeNull();
    cleanup();

    render(<BillCard bill={bill('b2', 'open')} role="cashier" onChanged={vi.fn()} />);
    expect(screen.queryByText('Left without paying')).toBeNull();
  });
});

describe('ShiftBar totals', () => {
  const onShift = { id: 's1', user_id: 'w1', started_at: '2026-11-05T09:00:00Z', ended_at: null };

  it("shows a waiter's collected money and what is not confirmed yet", async () => {
    svc.fetchMyShift.mockResolvedValue(onShift);
    problemSvc.fetchMyShiftReport.mockResolvedValue({ role: 'waiter', started_at: '', ended_at: null, bills: 3, collected: 1470, not_confirmed: 270, confirmed: 0 });
    render(<ShiftBar role="waiter" />);

    const totals = await screen.findByTestId('shift-totals');
    expect(totals.textContent).toMatch(/^This shift: collected .*1,?470.* not confirmed yet .*270/);
  });

  it("shows a cashier's confirmed money", async () => {
    svc.fetchMyShift.mockResolvedValue(onShift);
    problemSvc.fetchMyShiftReport.mockResolvedValue({ role: 'cashier', started_at: '', ended_at: null, bills: 2, collected: 0, not_confirmed: 0, confirmed: 900 });
    render(<ShiftBar role="cashier" />);

    expect((await screen.findByTestId('shift-totals')).textContent).toMatch(/^This shift: confirmed .*900.* on 2 bill\(s\)$/);
  });

  it('shows no totals off shift or for a manager', async () => {
    render(<ShiftBar role="waiter" />);
    await screen.findByText('Start shift');
    expect(screen.queryByTestId('shift-totals')).toBeNull();
    expect(problemSvc.fetchMyShiftReport).not.toHaveBeenCalled();
  });
});
