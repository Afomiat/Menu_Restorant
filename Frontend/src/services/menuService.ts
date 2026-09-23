import type {
  RestaurantMenu,
  MenuItem,
  Category,
  RestaurantMeta,
  RestaurantTheme,
  BackendFullMenuResponse,
  BackendMenuItem,
  BackendCategory,
} from '../types';
import { CANONICAL_MODERN_CATEGORIES, CANONICAL_MODERN_ITEMS } from '../data/modernMenuDefaults';
import { apiClient, ApiError } from './apiClient';

export class MenuServiceError extends Error {
  code: 'not-found' | 'network' | 'invalid-data';

  constructor(code: 'not-found' | 'network' | 'invalid-data', message?: string) {
    super(message || code);
    this.name = 'MenuServiceError';
    this.code = code;
  }
}

function mapBackendToRestaurantMenu(data: BackendFullMenuResponse['data']): RestaurantMenu {
  const tenant = data.tenant;
  const rawTheme = tenant.theme_config || {};
  const primaryColor = String(rawTheme.primaryColor || rawTheme.primary || '#F59E0B');

  const theme: RestaurantTheme = {
    primary: primaryColor,
    secondary: rawTheme.secondary ? String(rawTheme.secondary) : undefined,
    primaryLight: rawTheme.primaryLight ? String(rawTheme.primaryLight) : undefined,
    background: rawTheme.background ? String(rawTheme.background) : undefined,
    surface: rawTheme.surface ? String(rawTheme.surface) : undefined,
    text: rawTheme.text ? String(rawTheme.text) : undefined,
    textMuted: rawTheme.textMuted ? String(rawTheme.textMuted) : undefined,
    darkBar: rawTheme.darkBar ? String(rawTheme.darkBar) : undefined,
    mode: rawTheme.mode === 'dark' || rawTheme.mode === 'light' ? rawTheme.mode : undefined,
  };

  const meta: RestaurantMeta = {
    name: tenant.name,
    tagline: rawTheme.tagline || rawTheme.welcomeMessage || '',
    themeColor: primaryColor,
    theme,
    colors: theme,
    template: rawTheme.template === 'classic' ? 'classic' : 'modern',
    currency: tenant.currency || 'ETB',
    heroImageUrl: rawTheme.bannerUrl || rawTheme.heroImageUrl || undefined,
    heroTitle: tenant.name,
    heroSubtitle: rawTheme.welcomeMessage || '',
    heroBadges: Array.isArray(rawTheme.heroBadges) ? rawTheme.heroBadges.map(String).filter(Boolean) : undefined,
    deliveryAddress: rawTheme.address ? String(rawTheme.address) : undefined,
    logoUrl: rawTheme.logoUrl ? String(rawTheme.logoUrl) : undefined,
    openingHours: rawTheme.openingHours ? String(rawTheme.openingHours) : undefined,
    plan: getEffectiveTenantPlan(tenant.slug, tenant.plan),
    slug: tenant.slug,
  };

  const categories: Category[] = (data.categories || []).map((cat) => ({
    id: cat.id,
    name: cat.name,
    sortOrder: cat.sort_order,
  }));

  const items: MenuItem[] = (data.items || []).map((item) => ({
    id: item.id,
    categoryId: item.category_id,
    name: item.name,
    description: item.description,
    price: item.price,
    imageUrl: item.image_url || '/images/default_food.png',
    tags: Array.isArray(item.tags)
      ? item.tags.map((t: string) => String(t).toLowerCase().trim())
      : typeof item.tags === 'string' && (item.tags as string).trim()
      ? (item.tags as string).toLowerCase().split(/[\s,]+/).filter(Boolean) as any
      : [],
    available: item.is_available && !item.is_sold_out,
  }));

  return { meta, categories, items, plan: meta.plan || 'standard' };
}

/**
 * Validates and sanitizes raw restaurant JSON data, ensuring safe defaults
 * to prevent runtime crashes from missing fields.
 */
function sanitizeMenuData(raw: any): RestaurantMenu {
  if (!raw || typeof raw !== 'object') {
    throw new MenuServiceError('invalid-data', 'Menu data is not an object');
  }

  const rawTheme = raw.meta?.theme || raw.meta?.colors;
  const primaryColor = String(
    rawTheme?.primary || raw.meta?.themeColor || (raw.meta?.template === 'modern' ? '#ff5a36' : '#c9a876')
  );

  const theme: RestaurantTheme = {
    primary: primaryColor,
    secondary: rawTheme?.secondary ? String(rawTheme.secondary) : undefined,
    primaryLight: rawTheme?.primaryLight ? String(rawTheme.primaryLight) : undefined,
    background: rawTheme?.background ? String(rawTheme.background) : undefined,
    surface: rawTheme?.surface ? String(rawTheme.surface) : undefined,
    text: rawTheme?.text ? String(rawTheme.text) : undefined,
    textMuted: rawTheme?.textMuted ? String(rawTheme.textMuted) : undefined,
    darkBar: rawTheme?.darkBar ? String(rawTheme.darkBar) : undefined,
    mode: rawTheme?.mode === 'dark' || rawTheme?.mode === 'light' ? rawTheme.mode : undefined,
  };

  const meta: RestaurantMeta = {
    name: String(raw.meta?.name || 'Restaurant Menu'),
    tagline: String(raw.meta?.tagline || ''),
    themeColor: primaryColor,
    theme,
    colors: theme,
    template: raw.meta?.template === 'modern' ? 'modern' : 'classic',
    deliveryAddress: raw.meta?.deliveryAddress ? String(raw.meta.deliveryAddress) : undefined,
    currency: String(raw.meta?.currency || 'ETB'),
    heroImageUrl: raw.meta?.heroImageUrl ? String(raw.meta.heroImageUrl) : undefined,
    heroTitle: raw.meta?.heroTitle ? String(raw.meta.heroTitle) : undefined,
    heroSubtitle: raw.meta?.heroSubtitle ? String(raw.meta.heroSubtitle) : undefined,
    heroBadges: Array.isArray(raw.meta?.heroBadges) ? raw.meta.heroBadges.map(String) : undefined,
    plan: raw.plan === 'vip' || raw.meta?.plan === 'vip' ? 'vip' : 'standard',
  };

  // 1. Categories: Preserve custom categories or fallback to defaults (excluding any redundant 'all' category)
  let categories: Category[];
  if (Array.isArray(raw.categories) && raw.categories.length > 0) {
    categories = raw.categories
      .filter((cat: any) => {
        const id = String(cat?.id || '').trim().toLowerCase();
        const name = String(cat?.name || '').trim().toLowerCase();
        return id !== 'all' && name !== 'all' && name !== 'all dishes';
      })
      .map((cat: any, index: number) => ({
        id: String(cat?.id || `cat-${index}`),
        name: String(cat?.name || 'Category'),
        sortOrder: typeof cat?.sortOrder === 'number' ? cat.sortOrder : index + 1,
        iconUrl: cat?.iconUrl ? String(cat.iconUrl) : undefined,
      }));
  } else if (meta.template === 'modern') {
    categories = CANONICAL_MODERN_CATEGORIES;
  } else {
    categories = [];
  }

  // 2. Items: Preserve custom/stored items or fallback to template defaults
  let items: MenuItem[];
  if (Array.isArray(raw.items)) {
    items = raw.items.map((item: any, index: number) => ({
      id: String(item?.id || `item-${index}`),
      categoryId: String(item?.categoryId || (categories[0]?.id ?? 'food')),
      name: String(item?.name || 'Untitled Dish'),
      subtitle: item?.subtitle ? String(item.subtitle) : undefined,
      description: String(item?.description || ''),
      fullDescription: item?.fullDescription ? String(item.fullDescription) : undefined,
      price: typeof item?.price === 'number' ? item.price : parseFloat(String(item?.price)) || 0,
      imageUrl: String(item?.imageUrl || '/images/default_food.png'),
      tags: Array.isArray(item?.tags) ? item.tags : [],
      allergens: Array.isArray(item?.allergens) ? item.allergens : [],
      available: item?.available !== false,
      weightLabel: item?.weightLabel ? String(item.weightLabel) : undefined,
      badge: item?.badge ? String(item.badge) : undefined,
      variants: Array.isArray(item?.variants)
        ? item.variants.map((v: any) => ({
            name: String(v?.name || 'Standard'),
            priceAdjustment: typeof v?.priceAdjustment === 'number' ? v.priceAdjustment : 0,
          }))
        : undefined,
    }));

    // If initial JSON file has raw.prices override and not yet custom-edited
    if (!raw.isCustom && raw.prices && typeof raw.prices === 'object') {
      items = items.map((item) => {
        const customPrice = raw.prices[item.id];
        if (typeof customPrice === 'number') {
          return { ...item, price: customPrice };
        }
        return item;
      });
    }
  } else if (meta.template === 'modern') {
    items = CANONICAL_MODERN_ITEMS;
  } else {
    items = [];
  }

  return { meta, categories, items };
}

const STORAGE_PREFIX = 'menu_custom_';

/**
 * Retrieves client-side modified menu data for a specific restaurant if it exists.
 * Strictly isolated by restaurant slug.
 */
export function getStoredRestaurantMenu(slug: string): RestaurantMenu | null {
  if (typeof window === 'undefined' || !window.localStorage) return null;
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}${slug.toLowerCase().trim()}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return sanitizeMenuData(parsed);
  } catch (err) {
    console.warn(`[menuService] Failed to read stored menu for ${slug}:`, err);
    return null;
  }
}

/**
 * Persists customized menu data locally for a specific restaurant.
 * Strictly scoped so that editing Breath never affects Luna or Aura.
 * Automatically broadcasts updates to all active tabs/windows.
 */
export function saveRestaurantMenu(slug: string, menu: RestaurantMenu): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    const normalized = slug.toLowerCase().trim();
    const payload = { ...menu, isCustom: true };
    localStorage.setItem(`${STORAGE_PREFIX}${normalized}`, JSON.stringify(payload));

    // Broadcast live event across active views
    window.dispatchEvent(
      new CustomEvent('restaurant-menu-updated', {
        detail: { slug: normalized, menu: payload },
      })
    );
  } catch (err) {
    console.error(`[menuService] Failed to save menu for ${slug}:`, err);
    throw err;
  }
}

/**
 * Clears locally customized menu data for a restaurant, restoring original JSON.
 */
export function resetRestaurantMenu(slug: string): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  const normalized = slug.toLowerCase().trim();
  localStorage.removeItem(`${STORAGE_PREFIX}${normalized}`);
  window.dispatchEvent(
    new CustomEvent('restaurant-menu-updated', {
      detail: { slug: normalized, reset: true },
    })
  );
}

export async function fetchRestaurantMenu(slug: string): Promise<RestaurantMenu> {
  const normalizedSlug = slug.toLowerCase().trim();

  // 1. Try Live Backend API First (PostgreSQL + Supabase)
  try {
    const res = await apiClient.get<BackendFullMenuResponse>(`/menus/${normalizedSlug}`);
    if (res && res.data && res.data.tenant) {
      return mapBackendToRestaurantMenu(res.data);
    }
  } catch (err: any) {
    if (err instanceof ApiError && err.status === 404) {
      // If server explicitly says 404 restaurant not found, strictly fail with not-found
      throw new MenuServiceError('not-found', `Menu for ${normalizedSlug} not found`);
    }
    // Network error or backend offline: proceed to static/disk fallback
    console.warn(`[menuService] Backend API not available for ${normalizedSlug}, falling back to static/local:`, err?.message);
  }

  // 2. Fetch from static JSON file
  let diskMenu: RestaurantMenu | null = null;
  try {
    const response = await fetch(`/menus/${normalizedSlug}.json`);
    if (response.ok) {
      const raw = await response.json();
      diskMenu = sanitizeMenuData(raw);
    } else if (response.status === 404) {
      const stored = getStoredRestaurantMenu(normalizedSlug);
      if (stored) return stored;
      throw new MenuServiceError('not-found', `Menu for ${normalizedSlug} not found`);
    }
  } catch (err) {
    if (err instanceof MenuServiceError && err.code === 'not-found') {
      throw err;
    }
    const stored = getStoredRestaurantMenu(normalizedSlug);
    if (stored) return stored;
    throw new MenuServiceError('network', (err as Error)?.message || 'Network error fetching menu');
  }

  // 3. Check for locally customized menu data
  const stored = getStoredRestaurantMenu(normalizedSlug);
  if (!stored) {
    if (diskMenu) return diskMenu;
    throw new MenuServiceError('not-found', `Menu for ${normalizedSlug} not found`);
  }

  // 4. Merge stored custom data with disk menu
  if (diskMenu) {
    const mergedMeta: RestaurantMeta = {
      ...diskMenu.meta,
      ...stored.meta,
      heroImageUrl: stored.meta.heroImageUrl || diskMenu.meta.heroImageUrl,
      currency: diskMenu.meta.currency || stored.meta.currency || 'ETB',
    };

    const mergedMenu: RestaurantMenu = {
      meta: mergedMeta,
      categories: stored.categories && stored.categories.length > 0 ? stored.categories : diskMenu.categories,
      items: stored.items && stored.items.length > 0 ? stored.items : diskMenu.items,
    };

    try {
      localStorage.setItem(`${STORAGE_PREFIX}${normalizedSlug}`, JSON.stringify({ ...mergedMenu, isCustom: true }));
    } catch {
      // Ignore localStorage write error
    }

    return mergedMenu;
  }

  return stored;
}

// ============================================================================
// 5. Admin Menu & Category CRUD operations (PostgreSQL / Gin Backend)
// ============================================================================

export async function createAdminItem(item: {
  categoryId: string;
  name: string;
  description?: string;
  price: number;
  imageUrl?: string;
  tags?: string[];
}): Promise<BackendMenuItem> {
  const res = await apiClient.post<{ message: string; data: BackendMenuItem }>('/admin/items', {
    category_id: item.categoryId,
    name: item.name,
    description: item.description || '',
    price: item.price,
    image_url: item.imageUrl || '',
    tags: item.tags || [],
  });
  return res.data;
}

export async function updateAdminItem(
  id: string,
  item: {
    categoryId: string;
    name: string;
    description?: string;
    price: number;
    imageUrl?: string;
    tags?: string[];
    isAvailable?: boolean;
  }
): Promise<BackendMenuItem> {
  const res = await apiClient.put<{ message: string; data: BackendMenuItem }>(`/admin/items/${id}`, {
    category_id: item.categoryId,
    name: item.name,
    description: item.description || '',
    price: item.price,
    image_url: item.imageUrl || '',
    tags: item.tags || [],
    is_available: item.isAvailable !== false,
  });
  return res.data;
}

export async function deleteAdminItem(id: string): Promise<boolean> {
  await apiClient.delete(`/admin/items/${id}`);
  return true;
}

export async function createAdminCategory(name: string, sortOrder: number = 0): Promise<BackendCategory> {
  const res = await apiClient.post<{ message: string; data: BackendCategory }>('/admin/categories', {
    name,
    sort_order: sortOrder,
  });
  return res.data;
}

export async function updateAdminCategory(
  id: string,
  name: string,
  sortOrder: number = 0,
  isActive: boolean = true
): Promise<BackendCategory> {
  const res = await apiClient.put<{ message: string; data: BackendCategory }>(`/admin/categories/${id}`, {
    name,
    sort_order: sortOrder,
    is_active: isActive,
  });
  return res.data;
}

export async function deleteAdminCategory(id: string): Promise<boolean> {
  await apiClient.delete(`/admin/categories/${id}`);
  return true;
}

export async function updateAdminTenantTheme(themeConfig: Record<string, any>): Promise<boolean> {
  await apiClient.patch('/admin/tenant/theme', { theme_config: themeConfig });
  return true;
}

/**
 * Fetches live restaurant tenant profile from PostgreSQL
 */
export async function fetchAdminTenantProfile(): Promise<RestaurantMeta | null> {
  try {
    const res = await apiClient.get<{ data: any }>('/admin/tenant');
    if (res && res.data) {
      return {
        name: res.data.name,
        slug: res.data.slug,
        currency: res.data.currency || 'ETB',
        plan: res.data.plan,
        ...(res.data.theme_config || {}),
      };
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Fetches all categories directly from the admin categories endpoint
 */
export async function fetchAdminCategories(): Promise<BackendCategory[]> {
  try {
    const res = await apiClient.get<{ data: BackendCategory[] }>('/admin/categories');
    return res.data || [];
  } catch {
    return [];
  }
}

export interface ActiveTenantInfo {
  id: string;
  slug: string;
  name: string;
  plan: 'standard' | 'vip';
  currency: string;
  theme_config?: Record<string, any>;
  is_active: boolean;
}

/**
 * Fetches all active registered restaurants from PostgreSQL backend
 */
export async function fetchActiveRestaurants(): Promise<ActiveTenantInfo[]> {
  try {
    const res = await apiClient.get<{ data: ActiveTenantInfo[] }>('/restaurants');
    return res?.data || [];
  } catch (err) {
    console.warn('[menuService] Failed to fetch active restaurants:', err);
    return [];
  }
}

/**
 * Returns the active plan tier ('standard' or 'vip').
 *
 * The plan is derived exclusively from the backend API response (PostgreSQL tenants.plan).
 * There is intentionally no URL or localStorage override — plan spoofing via ?plan=vip
 * is not possible in production. The backend enforces the real access control.
 */
export function getEffectiveTenantPlan(_slug: string, backendPlan?: 'standard' | 'vip'): 'standard' | 'vip' {
  return backendPlan || 'standard';
}

