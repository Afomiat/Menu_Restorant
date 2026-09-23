import { ShoppingBag } from 'lucide-react';
import ClassicCategoryNav from './ClassicCategoryNav';
import type { Category } from '../../types';
import SearchBar from '../../components/common/SearchBar';
import { useFeatureGate } from '../../hooks/useFeatureGate';

interface ClassicHeaderProps {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  categories: Category[];
  activeCategory: string;
  onCategorySelect: (id: string) => void;
  totalCartItems: number;
  onCartClick: () => void;
  restaurantName?: string;
  restaurantTagline?: string;
}

export default function ClassicHeader({
  searchQuery,
  setSearchQuery,
  categories,
  activeCategory,
  onCategorySelect,
  totalCartItems,
  onCartClick,
  restaurantName,
  restaurantTagline,
}: ClassicHeaderProps) {
  const { can } = useFeatureGate();
  return (
    <header
      style={{
        padding: 'clamp(10px, 3vw, 16px) clamp(12px, 4vw, 20px) 6px',
        backgroundColor: 'rgba(21, 22, 28, 0.85)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        position: 'sticky',
        top: 0,
        zIndex: 40,
        width: '100%',
        paddingTop: 'max(clamp(10px, 3vw, 16px), env(safe-area-inset-top, 0px))',
      }}
    >
      {/* Top Bar: Logo + Right Controls */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          width: '100%',
          gap: '4px',
          minWidth: 0,
        }}
      >
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
          <img
            src="/images/aura_logo.svg"
            alt="Aura Logo"
            style={{ width: 'clamp(36px, 10vw, 48px)', height: 'clamp(36px, 10vw, 48px)', objectFit: 'contain' }}
          />
          <div style={{ display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
            <h1
              style={{
                fontFamily: 'var(--font-serif)',
                fontSize: 'clamp(20px, 5vw, 28px)',
                fontWeight: 500,
                letterSpacing: '1px',
                color: 'var(--text-primary)',
                lineHeight: 1.1,
              }}
            >
              {restaurantName ?? 'AURA'}
            </h1>
            <span
              style={{
                fontFamily: 'var(--font-sans)',
                fontSize: '8px',
                textTransform: 'uppercase',
                letterSpacing: '3px',
                color: 'var(--accent-gold)',
                marginTop: '1px',
              }}
            >
              {restaurantTagline ?? 'ristorante'}
            </span>
          </div>
        </div>

        {/* Right side controls: Search + Cart */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, flexShrink: 1 }}>
          {/* Pill Search */}
          <SearchBar
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Search…"
            variant="classic"
          />

          {/* Shopping Bag Icon with Count Badge (VIP Only) */}
          {can('ordering') ? (
            <button
              onClick={onCartClick}
              aria-label="View Order Tray"
              style={{
                background: 'none',
                cursor: 'pointer',
                color: 'var(--text-primary)',
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'var(--transition-smooth)',
                borderRadius: '50%',
                backgroundColor: totalCartItems > 0 ? 'rgba(201, 168, 118, 0.1)' : 'rgba(255, 255, 255, 0.03)',
                border: totalCartItems > 0 ? '1px solid rgba(201, 168, 118, 0.3)' : '1px solid rgba(255, 255, 255, 0.06)',
                width: '34px',
                height: '34px',
                flexShrink: 0,
                padding: 0,
              }}
            >
              <ShoppingBag size={15} style={{ color: totalCartItems > 0 ? 'var(--accent-gold)' : 'var(--text-secondary)', transition: 'color 0.3s ease' }} />
              {totalCartItems > 0 && (
                <span
                  style={{
                    position: 'absolute',
                    top: '-4px',
                    right: '-4px',
                    backgroundColor: 'var(--accent-gold)',
                    color: 'var(--bg-dark)',
                    fontSize: '9px',
                    fontWeight: 700,
                    width: '15px',
                    height: '15px',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 0 6px var(--accent-gold)',
                  }}
                >
                  {totalCartItems > 9 ? '9+' : totalCartItems}
                </span>
              )}
            </button>
          ) : (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                fontSize: '11px',
                fontWeight: 600,
                padding: '4px 10px',
                borderRadius: '999px',
                backgroundColor: 'rgba(201, 168, 118, 0.1)',
                color: 'var(--accent-gold)',
                border: '1px solid rgba(201, 168, 118, 0.25)',
                letterSpacing: '0.4px',
                whiteSpace: 'nowrap',
              }}
            >
              📖 Digital Menu
            </span>
          )}
        </div>
      </div>

      {/* Category Horizontal Navigation */}
      <ClassicCategoryNav
        categories={categories}
        activeCategory={activeCategory}
        onCategorySelect={onCategorySelect}
      />
    </header>
  );
}
