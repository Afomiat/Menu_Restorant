import { useState, useEffect, useMemo, useRef, type CSSProperties } from 'react';
import { useParams } from 'react-router-dom';
import { Search, Plus, AlertCircle, Sparkles, X, ChefHat, Settings, ExternalLink, UtensilsCrossed, ChevronLeft, ChevronRight } from 'lucide-react';
import useRestaurantMenu from '../hooks/useRestaurantMenu';
import { saveRestaurantMenu, resetRestaurantMenu } from '../services/menuService';
import { getRestaurantOrders, subscribeToOrders } from '../services/orderService';
import type { MenuItem, Category, RestaurantMeta, RestaurantMenu, CartItem } from '../types';
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
import AdminKitchenView from './AdminKitchenView';
import SearchBar from '../components/common/SearchBar';
import './admin.css';

export default function AdminDashboardPage() {
  const { restaurantName } = useParams<{ restaurantName: string }>();
  const slug = restaurantName?.toLowerCase().trim() || 'unknown';

  const { meta: initialMeta, categories: initialCategories, items: initialItems, loading, error } =
    useRestaurantMenu(slug);

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

  // Subscribe to live kitchen orders
  useEffect(() => {
    setKitchenOrders(getRestaurantOrders(slug));
    const unsubscribe = subscribeToOrders(slug, (latest) => {
      setKitchenOrders(latest);
    });
    return () => unsubscribe();
  }, [slug]);

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

  const handleSaveSettings = (updatedMeta: RestaurantMeta) => {
    setMeta(updatedMeta);
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

  const handleUpdatePrice = (itemId: string, newPrice: number) => {
    const updated = items.map((it) => (it.id === itemId ? { ...it, price: newPrice } : it));
    setItems(updated);
    persistChanges(updated);
    showToast(`Updated price to ${newPrice} ${activeCurrency}`);
  };

  const handleToggleStock = (itemId: string) => {
    const updated = items.map((it) =>
      it.id === itemId ? { ...it, available: it.available === false ? true : false } : it
    );
    setItems(updated);
    persistChanges(updated);
    const toggled = updated.find((it) => it.id === itemId);
    showToast(toggled?.available ? `"${toggled.name}" is now In Stock` : `"${toggled?.name}" marked as Sold Out`);
  };

  const handleDeleteItem = (itemId: string) => {
    const updated = items.filter((it) => it.id !== itemId);
    setItems(updated);
    persistChanges(updated);
    showToast('Dish removed from menu');
  };

  const handleSaveItem = (savedItem: MenuItem) => {
    let updated: MenuItem[];
    const exists = items.some((it) => it.id === savedItem.id);
    if (exists) {
      updated = items.map((it) => (it.id === savedItem.id ? savedItem : it));
    } else {
      updated = [savedItem, ...items];
    }
    setItems(updated);
    persistChanges(updated);
    showToast(`Saved "${savedItem.name}"`);
  };

  const handleUpdateCategories = (newCategories: Category[]) => {
    setCategories(newCategories);
    persistChanges(items, newCategories);
    showToast('Categories updated');
  };

  const handleRenameCategory = (categoryId: string, newName: string) => {
    const updated = categories.map((cat) =>
      cat.id === categoryId ? { ...cat, name: newName } : cat
    );
    setCategories(updated);
    persistChanges(items, updated);
    showToast(`Renamed category to "${newName}"`);
  };

  const confirmDeleteCategory = () => {
    if (!categoryToDelete) return;
    const updated = categories.filter((c) => c.id !== categoryToDelete.id);
    setCategories(updated);
    if (selectedCategory === categoryToDelete.id) {
      setSelectedCategory('all');
    }
    persistChanges(items, updated);
    showToast(`Category "${categoryToDelete.name}" deleted`);
    setCategoryToDelete(null);
  };

  const handleSaveSoldOut = (soldOutIds: Set<string>) => {
    const updated = items.map((it) => ({
      ...it,
      available: !soldOutIds.has(it.id),
    }));
    setItems(updated);
    persistChanges(updated);
    showToast(`✅ Updated sold out items (${soldOutIds.size} sold out)`);
  };

  const itemsInDeletingCat = categoryToDelete
    ? items.filter((it) => it.categoryId === categoryToDelete.id).length
    : 0;

  const activeOrdersCount = kitchenOrders.filter(
    (o) => o.status !== 'complete' && o.status !== 'cancelled'
  ).length;

  return (
    <div className="admin-layout-root" style={adminThemeStyle}>
      {/* GoMeal Style Left Navigation Sidebar with Mobile Drawer Support */}
      <AdminSidebar
        meta={meta}
        slug={slug}
        activeView={activeView}
        onSelectView={(view) => setActiveView(view)}
        activeOrdersCount={activeOrdersCount}
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
            meta={meta}
            orders={kitchenOrders}
            items={items}
            onBackToMenu={() => setActiveView('menu')}
          />
        ) : (
          /* ── Full Dashboard Menu Management View ───────────────────────────── */
          <>
            {/* Top Navigation Bar: Title, and Tools */}
            <div className="admin-top-nav">
              <div className="admin-top-title-wrap">
                <h1 className="admin-top-title admin-fancy-staff-title">
                  <span className="staff-part">Staff</span>{' '}
                  <span className="dashboard-part">Dashboard</span>
                </h1>
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
    </div>
  );
}
