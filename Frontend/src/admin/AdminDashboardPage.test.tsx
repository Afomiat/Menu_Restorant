import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
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
vi.mock('../hooks/useKitchenWebSocket', () => ({ useKitchenWebSocket: () => ({ isConnected: true }) }));
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
vi.mock('../services/orderService', async () => {
  const actual = await vi.importActual<typeof import('../services/orderService')>('../services/orderService');
  return {
    ...actual,
    fetchAdminActiveOrders: vi.fn(async () => kitchenOrders.map((o) => ({ id: o.orderId }))),
    mapBackendOrderToCartItems: (bo: { id: string }) => kitchenOrders.filter((o) => o.orderId === bo.id),
    updateTableOrdersStatus: (...args: unknown[]) => updateTableOrdersStatus(...args),
  };
});

import AdminDashboardPage from './AdminDashboardPage';

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

describe('AdminDashboardPage Start All', () => {
  it('starts the new round without sending the ready dish back to cooking', async () => {
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
