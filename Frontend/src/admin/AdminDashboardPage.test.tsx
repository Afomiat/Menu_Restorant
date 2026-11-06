import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type { CartItem, MenuItem, OrderStatus, PlanTier, RestaurantMeta } from '../types';

// The hook result must keep the same objects between renders, like the real hook,
// or the dashboard's effects that depend on them would run on every render.
const NO_CATEGORIES: never[] = [];
const NO_ITEMS: MenuItem[] = [];
const metaByPlan: Record<PlanTier, RestaurantMeta> = {
  basic: { name: 'Bistro', tagline: '', themeColor: '#000', slug: 'bistro', plan: 'basic', template: 'modern' },
  plus: { name: 'Bistro', tagline: '', themeColor: '#000', slug: 'bistro', plan: 'plus', template: 'modern' },
  pro: { name: 'Bistro', tagline: '', themeColor: '#000', slug: 'bistro', plan: 'pro', template: 'modern' },
};
let currentPlan: PlanTier = 'pro';
vi.mock('../hooks/useRestaurantMenu', () => ({
  default: () => ({
    meta: metaByPlan[currentPlan],
    categories: NO_CATEGORIES,
    items: NO_ITEMS,
    loading: false,
    error: null,
    plan: currentPlan,
  }),
}));
// Keeps the options the dashboard passes, so a test can fire live events through them
let wsOptions: Record<string, (...args: never[]) => void> = {};
vi.mock('../hooks/useKitchenWebSocket', () => ({
  useKitchenWebSocket: (opts: typeof wsOptions) => {
    wsOptions = opts;
    return { isConnected: true };
  },
}));
vi.mock('../services/apiClient', async () => {
  const actual = await vi.importActual<typeof import('../services/apiClient')>('../services/apiClient');
  return { ...actual, getAdminToken: () => 'token', clearAdminToken: vi.fn() };
});
vi.mock('../services/menuService', async () => {
  const actual = await vi.importActual<typeof import('../services/menuService')>('../services/menuService');
  return { ...actual, fetchAdminTenantProfile: vi.fn().mockResolvedValue({ name: 'Bistro', slug: 'bistro' }) };
});

const dish = (name: string): MenuItem => ({
  id: name,
  name,
  price: 100,
  imageUrl: '',
  description: '',
  tags: [],
  available: true,
  categoryId: 'all',
});
const order = (name: string, status: OrderStatus): CartItem => ({
  item: dish(name),
  quantity: 1,
  orderId: `${name}-0000-0000-0000-000000000000`,
  status,
  tableNumber: '5',
  placedAt: Date.now(),
});
let kitchenOrders: CartItem[] = [];
const updateTableOrdersStatus = vi.fn();
const updateOrderStatus = vi.fn(async (..._args: unknown[]) => true);
const fetchMyTables = vi.fn(async () => [] as unknown[]);
const fetchAdminActiveOrders = vi.fn(async () => kitchenOrders.map((o) => ({ id: o.orderId })));
vi.mock('../services/orderService', async () => {
  const actual = await vi.importActual<typeof import('../services/orderService')>('../services/orderService');
  return {
    ...actual,
    fetchAdminActiveOrders: () => fetchAdminActiveOrders(),
    mapBackendOrderToCartItems: (bo: { id: string }) => kitchenOrders.filter((o) => o.orderId === bo.id),
    updateTableOrdersStatus: (...args: unknown[]) => updateTableOrdersStatus(...args),
    updateOrderStatus: (...args: unknown[]) => updateOrderStatus(...args),
    fetchMyTables: () => fetchMyTables(),
  };
});

const fetchStaff = vi.fn(async () => []);
vi.mock('../services/staffService', () => ({
  fetchStaff: () => fetchStaff(),
  createStaff: vi.fn(),
  updateStaff: vi.fn(),
}));

const fetchBills = vi.fn(async () => [] as unknown[]);
vi.mock('../services/billService', () => ({
  fetchBills: () => fetchBills(),
  fetchMyShift: vi.fn(async () => null),
  startShift: vi.fn(),
  endShift: vi.fn(),
  requestBill: vi.fn(),
  collectBill: vi.fn(),
  confirmBill: vi.fn(),
  moveBill: vi.fn(),
  handoverBill: vi.fn(),
  fetchColleagues: vi.fn(async () => []),
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

import AdminDashboardPage from './AdminDashboardPage';

/** Signs in as a staff member with this role, the way a successful login stores it. */
function signedInAs(role: string, full_name = 'Test Person') {
  localStorage.setItem('azai_staff_user', JSON.stringify({ id: 'u1', email: '', full_name, role, tenant_id: 't1' }));
}

function renderDashboard() {
  return render(
    <MemoryRouter initialEntries={['/bistro/admin']}>
      <Routes>
        <Route path="/:restaurantName/admin" element={<AdminDashboardPage />} />
      </Routes>
    </MemoryRouter>
  );
}

beforeEach(() => {
  localStorage.clear();
  updateTableOrdersStatus.mockReset().mockResolvedValue(undefined);
  fetchAdminActiveOrders.mockClear();
  fetchStaff.mockClear();
  updateOrderStatus.mockClear();
  fetchMyTables.mockReset().mockResolvedValue([]);
  wsOptions = {};
  kitchenOrders = [];
  currentPlan = 'pro';
});

afterEach(cleanup);

describe('AdminDashboardPage plan badge', () => {
  it.each([
    ['basic', '⚡ Basic Plan'],
    ['plus', '👑 Plus Plan'],
    ['pro', '💎 Pro Plan'],
  ] as const)('shows the %s plan in the header', (plan, label) => {
    currentPlan = plan;
    renderDashboard();

    expect(screen.getAllByText(label).length).toBeGreaterThan(0);
  });
});

describe('AdminDashboardPage Start All (Plus kitchen)', () => {
  it('starts the new round without sending the ready dish back to cooking', async () => {
    currentPlan = 'plus';
    kitchenOrders = [order('Tibs', 'ready'), order('Coffee', 'not_started')];
    renderDashboard();

    fireEvent.click(screen.getAllByText('Kitchen Orders')[0].closest('button')!);
    fireEvent.click(await screen.findByText('Start All'));

    expect(updateTableOrdersStatus).toHaveBeenCalledWith('bistro', '5', 'preparing');
    // Coffee is now cooking (offers Mark Ready); Tibs is still ready (offers Served)
    expect(await screen.findByText('Mark Ready')).toBeTruthy();
    expect(screen.getByText('Served')).toBeTruthy();
    expect(screen.queryByText('Start Cooking')).toBeNull();
  });
});

describe('AdminDashboardPage screens by role', () => {
  const navItems = () => Array.from(document.querySelectorAll('.admin-nav-item')).map((el) => el.textContent?.trim());

  it('opens the kitchen for a chef and hides menu editing', async () => {
    currentPlan = 'plus';
    signedInAs('chef');
    kitchenOrders = [order('Coffee', 'not_started')];
    renderDashboard();

    expect(await screen.findByText('Start All')).toBeTruthy();
    // Kitchen Orders shows the number of open orders (1)
    expect(navItems()).toEqual(['Kitchen Orders1', 'Sign Out']);
    expect(screen.queryByLabelText('Add new dish')).toBeNull();
  });

  it('treats a login from before the Pro roles (kitchen) as a chef', async () => {
    currentPlan = 'plus';
    signedInAs('kitchen');
    kitchenOrders = [order('Coffee', 'not_started')];
    renderDashboard();

    expect(await screen.findByText('Start All')).toBeTruthy();
  });

  it('shows a waiter their own screen and does not load kitchen orders', () => {
    currentPlan = 'plus';
    signedInAs('waiter', 'Abebe Kebede');
    renderDashboard();

    expect(screen.getByText('Hello, Abebe Kebede')).toBeTruthy();
    expect(screen.getByText('Signed in as Waiter')).toBeTruthy();
    expect(fetchAdminActiveOrders).not.toHaveBeenCalled();
  });

  it('shows a cashier their own screen', () => {
    currentPlan = 'plus';
    signedInAs('cashier', 'Liya');
    renderDashboard();

    expect(screen.getByText('Signed in as Cashier')).toBeTruthy();
  });

  it('lets a manager open the Staff screen', async () => {
    signedInAs('manager');
    renderDashboard();

    fireEvent.click(screen.getByText('Staff', { selector: '.admin-nav-item span span' }));

    expect(await screen.findByRole('dialog', { name: 'Staff' })).toBeTruthy();
    expect(fetchStaff).toHaveBeenCalledTimes(1);
  });

  it('tells a turned-off staff member why they were signed out', async () => {
    currentPlan = 'plus';
    signedInAs('waiter');
    renderDashboard();

    act(() => {
      window.dispatchEvent(new CustomEvent('azai:auth:unauthorized', { detail: { code: 'STAFF_INACTIVE' } }));
    });

    expect(await screen.findByText(/Your account was turned off by a manager/)).toBeTruthy();
    expect(screen.getByLabelText('Phone number or email')).toBeTruthy();
  });
});

describe('AdminDashboardPage Pro screens', () => {
  it('gives a chef the Pro kitchen board and starts the whole order', async () => {
    signedInAs('chef');
    kitchenOrders = [order('Coffee', 'not_started')];
    renderDashboard();

    expect(await screen.findByText('Tap to enable sound')).toBeTruthy();
    expect(screen.queryByText('Start All')).toBeNull();

    fireEvent.click(await screen.findByText('Start'));

    expect(updateOrderStatus).toHaveBeenCalledWith('bistro', 'Coffee-0000-0000-0000-000000000000', 'preparing');
    // The timer starts at once
    expect((await screen.findByTestId('ticket-time')).textContent).toMatch(/^0:0\d \/ 15:00$/);
  });

  it('gives a waiter their tables and shows the food-ready bell as a banner', async () => {
    signedInAs('waiter', 'Abebe Kebede');
    renderDashboard();

    expect(await screen.findByText('My tables')).toBeTruthy();
    await waitFor(() => expect(fetchMyTables).toHaveBeenCalled());
    expect(fetchAdminActiveOrders).not.toHaveBeenCalled();

    act(() => wsOptions.onOrderReady?.({ order_id: 'o1', table_number: '5' } as never));

    expect((await screen.findByRole('alert')).textContent).toContain('Table 5: food is ready');
  });

  it('alerts a manager about an order cooking for twice its target', async () => {
    signedInAs('manager');
    renderDashboard();

    act(() => wsOptions.onOrderVeryLate?.({ order_id: 'o9', table_number: '7', target_minutes: 15, cooking_minutes: 31 } as never));

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('Table 7: cooking for 31 min (target 15 min)');
    fireEvent.click(within(alert).getByText('Dismiss'));
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('does not show the very-late alert to a chef', async () => {
    signedInAs('chef');
    renderDashboard();

    act(() => wsOptions.onOrderVeryLate?.({ order_id: 'o9', table_number: '7', target_minutes: 15, cooking_minutes: 31 } as never));

    expect(screen.queryByText(/cooking for 31 min/)).toBeNull();
  });

  it('turns the old new-order chime off on Pro and keeps it below Pro', () => {
    signedInAs('chef');
    renderDashboard();
    expect(wsOptions.chimeOnNewOrder).toBe(false);
    cleanup();

    currentPlan = 'plus';
    signedInAs('chef');
    renderDashboard();
    expect(wsOptions.chimeOnNewOrder).toBe(true);
  });
});

describe('AdminDashboardPage bills (Pro)', () => {
  it('gives a cashier the Bills screen with the shift bar', async () => {
    signedInAs('cashier', 'Liya');
    renderDashboard();

    expect(await screen.findByText('Collected, waiting for you to confirm (0)')).toBeTruthy();
    expect(screen.getByTestId('shift-status')).toBeTruthy();
    expect(fetchAdminActiveOrders).not.toHaveBeenCalled();
  });

  it('keeps a Plus cashier on the home screen', () => {
    currentPlan = 'plus';
    signedInAs('cashier', 'Liya');
    renderDashboard();

    expect(screen.getByText('Signed in as Cashier')).toBeTruthy();
  });

  it('lets a manager open Bills from the sidebar', async () => {
    signedInAs('manager');
    renderDashboard();

    fireEvent.click(screen.getByText('Bills', { selector: '.admin-nav-item span' }));

    expect(await screen.findByText('Open bills (0)')).toBeTruthy();
    expect(fetchBills).toHaveBeenCalled();
  });

  it('shows bill alerts as banners until dismissed', async () => {
    signedInAs('waiter', 'Abebe');
    renderDashboard();

    act(() => wsOptions.onStaffAlert?.('bill:requested' as never, { bill_id: 'b1', table_number: '5' } as never));
    act(() => wsOptions.onStaffAlert?.('table:long_open' as never, { bill_id: 'b2', table_number: '7' } as never));

    const alerts = await screen.findAllByRole('alert');
    expect(alerts.map((a) => a.textContent)).toEqual([
      expect.stringContaining('Table 5 asks for the bill'),
      expect.stringContaining('Table 7 has been open a long time'),
    ]);
    fireEvent.click(within(alerts[0]).getByText('Dismiss'));
    expect(screen.getAllByRole('alert')).toHaveLength(1);
  });
});

describe('AdminDashboardPage problems and reports (Pro)', () => {
  it('lets a manager open Alerts and Reports', async () => {
    problemSvc.fetchDecisions.mockResolvedValue({ problems: [], walkouts: [] });
    problemSvc.fetchDailyReport.mockResolvedValue({
      date: '2026-11-05', sales_by_method: [], sales_total: 0, waiters: [], walkouts: [], removed_dishes: [], kitchen: [], open_bills: [],
    });
    signedInAs('manager');
    renderDashboard();

    fireEvent.click(screen.getByText('Alerts', { selector: '.admin-nav-item span' }));
    expect(await screen.findByText('Nothing waiting for you.')).toBeTruthy();

    fireEvent.click(screen.getByText('Reports', { selector: '.admin-nav-item span' }));
    expect(await screen.findByRole('region', { name: 'Sales by payment method' })).toBeTruthy();
  });

  it('shows problem and walkout alerts to the manager', async () => {
    signedInAs('manager');
    renderDashboard();

    act(() => wsOptions.onStaffAlert?.('problem:reported' as never, { table_number: '5' } as never));
    act(() => wsOptions.onStaffAlert?.('walkout:marked' as never, { bill_id: 'b7', table_number: '7' } as never));

    const alerts = await screen.findAllByRole('alert');
    expect(alerts.map((a) => a.textContent)).toEqual([
      expect.stringContaining('Table 5 reported a problem with a dish'),
      expect.stringContaining('Table 7 left without paying'),
    ]);
  });
});
