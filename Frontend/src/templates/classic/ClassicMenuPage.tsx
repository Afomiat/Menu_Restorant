import { useState, useEffect, useMemo, type CSSProperties } from 'react';
import ClassicHeader from './ClassicHeader';
import ClassicTimeline from './ClassicTimeline';
import ClassicItemModal from './ClassicItemModal';
import ClassicCartDrawer from './ClassicCartDrawer';
import OfflineBanner from '../../components/common/OfflineBanner';
import useMenuCart from '../../hooks/useMenuCart';
import { useFeatureGate } from '../../hooks/useFeatureGate';
import type { MenuItem, Category, RestaurantMeta, RestaurantTheme } from '../../types';
import { matchesSearchQuery } from '../../utils/search';

interface ClassicMenuPageProps {
  meta: RestaurantMeta;
  categories: Category[];
  items: MenuItem[];
  restaurantSlug: string;
  tableNumber: string | null;
}

function getClassicThemeStyles(theme?: RestaurantTheme): CSSProperties {
  const primary = theme?.primary || '#C9A876';
  const cleanHex = primary.replace(/^#/, '').trim();
  let r = 201, g = 168, b = 118;
  if (cleanHex.length === 6) {
    const pr = parseInt(cleanHex.substring(0, 2), 16);
    const pg = parseInt(cleanHex.substring(2, 4), 16);
    const pb = parseInt(cleanHex.substring(4, 6), 16);
    if (!isNaN(pr) && !isNaN(pg) && !isNaN(pb)) {
      r = pr; g = pg; b = pb;
    }
  }
  const secondary = theme?.secondary || '#DEC093';
  const background = theme?.background || '#15161C';
  const surface = theme?.surface || '#1B1D26';
  const primaryRgb = `${r}, ${g}, ${b}`;

  return {
    '--accent-gold': primary,
    '--accent-gold-hover': secondary,
    '--accent-gold-rgb': primaryRgb,
    '--bg-dark': background,
    '--bg-card': surface,
    '--border-card': 'rgba(255, 255, 255, 0.07)',
    '--text-primary': '#FFFFFF',
    '--text-muted': '#A0A3AB',
  } as CSSProperties;
}

export default function ClassicMenuPage({
  meta,
  categories,
  items,
  restaurantSlug,
  tableNumber,
}: ClassicMenuPageProps) {
  const { can } = useFeatureGate();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('');
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null);

  const {
    cart,
    placedOrders,
    isCartOpen,
    setIsCartOpen,
    handleAddToOrder,
    handleUpdateQuantity,
    handleRemoveItem,
    handlePlaceOrder,
    handleUndoOrder,
    orderError,
    totalCartItems,
    resolvedTable,
    isTableVerified,
  } = useMenuCart({
    restaurantSlug,
    items,
    loading: false,
    tableNumber,
  });

  // Set initial active category once data loads
  useEffect(() => {
    if (categories.length > 0 && !activeCategory) {
      setActiveCategory(categories[0].id);
    }
  }, [categories, activeCategory]);

  // Scroll Spy Observer
  useEffect(() => {
    if (categories.length === 0) return;

    const sections = categories.map((cat) => document.getElementById(cat.id));
    const observerOptions = {
      root: null,
      rootMargin: '-160px 0px -50% 0px',
      threshold: 0,
    };

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          setActiveCategory(entry.target.id);
        }
      });
    }, observerOptions);

    sections.forEach((section) => {
      if (section) observer.observe(section);
    });

    return () => {
      sections.forEach((section) => {
        if (section) observer.unobserve(section);
      });
    };
  }, [categories]);

  // Category selection click navigation
  const handleCategorySelect = (id: string) => {
    setActiveCategory(id);
    const element = document.getElementById(id);
    if (element) {
      const headerOffset = 180;
      const elementPosition = element.getBoundingClientRect().top;
      const offsetPosition = elementPosition + window.pageYOffset - headerOffset;

      window.scrollTo({
        top: offsetPosition,
        behavior: 'smooth',
      });
    }
  };

  // Category name map for quick lookup
  const categoryNameMap = useMemo(() => {
    const map = new Map<string, string>();
    categories.forEach((c) => map.set(c.id, c.name));
    return map;
  }, [categories]);

  // Filter Items with multi-field search matcher
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const catName = categoryNameMap.get(item.categoryId);
      return matchesSearchQuery(item, searchQuery, catName);
    });
  }, [items, searchQuery, categoryNameMap]);

  // Helper: check if a category has any items after filters
  const getCategoryItems = (categoryId: string) => {
    return filteredItems.filter((item) => item.categoryId === categoryId);
  };

  const visibleCategories = useMemo(() => {
    if (!searchQuery.trim()) return categories;
    return categories.filter((cat) => getCategoryItems(cat.id).length > 0);
  }, [categories, filteredItems, searchQuery]);

  const themeStyles = useMemo(
    () => getClassicThemeStyles(meta.colors || meta.theme),
    [meta.colors, meta.theme]
  );

  return (
    <div className="app-container" style={themeStyles}>
      {/* Offline Banner */}
      <OfflineBanner />

      {/* Header Sticky — uses restaurant meta for branding */}
      <ClassicHeader
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        categories={visibleCategories}
        activeCategory={activeCategory}
        onCategorySelect={handleCategorySelect}
        totalCartItems={totalCartItems}
        onCartClick={() => setIsCartOpen(true)}
        restaurantName={meta?.name}
        restaurantTagline={meta?.tagline}
      />

      {/* Main Content Area */}
      <div style={{ flexGrow: 1 }}>
        {filteredItems.length === 0 && searchQuery && (
          <div style={{ padding: '80px 20px', textAlign: 'center', color: 'var(--text-secondary)' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px', opacity: 0.5 }}>🍽️</div>
            <h2
              style={{
                fontFamily: 'var(--font-serif)',
                fontSize: '24px',
                color: 'var(--text-primary)',
                marginBottom: '8px',
              }}
            >
              No items found
            </h2>
            <p style={{ fontSize: '14px', lineHeight: 1.5 }}>
              We couldn't find anything matching "{searchQuery}".
              <br />
              Try searching for something else.
            </p>
          </div>
        )}

        {categories.map((category) => {
          const categoryItems = getCategoryItems(category.id);

          return (
            <section
              key={category.id}
              id={category.id}
              className="category-section fade-in"
              style={{
                paddingTop: '24px',
                borderBottom: '1px solid rgba(255, 255, 255, 0.02)',
              }}
            >
              {/* Section Eyebrow Header */}
              <div
                style={{
                  padding: '0 20px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                <h2
                  style={{
                    fontFamily: 'var(--font-serif)',
                    fontSize: '38px',
                    fontWeight: 400,
                    fontStyle: 'italic',
                    color: 'var(--accent-gold)',
                    textAlign: 'center',
                    letterSpacing: '1px',
                  }}
                >
                  {category.name}
                </h2>
              </div>

              {/* Timeline rendering for this category */}
              {categoryItems.length === 0 ? (
                <div
                  style={{
                    padding: '24px 20px 40px 20px',
                    textAlign: 'center',
                    color: 'var(--text-secondary)',
                    fontSize: '13.5px',
                    fontStyle: 'italic',
                    opacity: 0.7,
                  }}
                >
                  No dishes in this category yet.
                </div>
              ) : (
                <ClassicTimeline
                  items={categoryItems}
                  currency={meta.currency || 'ETB'}
                  onItemSelect={setSelectedItem}
                />
              )}
            </section>
          );
        })}
      </div>

      {/* Item Detail Slide-Up Modal */}
      <ClassicItemModal
        item={selectedItem}
        currency={meta.currency || 'ETB'}
        onClose={() => setSelectedItem(null)}
        onAddToOrder={(item, qty, variant) => {
          handleAddToOrder(item, qty, variant);
          setIsCartOpen(true);
        }}
      />

      {/* Bottom Cart Drawer (VIP Only) */}
      {can('ordering') && (
        <ClassicCartDrawer
          cart={cart}
          tableNumber={resolvedTable || tableNumber}
          isTableVerified={isTableVerified}
          currency={meta.currency || 'ETB'}
          isOpen={isCartOpen}
          setIsOpen={setIsCartOpen}
          onUpdateQuantity={handleUpdateQuantity}
          onRemoveItem={handleRemoveItem}
          onPlaceOrder={handlePlaceOrder}
          placedOrders={placedOrders}
          onUndoOrder={handleUndoOrder}
          orderError={orderError}
        />
      )}

      {/* Footer Branding — uses restaurant meta */}
      <footer
        style={{
          padding: '40px 24px 100px 24px',
          textAlign: 'center',
          borderTop: '1px solid rgba(255,255,255,0.02)',
          backgroundColor: 'var(--bg-dark)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '8px',
        }}
      >
        <span
          style={{
            fontFamily: 'var(--font-serif)',
            fontSize: '18px',
            letterSpacing: '1px',
            color: 'var(--text-primary)',
            opacity: 0.8,
          }}
        >
          {meta?.name ?? 'AURA'}
        </span>
        <span
          style={{
            fontFamily: 'var(--font-sans)',
            fontSize: '10px',
            color: 'var(--text-secondary)',
            letterSpacing: '2px',
            textTransform: 'uppercase',
            opacity: 0.6,
          }}
        >
          {meta?.tagline ?? 'An Elegant Dining Experience'}
        </span>

        <div style={{ marginTop: '14px' }}>
          <a
            href={`/${restaurantSlug}/admin`}
            style={{
              fontSize: '11px',
              color: 'var(--text-muted, #8a8d9b)',
              textDecoration: 'none',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '5px 14px',
              borderRadius: '999px',
              backgroundColor: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              fontWeight: 500,
              letterSpacing: '0.5px',
            }}
          >
            ⚙️ Admin Portal
          </a>
        </div>
      </footer>
    </div>
  );
}
