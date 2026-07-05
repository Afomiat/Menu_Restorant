import { Search, X, ShoppingBag } from 'lucide-react';
import CategoryNav from './CategoryNav';
import type { Category } from '../data/menuData';

interface HeaderProps {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  categories: Category[];
  activeCategory: string;
  onCategorySelect: (id: string) => void;
  totalCartItems: number;
  onCartClick: () => void;
}

export default function Header({
  searchQuery,
  setSearchQuery,
  categories,
  activeCategory,
  onCategorySelect,
  totalCartItems,
  onCartClick
}: HeaderProps) {

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
        /* Safe area inset for notched phones */
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
        {/* Logo — smaller on phone */}
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
                lineHeight: 1.1
              }}
            >
              AURA
            </h1>
            <span
              style={{
                fontFamily: 'var(--font-sans)',
                fontSize: '8px',
                textTransform: 'uppercase',
                letterSpacing: '3px',
                color: 'var(--accent-gold)',
                marginTop: '1px'
              }}
            >
              ristorante
            </span>
          </div>
        </div>

        {/* Right side controls: Search + Table + Cart */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, flexShrink: 1 }}>

          {/* Pill Search — full width remaining on mobile */}
          <div
            style={{
              position: 'relative',
              width: 'clamp(105px, 30vw, 320px)',
              flexShrink: 1,
              minWidth: 0,
            }}
          >
            <Search
              size={12}
              style={{
                position: 'absolute',
                left: '10px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--text-secondary)',
                pointerEvents: 'none'
              }}
            />
            <input
              type="text"
              placeholder="Search…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                backgroundColor: 'rgba(255, 255, 255, 0.04)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '20px',
                padding: '7px 10px 7px 28px',
                fontFamily: 'var(--font-sans)',
                fontSize: '13px',
                color: 'var(--text-primary)',
                outline: 'none',
                transition: 'var(--transition-smooth)',
                /* Prevent iOS zoom on focus */
                WebkitTextSizeAdjust: '100%',
              }}
              onFocus={(e) => {
                e.target.style.borderColor = 'var(--accent-gold)';
                e.target.style.backgroundColor = 'rgba(255, 255, 255, 0.06)';
              }}
              onBlur={(e) => {
                e.target.style.borderColor = 'rgba(255, 255, 255, 0.08)';
                e.target.style.backgroundColor = 'rgba(255, 255, 255, 0.04)';
              }}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                style={{
                  position: 'absolute',
                  right: '8px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--text-secondary)',
                  display: 'flex',
                  alignItems: 'center',
                  padding: '2px'
                }}
              >
                <X size={11} />
              </button>
            )}
          </div>

          {/* Shopping Bag Icon with Count Badge */}
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
                  boxShadow: '0 0 6px var(--accent-gold)'
                }}
              >
                {totalCartItems > 9 ? '9+' : totalCartItems}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Category Horizontal Navigation — always inside header */}
      <CategoryNav
        categories={categories}
        activeCategory={activeCategory}
        onCategorySelect={onCategorySelect}
      />
    </header>
  );
}
