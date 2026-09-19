import type { CartItem, OrderStatus } from '../types';

const ORDER_EVENT_PREFIX = 'aura_orders_updated_';

export function getOrderStorageKey(slug: string): string {
  const cleanSlug = slug?.toLowerCase().trim() || 'unknown';
  return `aura_menu_placed_orders_${cleanSlug}`;
}

/**
 * Fetch all placed kitchen orders for a specific restaurant.
 */
export function getRestaurantOrders(slug: string): CartItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const key = getOrderStorageKey(slug);
    const stored = localStorage.getItem(key);
    if (!stored) return [];
    const parsed = JSON.parse(stored);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.warn(`Failed to read orders for ${slug}:`, err);
    return [];
  }
}

/**
 * Persist placed kitchen orders and emit cross-tab/local change events.
 */
export function saveRestaurantOrders(slug: string, orders: CartItem[]): void {
  if (typeof window === 'undefined') return;
  try {
    const key = getOrderStorageKey(slug);
    localStorage.setItem(key, JSON.stringify(orders));

    // Dispatch local custom event for immediate in-tab listeners
    window.dispatchEvent(
      new CustomEvent(`${ORDER_EVENT_PREFIX}${slug.toLowerCase().trim()}`, {
        detail: { orders },
      })
    );
  } catch (err) {
    console.error(`Failed to save orders for ${slug}:`, err);
  }
}

/**
 * Update the status of a specific order item (e.g. not_started -> preparing -> ready -> complete).
 */
export function updateOrderStatus(slug: string, orderId: string, newStatus: OrderStatus): void {
  const orders = getRestaurantOrders(slug);
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
}

/**
 * Update the status of all orders for a specific table number at once.
 */
export function updateTableOrdersStatus(slug: string, tableNumber: string, newStatus: OrderStatus): void {
  const orders = getRestaurantOrders(slug);
  const updated = orders.map((order) => {
    if (order.tableNumber === tableNumber && order.status !== 'complete' && order.status !== 'cancelled') {
      return {
        ...order,
        status: newStatus,
        statusUpdatedAt: Date.now(),
      };
    }
    return order;
  });
  saveRestaurantOrders(slug, updated);
}

/**
 * Add new orders submitted by a customer.
 */
export function addRestaurantOrders(slug: string, newOrders: CartItem[]): void {
  const current = getRestaurantOrders(slug);
  saveRestaurantOrders(slug, [...current, ...newOrders]);
}

/**
 * Undo an order if it is still 'not_started'.
 * Returns the undone order item if successful, or null if already locked/preparing.
 */
export function undoRestaurantOrder(slug: string, orderId: string): CartItem | null {
  const orders = getRestaurantOrders(slug);
  const orderToUndo = orders.find((o) => o.orderId === orderId);

  // If kitchen has already started preparing, undo is locked!
  if (!orderToUndo || orderToUndo.status !== 'not_started') {
    return null;
  }

  const remaining = orders.filter((o) => o.orderId !== orderId);
  saveRestaurantOrders(slug, remaining);
  return orderToUndo;
}

/**
 * Clear completed or cancelled orders older than the active session.
 */
export function clearCompletedOrders(slug: string): void {
  const orders = getRestaurantOrders(slug);
  const activeOrders = orders.filter((o) => o.status !== 'complete' && o.status !== 'cancelled');
  saveRestaurantOrders(slug, activeOrders);
}

/**
 * Completely clear / wipe all orders from the kitchen queue for a restaurant.
 */
export function clearAllRestaurantOrders(slug: string): void {
  saveRestaurantOrders(slug, []);
}

/**
 * Remove all orders belonging to a specific table number.
 */
export function deleteTableOrders(slug: string, tableNumber: string): void {
  const cleanTable = tableNumber?.trim() || '';
  const orders = getRestaurantOrders(slug);
  const remaining = orders.filter((o) => (o.tableNumber?.trim() || 'Direct') !== (cleanTable || 'Direct'));
  saveRestaurantOrders(slug, remaining);
}

/**
 * Remove a single order item by its ID.
 */
export function deleteSingleOrder(slug: string, orderId: string): void {
  const orders = getRestaurantOrders(slug);
  const remaining = orders.filter((o) => o.orderId !== orderId);
  saveRestaurantOrders(slug, remaining);
}

/**
 * Subscribe to real-time order updates across all browser tabs and within the current tab.
 */
export function subscribeToOrders(
  slug: string,
  callback: (orders: CartItem[]) => void
): () => void {
  const cleanSlug = slug?.toLowerCase().trim() || 'unknown';
  const key = getOrderStorageKey(cleanSlug);
  const eventName = `${ORDER_EVENT_PREFIX}${cleanSlug}`;

  // In-tab listener
  const handleCustomEvent = (e: Event) => {
    const customEvent = e as CustomEvent<{ orders: CartItem[] }>;
    if (customEvent.detail?.orders) {
      callback(customEvent.detail.orders);
    } else {
      callback(getRestaurantOrders(cleanSlug));
    }
  };

  // Cross-tab storage event listener
  const handleStorageEvent = (e: StorageEvent) => {
    if (e.key === key) {
      callback(getRestaurantOrders(cleanSlug));
    }
  };

  window.addEventListener(eventName, handleCustomEvent);
  window.addEventListener('storage', handleStorageEvent);

  return () => {
    window.removeEventListener(eventName, handleCustomEvent);
    window.removeEventListener('storage', handleStorageEvent);
  };
}
