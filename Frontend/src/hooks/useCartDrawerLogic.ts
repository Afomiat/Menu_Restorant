import { useState, useEffect, useMemo } from 'react';
import type { CartItem } from '../types';

export interface UseCartDrawerLogicProps {
  cart: CartItem[];
  placedOrders: CartItem[];
  isOpen: boolean;
  tableNumber?: string | null;
  isTableVerified?: boolean;
  initialTab?: 'tray' | 'orders' | 'kitchen';
  ordersTabName?: 'orders' | 'kitchen';
  onPlaceOrder: (tableNum?: string) => void | Promise<any>;
  submitDelay?: number;
  inputElementId?: string;
}

export function useCartDrawerLogic({
  cart,
  placedOrders,
  isOpen,
  tableNumber,
  isTableVerified = false,
  initialTab = 'tray',
  ordersTabName = 'orders',
  onPlaceOrder,
  submitDelay = 600,
  inputElementId,
}: UseCartDrawerLogicProps) {
  const [activeTab, setActiveTab] = useState<'tray' | 'orders' | 'kitchen'>(initialTab);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [customerTable, setCustomerTable] = useState(tableNumber || '');
  const [tableError, setTableError] = useState('');

  // Sync initialTab when drawer opens
  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
      setTableError('');
    }
  }, [isOpen, initialTab]);

  // Sync tableNumber if provided (e.g. from QR / URL param)
  useEffect(() => {
    if (tableNumber) {
      setCustomerTable(tableNumber);
    }
  }, [tableNumber]);

  const totalCartCount = useMemo(
    () => cart.reduce((sum, item) => sum + item.quantity, 0),
    [cart]
  );

  const totalPlacedCount = useMemo(
    () =>
      placedOrders
        .filter((o) => o.status !== 'complete' && o.status !== 'cancelled')
        .reduce((sum, item) => sum + item.quantity, 0),
    [placedOrders]
  );

  const getItemTotalPrice = (item: CartItem): number => {
    const variantAdj =
      item.item.variants?.find((v) => v.name === item.variant)?.priceAdjustment || 0;
    return (item.item.price + variantAdj) * item.quantity;
  };

  const subtotal = useMemo(
    () => cart.reduce((sum, item) => sum + getItemTotalPrice(item), 0),
    [cart]
  );

  const placedTotal = useMemo(
    () => placedOrders.reduce((sum, item) => sum + getItemTotalPrice(item), 0),
    [placedOrders]
  );

  const handlePlaceOrderClick = async () => {
    if (isSubmitting) return;

    const trimmed = customerTable.trim();
    if (!trimmed) {
      setTableError('Please enter your table number to send order to kitchen');
      if (inputElementId) {
        const el = document.getElementById(inputElementId);
        if (el) el.focus();
      }
      return;
    }

    setTableError('');
    setIsSubmitting(true);

    try {
      if (submitDelay > 0) {
        await new Promise((resolve) => setTimeout(resolve, submitDelay));
      }
      await Promise.resolve(onPlaceOrder(trimmed));
    } catch {
      // Catch handled in useMenuCart
    } finally {
      setIsSubmitting(false);
      setActiveTab(ordersTabName);
    }
  };

  return {
    activeTab,
    setActiveTab,
    isSubmitting,
    customerTable,
    setCustomerTable,
    tableError,
    setTableError,
    totalCartCount,
    totalPlacedCount,
    subtotal,
    placedTotal,
    getItemTotalPrice,
    handlePlaceOrderClick,
    isTableVerified,
  };
}
