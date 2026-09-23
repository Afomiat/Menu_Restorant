import { useState, useMemo, type CSSProperties } from 'react';
import {
  ShoppingBag,
  SlidersHorizontal,
  X,
  Home,
  Info,
  UtensilsCrossed,
  Sparkles,
  Zap,
} from 'lucide-react';
import type { MenuItem, Category, RestaurantMeta, RestaurantTheme } from '../../types';
import { matchesSearchQuery } from '../../utils/search';
import ModernCategoryBar from './ModernCategoryBar';
import ModernFoodGrid from './ModernFoodGrid';
import ModernItemModal from './ModernItemModal';
import ModernCartDrawer from './ModernCartDrawer';
import useMenuCart from '../../hooks/useMenuCart';
import { useFeatureGate } from '../../hooks/useFeatureGate';
import { formatPrice } from '../../utils/currency';
import SearchBar from '../../components/common/SearchBar';
import OfflineBanner from '../../components/common/OfflineBanner';

import './modern.css';

interface ModernMenuPageProps {
  meta: RestaurantMeta;
  categories: Category[];
  items: MenuItem[];
  restaurantSlug: string;
  tableNumber: string | null;
}

/**
 * Computes self-contained CSS variables for the modern template theme.
 */
function getModernThemeStyles(theme?: RestaurantTheme): CSSProperties {
  const primary = theme?.primary || '#FF5A36';
  const cleanHex = primary.replace(/^#/, '').trim();
  let r = 255, g = 90, b = 54;
  if (cleanHex.length === 6) {
    const pr = parseInt(cleanHex.substring(0, 2), 16);
    const pg = parseInt(cleanHex.substring(2, 4), 16);
    const pb = parseInt(cleanHex.substring(4, 6), 16);
    if (!isNaN(pr) && !isNaN(pg) && !isNaN(pb)) {
      r = pr; g = pg; b = pb;
    }
  } else if (cleanHex.length === 3) {
    const pr = parseInt(cleanHex[0] + cleanHex[0], 16);
    const pg = parseInt(cleanHex[1] + cleanHex[1], 16);
    const pb = parseInt(cleanHex[2] + cleanHex[2], 16);
    if (!isNaN(pr) && !isNaN(pg) && !isNaN(pb)) {
      r = pr; g = pg; b = pb;
    }
  }
  const adjust = (val: number, percent: number) => Math.min(255, Math.max(0, Math.round(val + (val * percent) / 100)));
  const secR = adjust(r, -12).toString(16).padStart(2, '0');
  const secG = adjust(g, -12).toString(16).padStart(2, '0');
  const secB = adjust(b, -12).toString(16).padStart(2, '0');
  const secondary = theme?.secondary || `#${secR}${secG}${secB}`;
  const primaryLight = theme?.primaryLight || `rgba(${r}, ${g}, ${b}, 0.08)`;
  const primaryRgb = `${r}, ${g}, ${b}`;
  const background = theme?.background || '#F8F9FB';
  const surface = theme?.surface || '#FFFFFF';
  const textDark = theme?.text || '#121417';
  const textMuted = theme?.textMuted || '#7B828D';
  const darkBar = theme?.darkBar || '#16181D';

  return {
    '--modern-primary': primary,
    '--modern-primary-hover': secondary,
    '--modern-primary-light': primaryLight,
    '--modern-primary-rgb': primaryRgb,
    '--modern-bg': background,
    '--modern-surface': surface,
    '--modern-card-bg': surface,
    '--modern-text-dark': textDark,
    '--modern-text-muted': textMuted,
    '--modern-dark-bar': darkBar,
    '--modern-badge-bg': darkBar,
    '--modern-badge-text': '#FFFFFF',
  } as CSSProperties;
}

export default function ModernMenuPage({
  meta,
  categories,
  items,
  restaurantSlug,
  tableNumber,
}: ModernMenuPageProps) {
  const { can } = useFeatureGate();
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null);
  const [showFilters, setShowFilters] = useState<boolean>(false);
  const [activeTagFilter, setActiveTagFilter] = useState<string | null>(null);
  const [activeNavTab, setActiveNavTab] = useState<'home' | 'cart' | 'info'>('home');
  const [showInfoModal, setShowInfoModal] = useState<boolean>(false);


  // Shared Cart hook
  const {
    cart,
    placedOrders,
    isCartOpen,
    setIsCartOpen,
    handleAddToOrder,
    handleQuickAdd,
    handleQuickSubtract,
    handleUpdateQuantity,
    handleRemoveItem,
    handlePlaceOrder,
    handleUndoOrder,
    orderError,
    totalCartItems,
    totalPlacedItems,
    totalPrice,
    getItemCartQuantity,
    resolvedTable,
    isTableVerified,
  } = useMenuCart({
    restaurantSlug,
    items,
    loading: false,
    tableNumber,
  });

  const [cartDrawerTab, setCartDrawerTab] = useState<'tray' | 'orders'>('tray');

  // Category name map for quick lookup
  const categoryNameMap = useMemo(() => {
    const map = new Map<string, string>();
    categories.forEach((c) => map.set(c.id, c.name));
    return map;
  }, [categories]);

  // Filter items based on activeCategory, search, and activeTagFilter
  const filteredItems = useMemo(() => {
    const isSearching = Boolean(searchQuery.trim());
    return items.filter((item) => {
      // When user is actively searching, search across the entire menu!
      if (!isSearching && activeCategory !== 'all' && item.categoryId !== activeCategory) {
        return false;
      }

      // Search query
      if (isSearching) {
        const catName = categoryNameMap.get(item.categoryId);
        if (!matchesSearchQuery(item, searchQuery, catName)) {
          return false;
        }
      }

      // Tag filter
      if (activeTagFilter) {
        if (!item.tags.includes(activeTagFilter as any)) {
          return false;
        }
      }

      // Keep sold-out dishes visible so they can display a Sold Out status
      return true;
    });
  }, [items, activeCategory, searchQuery, activeTagFilter, categoryNameMap]);

  // Handle navigation clicks (mobile bottom nav or desktop header nav)
  const handleNavClick = (tab: 'home' | 'cart' | 'info') => {
    setActiveNavTab(tab);
    if (tab === 'home') {
      setActiveCategory('all');
      setActiveTagFilter(null);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else if (tab === 'cart') {
      // If tray is empty and dishes are cooking, direct to kitchen status; otherwise show order tray
      if (totalCartItems === 0 && totalPlacedItems > 0) {
        setCartDrawerTab('orders');
      } else {
        setCartDrawerTab('tray');
      }
      setIsCartOpen(true);
    } else if (tab === 'info') {
      setShowInfoModal(true);
    }
  };

  const deliveryOrTableLabel = meta.deliveryAddress || `${meta.name}, Main Dining Room`;
  const activeCurrency = meta.currency || 'ETB';

  // Dynamic Hero Banner variables for each restaurant
  const heroImageSrc =
    meta.heroImageUrl ||
    items.find((it) => it.imageUrl)?.imageUrl ||
    '/images/burger_classic.jpg';

  const heroMainTitle = meta.heroTitle?.split('&')[0]?.trim() || 'Hungry?';
  const heroSubtitleText = meta.heroTitle?.includes('&')
    ? meta.heroTitle.substring(meta.heroTitle.indexOf('&')).trim()
    : (meta.heroSubtitle || 'Order & Eat.');

  const heroDescription =
    meta.tagline
      ? `${meta.tagline}. Select your favorite dishes and order directly to your table.`
      : 'Browse our curated menu, customize your order, and send dishes directly to the kitchen.';

  // Compute theme CSS variables passed from this restaurant's meta
  const themeStyles = useMemo(
    () => getModernThemeStyles(meta.colors || meta.theme),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [meta.colors?.primary, meta.theme?.primary, meta.colors?.background, meta.theme?.background]
  );

  return (
    <div className="modern-template-wrapper" style={themeStyles}>
      <OfflineBanner />
      {/* 1. Full-Width Sticky Header Bar */}
      <header className="modern-header-outer">
        <div className="modern-container">
          <div className="modern-header-inner">
            {/* Restaurant Branding & Table Indicator */}
            <div className="modern-brand-group">
              <div className="modern-brand-logo" aria-hidden="true">
                <UtensilsCrossed size={20} />
              </div>
              <div className="modern-brand-text">
                <span className="modern-brand-name">{meta.name}</span>
                <span className="modern-brand-tagline">
                  {meta.tagline || 'Digital Restaurant Menu'}
                </span>
              </div>
            </div>

            {/* Desktop Navigation Links */}
            <nav className="modern-desktop-nav" aria-label="Desktop Navigation">
              <button
                type="button"
                className={`modern-desktop-nav-link ${activeCategory === 'all' && !activeTagFilter ? 'active' : ''}`}
                onClick={() => handleNavClick('home')}
              >
                All Menu
              </button>
              <button
                type="button"
                className={`modern-desktop-nav-link ${activeTagFilter === 'chef-pick' ? 'active' : ''}`}
                onClick={() => {
                  setActiveTagFilter(activeTagFilter === 'chef-pick' ? null : 'chef-pick');
                }}
              >
                Chef's Specials
              </button>
              <button
                type="button"
                className="modern-desktop-nav-link"
                onClick={() => setShowInfoModal(true)}
              >
                Restaurant Info
              </button>
            </nav>

            {/* Header Right Actions (Desktop Only) */}
            <div className="modern-header-actions">
              {can('ordering') ? (
                /* Desktop View: Full Cart Trigger with subtotal */
                <button
                  type="button"
                  className="modern-desktop-cart-btn"
                  onClick={() => {
                    setCartDrawerTab('tray');
                    setIsCartOpen(true);
                  }}
                  aria-label="View current cart"
                >
                  <ShoppingBag size={18} />
                  <span>Tray</span>
                  {totalCartItems > 0 && (
                    <>
                      <span className="modern-desktop-cart-count">{totalCartItems}</span>
                      <span>{formatPrice(totalPrice, activeCurrency)}</span>
                    </>
                  )}
                </button>
              ) : (
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontSize: '12px',
                    fontWeight: 700,
                    padding: '8px 16px',
                    borderRadius: '999px',
                    backgroundColor: 'var(--modern-primary-light, rgba(255, 90, 54, 0.08))',
                    color: 'var(--modern-primary, #ff5a36)',
                    letterSpacing: '0.3px',
                  }}
                >
                  📖 Digital QR Menu
                </span>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Website Body Container */}
      <main className="modern-container" style={{ flex: '1 0 auto' }}>
        {/* 2. Hero Showcase Banner with Diagonal Half-Right Blurred Food Image */}
        <section className="modern-hero-banner" aria-label="Restaurant Highlight">
          {/* Diagonal Half-Right Food Image Showcase */}
          <div className="modern-hero-diagonal-bg" aria-hidden="true">
            <div
              className="modern-hero-image-blur-layer"
              style={{ backgroundImage: `url(${heroImageSrc})` }}
            />
            <img
              src={heroImageSrc}
              alt={meta.name || 'Hero showcase'}
              className="modern-hero-cut-image"
              loading="lazy"
              onError={(e) => {
                (e.target as HTMLImageElement).src = '/images/burger_classic.jpg';
              }}
            />
            <div className="modern-hero-diagonal-overlay" />
          </div>

          <div className="modern-hero-content">
            <h1 className="modern-hero-title">
              <span className="modern-hero-hungry">{heroMainTitle}</span>
              <span className="modern-hero-order">{heroSubtitleText}</span>
            </h1>
            <p className="modern-hero-desc">
              {meta.tagline ? (
                <>
                  <span className="modern-hero-tagline">{meta.tagline}.</span>{' '}
                  <span className="modern-hero-order-span">
                    Select your favorite dishes and order directly to your table.
                  </span>
                </>
              ) : (
                <span className="modern-hero-order-span">{heroDescription}</span>
              )}
            </p>
            <div className="modern-hero-badges">
              <span className="modern-hero-badge-pill">
                <Zap size={13} color="var(--modern-primary)" /> Direct Kitchen Dispatch
              </span>
              <span className="modern-hero-badge-pill">
                <Sparkles size={13} color="var(--modern-primary)" /> Fresh Ingredients
              </span>
              <span className="modern-hero-badge-pill">
                📍 {deliveryOrTableLabel}
              </span>
            </div>
          </div>
        </section>

        {/* 3. Search & Filter Bar */}
        <div className="modern-search-wrapper">
          <SearchBar
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Search dishes, drinks, ingredients..."
            variant="modern"
          />

          <button
            type="button"
            className={`modern-filter-btn ${showFilters || activeTagFilter ? 'active' : ''}`}
            onClick={() => setShowFilters(!showFilters)}
            aria-label="Toggle dietary filters"
          >
            <SlidersHorizontal size={18} />
          </button>
        </div>

        {/* Dietary Filter Tag Pills */}
        {showFilters && (
          <div className="modern-dietary-pills" role="region" aria-label="Dietary filters">
            <button
              type="button"
              className={`modern-dietary-pill ${activeTagFilter === null ? 'active' : ''}`}
              onClick={() => setActiveTagFilter(null)}
            >
              All Types
            </button>
            <button
              type="button"
              className={`modern-dietary-pill ${activeTagFilter === 'chef-pick' ? 'active' : ''}`}
              onClick={() =>
                setActiveTagFilter(activeTagFilter === 'chef-pick' ? null : 'chef-pick')
              }
            >
              ⭐ Chef's Pick
            </button>
            <button
              type="button"
              className={`modern-dietary-pill ${activeTagFilter === 'vegetarian' ? 'active' : ''}`}
              onClick={() =>
                setActiveTagFilter(activeTagFilter === 'vegetarian' ? null : 'vegetarian')
              }
            >
              🥗 Vegetarian
            </button>
            <button
              type="button"
              className={`modern-dietary-pill ${activeTagFilter === 'spicy' ? 'active' : ''}`}
              onClick={() =>
                setActiveTagFilter(activeTagFilter === 'spicy' ? null : 'spicy')
              }
            >
              🌶️ Spicy
            </button>
            <button
              type="button"
              className={`modern-dietary-pill ${activeTagFilter === 'gluten-free' ? 'active' : ''}`}
              onClick={() =>
                setActiveTagFilter(activeTagFilter === 'gluten-free' ? null : 'gluten-free')
              }
            >
              🌾 Gluten-Free
            </button>
          </div>
        )}

        {/* 4. Circular Category Bar (Orbix Studio Style) */}
        <ModernCategoryBar
          categories={categories}
          activeCategory={activeCategory}
          onSelectCategory={(id) => {
            setActiveCategory(id);
            setActiveTagFilter(null);
          }}
          items={items}
        />

        {/* 5. Food Grid directly below curved arc */}
        <ModernFoodGrid
          items={filteredItems}
          currency={activeCurrency}
          onSelectItem={setSelectedItem}
          onQuickAdd={handleQuickAdd}
          onQuickSubtract={handleQuickSubtract}
          getItemQuantity={getItemCartQuantity}
        />
      </main>

      {/* 6. Full-Width Modern Website Footer */}
      <footer className="modern-website-footer">
        <div className="modern-container">
          <div className="modern-footer-inner">
            <div>
              <div className="modern-footer-brand-title">{meta.name}</div>
              <div className="modern-footer-brand-tag">
                {meta.tagline || (can('ordering') ? 'Contactless Dining & Kitchen Ordering' : 'Digital QR Menu')}
              </div>
            </div>

            <div className="modern-footer-details">
              <span>📍 {deliveryOrTableLabel}</span>
              <span>🕒 Open 11:30 AM — 11:00 PM</span>
              <span>⚡ Powered by Azai QR Menu</span>
            </div>
          </div>
        </div>
      </footer>

      {/* 7. Floating Pill Bottom Navigation (Visible on Mobile) */}
      <nav className="modern-floating-nav" aria-label="Mobile Navigation">
        <button
          type="button"
          className={`modern-nav-tab ${activeNavTab === 'home' ? 'active' : ''}`}
          onClick={() => handleNavClick('home')}
          aria-label="Home menu"
        >
          <div className="modern-nav-tab-inner">
            <Home size={20} strokeWidth={2.4} />
            <span className="modern-nav-label">Menu</span>
          </div>
        </button>

        {can('ordering') && (
          <button
            type="button"
            className={`modern-nav-tab ${activeNavTab === 'cart' ? 'active' : ''}`}
            onClick={() => handleNavClick('cart')}
            aria-label="Order tray and kitchen status"
          >
            <div className="modern-nav-tab-inner">
              <div className="modern-nav-icon-wrap">
                <ShoppingBag size={20} strokeWidth={2.4} />
                {activeNavTab !== 'cart' && (totalCartItems > 0 || totalPlacedItems > 0) && (
                  <span className="modern-nav-badge">
                    {totalCartItems > 0 ? totalCartItems : totalPlacedItems}
                  </span>
                )}
              </div>
              <span className="modern-nav-label">
                Tray
                {(totalCartItems > 0 || totalPlacedItems > 0) && (
                  <span className="modern-nav-pill-count">
                    {totalCartItems > 0 ? totalCartItems : totalPlacedItems}
                  </span>
                )}
              </span>
            </div>
          </button>
        )}

        <button
          type="button"
          className={`modern-nav-tab ${activeNavTab === 'info' ? 'active' : ''}`}
          onClick={() => handleNavClick('info')}
          aria-label="Restaurant information"
        >
          <div className="modern-nav-tab-inner">
            <Info size={20} strokeWidth={2.4} />
            <span className="modern-nav-label">Info</span>
          </div>
        </button>
      </nav>

      {/* Item Detail Modal */}
      <ModernItemModal
        item={selectedItem}
        currency={activeCurrency}
        onClose={() => setSelectedItem(null)}
        onAddToCart={handleAddToOrder}
      />

      {/* Cart Drawer */}
      <ModernCartDrawer
        cart={cart}
        placedOrders={placedOrders}
        currency={activeCurrency}
        isOpen={isCartOpen}
        onClose={() => {
          setIsCartOpen(false);
          setActiveNavTab('home');
        }}
        onUpdateQuantity={handleUpdateQuantity}
        onRemoveItem={handleRemoveItem}
        onPlaceOrder={handlePlaceOrder}
        onUndoOrder={handleUndoOrder}
        orderError={orderError}
        initialTab={cartDrawerTab}
        tableNumber={resolvedTable || tableNumber}
        isTableVerified={isTableVerified}
      />

      {/* Restaurant Information Modal */}
      {showInfoModal && (
        <div
          className="modern-modal-overlay"
          onClick={() => {
            setShowInfoModal(false);
            setActiveNavTab('home');
          }}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="modern-modal-sheet"
            onClick={(e) => e.stopPropagation()}
            style={{ padding: '24px' }}
          >
            <div className="modern-modal-drag-handle" />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px' }}>
              <h2 style={{ fontSize: '20px', fontWeight: 800, margin: 0 }}>
                {meta.name}
              </h2>
              <button
                type="button"
                className="modern-modal-close-btn"
                onClick={() => {
                  setShowInfoModal(false);
                  setActiveNavTab('home');
                }}
                style={{ position: 'static' }}
              >
                <X size={16} />
              </button>
            </div>
            <p style={{ color: 'var(--modern-text-muted)', fontSize: '13px', marginTop: '4px' }}>
              {meta.tagline}
            </p>

            <div style={{ marginTop: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ padding: '14px', backgroundColor: '#f8f9fb', borderRadius: '16px' }}>
                <div style={{ fontSize: '11px', color: '#8c919a', textTransform: 'uppercase', fontWeight: 700 }}>
                  Location & Seating
                </div>
                <div style={{ fontSize: '14px', fontWeight: 700, marginTop: '2px' }}>
                  {deliveryOrTableLabel}
                </div>
              </div>

              <div style={{ padding: '14px', backgroundColor: '#f8f9fb', borderRadius: '16px' }}>
                <div style={{ fontSize: '11px', color: '#8c919a', textTransform: 'uppercase', fontWeight: 700 }}>
                  Kitchen & Service Hours
                </div>
                <div style={{ fontSize: '14px', fontWeight: 700, marginTop: '2px' }}>
                  Open Daily: 11:30 AM — 11:00 PM
                </div>
              </div>

              <div style={{ padding: '14px', backgroundColor: 'var(--modern-primary-light)', borderRadius: '16px', color: 'var(--modern-primary)' }}>
                <div style={{ fontSize: '12px', fontWeight: 700 }}>
                  📱 Contactless Digital Dining Active
                </div>
                <div style={{ fontSize: '11px', marginTop: '2px', opacity: 0.9 }}>
                  Scan the table QR code anytime to browse or add more dishes directly to your order.
                </div>
              </div>
            </div>

            <button
              type="button"
              className="modern-modal-cta-btn"
              style={{ marginTop: '20px' }}
              onClick={() => {
                setShowInfoModal(false);
                setActiveNavTab('home');
              }}
            >
              Back to Menu
            </button>

            <div style={{ marginTop: '16px', textAlign: 'center' }}>
              <a
                href={`/${restaurantSlug}/admin`}
                style={{
                  fontSize: '12px',
                  color: 'var(--modern-text-muted)',
                  textDecoration: 'none',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '7px 16px',
                  borderRadius: '999px',
                  backgroundColor: '#f1f3f6',
                  fontWeight: 600,
                  transition: 'opacity 0.2s ease',
                }}
              >
                ⚙️ Restaurant Admin Dashboard
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
