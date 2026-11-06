import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import AskBillButton from './AskBillButton';

afterEach(cleanup);

describe('AskBillButton', () => {
  it('asks once, then says the waiter is coming', () => {
    const onAsk = vi.fn();
    const { rerender } = render(<AskBillButton onAsk={onAsk} asked={false} />);

    fireEvent.click(screen.getByText('Ask for the bill'));
    expect(onAsk).toHaveBeenCalledTimes(1);

    rerender(<AskBillButton onAsk={onAsk} asked />);
    expect(screen.queryByText('Ask for the bill')).toBeNull();
    expect(screen.getByRole('status').textContent).toBe('Your waiter is bringing the bill');
  });

  it('shows why asking failed', () => {
    render(<AskBillButton onAsk={vi.fn()} asked={false} error="this table has no open bill" />);
    expect(screen.getByRole('alert').textContent).toBe('this table has no open bill');
  });
});
