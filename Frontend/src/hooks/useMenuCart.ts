import { useState, useEffect, useMemo, useCallback } from 'react';
import type { MenuItem, CartItem } from '../types';
import {
  getRestaurantOrders,
  addRestaurantOrders,
  undoRestaurantOrder,
  subscribeToOrders,
} from '../services/orderService';

interface UseMenuCartOptions {
  restaurantSlug: string;
  items: MenuItem[];
  loading: boolean;
  tableNumber: string | null;
}

export default function useMenuCart({
  restaurantSlug,
  items,
  loading,
  tableNumber,
}: UseMenuCartOptions) {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartRehydrated, setCartRehydrated] = useState(false);
  const [placedOrders, setPlacedOrders] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);

  const slug = restaurantSlug?.toLowerCase().trim() ?? 'unknown';
  const cartKey = `aura_menu_cart_${slug}`;
  const myOrderIdsKey = `aura_menu_my_order_ids_${slug}`;

  // Track the current customer's order IDs in this browser session
  const [myOrderIds, setMyOrderIds] = useState<string[]>(() => {
    try {
      const stored = sessionStorage.getItem(myOrderIdsKey) || localStorage.getItem(myOrderIdsKey);
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
      const stored = localStorage.getItem(cartKey);
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
  }, [loading, items, cartKey, cartRehydrated]);

  // Sync placed orders with real-time orderService subscription
  const mapPlacedOrdersWithItems = useCallback(
    (rawOrders: CartItem[]) => {
      // Filter so this customer only sees orders placed in their session or for their table
      const relevantOrders = rawOrders.filter((o) => {
        if (o.orderId && myOrderIds.includes(o.orderId)) return true;
        if (tableNumber && o.tableNumber === tableNumber) return true;
        return false;
      });

      return relevantOrders.map((raw) => ({
        ...raw,
        item: items.find((m) => m.id === raw.item?.id) || raw.item,
      }));
    },
    [items, myOrderIds, tableNumber]
  );

  useEffect(() => {
    if (loading || items.length === 0) return;

    // Load initial orders
    const initialOrders = getRestaurantOrders(slug);
    setPlacedOrders(mapPlacedOrdersWithItems(initialOrders));

    // Subscribe to live kitchen dispatch changes (cross-tab & in-tab)
    const unsubscribe = subscribeToOrders(slug, (latestOrders) => {
      setPlacedOrders(mapPlacedOrdersWithItems(latestOrders));
    });

    return () => {
      unsubscribe();
    };
  }, [loading, items, slug, mapPlacedOrdersWithItems]);

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

  // Submit Tray to Kitchen
  const handlePlaceOrder = (customTableNumber?: string) => {
    if (cart.length === 0) return;

    const effectiveTable = customTableNumber || tableNumber || null;

    const newPlacedItems: CartItem[] = cart.map((item) => ({
      ...item,
      orderId: `ORD-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
      placedAt: Date.now(),
      status: 'not_started' as const,
      tableNumber: effectiveTable,
    }));

    const newIds = newPlacedItems.map((it) => it.orderId!).filter(Boolean);
    setMyOrderIds((prev) => [...prev, ...newIds]);

    addRestaurantOrders(slug, newPlacedItems);
    setCart([]);
  };

  // Undo an order ONLY if kitchen hasn't started cooking yet
  const handleUndoOrder = (orderId: string): boolean => {
    const undoneItem = undoRestaurantOrder(slug, orderId);
    if (undoneItem) {
      setMyOrderIds((prev) => prev.filter((id) => id !== orderId));
      const { orderId: _oid, placedAt: _pa, status: _st, ...rest } = undoneItem;
      setCart((currentCart) => [...currentCart, rest as CartItem]);
      return true;
    }
    return false;
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

  return {
    cart,
    placedOrders,
    isCartOpen,
    setIsCartOpen,
    handleAddToOrder,
    handleQuickAdd,
    handleQuickSubtract,
    handleUpdateQuantity,
    handleRemoveItem,
    handlePlaceOrder,
    handleUndoOrder,
    totalCartItems,
    totalPlacedItems,
    totalPrice,
    getItemCartQuantity,
  };
}
