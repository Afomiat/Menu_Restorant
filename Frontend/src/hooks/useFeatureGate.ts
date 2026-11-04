import { usePlanContext, type PlanFeatures } from '../context/PlanContext';
import type { PlanTier } from '../types';
import { hasPlan } from '../utils/plan';

export interface FeatureGateResult {
  /** The current plan tier from the backend. */
  plan: PlanTier;
  /** True when the tenant's plan includes the features of `min`, e.g. hasPlan('plus') is true on Plus and Pro. */
  hasPlan: (min: PlanTier) => boolean;
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
 * const { can, hasPlan } = useFeatureGate();
 * if (can('ordering')) { ... }
 */
export function useFeatureGate(): FeatureGateResult {
  const { plan, features } = usePlanContext();

  return {
    plan,
    hasPlan: (min) => hasPlan(plan, min),
    features,
    can: (feature) => features[feature],
  };
}
