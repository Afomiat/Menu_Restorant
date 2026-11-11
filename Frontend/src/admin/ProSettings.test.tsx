import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { Category, MenuItem, RestaurantMeta, StaffMember } from '../types';

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
// The QR code is drawn in the browser; the test only needs to know what it was asked to encode
const toDataURL = vi.fn(async (text: string) => `data:image/png;base64,QR:${text}`);
vi.mock('qrcode', () => ({ default: { toDataURL: (text: string) => toDataURL(text) } }));
const fetchAdminTenantProfile = vi.fn();
const updateTenantSettings = vi.fn();
vi.mock('../services/menuService', () => ({
  fetchAdminTenantProfile: () => fetchAdminTenantProfile(),
  updateTenantSettings: (...a: unknown[]) => updateTenantSettings(...a),
}));

import AdminTablesModal from './AdminTablesModal';
import AdminSettingsModal from './AdminSettingsModal';
import AdminItemModal from './AdminItemModal';
import AdminDishCard from './AdminDishCard';

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

  it('shows each table with its waiter and confirms a change', async () => {
    fetchAdminTables.mockResolvedValue([
      { id: 'tb5', tenant_id: 't', table_number: '5', is_active: true, assigned_waiter_id: 'w1', assigned_waiter_name: 'Abebe' },
      { id: 'tb6', tenant_id: 't', table_number: 'Table 6', is_active: true, assigned_waiter_id: null },
    ]);
    assignTableWaiter.mockResolvedValueOnce({ id: 'tb5', tenant_id: 't', table_number: '5', is_active: true, assigned_waiter_id: null });
    render(<AdminTablesModal isOpen onClose={vi.fn()} restaurantSlug="demo-pro" plan="pro" />);

    expect((await screen.findByText('Table 5')).closest('button')?.textContent).toBe('Table 5 · Abebe');
    // A table already named "Table 6" is not shown as "Table Table 6"
    expect(screen.getByText('Table 6').closest('button')?.textContent).toBe('Table 6 · no waiter');

    const select = (await screen.findByLabelText(/^Waiter/)) as HTMLSelectElement;
    await waitFor(() => expect(select.value).toBe('w1'));
    fireEvent.change(select, { target: { value: '' } });

    expect((await screen.findByRole('status')).textContent).toContain('Saved');
    expect(screen.getByText('Table 5').closest('button')?.textContent).toBe('Table 5 · no waiter');
  });

  it('keeps a turned-off waiter visible on their table', async () => {
    fetchAdminTables.mockResolvedValue([
      { id: 'tb5', tenant_id: 't', table_number: '5', is_active: true, assigned_waiter_id: 'w2', assigned_waiter_name: 'Gone' },
    ]);
    render(<AdminTablesModal isOpen onClose={vi.fn()} restaurantSlug="demo-pro" plan="pro" />);

    const select = (await screen.findByLabelText(/^Waiter/)) as HTMLSelectElement;
    await waitFor(() => expect(select.value).toBe('w2'));
    expect(select.selectedOptions[0].textContent).toBe('Gone (turned off)');
  });

  it('draws the QR code in the app and offers it as a download', async () => {
    render(<AdminTablesModal isOpen onClose={vi.fn()} restaurantSlug="demo-pro" plan="pro" />);

    const img = (await screen.findByAltText('Table 5 QR')) as HTMLImageElement;
    expect(img.src.startsWith('data:image/png')).toBe(true);
    expect(img.src).not.toContain('qrserver');
    expect(toDataURL).toHaveBeenCalledWith(expect.stringContaining('/m/demo-pro?table=5&token=x'));

    const link = screen.getByText('Download QR').closest('a') as HTMLAnchorElement;
    expect(link.getAttribute('download')).toBe('demo-pro-table-5-qr.png');
    expect(link.getAttribute('href')).toBe(img.getAttribute('src'));
  });

  it('prints only the sticker, with the restaurant and table', async () => {
    const doc = { write: vi.fn(), close: vi.fn() };
    const open = vi.spyOn(window, 'open').mockReturnValue({ document: doc } as unknown as Window);
    render(<AdminTablesModal isOpen onClose={vi.fn()} restaurantSlug="demo-pro" plan="pro" restaurantName="Demo <Pro>" />);
    await screen.findByAltText('Table 5 QR');

    fireEvent.click(screen.getByText('Print sticker'));

    const html = doc.write.mock.calls[0][0] as string;
    expect(html).toContain('Demo &lt;Pro&gt;');
    expect(html).toContain('Table 5');
    expect(html).toContain('Scan to see the menu and order');
    expect(html).toContain('window.print()');
    open.mockRestore();
  });

  it('has no waiter choice below Pro', async () => {
    render(<AdminTablesModal isOpen onClose={vi.fn()} restaurantSlug="demo-plus" plan="plus" />);

    expect(await screen.findByText('QR Code for Table 5')).toBeTruthy();
    expect(screen.queryByLabelText('Waiter')).toBeNull();
    expect(fetchStaff).not.toHaveBeenCalled();
  });
});

describe('Pro timings', () => {
  const settings = { default_prep_minutes: 15, bill_reminder_minutes: 10, bill_escalation_minutes: 20, confirm_reminder_minutes: 15, long_table_minutes: 120 };
  const meta = { name: 'Bistro', tagline: '', themeColor: '#000', slug: 'bistro', plan: 'pro', template: 'modern' } as RestaurantMeta;
  const renderSettings = () => {
    const onSave = vi.fn();
    const onClose = vi.fn();
    render(<AdminSettingsModal isOpen meta={meta} onClose={onClose} onSave={onSave} onResetToDefault={vi.fn()} showProTimings />);
    return { onSave, onClose };
  };

  it('saves changed timings with the one Save Settings button', async () => {
    fetchAdminTenantProfile.mockResolvedValue({ settings });
    updateTenantSettings.mockResolvedValue({ ...settings, default_prep_minutes: 18 });
    const { onSave, onClose } = renderSettings();

    const prep = (await screen.findByLabelText('Default prep time')) as HTMLInputElement;
    expect(prep.value).toBe('15');
    expect((screen.getByLabelText('Remind waiter about a long-open table after') as HTMLInputElement).value).toBe('120');
    expect(screen.queryByText('Save timings')).toBeNull();

    fireEvent.change(prep, { target: { value: '18' } });
    fireEvent.click(screen.getByText('Save Settings'));

    await waitFor(() => expect(updateTenantSettings).toHaveBeenCalledWith({ ...settings, default_prep_minutes: 18 }));
    await waitFor(() => expect(onSave).toHaveBeenCalled());
    expect(onClose).toHaveBeenCalled();
  });

  it('does not call the server for timings that did not change', async () => {
    fetchAdminTenantProfile.mockResolvedValue({ settings });
    const { onSave } = renderSettings();
    await screen.findByLabelText('Default prep time');

    fireEvent.click(screen.getByText('Save Settings'));

    await waitFor(() => expect(onSave).toHaveBeenCalled());
    expect(updateTenantSettings).not.toHaveBeenCalled();
  });

  it('names the setting when a value is out of range and keeps the window open', async () => {
    fetchAdminTenantProfile.mockResolvedValue({ settings });
    const { onSave, onClose } = renderSettings();

    fireEvent.change(await screen.findByLabelText('Default prep time'), { target: { value: '0' } });
    fireEvent.click(screen.getByText('Save Settings'));

    expect((await screen.findByRole('alert')).textContent).toBe('Default prep time must be between 1 and 240 minutes.');
    expect(updateTenantSettings).not.toHaveBeenCalled();
    expect(onSave).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('asks for a number when a box is left empty', async () => {
    fetchAdminTenantProfile.mockResolvedValue({ settings });
    renderSettings();

    fireEvent.change(await screen.findByLabelText('Remind cashier to confirm after'), { target: { value: '' } });
    fireEvent.click(screen.getByText('Save Settings'));

    expect((await screen.findByRole('alert')).textContent).toBe('Remind cashier to confirm after: enter a number of minutes.');
  });

  it('keeps the manager alert after the waiter reminder', async () => {
    fetchAdminTenantProfile.mockResolvedValue({ settings });
    renderSettings();

    fireEvent.change(await screen.findByLabelText('Alert manager about an unpaid bill after'), { target: { value: '5' } });
    fireEvent.click(screen.getByText('Save Settings'));

    expect((await screen.findByRole('alert')).textContent).toBe('The manager alert for an unpaid bill must come after the waiter reminder.');
    expect(updateTenantSettings).not.toHaveBeenCalled();
  });

  it('shows the reason when the server refuses, and keeps the window open', async () => {
    fetchAdminTenantProfile.mockResolvedValue({ settings });
    updateTenantSettings.mockRejectedValue(new Error('Something went wrong on the server'));
    const { onClose } = renderSettings();

    fireEvent.change(await screen.findByLabelText('Default prep time'), { target: { value: '16' } });
    fireEvent.click(screen.getByText('Save Settings'));

    expect((await screen.findByRole('alert')).textContent).toBe('Something went wrong on the server');
    expect(onClose).not.toHaveBeenCalled();
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

  it('shows the restaurant\'s own default, not a fixed 15', () => {
    render(<AdminItemModal isOpen item={{ ...tibs, prepMinutes: null }} categories={categories} currency="ETB" onClose={vi.fn()} onSave={vi.fn()} showPrepTime defaultPrepMinutes={20} />);

    const prep = screen.getByLabelText('Prep time (minutes)') as HTMLInputElement;
    expect(prep.value).toBe('');
    expect(prep.placeholder).toBe('Default (20)');
    expect(screen.getByText('Leave empty to use the restaurant default (20 min).')).toBeTruthy();
  });

  it('shows a dish\'s own prep time on its card (Pro only)', () => {
    const card = (item: MenuItem, showPrepTime: boolean) =>
      render(<AdminDishCard item={item} categoryName="Mains" currency="ETB" onEdit={vi.fn()} onDelete={vi.fn()} onUpdatePrice={vi.fn()} onToggleStock={vi.fn()} showPrepTime={showPrepTime} />);

    card(tibs, true);
    expect(screen.getByTitle('Prep time set for this dish').textContent).toContain('25 min');
    cleanup();

    card({ ...tibs, prepMinutes: null }, true);
    expect(screen.queryByTitle('Prep time set for this dish')).toBeNull();
    cleanup();

    card(tibs, false);
    expect(screen.queryByTitle('Prep time set for this dish')).toBeNull();
  });

  it('has no prep time below Pro', () => {
    render(<AdminItemModal isOpen item={tibs} categories={categories} currency="ETB" onClose={vi.fn()} onSave={vi.fn()} />);
    expect(screen.queryByLabelText('Prep time (minutes)')).toBeNull();
  });
});
