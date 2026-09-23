import { useState, useEffect, useCallback } from 'react';
import type { RestaurantMeta, Category, MenuItem } from '../types';
import { fetchRestaurantMenu, MenuServiceError } from '../services/menuService';

interface UseRestaurantMenuResult {
  meta: RestaurantMeta | null;
  categories: Category[];
  items: MenuItem[];
  loading: boolean;
  error: 'not-found' | 'network' | null;
  plan: 'standard' | 'vip';
}

export default function useRestaurantMenu(restaurantName: string | undefined): UseRestaurantMenuResult {
  const [meta, setMeta] = useState<RestaurantMeta | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<'not-found' | 'network' | null>(null);

  const normalizedSlug = restaurantName?.toLowerCase().trim() || '';

  const loadMenu = useCallback(async (isBackgroundUpdate = false) => {
    if (!normalizedSlug) {
      setError('not-found');
      setLoading(false);
      return;
    }

    if (!isBackgroundUpdate) {
      setLoading(true);
    }
    setError(null);

    try {
      const data = await fetchRestaurantMenu(normalizedSlug);
      setMeta(data.meta);
      setCategories(data.categories);
      setItems(data.items);
      setLoading(false);
    } catch (err) {
      if (err instanceof MenuServiceError && err.code === 'not-found') {
        setError('not-found');
      } else {
        setError('network');
      }
      setLoading(false);
    }
  }, [normalizedSlug]);

  useEffect(() => {
    loadMenu();

    if (!normalizedSlug) return;

    // 1. Real-time live synchronization across components/pages in the same window
    const handleMenuUpdated = (e: Event) => {
      const customEvent = e as CustomEvent<{ slug?: string }>;
      if (!customEvent.detail?.slug || customEvent.detail.slug === normalizedSlug) {
        loadMenu(true);
      }
    };

    // 2. Real-time live synchronization across browser tabs
    const handleStorage = (e: StorageEvent) => {
      if (e.key === `menu_custom_${normalizedSlug}`) {
        loadMenu(true);
      }
    };

    // 3. Re-sync whenever user focuses or switches back to this tab
    const handleFocus = () => {
      loadMenu(true);
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        loadMenu(true);
      }
    };

    window.addEventListener('restaurant-menu-updated', handleMenuUpdated);
    window.addEventListener('storage', handleStorage);
    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('restaurant-menu-updated', handleMenuUpdated);
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [normalizedSlug, loadMenu]);

  return { meta, categories, items, loading, error, plan: meta?.plan || 'standard' };
}
