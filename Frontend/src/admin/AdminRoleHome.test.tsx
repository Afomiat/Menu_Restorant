import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import AdminRoleHome from './AdminRoleHome';

afterEach(cleanup);

describe('AdminRoleHome', () => {
  it('greets a waiter by name and lets them sign out', () => {
    const onLogout = vi.fn();
    render(<AdminRoleHome role="waiter" fullName="Abebe Kebede" onLogout={onLogout} />);

    expect(screen.getByText('Hello, Abebe Kebede')).toBeTruthy();
    expect(screen.getByText('Signed in as Waiter')).toBeTruthy();
    expect(screen.getByText(/Your tables/)).toBeTruthy();

    fireEvent.click(screen.getByText('Sign out'));
    expect(onLogout).toHaveBeenCalledTimes(1);
  });

  it('tells a cashier where bills will appear', () => {
    render(<AdminRoleHome role="cashier" onLogout={vi.fn()} />);

    expect(screen.getByText('Hello')).toBeTruthy();
    expect(screen.getByText('Signed in as Cashier')).toBeTruthy();
    expect(screen.getByText(/Bills waiting for confirmation/)).toBeTruthy();
  });
});
