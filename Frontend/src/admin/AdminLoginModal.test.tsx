import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';

const loginStaff = vi.fn();
vi.mock('../services/apiClient', async () => {
  const actual = await vi.importActual<typeof import('../services/apiClient')>('../services/apiClient');
  return { ...actual, loginStaff: (...args: unknown[]) => loginStaff(...args) };
});

import AdminLoginModal from './AdminLoginModal';
import { NO_RESTAURANT_LOGIN_MESSAGE } from '../services/apiClient';

afterEach(cleanup);

describe('AdminLoginModal', () => {
  it('explains when the account has no restaurant and stays signed out', async () => {
    loginStaff.mockRejectedValueOnce(new Error(NO_RESTAURANT_LOGIN_MESSAGE));
    const onSuccess = vi.fn();
    const { container } = render(<AdminLoginModal isOpen onSuccess={onSuccess} />);

    fireEvent.change(container.querySelector('input[type="email"]')!, { target: { value: 'superadmin@azai.local' } });
    fireEvent.change(container.querySelector('input[type="password"]')!, { target: { value: 'password123' } });
    fireEvent.submit(container.querySelector('form')!);

    expect(await screen.findByText(NO_RESTAURANT_LOGIN_MESSAGE)).toBeTruthy();
    expect(onSuccess).not.toHaveBeenCalled();
  });
});
