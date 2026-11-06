import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { Category, MenuItem, StaffMember } from '../types';

// --- Services used by the manager's Pro settings ---
const fetchAdminTables = vi.fn();
const assignTableWaiter = vi.fn();
vi.mock('../services/orderService', () => ({
  fetchAdminTables: () => fetchAdminTables(),
  createAdminTable: vi.fn(),
  generateAdminTableQR: vi.fn(async (n: string) => ({ qr_url: `/m/demo-pro?table=${n}&token=x` })),
  assignTableWaiter: (...a: unknown[]) => assignTableWaiter(...a),
}));
const fetchStaff = vi.fn();
vi.mock('../services/staffService', () => ({ fetchStaff: () => fetchStaff() }));
const fetchAdminTenantProfile = vi.fn();
const updateTenantSettings = vi.fn();
vi.mock('../services/menuService', () => ({
  fetchAdminTenantProfile: () => fetchAdminTenantProfile(),
  updateTenantSettings: (...a: unknown[]) => updateTenantSettings(...a),
}));

import AdminTablesModal from './AdminTablesModal';
import ProTimingsSection from './ProTimingsSection';
import AdminItemModal from './AdminItemModal';

const waiter = (id: string, full_name: string, extra: Partial<StaffMember> = {}): StaffMember => ({
  id,
  tenant_id: 't',
  full_name,
  phone: '',
  email: '',
  role: 'waiter',
  is_active: true,
  created_at: '',
  ...extra,
});

beforeEach(() => {
  fetchAdminTables.mockReset().mockResolvedValue([{ id: 'tb5', tenant_id: 't', table_number: '5', is_active: true, assigned_waiter_id: null }]);
  assignTableWaiter.mockReset();
  fetchStaff.mockReset().mockResolvedValue([
    waiter('w1', 'Abebe'),
    waiter('w2', 'Gone', { is_active: false }),
    waiter('c1', 'Tsion', { role: 'chef' }),
  ]);
  fetchAdminTenantProfile.mockReset();
  updateTenantSettings.mockReset();
});
afterEach(cleanup);

describe('Tables: assigning a waiter (Pro)', () => {
  it('offers active waiters only and saves the choice', async () => {
    assignTableWaiter.mockResolvedValueOnce({ id: 'tb5', tenant_id: 't', table_number: '5', is_active: true, assigned_waiter_id: 'w1', assigned_waiter_name: 'Abebe' });
    render(<AdminTablesModal isOpen onClose={vi.fn()} restaurantSlug="demo-pro" plan="pro" />);

    const select = (await screen.findByLabelText('Waiter')) as HTMLSelectElement;
    await waitFor(() => expect(select.options.length).toBe(2));
    expect(Array.from(select.options).map((o) => o.textContent)).toEqual(['No waiter (alerts go to managers)', 'Abebe']);

    fireEvent.change(select, { target: { value: 'w1' } });
    await waitFor(() => expect(assignTableWaiter).toHaveBeenCalledWith('tb5', 'w1'));
    await waitFor(() => expect(select.value).toBe('w1'));

    assignTableWaiter.mockResolvedValueOnce({ id: 'tb5', tenant_id: 't', table_number: '5', is_active: true, assigned_waiter_id: null });
    fireEvent.change(select, { target: { value: '' } });
    await waitFor(() => expect(assignTableWaiter).toHaveBeenCalledWith('tb5', null));
  });

  it('shows the reason when assigning fails', async () => {
    assignTableWaiter.mockRejectedValueOnce(new Error('choose an active waiter of this restaurant'));
    render(<AdminTablesModal isOpen onClose={vi.fn()} restaurantSlug="demo-pro" plan="pro" />);

    const select = (await screen.findByLabelText('Waiter')) as HTMLSelectElement;
    await waitFor(() => expect(select.options.length).toBe(2));
    fireEvent.change(select, { target: { value: 'w1' } });

    expect((await screen.findByRole('alert')).textContent).toBe('choose an active waiter of this restaurant');
  });

  it('has no waiter choice below Pro', async () => {
    render(<AdminTablesModal isOpen onClose={vi.fn()} restaurantSlug="demo-plus" plan="plus" />);

    expect(await screen.findByText('QR Code for Table 5')).toBeTruthy();
    expect(screen.queryByLabelText('Waiter')).toBeNull();
    expect(fetchStaff).not.toHaveBeenCalled();
  });
});

describe('Pro timings', () => {
  it('loads the current timings and saves changes', async () => {
    const settings = { default_prep_minutes: 15, bill_reminder_minutes: 10, bill_escalation_minutes: 20, confirm_reminder_minutes: 15, long_table_minutes: 120 };
    fetchAdminTenantProfile.mockResolvedValue({ settings });
    updateTenantSettings.mockResolvedValue({ ...settings, default_prep_minutes: 18 });
    const onSaved = vi.fn();
    render(<ProTimingsSection onSaved={onSaved} />);

    const prep = (await screen.findByLabelText('Default prep time')) as HTMLInputElement;
    expect(prep.value).toBe('15');
    expect((screen.getByLabelText('Remind waiter about a long-open table after') as HTMLInputElement).value).toBe('120');

    fireEvent.change(prep, { target: { value: '18' } });
    fireEvent.click(screen.getByText('Save timings'));

    await waitFor(() => expect(updateTenantSettings).toHaveBeenCalledWith({ ...settings, default_prep_minutes: 18 }));
    expect(onSaved).toHaveBeenCalledWith('Timings saved');
  });

  it('shows the reason when the server refuses', async () => {
    fetchAdminTenantProfile.mockResolvedValue({ settings: { default_prep_minutes: 15, bill_reminder_minutes: 10, bill_escalation_minutes: 20, confirm_reminder_minutes: 15, long_table_minutes: 120 } });
    updateTenantSettings.mockRejectedValue(new Error('the manager alert for an unpaid bill must come after the waiter reminder'));
    render(<ProTimingsSection />);

    fireEvent.click(await screen.findByText('Save timings'));

    expect((await screen.findByRole('alert')).textContent).toContain('must come after the waiter reminder');
  });
});

describe('Dish editor: prep time (Pro)', () => {
  const categories: Category[] = [{ id: 'mains', name: 'Mains', sortOrder: 1 }];
  const tibs: MenuItem = { id: 'tibs', name: 'Tibs', price: 450, imageUrl: '', description: '', tags: [], available: true, categoryId: 'mains', prepMinutes: 25 };

  it('shows the prep time on Pro and saves it with the dish', () => {
    const onSave = vi.fn();
    render(<AdminItemModal isOpen item={tibs} categories={categories} currency="ETB" onClose={vi.fn()} onSave={onSave} showPrepTime />);

    const prep = screen.getByLabelText('Prep time (minutes)') as HTMLInputElement;
    expect(prep.value).toBe('25');
    fireEvent.change(prep, { target: { value: '30' } });
    fireEvent.submit(prep.closest('form')!);

    expect(onSave.mock.calls[0][0].prepMinutes).toBe(30);
  });

  it('saves an empty prep time as the restaurant default', () => {
    const onSave = vi.fn();
    render(<AdminItemModal isOpen item={tibs} categories={categories} currency="ETB" onClose={vi.fn()} onSave={onSave} showPrepTime />);

    const prep = screen.getByLabelText('Prep time (minutes)');
    fireEvent.change(prep, { target: { value: '' } });
    fireEvent.submit(prep.closest('form')!);

    expect(onSave.mock.calls[0][0].prepMinutes).toBeNull();
  });

  it('has no prep time below Pro', () => {
    render(<AdminItemModal isOpen item={tibs} categories={categories} currency="ETB" onClose={vi.fn()} onSave={vi.fn()} />);
    expect(screen.queryByLabelText('Prep time (minutes)')).toBeNull();
  });
});
