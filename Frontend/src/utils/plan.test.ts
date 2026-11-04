import { describe, expect, it } from 'vitest';
import { PLANS, PLAN_INFO, hasPlan, normalizePlan } from './plan';

describe('normalizePlan', () => {
  it('keeps current plan names', () => {
    expect(normalizePlan('basic')).toBe('basic');
    expect(normalizePlan('plus')).toBe('plus');
    expect(normalizePlan('pro')).toBe('pro');
  });

  it('maps names used before the rename', () => {
    expect(normalizePlan('standard')).toBe('basic');
    expect(normalizePlan('vip')).toBe('plus');
    expect(normalizePlan('enterprise')).toBe('pro');
  });

  it('defaults unknown or missing plans to basic', () => {
    expect(normalizePlan(undefined)).toBe('basic');
    expect(normalizePlan('gold')).toBe('basic');
  });
});

describe('hasPlan', () => {
  it('gives higher plans the features of lower ones', () => {
    expect(hasPlan('pro', 'plus')).toBe(true);
    expect(hasPlan('plus', 'plus')).toBe(true);
    expect(hasPlan('basic', 'plus')).toBe(false);
    expect(hasPlan('plus', 'pro')).toBe(false);
  });
});

describe('PLAN_INFO', () => {
  it('has a label for every plan in order', () => {
    expect(PLANS.map((p) => PLAN_INFO[p].label)).toEqual(['Basic', 'Plus', 'Pro']);
  });
});
