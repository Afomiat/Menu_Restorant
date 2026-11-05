import { UtensilsCrossed, Sparkles, ChefHat, X, QrCode, LogOut, Settings, LayoutGrid, Rows3, Users, Receipt } from 'lucide-react';
import type { RestaurantMeta, StaffRole } from '../types';
import { PLAN_INFO, hasPlan } from '../utils/plan';
import { canManage, canUseKitchen } from '../utils/roles';
import { t } from '../i18n/en';

type MenuDesign = NonNullable<RestaurantMeta['template']>;

// The two customer menu designs a restaurant can switch between
const MENU_DESIGNS: { id: MenuDesign; label: string; Icon: typeof LayoutGrid }[] = [
  { id: 'modern', label: 'Modern', Icon: LayoutGrid },
  { id: 'classic', label: 'Classic', Icon: Rows3 },
];

interface AdminSidebarProps {
  meta: RestaurantMeta;
  slug: string;
  activeView?: 'menu' | 'kitchen' | 'bills';
  onSelectView?: (view: 'menu' | 'kitchen' | 'bills') => void;
  activeOrdersCount?: number;
  onOpenKitchen?: () => void;
  onOpenTables?: () => void;
  onOpenSettings?: () => void;
  onOpenStaff?: () => void;
  onLogout?: () => void;
  onChangeDesign?: (design: MenuDesign) => void;
  isMobileOpen?: boolean;
  onCloseMobile?: () => void;
  /** The signed-in staff member's role; each role only sees what it may use. Defaults to manager. */
  role?: StaffRole | null;
}

export default function AdminSidebar({
  meta,
  slug,
  activeView = 'menu',
  onSelectView,
  activeOrdersCount = 0,
  onOpenKitchen,
  onOpenTables,
  onOpenSettings,
  onOpenStaff,
  onLogout,
  onChangeDesign,
  isMobileOpen = false,
  onCloseMobile,
  role = 'manager',
}: AdminSidebarProps) {
  const isManager = canManage(role);
  const showKitchen = canUseKitchen(role);
  const displayName = meta.name || 'Azai';
  // Same rule the customer menu uses: anything but 'modern' shows the classic design
  const currentDesign: MenuDesign = meta.template === 'modern' ? 'modern' : 'classic';

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
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span className="admin-sidebar-logo-text">
                {displayName}
                <span className="admin-sidebar-logo-dot">.</span>
              </span>
              <span
                style={{
                  fontSize: '10px',
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  letterSpacing: '0.6px',
                  color: PLAN_INFO[meta?.plan ?? 'basic'].color,
                  marginTop: '1px',
                }}
              >
                {PLAN_INFO[meta?.plan ?? 'basic'].icon} {PLAN_INFO[meta?.plan ?? 'basic'].label} Plan
              </span>
            </div>

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
            {isManager && (
              <button
                type="button"
                className={`admin-nav-item ${activeView === 'menu' ? 'active' : ''}`}
                onClick={handleMenuClick}
              >
                <UtensilsCrossed size={18} />
                <span>Dashboard</span>
              </button>
            )}

            {showKitchen && (
            <button
              type="button"
              className={`admin-nav-item ${activeView === 'kitchen' ? 'active' : ''}`}
              onClick={handleKitchenClick}
            >
              <ChefHat size={18} />
              <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                <span>Kitchen Orders</span>
                {meta?.plan && !hasPlan(meta.plan, 'plus') ? (
                  <span
                    style={{
                      fontSize: '10px',
                      fontWeight: 800,
                      padding: '2px 8px',
                      borderRadius: '999px',
                      backgroundColor: 'rgba(245, 158, 11, 0.15)',
                      color: '#d97706',
                    }}
                  >
                    PLUS
                  </span>
                ) : activeOrdersCount > 0 ? (
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
                ) : null}
              </span>
            </button>
            )}

            {isManager && onSelectView && meta?.plan && hasPlan(meta.plan, 'pro') && (
              <button
                type="button"
                className={`admin-nav-item ${activeView === 'bills' ? 'active' : ''}`}
                onClick={() => {
                  onSelectView('bills');
                  if (onCloseMobile) onCloseMobile();
                }}
              >
                <Receipt size={18} />
                <span>{t.bills.navLabel}</span>
              </button>
            )}

            {isManager && onOpenStaff && (
              <button
                type="button"
                className="admin-nav-item"
                onClick={() => {
                  onOpenStaff();
                  if (onCloseMobile) onCloseMobile();
                }}
              >
                <Users size={18} />
                <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                  <span>{t.staff.navLabel}</span>
                  {meta?.plan && !hasPlan(meta.plan, 'pro') && (
                    <span
                      style={{
                        fontSize: '10px',
                        fontWeight: 800,
                        padding: '2px 8px',
                        borderRadius: '999px',
                        backgroundColor: 'rgba(139, 92, 246, 0.15)',
                        color: '#7c3aed',
                      }}
                    >
                      PRO
                    </span>
                  )}
                </span>
              </button>
            )}

            {isManager && (
            <button
              type="button"
              className="admin-nav-item"
              onClick={() => {
                if (onOpenTables) onOpenTables();
                if (onCloseMobile) onCloseMobile();
              }}
            >
              <QrCode size={18} />
              <span>Tables & QR Codes</span>
            </button>
            )}

            {isManager && onOpenSettings && (
              <button
                type="button"
                className="admin-nav-item"
                onClick={() => {
                  onOpenSettings();
                  if (onCloseMobile) onCloseMobile();
                }}
              >
                <Settings size={18} />
                <span>Restaurant Settings</span>
              </button>
            )}

            {onLogout && (
              <button
                type="button"
                className="admin-nav-item"
                onClick={() => {
                  onLogout();
                  if (onCloseMobile) onCloseMobile();
                }}
                style={{ color: '#ef4444' }}
              >
                <LogOut size={18} />
                <span>Sign Out</span>
              </button>
            )}
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
          {isManager && onChangeDesign && (
            <>
              <div className="admin-design-switch-label">Menu design</div>
              <div className="admin-design-switch" role="radiogroup" aria-label="Menu design">
                {MENU_DESIGNS.map(({ id, label, Icon }) => (
                  <button
                    key={id}
                    type="button"
                    role="radio"
                    aria-checked={currentDesign === id}
                    className={`admin-design-option ${currentDesign === id ? 'active' : ''}`}
                    onClick={() => onChangeDesign(id)}
                  >
                    <Icon size={14} />
                    <span>{label}</span>
                  </button>
                ))}
              </div>
            </>
          )}
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
