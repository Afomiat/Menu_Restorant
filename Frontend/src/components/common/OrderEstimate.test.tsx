import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import type { CartItem } from '../../types';
import OrderEstimate from './OrderEstimate';

const order = (extra: Partial<CartItem>): CartItem => ({
  item: { id: 'tibs', name: 'Tibs', price: 450, imageUrl: '', description: '', tags: [], available: true, categoryId: 'all' },
  quantity: 1,
  orderId: 'o1',
  ...extra,
});

afterEach(cleanup);

describe('OrderEstimate', () => {
  it('shows the estimate for a Pro order', () => {
    render(<OrderEstimate order={order({ status: 'not_started', targetMinutes: 15 })} />);
    expect(screen.getByTestId('order-estimate').textContent).toBe('About 15 min');
  });

  it('counts down while cooking', () => {
    render(<OrderEstimate order={order({ status: 'preparing', targetMinutes: 15, startedAt: Date.now() - 8 * 60_000 })} />);
    expect(screen.getByTestId('order-estimate').textContent).toBe('Ready in about 7 min');
  });

  it('shows nothing without a target (Basic and Plus) or once ready', () => {
    render(<OrderEstimate order={order({ status: 'not_started' })} />);
    render(<OrderEstimate order={order({ status: 'ready', targetMinutes: 15 })} />);
    expect(screen.queryByTestId('order-estimate')).toBeNull();
  });
});
