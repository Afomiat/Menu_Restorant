import type { RestaurantMenu, MenuItem, Category, RestaurantMeta, RestaurantTheme } from '../types';
import { CANONICAL_MODERN_CATEGORIES, CANONICAL_MODERN_ITEMS } from '../data/modernMenuDefaults';

export class MenuServiceError extends Error {
  code: 'not-found' | 'network' | 'invalid-data';

  constructor(code: 'not-found' | 'network' | 'invalid-data', message?: string) {
    super(message || code);
    this.name = 'MenuServiceError';
    this.code = code;
  }
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

  // 1. Fetch from static JSON file
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

  // 2. Check for locally customized menu data
  const stored = getStoredRestaurantMenu(normalizedSlug);
  if (!stored) {
    if (diskMenu) return diskMenu;
    throw new MenuServiceError('not-found', `Menu for ${normalizedSlug} not found`);
  }

  // 3. If stored custom data exists, merge disk menu meta (so updates to JSON files like currency or name are reflected immediately)
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
