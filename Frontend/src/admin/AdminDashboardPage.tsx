import { useState, useEffect, useMemo, useRef, type CSSProperties } from 'react';
import { useParams } from 'react-router-dom';
import { Plus, AlertCircle, Sparkles, ChefHat, ExternalLink, UtensilsCrossed, ChevronLeft, ChevronRight } from 'lucide-react';
import useRestaurantMenu from '../hooks/useRestaurantMenu';
import { PlanProvider } from '../context/PlanContext';
import {
  saveRestaurantMenu,
  resetRestaurantMenu,
  createAdminItem,
  updateAdminItem,
  deleteAdminItem,
  createAdminCategory,
  updateAdminCategory,
  deleteAdminCategory,
  updateAdminTenantTheme,
  fetchAdminTenantProfile,
} from '../services/menuService';
import {
  saveRestaurantOrders,
  fetchAdminActiveOrders,
  mapBackendOrderToCartItems,
  mapBackendStatusToFrontend,
  toggleAdminItemSoldOut,
  updateOrderStatus,
  updateTableOrdersStatus,
  cancelTableOrders,
  cancelAllActiveOrders,
  clearCompletedOrders,
} from '../services/orderService';
import { getAdminToken, clearAdminToken } from '../services/apiClient';
import { useKitchenWebSocket } from '../hooks/useKitchenWebSocket';
import type { MenuItem, Category, RestaurantMeta, RestaurantMenu, CartItem, OrderStatus } from '../types';
import { matchesSearchQuery } from '../utils/search';
import SkeletonLoader from '../components/common/SkeletonLoader';
import NotFoundPage from '../pages/NotFoundPage';
import AdminSidebar from './AdminSidebar';
import AdminDishCard from './AdminDishCard';
import AdminCategoryCard from './AdminCategoryCard';
import AdminCategoryModal from './AdminCategoryModal';
import AdminEditCategoryModal from './AdminEditCategoryModal';
import AdminItemModal from './AdminItemModal';
import AdminSoldOutModal from './AdminSoldOutModal';
import AdminConfirmModal from './AdminConfirmModal';
import AdminSettingsModal from './AdminSettingsModal';
import AdminTablesModal from './AdminTablesModal';
import AdminKitchenView from './AdminKitchenView';
import AdminLoginModal from './AdminLoginModal';
import SearchBar from '../components/common/SearchBar';
import OfflineBanner from '../components/common/OfflineBanner';
import './admin.css';

export default function AdminDashboardPage() {
  const { restaurantName } = useParams<{ restaurantName: string }>();
  const slug = restaurantName?.toLowerCase().trim() || 'unknown';

  const { meta: initialMeta, categories: initialCategories, items: initialItems, loading, error } =
    useRestaurantMenu(slug);

  // The plan tier is derived exclusively from the backend API response (PostgreSQL tenants.plan).
  // It is NOT overridable from the UI — the backend RequireVIPPlan middleware is the real gate.
  const planFromBackend: 'standard' | 'vip' = initialMeta?.plan || 'standard';

  // Active top-level view: 'menu' (Dashboard/Dishes) or 'kitchen' (Live KDS Orders)
  const [activeView, setActiveView] = useState<'menu' | 'kitchen'>('menu');
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  // Local editable state
  const [meta, setMeta] = useState<RestaurantMeta | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [kitchenOrders, setKitchenOrders] = useState<CartItem[]>([]);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [stockFilter, setStockFilter] = useState<'all' | 'in-stock' | 'out-of-stock'>('all');

  // Category carousel scroll ref and state
  const categoryScrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const checkCategoryScroll = () => {
    if (categoryScrollRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = categoryScrollRef.current;
      setCanScrollLeft(scrollLeft > 6);
      setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 6);
    }
  };

  useEffect(() => {
    checkCategoryScroll();
    const el = categoryScrollRef.current;
    if (!el) return;
    el.addEventListener('scroll', checkCategoryScroll, { passive: true });
    window.addEventListener('resize', checkCategoryScroll);
    return () => {
      el.removeEventListener('scroll', checkCategoryScroll);
      window.removeEventListener('resize', checkCategoryScroll);
    };
  }, [categories]);

  // Auto-scroll active category into view
  useEffect(() => {
    if (categoryScrollRef.current) {
      const activeEl = categoryScrollRef.current.querySelector<HTMLElement>('.admin-category-card.active');
      if (activeEl) {
        activeEl.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
      }
      setTimeout(checkCategoryScroll, 300);
    }
  }, [selectedCategory]);

  const handleCategoryScrollLeft = () => {
    if (categoryScrollRef.current) {
      categoryScrollRef.current.scrollBy({ left: -240, behavior: 'smooth' });
    }
  };

  const handleCategoryScrollRight = () => {
    if (categoryScrollRef.current) {
      categoryScrollRef.current.scrollBy({ left: 240, behavior: 'smooth' });
    }
  };

  // Modals state
  const [isDishModalOpen, setIsDishModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [isSoldOutModalOpen, setIsSoldOutModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isTablesModalOpen, setIsTablesModalOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<MenuItem | null>(null);
  const [categoryToEdit, setCategoryToEdit] = useState<Category | null>(null);
  const [categoryToDelete, setCategoryToDelete] = useState<Category | null>(null);

  // Toast message
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((current) => (current === msg ? null : current));
    }, 2800);
  };

  // Sync loaded menu into local state
  useEffect(() => {
    if (initialMeta) {
      setMeta(initialMeta);
      setCategories(initialCategories);
      setItems(initialItems);
    }
  }, [initialMeta, initialCategories, initialItems]);

  const [adminToken, setAdminToken] = useState<string | null>(getAdminToken());

  // Live WebSocket feed for real-time Kitchen Display System (VIP Plan)
  useKitchenWebSocket({
    token: adminToken,
    onOrderCreated: (orderData: any) => {
      if (!orderData) return;
      const newItems = mapBackendOrderToCartItems(orderData, items);
      setKitchenOrders((prev) => {
        const filtered = prev.filter((o) => o.orderId !== orderData.id);
        const updated = [...newItems, ...filtered];
        saveRestaurantOrders(slug, updated);
        return updated;
      });
      showToast(`🔔 New Order #${orderData.id?.slice(-4)} received (Table ${orderData.table_number || 'Direct'})`);
    },
    onOrderCancelled: (cancelledOrderId: string) => {
      if (!cancelledOrderId) return;
      setKitchenOrders((prev) => {
        const updated = prev.map((o) =>
          o.orderId === cancelledOrderId ? { ...o, status: 'cancelled' as const } : o
        );
        saveRestaurantOrders(slug, updated);
        return updated;
      });
      showToast(`⚠️ Order #${cancelledOrderId.slice(-4)} cancelled`);
    },
    onOrderStatusUpdated: (orderId: string, status: string) => {
      if (!orderId || !status) return;
      const mapped = mapBackendStatusToFrontend(status);
      setKitchenOrders((prev) => {
        const updated = prev.map((o) => (o.orderId === orderId ? { ...o, status: mapped } : o));
        saveRestaurantOrders(slug, updated);
        return updated;
      });
    },
  });

  // Listen for unauthorized 401 events to prompt login
  useEffect(() => {
    const handleUnauthorized = () => {
      setAdminToken(null);
    };
    window.addEventListener('azai:auth:unauthorized', handleUnauthorized);
    return () => window.removeEventListener('azai:auth:unauthorized', handleUnauthorized);
  }, []);

  // The staff token is stored per browser, not per restaurant. Make sure it belongs to the
  // restaurant in the URL; otherwise every edit would be sent on behalf of another tenant.
  const liveTenantSlug = initialMeta?.slug?.toLowerCase();
  const [loginNotice, setLoginNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!adminToken || !liveTenantSlug) return;

    let cancelled = false;
    fetchAdminTenantProfile().then((profile) => {
      if (cancelled) return;
      const profileSlug = profile?.slug?.toLowerCase();
      if (profileSlug && profileSlug !== liveTenantSlug) {
        clearAdminToken();
        setAdminToken(null);
        setLoginNotice(
          `You were signed in to "${profile?.name || profileSlug}". Sign in with a staff account for this restaurant to manage its menu.`
        );
      }
    });
    return () => {
      cancelled = true;
    };
  }, [adminToken, liveTenantSlug]);

  // Authoritatively fetch active kitchen orders from PostgreSQL backend
  useEffect(() => {
    if (!adminToken) {
      return;
    }

    fetchAdminActiveOrders().then((backendOrders) => {
      if (backendOrders && backendOrders.length > 0) {
        const liveItems = backendOrders.flatMap((bo) => mapBackendOrderToCartItems(bo, items));
        setKitchenOrders(liveItems);
        saveRestaurantOrders(slug, liveItems);
      } else {
        setKitchenOrders([]);
        saveRestaurantOrders(slug, []);
      }
    });
  }, [slug, items, adminToken]);

  const handleLogout = () => {
    clearAdminToken();
    setAdminToken(null);
    showToast('Signed out of staff console');
  };

  // ── Optimistic Kitchen Order Handlers (Instant 0ms UI feedback) ───────────
  const handleKitchenOrderStatusChange = (orderId: string, status: OrderStatus) => {
    // 1. Optimistically update local React state immediately (0ms perceived latency)
    setKitchenOrders((prev) => {
      const updated = prev.map((o) =>
        o.orderId === orderId ? { ...o, status, statusUpdatedAt: Date.now() } : o
      );
      saveRestaurantOrders(slug, updated);
      return updated;
    });

    // 2. Persist to server in background with rollback warning
    updateOrderStatus(slug, orderId, status).catch((err) => {
      console.error('Failed to update order status on server:', err);
      showToast('⚠️ Failed to sync status with server');
    });
  };

  const handleKitchenTableStatusChange = (tableNumber: string, status: OrderStatus) => {
    // 1. Optimistically update all orders at this table immediately
    setKitchenOrders((prev) => {
      const updated = prev.map((o) =>
        o.tableNumber === tableNumber && o.status !== 'complete' && o.status !== 'cancelled'
          ? { ...o, status, statusUpdatedAt: Date.now() }
          : o
      );
      saveRestaurantOrders(slug, updated);
      return updated;
    });

    // 2. Persist to server in background
    updateTableOrdersStatus(slug, tableNumber, status).catch((err) => {
      console.error('Failed to update table orders on server:', err);
      showToast('⚠️ Failed to sync table status with server');
    });
  };

  const handleKitchenTableCancel = (tableNumber: string) => {
    // 1. Optimistic instant UI update
    setKitchenOrders((prev) => {
      const updated = prev.map((o) =>
        o.tableNumber === tableNumber && o.status !== 'complete' && o.status !== 'cancelled'
          ? { ...o, status: 'cancelled' as const }
          : o
      );
      saveRestaurantOrders(slug, updated);
      return updated;
    });

    cancelTableOrders(slug, tableNumber).catch((err) => {
      console.error('Failed to cancel table orders on server:', err);
      showToast('⚠️ Failed to cancel table orders on server');
    });
  };

  const handleKitchenClearAllQueue = () => {
    // 1. Optimistic instant UI update
    setKitchenOrders((prev) => {
      const updated = prev.map((o) =>
        o.status !== 'complete' && o.status !== 'cancelled'
          ? { ...o, status: 'cancelled' as const }
          : o
      );
      saveRestaurantOrders(slug, updated);
      return updated;
    });

    cancelAllActiveOrders(slug).catch((err) => {
      console.error('Failed to clear kitchen queue on server:', err);
      showToast('⚠️ Failed to clear queue on server');
    });
  };

  const handleKitchenClearHistory = () => {
    setKitchenOrders((prev) => {
      const updated = prev.filter((o) => o.status !== 'complete' && o.status !== 'cancelled');
      saveRestaurantOrders(slug, updated);
      return updated;
    });
    clearCompletedOrders(slug);
  };

  // Compute dynamic brand theme color for admin dashboard
  const adminThemeStyle = useMemo<CSSProperties>(() => {
    const primary = meta?.colors?.primary || meta?.theme?.primary || '#FF5A36';
    const secondary = meta?.colors?.secondary || meta?.theme?.secondary || primary;

    const cleanHex = primary.replace(/^#/, '').trim();
    let r = 255, g = 90, b = 54;
    if (cleanHex.length === 6) {
      r = parseInt(cleanHex.substring(0, 2), 16) || 255;
      g = parseInt(cleanHex.substring(2, 4), 16) || 90;
      b = parseInt(cleanHex.substring(4, 6), 16) || 54;
    }

    return {
      '--admin-primary': primary,
      '--admin-primary-hover': secondary,
      '--admin-primary-light': `rgba(${r}, ${g}, ${b}, 0.12)`,
      '--admin-primary-rgb': `${r}, ${g}, ${b}`,
    } as CSSProperties;
  }, [meta?.colors, meta?.theme]);

  // Automatic live persistence helper
  const persistChanges = (
    updatedItems: MenuItem[],
    updatedCategories: Category[] = categories,
    updatedMeta: RestaurantMeta = meta!
  ) => {
    if (!updatedMeta) return;
    const currentMenu: RestaurantMenu = {
      meta: updatedMeta,
      categories: updatedCategories,
      items: updatedItems,
    };
    saveRestaurantMenu(slug, currentMenu);
  };

  const handleSaveSettings = async (updatedMeta: RestaurantMeta) => {
    const previousMeta = meta;
    setMeta(updatedMeta);

    if (liveTenantSlug) {
      const themeToSave = {
        ...(updatedMeta.theme || updatedMeta.colors || {}),
        welcomeMessage: updatedMeta.tagline,
        bannerUrl: updatedMeta.heroImageUrl,
      };
      try {
        await updateAdminTenantTheme(themeToSave);
      } catch (err) {
        setMeta(previousMeta);
        showToast(`⚠️ Couldn't save settings: ${(err as Error)?.message || 'the server rejected the change'}`);
        return;
      }
    }

    persistChanges(items, categories, updatedMeta);
    showToast(`✅ Settings saved (Currency: ${updatedMeta.currency || 'ETB'})`);
  };

  const handleResetToDefault = () => {
    resetRestaurantMenu(slug);
    showToast('🔄 Restored menu from original JSON file');
    setTimeout(() => {
      window.location.reload();
    }, 400);
  };

  // Category name map for quick lookup
  const categoryNameMap = useMemo(() => {
    const map = new Map<string, string>();
    categories.forEach((cat) => map.set(cat.id, cat.name));
    return map;
  }, [categories]);

  // Category-scoped items (before applying search or stock filter)
  const categoryScopedItems = useMemo(() => {
    return selectedCategory === 'all'
      ? items
      : items.filter((item) => item.categoryId === selectedCategory);
  }, [items, selectedCategory]);

  const catTotalCount = categoryScopedItems.length;
  const catInStockCount = categoryScopedItems.filter((it) => it.available !== false).length;
  const catSoldOutCount = categoryScopedItems.filter((it) => it.available === false).length;

  // Filtered dishes with intelligent multi-field search and global matching
  const filteredItems = useMemo(() => {
    const isSearching = Boolean(searchQuery.trim());
    return items.filter((item) => {
      const catName = categoryNameMap.get(item.categoryId);
      const matchesSearch = matchesSearchQuery(item, searchQuery, catName);

      // When actively searching, search across all categories so the user finds any dish immediately
      const matchesCat = isSearching
        ? true
        : selectedCategory === 'all' || item.categoryId === selectedCategory;

      const matchesStock =
        stockFilter === 'all' ||
        (stockFilter === 'in-stock' && item.available !== false) ||
        (stockFilter === 'out-of-stock' && item.available === false);

      return matchesSearch && matchesCat && matchesStock;
    });
  }, [items, searchQuery, selectedCategory, stockFilter, categoryNameMap]);

  if (error === 'not-found') {
    return <NotFoundPage />;
  }

  if (loading || !meta) {
    return <SkeletonLoader />;
  }

  const activeCurrency = meta.currency || 'ETB';

  // ── Action Handlers with Automatic Real-Time Persistence ────────────────────

  // Applies a change on screen right away, then confirms it with the backend for live
  // (database) restaurants. Success is only reported once the backend accepts the change;
  // on failure the previous state is restored and the backend's error is shown.
  // Local demo menus (static JSON) have no backend and are persisted to this browser only.
  // A request may resolve with `partialError` when the backend accepted only part of a
  // batch; the confirmed part is kept and the error is shown instead of the success message.
  const commitChange = async (
    next: { items?: MenuItem[]; categories?: Category[] },
    request: () => Promise<{ items?: MenuItem[]; categories?: Category[]; partialError?: string } | void>,
    successMessage: string,
    failureMessage: string
  ): Promise<boolean> => {
    const previousItems = items;
    const previousCategories = categories;
    let finalItems = next.items ?? items;
    let finalCategories = next.categories ?? categories;
    let partialError: string | undefined;
    setItems(finalItems);
    setCategories(finalCategories);

    if (liveTenantSlug) {
      try {
        const confirmed = await request();
        if (confirmed?.items) finalItems = confirmed.items;
        if (confirmed?.categories) finalCategories = confirmed.categories;
        partialError = confirmed?.partialError;
      } catch (err) {
        setItems(previousItems);
        setCategories(previousCategories);
        showToast(`⚠️ ${failureMessage}: ${(err as Error)?.message || 'the server rejected the change'}`);
        return false;
      }
      setItems(finalItems);
      setCategories(finalCategories);
    }

    persistChanges(finalItems, finalCategories);
    if (partialError) {
      showToast(`⚠️ ${failureMessage}: ${partialError}`);
      return false;
    }
    showToast(successMessage);
    return true;
  };

  const toBackendItem = (item: MenuItem) => ({
    categoryId: item.categoryId,
    name: item.name,
    description: item.description,
    price: item.price,
    imageUrl: item.imageUrl,
    tags: item.tags,
    isAvailable: item.available !== false,
  });

  const setSoldOutOnBackend = async (itemId: string, isSoldOut: boolean) => {
    if (!(await toggleAdminItemSoldOut(itemId, isSoldOut))) {
      throw new Error('the server rejected the change');
    }
  };

  const handleUpdatePrice = (itemId: string, newPrice: number) => {
    const updated = items.map((it) => (it.id === itemId ? { ...it, price: newPrice } : it));
    const it = updated.find((x) => x.id === itemId);
    if (!it) return;
    commitChange(
      { items: updated },
      () => updateAdminItem(itemId, toBackendItem(it)).then(() => undefined),
      `Updated price to ${newPrice} ${activeCurrency}`,
      `Couldn't update the price of "${it.name}"`
    );
  };

  const handleToggleStock = (itemId: string) => {
    const updated = items.map((it) =>
      it.id === itemId ? { ...it, available: it.available === false ? true : false } : it
    );
    const toggled = updated.find((it) => it.id === itemId);
    if (!toggled) return;
    commitChange(
      { items: updated },
      () => setSoldOutOnBackend(itemId, !toggled.available),
      toggled.available ? `"${toggled.name}" is now In Stock` : `"${toggled.name}" marked as Sold Out`,
      `Couldn't change stock for "${toggled.name}"`
    );
  };

  const handleDeleteItem = (itemId: string) => {
    const removed = items.find((it) => it.id === itemId);
    commitChange(
      { items: items.filter((it) => it.id !== itemId) },
      () => deleteAdminItem(itemId).then(() => undefined),
      'Dish removed from menu',
      `Couldn't remove "${removed?.name || 'dish'}"`
    );
  };

  const handleSaveItem = (savedItem: MenuItem) => {
    const exists = items.some((it) => it.id === savedItem.id);
    if (exists) {
      commitChange(
        { items: items.map((it) => (it.id === savedItem.id ? savedItem : it)) },
        () => updateAdminItem(savedItem.id, toBackendItem(savedItem)).then(() => undefined),
        `Saved "${savedItem.name}"`,
        `Couldn't save "${savedItem.name}"`
      );
      return;
    }

    const withNewItem = [savedItem, ...items];
    commitChange(
      { items: withNewItem },
      async () => {
        const created = await createAdminItem(toBackendItem(savedItem));
        if (!created?.id) throw new Error('the server did not return the new dish');
        // Swap the temporary client id for the database id so later edits reach the backend
        return { items: withNewItem.map((it) => (it.id === savedItem.id ? { ...it, id: created.id } : it)) };
      },
      `Added "${savedItem.name}"`,
      `Couldn't add "${savedItem.name}"`
    );
  };

  const handleUpdateCategories = (newCategories: Category[]) => {
    const existingCatIds = new Set(categories.map((c) => c.id));
    commitChange(
      { categories: newCategories },
      async () => {
        const confirmed = await Promise.all(
          newCategories.map(async (nc, idx) => {
            if (existingCatIds.has(nc.id)) return nc;
            const created = await createAdminCategory(nc.name, idx);
            if (!created?.id) throw new Error(`the server did not return category "${nc.name}"`);
            return { ...nc, id: created.id };
          })
        );
        return { categories: confirmed };
      },
      'Categories updated',
      "Couldn't update categories"
    );
  };

  const handleRenameCategory = (categoryId: string, newName: string) => {
    const category = categories.find((cat) => cat.id === categoryId);
    commitChange(
      { categories: categories.map((cat) => (cat.id === categoryId ? { ...cat, name: newName } : cat)) },
      () => updateAdminCategory(categoryId, newName, category?.sortOrder ?? 0).then(() => undefined),
      `Renamed category to "${newName}"`,
      `Couldn't rename category "${category?.name || ''}"`
    );
  };

  const confirmDeleteCategory = () => {
    if (!categoryToDelete) return;
    const deleting = categoryToDelete;
    setCategoryToDelete(null);
    commitChange(
      { categories: categories.filter((c) => c.id !== deleting.id) },
      () => deleteAdminCategory(deleting.id).then(() => undefined),
      `Category "${deleting.name}" deleted`,
      `Couldn't delete category "${deleting.name}"`
    ).then((ok) => {
      if (ok && selectedCategory === deleting.id) {
        setSelectedCategory('all');
      }
    });
  };

  const handleSaveSoldOut = (soldOutIds: Set<string>) => {
    const changed = items.filter((it) => (it.available === false) !== soldOutIds.has(it.id));
    commitChange(
      { items: items.map((it) => ({ ...it, available: !soldOutIds.has(it.id) })) },
      async () => {
        const results = await Promise.allSettled(
          changed.map((it) => setSoldOutOnBackend(it.id, soldOutIds.has(it.id)))
        );
        const failed = results.filter((r) => r.status === 'rejected').length;
        if (failed === 0) return;
        if (failed === changed.length) throw new Error('the server rejected the change');
        // Keep the dishes the backend accepted; the rest stay as they were
        const accepted = new Set(changed.filter((_, i) => results[i].status === 'fulfilled').map((it) => it.id));
        return {
          items: items.map((it) => (accepted.has(it.id) ? { ...it, available: !soldOutIds.has(it.id) } : it)),
          partialError: `${failed} of ${changed.length} dishes were not updated`,
        };
      },
      `✅ Updated sold out items (${soldOutIds.size} sold out)`,
      "Couldn't update sold out items"
    );
  };

  const itemsInDeletingCat = categoryToDelete
    ? items.filter((it) => it.categoryId === categoryToDelete.id).length
    : 0;

  const activeOrdersCount = kitchenOrders.filter(
    (o) => o.status !== 'complete' && o.status !== 'cancelled'
  ).length;

  return (
    <PlanProvider plan={planFromBackend}>
    <div className="admin-layout-root" style={adminThemeStyle}>
      <OfflineBanner />
      {/* GoMeal Style Left Navigation Sidebar with Mobile Drawer Support */}
      <AdminSidebar
        meta={meta!}
        slug={slug}
        activeView={activeView}
        onSelectView={(view) => setActiveView(view)}
        activeOrdersCount={activeOrdersCount}
        onOpenTables={() => setIsTablesModalOpen(true)}
        onLogout={handleLogout}
        isMobileOpen={isMobileSidebarOpen}
        onCloseMobile={() => setIsMobileSidebarOpen(false)}
      />

      {/* Mobile Top Header (Visible on screens <= 1024px) */}
      <header className="admin-mobile-header">
        <div className="admin-mobile-header-brand">
          <span className="admin-fancy-staff-title">
            <span className="staff-part">Staff</span>{' '}
            <span className="dashboard-part">Dashboard</span>
          </span>
        </div>

        <div className="admin-mobile-header-actions">
          <button
            type="button"
            className="admin-mobile-header-add-btn"
            onClick={() => {
              setEditingItem(null);
              setIsDishModalOpen(true);
            }}
            aria-label="Add new dish"
          >
            <Plus size={20} strokeWidth={2.5} />
          </button>
        </div>
      </header>

      {/* Main Full-Width Edge-to-Edge Dashboard */}
      <main className="admin-main-viewport">
        {activeView === 'kitchen' ? (
          /* ── Full Dashboard Kitchen Orders View ────────────────────────────── */
          <AdminKitchenView
            slug={slug}
            meta={meta!}
            orders={kitchenOrders}
            items={items}
            onBackToMenu={() => setActiveView('menu')}
            onOrderStatusChange={handleKitchenOrderStatusChange}
            onTableStatusChange={handleKitchenTableStatusChange}
            onTableCancel={handleKitchenTableCancel}
            onClearAllQueue={handleKitchenClearAllQueue}
            onClearHistory={handleKitchenClearHistory}
            onUpgradePlan={() => setActiveView('menu')}
          />
        ) : (
          /* ── Full Dashboard Menu Management View ───────────────────────────── */
          <>
            {/* Top Navigation Bar: Title, and Tools */}
            <div className="admin-top-nav">
              <div className="admin-top-title-wrap" style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                <h1 className="admin-top-title admin-fancy-staff-title">
                  <span className="staff-part">Staff</span>{' '}
                  <span className="dashboard-part">Dashboard</span>
                </h1>

                {/* Plan Tier Badge (read-only — reflects PostgreSQL tenants.plan) */}
                <span
                  title={`Plan tier: ${planFromBackend.toUpperCase()}. Managed via backend.`}
                  style={{
                    border: 'none',
                    borderRadius: '999px',
                    padding: '5px 12px',
                    fontSize: '11px',
                    fontWeight: 800,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '5px',
                    letterSpacing: '0.5px',
                    textTransform: 'uppercase',
                    background:
                      planFromBackend === 'vip'
                        ? 'linear-gradient(135deg, #f59e0b, #ea580c)'
                        : 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
                    color: '#ffffff',
                    boxShadow:
                      planFromBackend === 'vip'
                        ? '0 2px 8px rgba(245, 158, 11, 0.35)'
                        : '0 2px 8px rgba(59, 130, 246, 0.35)',
                  }}
                >
                  <span>{planFromBackend === 'vip' ? '👑 VIP Tier' : '⚡ Standard Tier'}</span>
                </span>
              </div>

              {/* Right Action Tools */}
              <div className="admin-top-tools">
                {/* Live Kitchen Dispatch Trigger Button */}
                <button
                  type="button"
                  className="admin-sec-pill-btn"
                  onClick={() => setActiveView('kitchen')}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '7px',
                    backgroundColor: activeOrdersCount > 0 ? 'var(--admin-primary)' : '#ffffff',
                    color: activeOrdersCount > 0 ? '#ffffff' : 'var(--admin-text-dark)',
                    borderColor: activeOrdersCount > 0 ? 'var(--admin-primary)' : 'var(--admin-border)',
                    fontWeight: 700,
                    fontSize: '13px',
                  }}
                  title="Open Live Kitchen Dispatch"
                >
                  <ChefHat size={16} />
                  <span>Kitchen</span>
                  {activeOrdersCount > 0 && (
                    <span
                      style={{
                        backgroundColor: '#ffffff',
                        color: 'var(--admin-primary)',
                        fontSize: '11px',
                        fontWeight: 800,
                        padding: '1px 6px',
                        borderRadius: '999px',
                      }}
                    >
                      {activeOrdersCount}
                    </span>
                  )}
                </button>

                {/* + Add Dish (GoMeal Style Primary Button) */}
                <button
                  type="button"
                  className="admin-add-menu-btn"
                  onClick={() => {
                    setEditingItem(null);
                    setIsDishModalOpen(true);
                  }}
                >
                  <Plus size={18} />
                  <span>Add Dish</span>
                </button>
              </div>
            </div>

            {/* ── Category Horizontal Strip with Cute Nav Buttons ──────────────── */}
            <div className="admin-category-strip-wrap">
              <div className="admin-section-header">
                <h2 className="admin-section-title">Category</h2>
              </div>

              <div className="admin-category-carousel-wrap">
                {/* Cute Left Nav Arrow Button */}
                <button
                  type="button"
                  className={`admin-category-nav-btn admin-category-nav-left ${!canScrollLeft ? 'is-disabled' : ''}`}
                  onClick={handleCategoryScrollLeft}
                  aria-label="Previous categories"
                  disabled={!canScrollLeft}
                >
                  <ChevronLeft size={16} />
                </button>

                <div
                  ref={categoryScrollRef}
                  className="admin-category-scroll-row hide-scrollbar"
                >
                  {/* All Dishes Category Card */}
                  <AdminCategoryCard
                    category={{ id: 'all', name: 'All Dishes' }}
                    count={items.length}
                    isActive={selectedCategory === 'all'}
                    onClick={() => {
                      setSelectedCategory('all');
                      setStockFilter('all');
                    }}
                  />

                  {/* Dynamic Restaurant Category Cards (filter out any 'all' category to prevent duplicate cards) */}
                  {categories
                    .filter((cat) => cat.id.toLowerCase() !== 'all' && cat.name.toLowerCase() !== 'all' && cat.name.toLowerCase() !== 'all dishes')
                    .map((cat) => {
                      const count = items.filter((it) => it.categoryId === cat.id).length;
                      return (
                        <AdminCategoryCard
                          key={cat.id}
                          category={cat}
                          count={count}
                          isActive={selectedCategory === cat.id}
                          onClick={() => {
                            setSelectedCategory(cat.id);
                            setStockFilter('all');
                          }}
                          onEdit={(category) => setCategoryToEdit(category)}
                          onDelete={(category) => setCategoryToDelete(category)}
                        />
                      );
                    })}

                  {/* Quick + Add Category Card */}
                  <button
                    type="button"
                    className="admin-category-add-card"
                    onClick={() => setIsCategoryModalOpen(true)}
                    title="Add a new category"
                  >
                    <Plus size={24} />
                    <span style={{ fontSize: '12px', fontWeight: 700 }}>Add Category</span>
                  </button>
                </div>

                {/* Cute Right Nav Arrow Button */}
                <button
                  type="button"
                  className={`admin-category-nav-btn admin-category-nav-right ${!canScrollRight ? 'is-disabled' : ''}`}
                  onClick={handleCategoryScrollRight}
                  aria-label="Next categories"
                  disabled={!canScrollRight}
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>

            {/* ── Dishes Cards Grid Section ─────────────────────────────────────── */}
            <div>
              <div className="admin-section-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '14px', marginBottom: '20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
                  <h2 className="admin-section-title" style={{ margin: 0 }}>
                    {selectedCategory === 'all'
                      ? 'All Dishes'
                      : categoryNameMap.get(selectedCategory) || 'Dishes'}{' '}
                    ({stockFilter === 'all' && !searchQuery ? catTotalCount : filteredItems.length})
                  </h2>

                  {/* Unified SearchBar right next to All Dishes */}
                  <SearchBar
                    value={searchQuery}
                    onChange={setSearchQuery}
                    placeholder="Search dishes..."
                    variant="admin"
                    style={{ width: '480px', maxWidth: '100%' }}
                  />
                </div>

                {/* Stock Filter Pills Scoped to the Selected Category */}
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <button
                    type="button"
                    className={`admin-sec-pill-btn ${stockFilter === 'all' ? 'active' : ''}`}
                    style={
                      stockFilter === 'all'
                        ? { borderColor: 'var(--admin-primary)', color: 'var(--admin-primary)' }
                        : undefined
                    }
                    onClick={() => setStockFilter('all')}
                  >
                    All ({catTotalCount})
                  </button>
                  <button
                    type="button"
                    className={`admin-sec-pill-btn ${stockFilter === 'in-stock' ? 'active' : ''}`}
                    style={
                      stockFilter === 'in-stock'
                        ? { borderColor: '#10b981', color: '#10b981' }
                        : undefined
                    }
                    onClick={() => setStockFilter('in-stock')}
                  >
                    In Stock ({catInStockCount})
                  </button>
                  <button
                    type="button"
                    className={`admin-sec-pill-btn ${stockFilter === 'out-of-stock' ? 'active' : ''}`}
                    style={
                      stockFilter === 'out-of-stock'
                        ? { borderColor: '#ef4444', color: '#ef4444' }
                        : undefined
                    }
                    onClick={() => setStockFilter('out-of-stock')}
                  >
                    Sold Out ({catSoldOutCount})
                  </button>
                </div>
              </div>

              {/* Dish Cards Grid */}
              {filteredItems.length === 0 ? (
                <div
                  style={{
                    backgroundColor: '#ffffff',
                    border: '1px dashed var(--admin-border)',
                    borderRadius: 'var(--admin-radius)',
                    padding: '60px 20px',
                    textAlign: 'center',
                  }}
                >
                  <Sparkles size={36} color="var(--admin-text-subtle)" style={{ margin: '0 auto 12px auto' }} />
                  <h3 style={{ fontSize: '18px', fontWeight: 800, margin: '0 0 6px 0' }}>
                    {stockFilter === 'out-of-stock'
                      ? 'No Sold Out Dishes'
                      : stockFilter === 'in-stock'
                      ? 'No In-Stock Dishes'
                      : searchQuery
                      ? 'No dishes found'
                      : 'No dishes in this category'}
                  </h3>
                  <p style={{ color: 'var(--admin-text-muted)', fontSize: '14px', margin: '0 0 20px 0' }}>
                    {stockFilter === 'out-of-stock'
                      ? 'All dishes in this category are currently available and in stock.'
                      : stockFilter === 'in-stock'
                      ? 'There are currently no in-stock dishes in this category.'
                      : searchQuery
                      ? `No dishes match "${searchQuery}". Try a different keyword.`
                      : 'Start by adding your first dish to this category!'}
                  </p>
                  {stockFilter === 'out-of-stock' ? (
                    <button
                      type="button"
                      className="admin-sec-pill-btn"
                      onClick={() => setIsSoldOutModalOpen(true)}
                    >
                      <AlertCircle size={15} />
                      <span>Manage Sold Out Dishes</span>
                    </button>
                  ) : searchQuery ? (
                    <button
                      type="button"
                      className="admin-sec-pill-btn"
                      onClick={() => setSearchQuery('')}
                    >
                      <span>Clear Search</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="admin-add-menu-btn"
                      onClick={() => {
                        setEditingItem(null);
                        setIsDishModalOpen(true);
                      }}
                    >
                      <Plus size={16} />
                      <span>Add Dish</span>
                    </button>
                  )}
                </div>
              ) : (
                <div className="admin-dishes-grid">
                  {filteredItems.map((dish) => (
                    <AdminDishCard
                      key={dish.id}
                      item={dish}
                      categoryName={categoryNameMap.get(dish.categoryId) || 'General'}
                      currency={activeCurrency}
                      onEdit={(it) => {
                        setEditingItem(it);
                        setIsDishModalOpen(true);
                      }}
                      onDelete={() => setItemToDelete(dish)}
                      onUpdatePrice={handleUpdatePrice}
                      onToggleStock={handleToggleStock}
                    />
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </main>

      {/* Dish Add/Edit Modal */}
      <AdminItemModal
        isOpen={isDishModalOpen}
        item={editingItem}
        categories={categories}
        currency={activeCurrency}
        defaultCategoryId={selectedCategory !== 'all' ? selectedCategory : undefined}
        onClose={() => {
          setIsDishModalOpen(false);
          setEditingItem(null);
        }}
        onSave={handleSaveItem}
      />

      {/* Categories Add Modal */}
      <AdminCategoryModal
        isOpen={isCategoryModalOpen}
        categories={categories}
        items={items}
        onClose={() => setIsCategoryModalOpen(false)}
        onUpdateCategories={handleUpdateCategories}
      />

      {/* Rename Category Modal */}
      <AdminEditCategoryModal
        isOpen={Boolean(categoryToEdit)}
        category={categoryToEdit}
        onClose={() => setCategoryToEdit(null)}
        onSave={handleRenameCategory}
      />

      {/* Dedicated Sold Out Selection Modal */}
      <AdminSoldOutModal
        isOpen={isSoldOutModalOpen}
        items={items}
        currency={activeCurrency}
        onClose={() => setIsSoldOutModalOpen(false)}
        onSaveSoldOut={handleSaveSoldOut}
      />

      {/* In-App Confirmation Modal for Deleting Dishes */}
      <AdminConfirmModal
        isOpen={Boolean(itemToDelete)}
        title="Delete Dish"
        message="Are you sure you want to delete this dish from the menu? It will be removed immediately from both the dashboard and customer menu."
        itemName={itemToDelete?.name}
        confirmLabel="Delete Dish"
        onConfirm={() => {
          if (itemToDelete) {
            handleDeleteItem(itemToDelete.id);
            setItemToDelete(null);
          }
        }}
        onClose={() => setItemToDelete(null)}
      />

      {/* In-App Confirmation Modal for Deleting Categories */}
      <AdminConfirmModal
        isOpen={Boolean(categoryToDelete)}
        title="Delete Category"
        message={
          itemsInDeletingCat > 0
            ? `This category contains ${itemsInDeletingCat} dishes. Deleting it will remove the category from your menu. Are you sure?`
            : `Are you sure you want to delete the category "${categoryToDelete?.name}"?`
        }
        itemName={categoryToDelete?.name}
        confirmLabel="Delete Category"
        onConfirm={confirmDeleteCategory}
        onClose={() => setCategoryToDelete(null)}
      />

      {/* Restaurant Meta & Currency Settings Modal */}
      <AdminSettingsModal
        isOpen={isSettingsModalOpen}
        meta={meta}
        onClose={() => setIsSettingsModalOpen(false)}
        onSave={handleSaveSettings}
        onResetToDefault={handleResetToDefault}
      />

      {/* Dining Tables & QR Code Generator Modal */}
      <AdminTablesModal
        isOpen={isTablesModalOpen}
        onClose={() => setIsTablesModalOpen(false)}
        restaurantSlug={slug}
      />

      {/* Floating Toast Notification */}
      {toastMessage && (
        <div className="admin-toast">
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Mobile Bottom Navigation Bar (Visible on screens <= 1024px) */}
      <nav className="admin-mobile-bottom-nav" aria-label="Mobile Navigation">
        <button
          type="button"
          className={`admin-mobile-tab-btn ${activeView === 'menu' ? 'active' : ''}`}
          onClick={() => setActiveView('menu')}
        >
          <UtensilsCrossed size={19} />
          <span>Staff</span>
        </button>

        <button
          type="button"
          className={`admin-mobile-tab-btn ${activeView === 'kitchen' ? 'active' : ''}`}
          onClick={() => setActiveView('kitchen')}
        >
          <div style={{ position: 'relative', display: 'inline-flex' }}>
            <ChefHat size={19} />
            {activeOrdersCount > 0 && (
              <span className="admin-mobile-tab-badge">{activeOrdersCount}</span>
            )}
          </div>
          <span>Kitchen</span>
        </button>

        <a
          href={`/${slug}`}
          target="_blank"
          rel="noreferrer"
          className="admin-mobile-tab-btn"
          aria-label="View live customer menu"
        >
          <ExternalLink size={19} />
          <span>Menu</span>
        </a>
      </nav>

      {/* Staff Production Login Modal */}
      <AdminLoginModal
        isOpen={!adminToken}
        notice={loginNotice}
        onSuccess={(token) => {
          setLoginNotice(null);
          setAdminToken(token);
          showToast('Signed in successfully');
        }}
      />
    </div>
    </PlanProvider>
  );
}
