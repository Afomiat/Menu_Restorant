import { useState, useEffect, useMemo, useCallback } from 'react';
import type { MenuItem, CartItem, OrderStatus } from '../types';
import { 
  getCustomerOrders, 
  addCustomerOrders, 
  removeCustomerOrder, 
  clearCustomerOrders, 
  placeLiveOrder,
  undoLiveOrder,
  fetchLiveOrderStatus,
} from '../services/orderService';

function mapBackendStatusToFrontend(backendStatus?: string): OrderStatus {
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

interface UseMenuCartOptions {
  restaurantSlug: string;
  items: MenuItem[];
  loading: boolean;
  tableNumber: string | null;
  tableToken?: string | null;
  isTableVerified?: boolean;
}

export interface ActiveUndoState {
  orderId: string;
  graceEndsAt: string | number;
  seconds?: number;
}

export default function useMenuCart({
  restaurantSlug,
  items,
  loading,
  tableNumber,
  tableToken,
}: UseMenuCartOptions) {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartRehydrated, setCartRehydrated] = useState(false);
  const [placedOrders, setPlacedOrders] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [activeUndoOrder, setActiveUndoOrder] = useState<ActiveUndoState | null>(null);
  const [orderError, setOrderError] = useState<string | null>(null);
  const [isPlacingOrder, setIsPlacingOrder] = useState(false);


  const slug = restaurantSlug?.toLowerCase().trim() ?? 'unknown';
  const cartKey = `azai:cart:${slug}`;
  const legacyCartKey = `aura_menu_cart_${slug}`;
  const myOrderIdsKey = `azai:my_orders:${slug}`;
  const legacyMyOrderIdsKey = `aura_menu_my_order_ids_${slug}`;
  const tableSessionKey = `azai:table_session:${slug}`;

  // Automatically retrieve table token & table number from props, URL query, or persistent storage (paired together)
  const resolvedTableSession = useMemo<{ tableNumber: string; tableToken: string }>(() => {
    if (typeof window === 'undefined') {
      return { tableNumber: tableNumber || '', tableToken: tableToken || '' };
    }

    const sp = new URLSearchParams(window.location.search);
    const queryTable = sp.get('table') || tableNumber || '';
    const queryToken = sp.get('token') || tableToken || '';

    // If both queryTable and queryToken are present in URL, store as authoritative
    if (queryTable && queryToken) {
      const session = { tableNumber: queryTable, tableToken: queryToken };
      try {
        sessionStorage.setItem(tableSessionKey, JSON.stringify(session));
        localStorage.setItem(tableSessionKey, JSON.stringify(session));
      } catch {}

      // Sanitize URL bar: strip the sensitive raw HMAC token so it cannot be leaked via bookmarks/sharing
      if (typeof window !== 'undefined' && window.history?.replaceState) {
        try {
          const url = new URL(window.location.href);
          url.searchParams.delete('token');
          window.history.replaceState({}, document.title, url.pathname + url.search);
        } catch {}
      }

      return session;
    }

    // If queryTable is present without token, verify if we already stored token for THIS table
    if (queryTable) {
      try {
        const stored = sessionStorage.getItem(tableSessionKey) || localStorage.getItem(tableSessionKey);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (parsed.tableNumber === queryTable && parsed.tableToken) {
            return parsed;
          }
        }
      } catch {}
      return { tableNumber: queryTable, tableToken: '' };
    }

    // No table in URL: read from persistent storage
    try {
      const stored = sessionStorage.getItem(tableSessionKey) || localStorage.getItem(tableSessionKey);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch {}

    return { tableNumber: '', tableToken: '' };
  }, [slug, tableNumber, tableToken, tableSessionKey]);

  const resolvedTable = resolvedTableSession.tableNumber || null;
  const resolvedToken = resolvedTableSession.tableToken || '';
  const isTableVerified = Boolean(resolvedTable && resolvedToken);

  // Track the current customer's order IDs in this browser session
  const [myOrderIds, setMyOrderIds] = useState<string[]>(() => {
    try {
      const stored =
        sessionStorage.getItem(myOrderIdsKey) ||
        localStorage.getItem(myOrderIdsKey) ||
        sessionStorage.getItem(legacyMyOrderIdsKey) ||
        localStorage.getItem(legacyMyOrderIdsKey);
      if (stored) {
        const parsed = JSON.parse(stored);
        return Array.isArray(parsed) ? parsed : [];
      }
    } catch {}
    return [];
  });

  useEffect(() => {
    try {
      sessionStorage.setItem(myOrderIdsKey, JSON.stringify(myOrderIds));
      localStorage.setItem(myOrderIdsKey, JSON.stringify(myOrderIds));
    } catch {}
  }, [myOrderIds, myOrderIdsKey]);

  // Rehydrate cart from localStorage once items are loaded
  useEffect(() => {
    if (loading || items.length === 0 || cartRehydrated) return;

    try {
      const stored = localStorage.getItem(cartKey) || localStorage.getItem(legacyCartKey);
      if (stored) {
        const parsed = JSON.parse(stored);
        setCart(
          parsed.map((cartItem: any) => ({
            ...cartItem,
            item: items.find((m) => m.id === cartItem.item?.id) || cartItem.item,
          }))
        );
      }
    } catch {
      // Corrupted localStorage — start fresh
    }
    setCartRehydrated(true);
  }, [loading, items, cartKey, legacyCartKey, cartRehydrated]);

  // Sync placed orders with real-time orderService subscription
  const mapPlacedOrdersWithItems = useCallback(
    (rawOrders: CartItem[]) => {
      const now = Date.now();
      const TWO_HOURS_MS = 2 * 60 * 60 * 1000;

      // Filter so this customer only sees:
      // 1. Orders placed in this customer's active browser session (myOrderIds)
      // 2. Or if tableNumber is set, orders placed for this table within the last 2 hours
      const relevantOrders = rawOrders.filter((o) => {
        if (o.orderId && myOrderIds.includes(o.orderId)) return true;
        if (tableNumber && o.tableNumber === tableNumber) {
          return o.placedAt ? (now - o.placedAt < TWO_HOURS_MS) : false;
        }
        return false;
      });

      // Deduplicate by unique orderId + item.id + variant
      const seen = new Set<string>();
      const deduped: CartItem[] = [];
      for (const order of relevantOrders) {
        const key = `${order.orderId || 'ord'}-${order.item.id}-${order.variant || ''}`;
        if (!seen.has(key)) {
          seen.add(key);
          deduped.push(order);
        }
      }

      return deduped.map((raw) => ({
        ...raw,
        status: mapBackendStatusToFrontend(raw.status),
        item: items.find((m) => m.id === raw.item?.id) || raw.item,
      }));
    },
    [items, myOrderIds, tableNumber]
  );

  useEffect(() => {
    if (loading || items.length === 0) return;

    // Load customer's own active/recent orders (device & session isolated)
    const initialOrders = getCustomerOrders(slug);
    setPlacedOrders(mapPlacedOrdersWithItems(initialOrders));
  }, [loading, items, slug, mapPlacedOrdersWithItems]);

  // Poll customer's active live order statuses every 2 seconds so kitchen updates reflect swiftly
  useEffect(() => {
    if (myOrderIds.length === 0) return;

    let isMounted = true;

    const pollActiveOrders = async () => {
      const activeBackendOrderIds = placedOrders
        .filter((o) => o.orderId && o.orderId.length > 20 && !o.orderId.startsWith('ORD-'))
        .filter((o) => o.status !== 'complete' && o.status !== 'cancelled')
        .map((o) => o.orderId!);

      if (activeBackendOrderIds.length === 0) return;

      try {
        // Query all active live orders in parallel
        const results = await Promise.all(
          activeBackendOrderIds.map(async (orderId) => {
            try {
              const liveOrder = await fetchLiveOrderStatus(slug, orderId);
              return { orderId, liveOrder };
            } catch {
              return { orderId, liveOrder: null };
            }
          })
        );

        if (!isMounted) return;

        setPlacedOrders((prev) => {
          let hasChanges = false;
          const next = prev.map((o) => {
            const found = results.find((r) => r.orderId === o.orderId);
            if (found && found.liveOrder && found.liveOrder.status) {
              const mapped = mapBackendStatusToFrontend(found.liveOrder.status);
              if (mapped !== o.status) {
                hasChanges = true;
                return { ...o, status: mapped };
              }
            }
            return o;
          });
          return hasChanges ? next : prev;
        });
      } catch {
        // Silent catch on intermittent network poll error
      }
    };

    // Immediate check on mount or active change
    pollActiveOrders();

    const interval = setInterval(pollActiveOrders, 2000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [myOrderIds, placedOrders, slug]);

  // Sync Cart to localStorage
  useEffect(() => {
    if (cartRehydrated) {
      localStorage.setItem(cartKey, JSON.stringify(cart));
    }
  }, [cart, cartKey, cartRehydrated]);

  // Add Item to Order Tray
  const handleAddToOrder = (item: MenuItem, qty: number = 1, variant: string = '') => {
    const effectiveVariant =
      variant || (item.variants && item.variants.length > 0 ? item.variants[0].name : '');

    setCart((prev) => {
      let existingIdx = prev.findIndex(
        (ci) => ci.item.id === item.id && ci.variant === effectiveVariant
      );
      if (existingIdx === -1 && !variant) {
        existingIdx = prev.findIndex((ci) => ci.item.id === item.id);
      }
      if (existingIdx > -1) {
        const next = [...prev];
        next[existingIdx].quantity += qty;
        return next;
      }
      return [...prev, { item, quantity: qty, variant: effectiveVariant }];
    });
  };

  // Update Item Quantity in Tray
  const handleUpdateQuantity = (idx: number, change: number) => {
    setCart((prev) => {
      const next = [...prev];
      const nextQty = next[idx].quantity + change;
      if (nextQty <= 0) {
        next.splice(idx, 1);
        return next;
      }
      next[idx].quantity = nextQty;
      return next;
    });
  };

  // Convenience quick +/- handlers
  const handleQuickAdd = (item: MenuItem) => {
    const defaultVariant = item.variants?.[0]?.name || '';
    handleAddToOrder(item, 1, defaultVariant);
  };

  const handleQuickSubtract = (itemId: string) => {
    setCart((prev) => {
      const idx = prev.findIndex((ci) => ci.item.id === itemId);
      if (idx === -1) return prev;
      const next = [...prev];
      if (next[idx].quantity <= 1) {
        next.splice(idx, 1);
      } else {
        next[idx] = { ...next[idx], quantity: next[idx].quantity - 1 };
      }
      return next;
    });
  };

  // Remove Item from Tray
  const handleRemoveItem = (idx: number) => {
    setCart((prev) => prev.filter((_, i) => i !== idx));
  };

  // Submit Tray to Kitchen (Backend API with automatic offline fallback)
  const handlePlaceOrder = async (customTableNumber?: string) => {
    const effectiveTable = customTableNumber || resolvedTable || '1';
    const effectiveToken = (effectiveTable === resolvedTable) ? resolvedToken : '';
    setIsPlacingOrder(true);
    setOrderError(null);

    // 1. Try Live Backend Order first (for database tenants like Azai Burger)
    try {
      const orderPromises = cart.map((c) =>
        placeLiveOrder(slug, {
          tableNumber: effectiveTable,
          tableToken: effectiveToken,
          items: [
            {
              menu_item_id: c.item.id,
              item_name: c.item.name,
              unit_price: c.item.price,
              quantity: c.quantity,
              notes: c.notes || '',
              modifiers: [],
            },
          ],
        })
      );

      const results = await Promise.all(orderPromises);
      const successfulOrders = results.filter((r) => r && r.order);

      if (successfulOrders.length > 0) {
        const newPlacedItems: CartItem[] = [];
        const newOrderIds: string[] = [];

        successfulOrders.forEach((res, i) => {
          const originalCartItem = cart[i];
          const it = res.order.items?.[0];
          newOrderIds.push(res.order.id);

          newPlacedItems.push({
            orderId: res.order.id,
            placedAt: new Date(res.order.created_at).getTime(),
            status: mapBackendStatusToFrontend(res.order.status),
            tableNumber: res.order.table_number,
            quantity: it?.quantity || originalCartItem?.quantity || 1,
            variant: originalCartItem?.variant || '',
            notes: it?.notes || originalCartItem?.notes || '',
            item: originalCartItem?.item || {
              id: it?.menu_item_id || res.order.id,
              name: it?.item_name || 'Dish Item',
              price: it?.unit_price || 0,
              imageUrl: '/images/default_food.png',
              description: '',
              tags: [],
              available: true,
              categoryId: 'all',
            },
          });
        });

        const latest = successfulOrders[successfulOrders.length - 1];
        setActiveUndoOrder({
          orderId: latest.order.id,
          graceEndsAt: latest.grace_period_ends_at,
          seconds: latest.grace_period_seconds,
        });

        setMyOrderIds((prev) => [...prev, ...newOrderIds]);
        setPlacedOrders((prev) => [...newPlacedItems, ...prev]);
        addCustomerOrders(slug, newPlacedItems);
        setCart([]);
        setIsPlacingOrder(false);
        return { success: true, orders: successfulOrders.map((s) => s.order) };
      } else {
        throw new Error('No orders were confirmed by the kitchen server.');
      }
    } catch (err: any) {
      let errMsg = err?.message || 'Failed to send order to kitchen. Please try again.';
      if (typeof errMsg === 'string' && (errMsg.toLowerCase().includes('table token') || errMsg.toLowerCase().includes('qr code'))) {
        errMsg = 'Dining Table Verification Required: Please scan the official QR code on your table to send orders to the kitchen.';
      }
      console.error('[useMenuCart] Live backend order failed:', errMsg);
      setOrderError(errMsg);
      setIsPlacingOrder(false);
      return { success: false, error: errMsg };
    }
  };

  // Undo an order within 60-second grace period
  const handleUndoOrder = async (orderId: string): Promise<boolean> => {
    try {
      await undoLiveOrder(slug, orderId);
    } catch (err) {
      console.warn('Live backend undo error:', err);
    }

    setActiveUndoOrder(null);
    setMyOrderIds((prev) => prev.filter((id) => id !== orderId));
    removeCustomerOrder(slug, orderId);

    const undoneItems = placedOrders.filter((o) => o.orderId === orderId);
    setPlacedOrders((prev) => prev.filter((o) => o.orderId !== orderId));

    if (undoneItems.length > 0) {
      setCart((currentCart) => [
        ...currentCart,
        ...undoneItems.map((it) => ({
          item: it.item,
          quantity: it.quantity,
          variant: it.variant,
          notes: it.notes,
        })),
      ]);
    }
    return true;
  };

  const totalCartItems = useMemo(
    () => cart.reduce((sum, item) => sum + item.quantity, 0),
    [cart]
  );

  const totalPlacedItems = useMemo(
    () =>
      placedOrders
        .filter((o) => o.status !== 'complete' && o.status !== 'cancelled')
        .reduce((sum, item) => sum + item.quantity, 0),
    [placedOrders]
  );

  const totalPrice = useMemo(() => {
    return cart.reduce((sum, current) => {
      const variantAdjustment =
        current.item.variants?.find((v) => v.name === current.variant)?.priceAdjustment || 0;
      return sum + (current.item.price + variantAdjustment) * current.quantity;
    }, 0);
  }, [cart]);

  const getItemCartQuantity = (itemId: string): number => {
    return cart
      .filter((ci) => ci.item.id === itemId)
      .reduce((sum, ci) => sum + ci.quantity, 0);
  };

const handleClearOrders = () => {
  setMyOrderIds([]);
  setPlacedOrders([]);
  clearCustomerOrders(slug);
  try {
    sessionStorage.removeItem(myOrderIdsKey);
  } catch (e) {
    console.error(e);
  }
};
  return {
    cart,
    placedOrders,
    isCartOpen,
    setIsCartOpen,
    activeUndoOrder,
    setActiveUndoOrder,
    orderError,
    isPlacingOrder,
    handleAddToOrder,
    handleQuickAdd,
    handleQuickSubtract,
    handleUpdateQuantity,
    handleRemoveItem,
    handlePlaceOrder,
    handleUndoOrder,
    handleClearOrders,
    totalCartItems,
    totalPlacedItems,
    totalPrice,
    getItemCartQuantity,
    resolvedTable,
    isTableVerified,
    tableToken: resolvedToken,
  };
}

