import type { ReactNode } from 'react';
import { useFeatureGate } from '../../hooks/useFeatureGate';
import type { PlanFeatures } from '../../context/PlanContext';

interface FeatureGateProps {
  /**
   * The feature key to check against the current plan.
   * Corresponds to a key in PlanFeatures.
   */
  feature: keyof PlanFeatures;
  /**
   * Rendered when the feature IS enabled for the current plan.
   */
  children: ReactNode;
  /**
   * Optional: Rendered when the feature is NOT enabled (Standard tier).
   * If not provided, nothing is rendered for unavailable features.
   */
  fallback?: ReactNode;
}

/**
 * FeatureGate — declarative JSX component for plan-based feature rendering.
 *
 * Replaces ternary expressions like:
 *   `isOrderingEnabled ? <AddBtn /> : <ViewBadge />`
 *
 * With:
 *   `<FeatureGate feature="ordering" fallback={<ViewBadge />}><AddBtn /></FeatureGate>`
 *
 * Must be inside a <PlanProvider>.
 *
 * @example
 * // Only render cart button for VIP
 * <FeatureGate feature="ordering">
 *   <CartButton />
 * </FeatureGate>
 *
 * @example
 * // Render different UI per tier, no duplication
 * <FeatureGate feature="ordering" fallback={<span>View only</span>}>
 *   <AddToCartButton />
 * </FeatureGate>
 */
export default function FeatureGate({ feature, children, fallback = null }: FeatureGateProps) {
  const { can } = useFeatureGate();

  if (can(feature)) {
    return <>{children}</>;
  }

  return <>{fallback}</>;
}
