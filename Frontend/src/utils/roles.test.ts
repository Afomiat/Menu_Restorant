import { describe, expect, it } from 'vitest';
import { canManage, canUseKitchen, normalizeRole, roleHome, roleLabel, STAFF_ROLES } from './roles';

describe('normalizeRole', () => {
  it('keeps the Pro roles', () => {
    for (const role of ['manager', 'cashier', 'waiter', 'chef', 'super_admin']) {
      expect(normalizeRole(role)).toBe(role);
    }
  });

  it('maps role names from before the Pro roles', () => {
    expect(normalizeRole('owner')).toBe('manager');
    expect(normalizeRole('kitchen')).toBe('chef');
  });

  it('returns null for unknown roles', () => {
    expect(normalizeRole('staff')).toBeNull();
    expect(normalizeRole(undefined)).toBeNull();
  });
});

describe('role screens and permissions', () => {
  it('sends each role to its own screen', () => {
    expect(roleHome('manager')).toBe('menu');
    expect(roleHome('super_admin')).toBe('menu');
    expect(roleHome('chef')).toBe('kitchen');
    expect(roleHome('waiter')).toBe('waiter');
    expect(roleHome('cashier')).toBe('cashier');
  });

  it('lets only managers manage and only managers and chefs use the kitchen', () => {
    expect(STAFF_ROLES.filter(canManage)).toEqual(['manager']);
    expect(STAFF_ROLES.filter(canUseKitchen)).toEqual(['manager', 'chef']);
    expect(canManage('super_admin')).toBe(true);
    expect(canManage(null)).toBe(false);
  });

  it('labels every role', () => {
    expect(STAFF_ROLES.map(roleLabel)).toEqual(['Manager', 'Cashier', 'Waiter', 'Chef']);
  });
});
