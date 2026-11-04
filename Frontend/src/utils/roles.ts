import type { StaffRole } from '../types';
import { t } from '../i18n/en';

/** Roles a manager can give a staff member, in display order. */
export const STAFF_ROLES: readonly StaffRole[] = ['manager', 'cashier', 'waiter', 'chef'];

/**
 * Turns a role from a login into a known role. Logins from before the Pro roles say
 * 'owner' and 'kitchen', which are now Manager and Chef. Unknown roles give null.
 */
export function normalizeRole(raw: unknown): StaffRole | null {
  const value = String(raw ?? '').toLowerCase();
  if (value === 'owner') return 'manager';
  if (value === 'kitchen') return 'chef';
  if (value === 'super_admin' || (STAFF_ROLES as readonly string[]).includes(value)) return value as StaffRole;
  return null;
}

export function roleLabel(role: StaffRole): string {
  return t.roles[role];
}

/** Managers (and the Azai team) edit the menu, tables, settings and staff. */
export function canManage(role: StaffRole | null): boolean {
  return role === 'manager' || role === 'super_admin';
}

/** The screen a role sees after signing in. */
export type RoleHome = 'menu' | 'kitchen' | 'waiter' | 'cashier';

export function roleHome(role: StaffRole | null): RoleHome {
  switch (role) {
    case 'chef':
      return 'kitchen';
    case 'waiter':
      return 'waiter';
    case 'cashier':
      return 'cashier';
    default:
      return 'menu';
  }
}

/** Roles that work the kitchen screen. */
export function canUseKitchen(role: StaffRole | null): boolean {
  return canManage(role) || role === 'chef';
}
