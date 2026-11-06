import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const get = vi.fn();
const post = vi.fn();
const put = vi.fn();
const patch = vi.fn();
vi.mock('./apiClient', async () => {
  const actual = await vi.importActual<typeof import('./apiClient')>('./apiClient');
  return {
    ...actual,
    apiClient: {
      get: (...args: unknown[]) => get(...args),
      post: (...args: unknown[]) => post(...args),
      put: (...args: unknown[]) => put(...args),
      patch: (...args: unknown[]) => patch(...args),
    },
  };
});

import {
  createAdminItem,
  fetchActiveRestaurants,
  fetchAdminTenantProfile,
  fetchRestaurantMenu,
  getSavedMenu,
  updateAdminItem,
  updateTenantSettings,
} from './menuService';

const backendMenu = (plan: string) => ({
  data: {
    tenant: { id: 't1', slug: 'bistro', name: 'Bistro', plan, currency: 'ETB', theme_config: {}, is_active: true },
    categories: [],
    items: [],
  },
});

beforeEach(() => {
  localStorage.clear();
  get.mockReset();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('plan from the backend', () => {
  it('keeps Basic, Plus and Pro from the live menu', async () => {
    for (const plan of ['basic', 'plus', 'pro']) {
      get.mockResolvedValueOnce(backendMenu(plan));
      const menu = await fetchRestaurantMenu('bistro');
      expect(menu.plan).toBe(plan);
      expect(menu.meta.plan).toBe(plan);
    }
  });

  it('maps an old VIP plan from the live menu to Plus', async () => {
    get.mockResolvedValueOnce(backendMenu('vip'));
    const menu = await fetchRestaurantMenu('bistro');
    expect(menu.meta.plan).toBe('plus');
  });

  it('maps old plan names in the restaurant list', async () => {
    get.mockResolvedValueOnce({
      data: [
        { id: '1', slug: 'a', name: 'A', plan: 'vip', currency: 'ETB', is_active: true },
        { id: '2', slug: 'b', name: 'B', plan: 'pro', currency: 'ETB', is_active: true },
        { id: '3', slug: 'c', name: 'C', plan: 'standard', currency: 'ETB', is_active: true },
      ],
    });
    const list = await fetchActiveRestaurants();
    expect(list.map((t) => t.plan)).toEqual(['plus', 'pro', 'basic']);
  });

  it('maps the admin profile plan', async () => {
    get.mockResolvedValueOnce({ data: { name: 'Bistro', slug: 'bistro', plan: 'vip', theme_config: {} } });
    const profile = await fetchAdminTenantProfile();
    expect(profile?.plan).toBe('plus');
  });
});

describe('plan from saved and static menus', () => {
  it('maps a menu saved on the phone before the rename', () => {
    localStorage.setItem(
      'azai:menu:bistro',
      JSON.stringify({ meta: { name: 'Bistro', tagline: '', themeColor: '#000', plan: 'vip' }, categories: [], items: [], plan: 'vip' })
    );
    const menu = getSavedMenu('bistro');
    expect(menu?.plan).toBe('plus');
    expect(menu?.meta.plan).toBe('plus');
  });

  it('maps the plan in a static menu file and defaults to Basic', async () => {
    get.mockRejectedValue(new Error('offline'));
    const fetchMock = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({ meta: { name: 'Luna', plan: 'vip' }, categories: [], items: [] }),
    });
    vi.stubGlobal('fetch', fetchMock);
    expect((await fetchRestaurantMenu('luna')).meta.plan).toBe('plus');

    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ meta: { name: 'Aura' }, categories: [], items: [] }) });
    expect((await fetchRestaurantMenu('aura')).meta.plan).toBe('basic');
  });
});

describe('Pro timings in menus and settings', () => {
  it('reads each dish prep time from the live menu', async () => {
    get.mockResolvedValueOnce({
      data: {
        ...backendMenu('pro').data,
        items: [
          { id: 'tibs', tenant_id: 't1', category_id: 'c', name: 'Tibs', description: '', price: 450, image_url: '', tags: [], is_available: true, is_sold_out: false, created_at: '', prep_minutes: 25 },
          { id: 'buna', tenant_id: 't1', category_id: 'c', name: 'Buna', description: '', price: 60, image_url: '', tags: [], is_available: true, is_sold_out: false, created_at: '' },
        ],
      },
    });
    const menu = await fetchRestaurantMenu('bistro');
    expect(menu.items.map((i) => i.prepMinutes)).toEqual([25, null]);
  });

  it('sends the prep time when adding and editing a dish', async () => {
    post.mockResolvedValueOnce({ data: { id: 'new' } });
    put.mockResolvedValueOnce({ data: { id: 'tibs' } });

    await createAdminItem({ categoryId: 'c', name: 'Tibs', price: 450, prepMinutes: 25 });
    await updateAdminItem('tibs', { categoryId: 'c', name: 'Tibs', price: 450, prepMinutes: null });

    expect(post.mock.calls[0][1].prep_minutes).toBe(25);
    expect(put.mock.calls[0][1].prep_minutes).toBeNull();
  });

  it('saves timings and reads them on the staff profile', async () => {
    patch.mockResolvedValueOnce({ data: { default_prep_minutes: 18 } });
    expect(await updateTenantSettings({ default_prep_minutes: 18 })).toEqual({ default_prep_minutes: 18 });
    expect(patch).toHaveBeenCalledWith('/admin/tenant/settings', { default_prep_minutes: 18 });

    get.mockResolvedValueOnce({ data: { name: 'Bistro', slug: 'bistro', plan: 'pro', settings: { default_prep_minutes: 18 }, theme_config: {} } });
    expect((await fetchAdminTenantProfile())?.settings?.default_prep_minutes).toBe(18);
  });
});
