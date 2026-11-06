import { describe, expect, it } from 'vitest';
import { renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { PlanProvider } from './PlanContext';
import { useFeatureGate } from '../hooks/useFeatureGate';
import type { PlanTier } from '../types';

function gateFor(plan: PlanTier) {
  const wrapper = ({ children }: { children: ReactNode }) => <PlanProvider plan={plan}>{children}</PlanProvider>;
  return renderHook(() => useFeatureGate(), { wrapper }).result.current;
}

describe('plan features', () => {
  it('Basic has the menu but no ordering or kitchen screen', () => {
    const gate = gateFor('basic');
    expect(gate.can('ordering')).toBe(false);
    expect(gate.can('liveKDS')).toBe(false);
    expect(gate.can('tables')).toBe(false);
    expect(gate.can('dietaryInfo')).toBe(true);
  });

  it('Plus and Pro both get ordering, order status, kitchen screen and tables', () => {
    for (const plan of ['plus', 'pro'] as const) {
      const gate = gateFor(plan);
      expect(gate.can('ordering')).toBe(true);
      expect(gate.can('orderStatus')).toBe(true);
      expect(gate.can('liveKDS')).toBe(true);
      expect(gate.can('tables')).toBe(true);
    }
  });

  it('hasPlan compares against the restaurant plan', () => {
    expect(gateFor('pro').hasPlan('pro')).toBe(true);
    expect(gateFor('plus').hasPlan('pro')).toBe(false);
    expect(gateFor('plus').hasPlan('plus')).toBe(true);
    expect(gateFor('basic').hasPlan('plus')).toBe(false);
  });
});
