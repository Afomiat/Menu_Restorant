import { createContext, useContext, useMemo, type ReactNode } from 'react';

// ─── Plan Feature Matrix ─────────────────────────────────────────────────────

/**
 * The set of features that vary by plan tier.
 * This is the single authoritative definition — every component reads from here.
 */
export interface PlanFeatures {
  /**
   * Customer: Can add items to cart and place orders to the kitchen.
   * VIP only.
   */
  ordering: boolean;

  /**
   * Customer: Can view live order status after placing an order.
   * VIP only.
   */
  orderStatus: boolean;

  /**
   * Admin: Can view and manage the Kitchen Display System (KDS) board.
   * VIP only.
   */
  liveKDS: boolean;

  /**
   * Admin: Can manage dine-in tables and generate QR codes.
   * VIP only.
   */
  tables: boolean;

  /**
   * Shared: Dietary tags (spicy, vegetarian, gluten-free, etc.) and
   * allergen information are always shown — on both Standard and VIP.
   * This is here for explicitness, not gating.
   */
  dietaryInfo: boolean;

  /**
   * Shared: Weight labels, item variants (read-only for Standard),
   * and item detail modals are available on both tiers.
   */
  itemDetails: boolean;
}

export interface PlanContextValue {
  plan: 'standard' | 'vip';
  features: PlanFeatures;
}

// ─── Feature Matrix per Plan ──────────────────────────────────────────────────

function buildFeatures(plan: 'standard' | 'vip'): PlanFeatures {
  const isVIP = plan === 'vip';
  return {
    // VIP-only features
    ordering: isVIP,
    orderStatus: isVIP,
    liveKDS: isVIP,
    tables: isVIP,
    // Shared features — always enabled
    dietaryInfo: true,
    itemDetails: true,
  };
}

// ─── Context ──────────────────────────────────────────────────────────────────

const PlanContext = createContext<PlanContextValue | null>(null);

PlanContext.displayName = 'PlanContext';

// ─── Provider ─────────────────────────────────────────────────────────────────

interface PlanProviderProps {
  plan: 'standard' | 'vip';
  children: ReactNode;
}

/**
 * PlanProvider must wrap any component tree that needs feature gating.
 * The `plan` prop should come directly from the backend API response
 * (RestaurantMenu.plan or RestaurantMeta.plan), never from URL params
 * or localStorage.
 *
 * Usage:
 *   <PlanProvider plan={menu.plan ?? 'standard'}>
 *     <ModernMenuPage ... />
 *   </PlanProvider>
 */
export function PlanProvider({ plan, children }: PlanProviderProps) {
  const value = useMemo<PlanContextValue>(
    () => ({
      plan,
      features: buildFeatures(plan),
    }),
    [plan]
  );

  return <PlanContext.Provider value={value}>{children}</PlanContext.Provider>;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * Internal hook to access PlanContext. Throws if called outside a PlanProvider.
 */
export function usePlanContext(): PlanContextValue {
  const ctx = useContext(PlanContext);
  if (!ctx) {
    throw new Error('usePlanContext must be used within a <PlanProvider>');
  }
  return ctx;
}
