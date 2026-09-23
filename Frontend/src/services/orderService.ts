import type { CartItem, OrderStatus, BackendOrder } from '../types';
import { apiClient } from './apiClient';

const ORDER_EVENT_PREFIX = 'azai_orders_updated_';
const LEGACY_ORDER_EVENT_PREFIX = 'aura_orders_updated_';

export function getOrderStorageKey(slug: string): string {
  const cleanSlug = slug?.toLowerCase().trim() || 'unknown';
  return `azai:orders:${cleanSlug}`;
}

// ============================================================================
// 1. LIVE BACKEND API METHODS (PostgreSQL + Supabase + Gin)
// ============================================================================

/**
 * Validates a table QR token with the backend using HMAC verification
 */
export async function validateTable(
  slug: string,
  tableNumber: string,
  token: string
): Promise<{ valid: boolean; table_number?: string; error?: string }> {
  try {
    const res = await apiClient.get<{ valid: boolean; table_number: string }>(
      `/menus/${slug}/tables/validate?table=${encodeURIComponent(tableNumber)}&token=${encodeURIComponent(token)}`
    );
    return { valid: res.valid, table_number: res.table_number };
  } catch (err: any) {
    return { valid: false, error: err?.message || 'Invalid table QR token' };
  }
}

/**
 * Places a verified live customer order on the backend with server-side pricing & 60s Undo window.
 */
export async function placeLiveOrder(
  slug: string,
  params: {
    tableNumber: string;
    tableToken: string;
    items: {
      menu_item_id: string;
      item_name: string;
      unit_price: number;
      quantity: number;
      notes?: string;
      modifiers?: { modifier_id: string; modifier_name: string; price_applied: number }[];
    }[];
  }
): Promise<{ order: BackendOrder; grace_period_ends_at: string; grace_period_seconds: number }> {
  const payload = {
    table_number: params.tableNumber,
    table_token: params.tableToken,
    items: params.items.map((it) => ({
      menu_item_id: it.menu_item_id,
      item_name: it.item_name,
      unit_price: it.unit_price,
      quantity: it.quantity,
      notes: it.notes || '',
      modifiers: it.modifiers || [],
    })),
  };

  const res = await apiClient.post<{
    message: string;
    order: BackendOrder;
    grace_period_ends_at: string;
    grace_period_seconds: number;
  }>(`/menus/${slug}/orders`, payload);

  return res;
}

/**
 * Cancels an order within its 60-second grace window.
 */
export async function undoLiveOrder(slug: string, orderId: string): Promise<boolean> {
  if (!orderId || orderId.startsWith('ORD-')) {
    // Local offline order cancelled locally without remote call
    return true;
  }
  try {
    await apiClient.post(`/menus/${slug}/orders/${orderId}/undo`);
    return true;
  } catch (err) {
    console.error('Failed to undo order:', err);
    throw err;
  }
}

/**
 * Polls or tracks a customer's live order status.
 */
export async function fetchLiveOrderStatus(slug: string, orderId: string): Promise<BackendOrder | null> {
  try {
    const res = await apiClient.get<{ data: BackendOrder }>(`/menus/${slug}/orders/${orderId}`);
    return res.data;
  } catch {
    return null;
  }
}

export function mapBackendStatusToFrontend(backendStatus?: string): OrderStatus {
  if (!backendStatus || backendStatus === 'pending_grace' || backendStatus === 'received' || backendStatus === 'not_started') {
    return 'not_started';
  }
  if (backendStatus === 'preparing' || backendStatus === 'cooking') {
    return 'preparing';
  }
  if (backendStatus === 'ready') {
    return 'ready';
  }
  if (backendStatus === 'complete' || backendStatus === 'delivered') {
    return 'complete';
  }
  if (backendStatus === 'cancelled') {
    return 'cancelled';
  }
  return 'not_started';
}

export function mapBackendOrderToCartItems(order: BackendOrder, menuItems: any[] = []): CartItem[] {
  const status = mapBackendStatusToFrontend(order.status);
  const placedAt = order.created_at ? new Date(order.created_at).getTime() : Date.now();

  if (!order.items || order.items.length === 0) {
    return [
      {
        orderId: order.id,
        placedAt,
        status,
        tableNumber: order.table_number,
        quantity: 1,
        variant: '',
        notes: '',
        item: {
          id: order.id,
          name: `Order #${order.id.slice(-4)}`,
          price: order.total_amount || 0,
          imageUrl: '/images/default_food.png',
          description: '',
          tags: [],
          available: true,
          categoryId: 'all',
        },
      },
    ];
  }

  return order.items.map((it) => {
    const matched = menuItems.find((m) => m.id === it.menu_item_id);
    return {
      orderId: order.id,
      placedAt,
      status,
      tableNumber: order.table_number,
      quantity: it.quantity,
      variant: '',
      notes: it.notes || '',
      item: matched || {
        id: it.menu_item_id,
        name: it.item_name,
        price: it.unit_price,
        imageUrl: '/images/default_food.png',
        description: '',
        tags: [],
        available: true,
        categoryId: 'all',
      },
    };
  });
}

/**
 * Staff / Kitchen KDS: Fetch live active kitchen orders
 */
export async function fetchAdminActiveOrders(): Promise<BackendOrder[]> {
  try {
    const res = await apiClient.get<{ data: BackendOrder[] }>('/admin/orders');
    return res.data || [];
  } catch (err) {
    console.warn('Failed to fetch admin active orders:', err);
    return [];
  }
}

/**
 * Staff / Kitchen KDS: Update order progress status
 */
export async function updateAdminOrderStatus(orderId: string, status: OrderStatus): Promise<boolean> {
  try {
    const backendStatus = status === 'complete' ? 'delivered' : status;
    await apiClient.patch(`/admin/orders/${orderId}/status`, { status: backendStatus });
    return true;
  } catch (err) {
    console.error('Failed to update admin order status:', err);
    throw err;
  }
}

/**
 * Staff 86'd Toggle: Instantly mark item as sold out or back in stock
 */
export async function toggleAdminItemSoldOut(itemId: string, isSoldOut: boolean): Promise<boolean> {
  try {
    await apiClient.patch(`/admin/items/${itemId}/sold-out`, { is_sold_out: isSoldOut });
    return true;
  } catch (err) {
    console.error('Failed to toggle sold out:', err);
    return false;
  }
}

/**
 * License Upgrade: Update restaurant plan tier ('standard' -> 'vip')
 */
export async function updateAdminTenantPlan(plan: 'standard' | 'vip', _slug?: string): Promise<boolean> {
  try {
    await apiClient.patch('/admin/tenant/plan', { plan });
    return true;
  } catch (err) {
    console.error('Failed to update plan:', err);
    return false;
  }
}

export interface AdminTable {
  id: string;
  tenant_id: string;
  table_number: string;
  is_active: boolean;
}

/**
 * Fetch all dining tables registered for this restaurant
 */
export async function fetchAdminTables(): Promise<AdminTable[]> {
  const res = await apiClient.get<{ data: AdminTable[] }>('/admin/tables');
  return res.data || [];
}

/**
 * Register a new dining table in PostgreSQL
 */
export async function createAdminTable(tableNumber: string): Promise<AdminTable> {
  const res = await apiClient.post<{ message: string; data: AdminTable }>('/admin/tables', {
    table_number: tableNumber,
  });
  return res.data;
}

/**
 * Table QR Code Generation with HMAC-SHA256 signature
 */
export async function generateAdminTableQR(tableNumber: string): Promise<{ qr_url: string; table_number: string }> {
  const res = await apiClient.post<{ qr_url: string; table_number: string }>('/admin/tables/qr', { table_number: tableNumber });
  return res;
}


// ============================================================================
// 2. CUSTOMER-SPECIFIC ORDER STORAGE (Isolated per device/customer session)
// ============================================================================

export function getCustomerOrdersStorageKey(slug: string): string {
  const cleanSlug = slug?.toLowerCase().trim() || 'unknown';
  return `azai:customer_orders:${cleanSlug}`;
}

export function getCustomerOrders(slug: string): CartItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const key = getCustomerOrdersStorageKey(slug);
    const stored = localStorage.getItem(key);
    if (!stored) return [];
    const parsed = JSON.parse(stored);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.warn(`Failed to read customer orders for ${slug}:`, err);
    return [];
  }
}

export function saveCustomerOrders(slug: string, orders: CartItem[]): void {
  if (typeof window === 'undefined') return;
  try {
    const key = getCustomerOrdersStorageKey(slug);
    localStorage.setItem(key, JSON.stringify(orders));
  } catch (err) {
    console.error(`Failed to save customer orders for ${slug}:`, err);
  }
}

export function addCustomerOrders(slug: string, newOrders: CartItem[]): void {
  const current = getCustomerOrders(slug);
  saveCustomerOrders(slug, [...newOrders, ...current]);
}

export function removeCustomerOrder(slug: string, orderId: string): void {
  const current = getCustomerOrders(slug);
  const remaining = current.filter((o) => o.orderId !== orderId);
  saveCustomerOrders(slug, remaining);
}

/** Clears ONLY this customer's own order history (never touches the kitchen's key). */
export function clearCustomerOrders(slug: string): void {
  saveCustomerOrders(slug, []);
}
// ============================================================================
// 3. STAFF / KITCHEN LOCAL SYNC (Strictly for KDS display)
// ============================================================================

export function getRestaurantOrders(slug: string): CartItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const cleanSlug = slug?.toLowerCase().trim() || 'unknown';
    const primaryKey = `azai:orders:${cleanSlug}`;
    const legacyKey = `aura_menu_placed_orders_${cleanSlug}`;
    const stored = localStorage.getItem(primaryKey) || localStorage.getItem(legacyKey);
    if (!stored) return [];
    const parsed = JSON.parse(stored);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.warn(`Failed to read orders for ${slug}:`, err);
    return [];
  }
}

export function saveRestaurantOrders(slug: string, orders: CartItem[]): void {
  if (typeof window === 'undefined') return;
  try {
    const key = getOrderStorageKey(slug);
    localStorage.setItem(key, JSON.stringify(orders));

    window.dispatchEvent(
      new CustomEvent(`${ORDER_EVENT_PREFIX}${slug.toLowerCase().trim()}`, {
        detail: { orders },
      })
    );
  } catch (err) {
    console.error(`Failed to save orders for ${slug}:`, err);
  }
}

export async function updateOrderStatus(slug: string, orderId: string, newStatus: OrderStatus): Promise<boolean> {
  const orders = getRestaurantOrders(slug);
  const target = orders.find((o) => o.orderId === orderId);
  const prevStatus = target?.status || 'not_started';

  const updated = orders.map((order) => {
    if (order.orderId === orderId) {
      return {
        ...order,
        status: newStatus,
        statusUpdatedAt: Date.now(),
      };
    }
    return order;
  });
  saveRestaurantOrders(slug, updated);

  // If live backend order ID, notify backend API asynchronously with rollback protection
  if (orderId && !orderId.startsWith('ORD-') && orderId.length > 20) {
    try {
      await updateAdminOrderStatus(orderId, newStatus);
      return true;
    } catch (err) {
      // Revert optimistic update
      const reverted = getRestaurantOrders(slug).map((o) =>
        o.orderId === orderId ? { ...o, status: prevStatus } : o
      );
      saveRestaurantOrders(slug, reverted);
      throw err;
    }
  }
  return true;
}

export async function updateTableOrdersStatus(slug: string, tableNumber: string, newStatus: OrderStatus): Promise<void> {
  const orders = getRestaurantOrders(slug);
  const prevStatuses = new Map<string, OrderStatus>();

  const updated = orders.map((order) => {
    if (order.tableNumber === tableNumber && order.status !== 'complete' && order.status !== 'cancelled') {
      if (order.orderId) {
        prevStatuses.set(order.orderId, order.status || 'not_started');
      }
      return {
        ...order,
        status: newStatus,
        statusUpdatedAt: Date.now(),
      };
    }
    return order;
  });
  saveRestaurantOrders(slug, updated);

  // Notify backend for all affected live orders concurrently in parallel
  const liveTargetOrders = orders.filter(
    (o) =>
      o.tableNumber === tableNumber &&
      o.status !== 'complete' &&
      o.status !== 'cancelled' &&
      o.orderId &&
      !o.orderId.startsWith('ORD-') &&
      o.orderId.length > 20
  );

  await Promise.all(
    liveTargetOrders.map(async (order) => {
      try {
        await updateAdminOrderStatus(order.orderId!, newStatus);
      } catch (err) {
        // Rollback this specific order on failure
        const prev = prevStatuses.get(order.orderId!) || 'not_started';
        const currentOrders = getRestaurantOrders(slug);
        const rolledBack = currentOrders.map((o) =>
          o.orderId === order.orderId ? { ...o, status: prev } : o
        );
        saveRestaurantOrders(slug, rolledBack);
      }
    })
  );
}

/** Admin: Bulk cancel all orders for a specific table in PostgreSQL */
export async function cancelTableOrders(slug: string, tableNumber: string): Promise<void> {
  await apiClient.delete(`/admin/orders/table/${encodeURIComponent(tableNumber)}`);
  // Also clear locally
  deleteTableOrders(slug, tableNumber);
}

/** Admin: Bulk cancel all active orders in PostgreSQL */
export async function cancelAllActiveOrders(slug: string): Promise<void> {
  await apiClient.delete('/admin/orders');
  // Also clear locally
  saveRestaurantOrders(slug, []);
}


export function addRestaurantOrders(slug: string, newOrders: CartItem[]): void {
  const current = getRestaurantOrders(slug);
  saveRestaurantOrders(slug, [...current, ...newOrders]);
}

export function undoRestaurantOrder(slug: string, orderId: string): CartItem | null {
  const orders = getRestaurantOrders(slug);
  const orderToUndo = orders.find((o) => o.orderId === orderId);

  if (!orderToUndo || (orderToUndo.status && orderToUndo.status !== 'not_started')) {
    return null;
  }

  const remaining = orders.filter((o) => o.orderId !== orderId);
  saveRestaurantOrders(slug, remaining);
  return orderToUndo;
}

export function clearCompletedOrders(slug: string): void {
  const orders = getRestaurantOrders(slug);
  const activeOrders = orders.filter((o) => o.status !== 'complete' && o.status !== 'cancelled');
  saveRestaurantOrders(slug, activeOrders);
}

export function clearAllRestaurantOrders(slug: string): void {
  saveRestaurantOrders(slug, []);
}

export function deleteTableOrders(slug: string, tableNumber: string): void {
  const cleanTable = tableNumber?.trim() || '';
  const orders = getRestaurantOrders(slug);
  const remaining = orders.filter((o) => (o.tableNumber?.trim() || 'Direct') !== (cleanTable || 'Direct'));
  saveRestaurantOrders(slug, remaining);
}

export function deleteSingleOrder(slug: string, orderId: string): void {
  const orders = getRestaurantOrders(slug);
  const remaining = orders.filter((o) => o.orderId !== orderId);
  saveRestaurantOrders(slug, remaining);
}

export function subscribeToOrders(
  slug: string,
  callback: (orders: CartItem[]) => void
): () => void {
  const cleanSlug = slug?.toLowerCase().trim() || 'unknown';
  const key = getOrderStorageKey(cleanSlug);
  const legacyKey = `aura_menu_placed_orders_${cleanSlug}`;
  const eventName = `${ORDER_EVENT_PREFIX}${cleanSlug}`;
  const legacyEventName = `${LEGACY_ORDER_EVENT_PREFIX}${cleanSlug}`;

  const handleCustomEvent = (e: Event) => {
    const customEvent = e as CustomEvent<{ orders: CartItem[] }>;
    if (customEvent.detail?.orders) {
      callback(customEvent.detail.orders);
    } else {
      callback(getRestaurantOrders(cleanSlug));
    }
  };

  const handleStorageEvent = (e: StorageEvent) => {
    if (e.key === key || e.key === legacyKey) {
      callback(getRestaurantOrders(cleanSlug));
    }
  };

  window.addEventListener(eventName, handleCustomEvent);
  window.addEventListener(legacyEventName, handleCustomEvent);
  window.addEventListener('storage', handleStorageEvent);

  return () => {
    window.removeEventListener(eventName, handleCustomEvent);
    window.removeEventListener(legacyEventName, handleCustomEvent);
    window.removeEventListener('storage', handleStorageEvent);
  };
}
