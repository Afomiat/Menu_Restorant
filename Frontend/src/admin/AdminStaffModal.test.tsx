import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { StaffMember } from '../types';

const fetchStaff = vi.fn();
const createStaff = vi.fn();
const updateStaff = vi.fn();
vi.mock('../services/staffService', () => ({
  fetchStaff: (...a: unknown[]) => fetchStaff(...a),
  createStaff: (...a: unknown[]) => createStaff(...a),
  updateStaff: (...a: unknown[]) => updateStaff(...a),
}));

import AdminStaffModal from './AdminStaffModal';

const member = (id: string, full_name: string, role: StaffMember['role'], is_active = true): StaffMember => ({
  id,
  tenant_id: 't1',
  full_name,
  phone: `+2519110000${id}`,
  email: '',
  role,
  is_active,
  created_at: '2026-11-04T00:00:00Z',
});

const hana = member('01', 'Hana Alemu', 'manager');
const abebe = member('02', 'Abebe Kebede', 'waiter');

beforeEach(() => {
  fetchStaff.mockReset().mockResolvedValue([hana, abebe]);
  createStaff.mockReset();
  updateStaff.mockReset();
});
afterEach(cleanup);

function renderModal(plan: 'basic' | 'plus' | 'pro' = 'pro', onToast = vi.fn()) {
  render(<AdminStaffModal isOpen onClose={vi.fn()} plan={plan} currentUserId="01" onToast={onToast} />);
  return onToast;
}

describe('AdminStaffModal', () => {
  it('explains that staff accounts need Pro and loads nothing', () => {
    renderModal('plus');

    expect(screen.getByText(/Staff accounts are part of the Pro plan/)).toBeTruthy();
    expect(fetchStaff).not.toHaveBeenCalled();
  });

  it('lists the staff with their phone and role', async () => {
    renderModal();

    const row = await screen.findByTestId('staff-row-02');
    expect(within(row).getByText('Abebe Kebede')).toBeTruthy();
    expect(within(row).getByText('+251911000002')).toBeTruthy();
    expect((within(row).getByLabelText('Role: Abebe Kebede') as HTMLSelectElement).value).toBe('waiter');
  });

  it('does not let the manager change their own role or turn themselves off', async () => {
    renderModal();

    const own = await screen.findByTestId('staff-row-01');
    expect(within(own).getByText('(You)')).toBeTruthy();
    expect((within(own).getByLabelText('Role: Hana Alemu') as HTMLSelectElement).disabled).toBe(true);
    expect((within(own).getByText('Turn off') as HTMLButtonElement).disabled).toBe(true);
  });

  it('adds a staff member', async () => {
    const tigist = member('04', 'Tigist Worku', 'chef');
    createStaff.mockResolvedValueOnce(tigist);
    const onToast = renderModal();
    await screen.findByTestId('staff-row-02');

    const form = screen.getByRole('form', { name: 'Add staff member' });
    fireEvent.change(within(form).getByLabelText('Full name'), { target: { value: 'Tigist Worku' } });
    fireEvent.change(within(form).getByLabelText('Phone number'), { target: { value: '0911 000 004' } });
    fireEvent.change(within(form).getByLabelText('Password'), { target: { value: 'pass123' } });
    fireEvent.change(within(form).getByLabelText('Role'), { target: { value: 'chef' } });
    fireEvent.submit(form);

    expect(await screen.findByTestId('staff-row-04')).toBeTruthy();
    expect(createStaff).toHaveBeenCalledWith({
      full_name: 'Tigist Worku',
      phone: '0911 000 004',
      email: undefined,
      password: 'pass123',
      role: 'chef',
    });
    expect(onToast).toHaveBeenCalledWith('Tigist Worku was added');
  });

  it('shows the reason when adding fails', async () => {
    createStaff.mockRejectedValueOnce(new Error('another staff member already uses this phone number'));
    renderModal();
    await screen.findByTestId('staff-row-02');

    const form = screen.getByRole('form', { name: 'Add staff member' });
    fireEvent.change(within(form).getByLabelText('Full name'), { target: { value: 'Copy' } });
    fireEvent.change(within(form).getByLabelText('Phone number'), { target: { value: '0911000002' } });
    fireEvent.change(within(form).getByLabelText('Password'), { target: { value: 'pass123' } });
    fireEvent.submit(form);

    expect(await screen.findByText('another staff member already uses this phone number')).toBeTruthy();
  });

  it('changes a role and turns a staff member off', async () => {
    updateStaff
      .mockResolvedValueOnce({ ...abebe, role: 'cashier' })
      .mockResolvedValueOnce({ ...abebe, role: 'cashier', is_active: false });
    renderModal();
    const row = await screen.findByTestId('staff-row-02');

    fireEvent.change(within(row).getByLabelText('Role: Abebe Kebede'), { target: { value: 'cashier' } });
    await waitFor(() => expect(updateStaff).toHaveBeenCalledWith('02', { role: 'cashier' }));

    fireEvent.click(within(row).getByText('Turn off'));
    await waitFor(() => expect(updateStaff).toHaveBeenCalledWith('02', { is_active: false }));
    expect(await within(row).findByText('Turned off')).toBeTruthy();
    expect(within(row).getByText('Turn on')).toBeTruthy();
  });

  it('shows the reason when a change is refused', async () => {
    updateStaff.mockRejectedValueOnce(new Error('the restaurant needs at least one active manager'));
    renderModal();
    const row = await screen.findByTestId('staff-row-02');

    fireEvent.click(within(row).getByText('Turn off'));

    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(screen.getByText('the restaurant needs at least one active manager')).toBeTruthy();
  });

  it('sets a new password', async () => {
    updateStaff.mockResolvedValueOnce(abebe);
    const onToast = renderModal();
    const row = await screen.findByTestId('staff-row-02');

    fireEvent.click(within(row).getByText('New password'));
    fireEvent.change(within(row).getByLabelText('New password for Abebe Kebede (at least 6 characters)'), {
      target: { value: 'newpass1' },
    });
    fireEvent.click(within(row).getByText('Saved'));

    await waitFor(() => expect(updateStaff).toHaveBeenCalledWith('02', { password: 'newpass1' }));
    expect(onToast).toHaveBeenCalledWith('Password changed for Abebe Kebede');
  });
});
