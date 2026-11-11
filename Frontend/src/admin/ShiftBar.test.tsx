import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';

const fetchMyShift = vi.fn();
const endShift = vi.fn();
vi.mock('../services/billService', () => ({
  fetchMyShift: () => fetchMyShift(),
  startShift: vi.fn(),
  endShift: () => endShift(),
}));
const fetchMyShiftReport = vi.fn();
vi.mock('../services/problemService', () => ({ fetchMyShiftReport: () => fetchMyShiftReport() }));

import ShiftBar from './ShiftBar';

afterEach(cleanup);

const report = (collected: number) => ({ role: 'waiter', started_at: '', ended_at: null, bills: 1, collected, not_confirmed: 0, confirmed: 0 });

describe('ShiftBar', () => {
  it('reloads the totals when the bills change, and clears an old refusal', async () => {
    fetchMyShift.mockResolvedValue({ id: 's', user_id: 'w', started_at: new Date().toISOString(), ended_at: null });
    fetchMyShiftReport.mockResolvedValueOnce(report(0)).mockResolvedValueOnce(report(50));
    endShift.mockRejectedValue(new Error('you still have 1 unpaid bill(s)'));

    const { rerender } = render(<ShiftBar role="waiter" currency="ETB" refreshSignal="a" />);
    await waitFor(() => expect(screen.getByTestId('shift-totals').textContent).toContain('collected 0'));
    fireEvent.click(screen.getByText('End shift'));
    expect(await screen.findByRole('alert')).toBeTruthy();

    rerender(<ShiftBar role="waiter" currency="ETB" refreshSignal="b" />);
    await waitFor(() => expect(screen.getByTestId('shift-totals').textContent).toContain('collected 50'));
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
