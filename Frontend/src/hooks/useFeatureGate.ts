import { usePlanContext, type PlanFeatures } from '../context/PlanContext';

export interface FeatureGateResult {
  /** The current plan tier from the backend. */
  plan: 'standard' | 'vip';
  /** True when the tenant is on the VIP plan. */
  isVIP: boolean;
  /** True when the tenant is on the Standard plan. */
  isStandard: boolean;
  /** The full feature set for the current plan. */
  features: PlanFeatures;
  /**
   * Checks if a specific named feature is enabled.
   * Equivalent to `features[feature]`, but provides a clean API surface.
   */
  can: (feature: keyof PlanFeatures) => boolean;
}

/**
 * useFeatureGate — the primary hook for plan-based feature access in components.
 *
 * Must be used inside a <PlanProvider> (which is set at the menu/admin page level).
 *
 * @example
 * const { can, isVIP } = useFeatureGate();
 * if (can('ordering')) { ... }
 */
export function useFeatureGate(): FeatureGateResult {
  const { plan, features } = usePlanContext();

  return {
    plan,
    isVIP: plan === 'vip',
    isStandard: plan === 'standard',
    features,
    can: (feature) => features[feature],
  };
}
