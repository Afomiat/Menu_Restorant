import type { PlanTier } from '../types';

/** Every plan from lowest to highest; each plan includes everything below it. */
export const PLANS: readonly PlanTier[] = ['basic', 'plus', 'pro'];

export const PLAN_INFO: Record<PlanTier, { label: string; icon: string; color: string; gradient: string }> = {
  basic: { label: 'Basic', icon: '⚡', color: '#3b82f6', gradient: 'linear-gradient(135deg, #3b82f6, #1d4ed8)' },
  plus: { label: 'Plus', icon: '👑', color: '#f59e0b', gradient: 'linear-gradient(135deg, #f59e0b, #ea580c)' },
  pro: { label: 'Pro', icon: '💎', color: '#8b5cf6', gradient: 'linear-gradient(135deg, #8b5cf6, #6d28d9)' },
};

// Names used before the Basic / Plus / Pro rename, still accepted while old data is around
const LEGACY_PLANS: Record<string, PlanTier> = { standard: 'basic', vip: 'plus', enterprise: 'pro' };

/** Turns a plan value from the backend or a menu file into a known plan, defaulting to Basic. */
export function normalizePlan(raw: unknown): PlanTier {
  const value = String(raw ?? '').toLowerCase();
  if ((PLANS as readonly string[]).includes(value)) return value as PlanTier;
  return LEGACY_PLANS[value] ?? 'basic';
}

/** True when `plan` includes the features of `min`. */
export function hasPlan(plan: PlanTier, min: PlanTier): boolean {
  return PLANS.indexOf(plan) >= PLANS.indexOf(min);
}
