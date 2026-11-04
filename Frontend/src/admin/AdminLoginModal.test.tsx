import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';

const loginStaff = vi.fn();
vi.mock('../services/apiClient', async () => {
  const actual = await vi.importActual<typeof import('../services/apiClient')>('../services/apiClient');
  return { ...actual, loginStaff: (...args: unknown[]) => loginStaff(...args) };
});

import AdminLoginModal from './AdminLoginModal';
import { NO_RESTAURANT_LOGIN_MESSAGE } from '../services/apiClient';

afterEach(() => {
  cleanup();
  loginStaff.mockReset();
});

function signIn(identifier: string, password = 'password123') {
  fireEvent.change(screen.getByLabelText('Phone number or email'), { target: { value: identifier } });
  fireEvent.change(document.querySelector('input[type="password"]')!, { target: { value: password } });
  fireEvent.submit(document.querySelector('form')!);
}

describe('AdminLoginModal', () => {
  it('signs in with a phone at this restaurant and passes the staff member on', async () => {
    const user = { id: 'u1', email: '', full_name: 'Abebe', role: 'waiter', tenant_id: 't1' };
    loginStaff.mockResolvedValueOnce({ token: 'jwt', user });
    const onSuccess = vi.fn();
    render(<AdminLoginModal isOpen restaurantSlug="demo-pro" onSuccess={onSuccess} />);

    signIn('0911200003');

    await waitFor(() => expect(onSuccess).toHaveBeenCalledWith('jwt', user));
    expect(loginStaff).toHaveBeenCalledWith('0911200003', 'password123', 'demo-pro');
  });

  it('asks for both fields', async () => {
    render(<AdminLoginModal isOpen restaurantSlug="demo-pro" onSuccess={vi.fn()} />);

    fireEvent.submit(document.querySelector('form')!);

    expect(await screen.findByText('Please enter your phone number (or email) and password.')).toBeTruthy();
    expect(loginStaff).not.toHaveBeenCalled();
  });

  it('explains when the account has no restaurant and stays signed out', async () => {
    loginStaff.mockRejectedValueOnce(new Error(NO_RESTAURANT_LOGIN_MESSAGE));
    const onSuccess = vi.fn();
    render(<AdminLoginModal isOpen restaurantSlug="demo-pro" onSuccess={onSuccess} />);

    signIn('superadmin@azai.local');

    expect(await screen.findByText(NO_RESTAURANT_LOGIN_MESSAGE)).toBeTruthy();
    expect(onSuccess).not.toHaveBeenCalled();
  });
});
