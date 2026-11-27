/** Every page of the staff dashboard; the open one is kept in the address as ?view=<name>. */
export const ADMIN_VIEWS = ['menu', 'kitchen', 'bills', 'alerts', 'reports', 'finance', 'staff', 'tables', 'settings'] as const;
export type AdminView = (typeof ADMIN_VIEWS)[number];

/** True for a page name the dashboard knows, e.g. from the address (?view=bills). */
export function isAdminView(value: unknown): value is AdminView {
  return typeof value === 'string' && (ADMIN_VIEWS as readonly string[]).includes(value);
}
