import { UtensilsCrossed, Sparkles, ChefHat, X } from 'lucide-react';
import type { RestaurantMeta } from '../types';

interface AdminSidebarProps {
  meta: RestaurantMeta;
  slug: string;
  activeView?: 'menu' | 'kitchen';
  onSelectView?: (view: 'menu' | 'kitchen') => void;
  activeOrdersCount?: number;
  onOpenKitchen?: () => void;
  isMobileOpen?: boolean;
  onCloseMobile?: () => void;
}

export default function AdminSidebar({
  meta,
  slug,
  activeView = 'menu',
  onSelectView,
  activeOrdersCount = 0,
  onOpenKitchen,
  isMobileOpen = false,
  onCloseMobile,
}: AdminSidebarProps) {
  const displayName = meta.name || 'Azai';

  const handleMenuClick = () => {
    if (onSelectView) {
      onSelectView('menu');
    }
    if (onCloseMobile) {
      onCloseMobile();
    }
  };

  const handleKitchenClick = () => {
    if (onSelectView) {
      onSelectView('kitchen');
    } else if (onOpenKitchen) {
      onOpenKitchen();
    }
    if (onCloseMobile) {
      onCloseMobile();
    }
  };

  return (
    <>
      {/* Mobile Drawer Backdrop */}
      {isMobileOpen && (
        <div
          className="admin-sidebar-backdrop"
          onClick={onCloseMobile}
          aria-hidden="true"
        />
      )}

      <aside
        className={`admin-sidebar ${isMobileOpen ? 'mobile-open' : ''}`}
        aria-label="Sidebar Navigation"
      >
        <div>
          {/* Brand Logo & Mobile Close Button */}
          <div className="admin-sidebar-brand" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span className="admin-sidebar-logo-text">
              {displayName}
              <span className="admin-sidebar-logo-dot">.</span>
            </span>

            {/* Mobile Close Button */}
            <button
              type="button"
              className="admin-sidebar-mobile-close"
              onClick={onCloseMobile}
              aria-label="Close navigation menu"
            >
              <X size={20} />
            </button>
          </div>

          {/* Clean Navigation Items pushed down with 150px gap on desktop */}
          <nav className="admin-sidebar-nav">
            <button
              type="button"
              className={`admin-nav-item ${activeView === 'menu' ? 'active' : ''}`}
              onClick={handleMenuClick}
            >
              <UtensilsCrossed size={18} />
              <span>Dashboard</span>
            </button>

            <button
              type="button"
              className={`admin-nav-item ${activeView === 'kitchen' ? 'active' : ''}`}
              onClick={handleKitchenClick}
            >
              <ChefHat size={18} />
              <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                Kitchen Orders
                {activeOrdersCount > 0 && (
                  <span
                    style={{
                      backgroundColor: activeView === 'kitchen' ? '#ffffff' : 'var(--admin-primary, #ff5a36)',
                      color: activeView === 'kitchen' ? 'var(--admin-primary, #ff5a36)' : '#ffffff',
                      fontSize: '11px',
                      fontWeight: 800,
                      padding: '2px 8px',
                      borderRadius: '999px',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                    }}
                  >
                    {activeOrdersCount}
                  </span>
                )}
              </span>
            </button>
          </nav>
        </div>

        {/* Bottom Promo/Status Card (GoMeal Style) */}
        <div className="admin-sidebar-banner">
          <div className="admin-sidebar-banner-decor" />
          <div className="admin-sidebar-banner-title">
            <Sparkles size={14} style={{ display: 'inline', marginRight: '6px' }} />
            Menu Status: Live
          </div>
          <div className="admin-sidebar-banner-desc">
            Managing <strong>/{slug}</strong> menu in real-time. Changes are automatically saved.
          </div>
          <a
            href={`/${slug}`}
            target="_blank"
            rel="noreferrer"
            className="admin-sidebar-banner-btn"
          >
            View Menu
          </a>
        </div>
      </aside>
    </>
  );
}
