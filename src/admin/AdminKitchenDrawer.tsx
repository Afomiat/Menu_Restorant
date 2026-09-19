import { useState, useMemo } from 'react';
import {
  X,
  ChefHat,
  Clock,
  CheckCircle2,
  Flame,
  Check,
  Ban,
  Trash2,
  Sparkles,
} from 'lucide-react';
import type { CartItem, MenuItem, OrderStatus, RestaurantMeta } from '../types';
import {
  updateOrderStatus,
  updateTableOrdersStatus,
  clearCompletedOrders,
} from '../services/orderService';
import { formatPrice } from '../utils/currency';

interface AdminKitchenDrawerProps {
  slug: string;
  meta: RestaurantMeta;
  orders: CartItem[];
  items?: MenuItem[];
  isOpen: boolean;
  onClose: () => void;
}

export default function AdminKitchenDrawer({
  slug,
  meta,
  orders = [],
  items = [],
  isOpen,
  onClose,
}: AdminKitchenDrawerProps) {
  const [filterTab, setFilterTab] = useState<'active' | 'new' | 'cooking' | 'ready' | 'history'>('active');

  const activeCurrency = meta?.currency || 'ETB';

  // Safely hydrate any order whose item object might be missing or partial
  const safeOrders: CartItem[] = useMemo(() => {
    return (orders || [])
      .filter(Boolean)
      .map((order, index) => {
        const existingItem = order?.item;
        const matchedItem = items?.find((m) => m?.id === (existingItem?.id || (order as any)?.itemId));
        const fallbackItem: MenuItem = {
          id: existingItem?.id || (order as any)?.itemId || `unknown-${index}`,
          name: existingItem?.name || (order as any)?.name || 'Dish Item',
          price: typeof existingItem?.price === 'number' ? existingItem.price : (order as any)?.price || 0,
          imageUrl: existingItem?.imageUrl || '/images/cat_food.jpg',
          description: existingItem?.description || '',
          tags: existingItem?.tags || [],
          available: existingItem?.available !== false,
          categoryId: existingItem?.categoryId || 'all',
          variants: existingItem?.variants || [],
        };

        return {
          ...order,
          orderId: order?.orderId || `ORD-${index}-${Date.now()}`,
          quantity: typeof order?.quantity === 'number' && order.quantity > 0 ? order.quantity : 1,
          variant: order?.variant || '',
          status: order?.status || 'not_started',
          placedAt: order?.placedAt || Date.now(),
          tableNumber: order?.tableNumber || null,
          item: matchedItem || existingItem || fallbackItem,
        };
      });
  }, [orders, items]);

  // Filtered orders
  const filteredOrders = useMemo(() => {
    switch (filterTab) {
      case 'new':
        return safeOrders.filter((o) => !o.status || o.status === 'not_started');
      case 'cooking':
        return safeOrders.filter((o) => o.status === 'preparing');
      case 'ready':
        return safeOrders.filter((o) => o.status === 'ready');
      case 'history':
        return safeOrders.filter((o) => o.status === 'complete' || o.status === 'cancelled');
      case 'active':
      default:
        return safeOrders.filter((o) => o.status !== 'complete' && o.status !== 'cancelled');
    }
  }, [safeOrders, filterTab]);

  // Group filtered orders by Table Number
  const ordersByTable = useMemo(() => {
    const map = new Map<string, CartItem[]>();
    filteredOrders.forEach((order) => {
      const tableKey = order.tableNumber ? `Table ${order.tableNumber}` : 'Direct Orders';
      const existing = map.get(tableKey) || [];
      map.set(tableKey, [...existing, order]);
    });
    return Array.from(map.entries());
  }, [filteredOrders]);

  if (!isOpen) return null;

  // Counts (computed when open)
  const newOrdersCount = safeOrders.filter((o) => !o.status || o.status === 'not_started').length;
  const cookingCount = safeOrders.filter((o) => o.status === 'preparing').length;
  const readyCount = safeOrders.filter((o) => o.status === 'ready').length;
  const activeOrdersCount = safeOrders.filter((o) => o.status !== 'complete' && o.status !== 'cancelled').length;

  const formatElapsed = (placedAt?: number) => {
    if (!placedAt) return 'Just now';
    const elapsedSec = Math.floor((Date.now() - placedAt) / 1000);
    if (elapsedSec < 60) return `${Math.max(1, elapsedSec)}s ago`;
    const elapsedMin = Math.floor(elapsedSec / 60);
    if (elapsedMin < 60) return `${elapsedMin}m ago`;
    const elapsedHr = Math.floor(elapsedMin / 60);
    return `${elapsedHr}h ago`;
  };

  const handleStatusChange = (orderId: string, status: OrderStatus) => {
    updateOrderStatus(slug, orderId, status);
  };

  const handleStartTableCooking = (tableKey: string) => {
    const rawTable = tableKey.replace('Table ', '').trim();
    updateTableOrdersStatus(slug, rawTable, 'preparing');
  };

  const handleMarkTableReady = (tableKey: string) => {
    const rawTable = tableKey.replace('Table ', '').trim();
    updateTableOrdersStatus(slug, rawTable, 'ready');
  };

  return (
    <div
      className="admin-modal-overlay"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="kitchen-drawer-title"
    >
      <div
        className="admin-modal-sheet"
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: '720px',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          padding: 0,
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '20px 24px 16px',
            borderBottom: '1px solid var(--admin-border, #edf0f5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: '#ffffff',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '42px',
                height: '42px',
                borderRadius: '12px',
                backgroundColor: 'var(--admin-primary-light, rgba(255, 90, 54, 0.12))',
                color: 'var(--admin-primary, #ff5a36)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <ChefHat size={22} />
            </div>
            <div>
              <h2 id="kitchen-drawer-title" style={{ fontSize: '20px', fontWeight: 800, margin: 0, color: '#121417' }}>
                Live Kitchen Dispatch
              </h2>
              <p style={{ fontSize: '13px', color: '#7b828d', margin: '2px 0 0 0' }}>
                Manage incoming customer table orders in real time.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="admin-modal-close"
            style={{ position: 'static' }}
            aria-label="Close kitchen drawer"
          >
            <X size={20} />
          </button>
        </div>

        {/* Filter Navigation Bar */}
        <div
          style={{
            padding: '12px 24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: '#f8f9fb',
            borderBottom: '1px solid var(--admin-border, #edf0f5)',
            gap: '8px',
            overflowX: 'auto',
          }}
        >
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'nowrap' }}>
            <button
              type="button"
              className={`admin-sec-pill-btn ${filterTab === 'active' ? 'active' : ''}`}
              style={filterTab === 'active' ? { borderColor: 'var(--admin-primary)', color: 'var(--admin-primary)' } : undefined}
              onClick={() => setFilterTab('active')}
            >
              Active Queue ({activeOrdersCount})
            </button>
            <button
              type="button"
              className={`admin-sec-pill-btn ${filterTab === 'new' ? 'active' : ''}`}
              style={filterTab === 'new' ? { borderColor: '#f59e0b', color: '#f59e0b' } : undefined}
              onClick={() => setFilterTab('new')}
            >
              New / Pending ({newOrdersCount})
            </button>
            <button
              type="button"
              className={`admin-sec-pill-btn ${filterTab === 'cooking' ? 'active' : ''}`}
              style={filterTab === 'cooking' ? { borderColor: 'var(--admin-primary)', color: 'var(--admin-primary)' } : undefined}
              onClick={() => setFilterTab('cooking')}
            >
              Cooking ({cookingCount})
            </button>
            <button
              type="button"
              className={`admin-sec-pill-btn ${filterTab === 'ready' ? 'active' : ''}`}
              style={filterTab === 'ready' ? { borderColor: '#10b981', color: '#10b981' } : undefined}
              onClick={() => setFilterTab('ready')}
            >
              Ready ({readyCount})
            </button>
            <button
              type="button"
              className={`admin-sec-pill-btn ${filterTab === 'history' ? 'active' : ''}`}
              onClick={() => setFilterTab('history')}
            >
              History
            </button>
          </div>

          {filterTab === 'history' && (
            <button
              type="button"
              onClick={() => clearCompletedOrders(slug)}
              style={{
                background: 'none',
                border: 'none',
                color: '#ef4444',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              <Trash2 size={14} /> Clear History
            </button>
          )}
        </div>

        {/* Content Body: Tickets List */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '20px 24px',
            backgroundColor: '#ffffff',
            display: 'flex',
            flexDirection: 'column',
            gap: '18px',
          }}
        >
          {ordersByTable.length === 0 ? (
            <div
              style={{
                padding: '60px 20px',
                textAlign: 'center',
                border: '1px dashed #e2e8f0',
                borderRadius: '16px',
              }}
            >
              <Sparkles size={36} color="#94a3b8" style={{ margin: '0 auto 12px' }} />
              <h3 style={{ fontSize: '17px', fontWeight: 800, margin: '0 0 6px', color: '#121417' }}>
                {filterTab === 'new'
                  ? 'No New Pending Orders'
                  : filterTab === 'cooking'
                  ? 'No Dishes Currently Cooking'
                  : filterTab === 'ready'
                  ? 'No Orders Waiting for Pickup'
                  : 'Kitchen Queue is Clear'}
              </h3>
              <p style={{ fontSize: '13px', color: '#7b828d', margin: 0 }}>
                When customers send food orders to the kitchen from the QR menu, they will appear here in real time.
              </p>
            </div>
          ) : (
            ordersByTable.map(([tableLabel, tableOrders]) => {
              const hasNew = tableOrders.some((o) => !o.status || o.status === 'not_started');
              const hasCooking = tableOrders.some((o) => o.status === 'preparing');

              return (
                <div
                  key={tableLabel}
                  style={{
                    border: '1px solid #e2e8f0',
                    borderRadius: '16px',
                    padding: '16px 18px',
                    backgroundColor: '#ffffff',
                    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)',
                  }}
                >
                  {/* Table Card Header */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginBottom: '14px',
                      paddingBottom: '10px',
                      borderBottom: '1px solid #f1f5f9',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span
                        style={{
                          backgroundColor: '#16181d',
                          color: '#ffffff',
                          fontSize: '13px',
                          fontWeight: 800,
                          padding: '4px 12px',
                          borderRadius: '999px',
                        }}
                      >
                        🪑 {tableLabel}
                      </span>
                      <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 600 }}>
                        {tableOrders.length} {tableOrders.length === 1 ? 'item' : 'items'}
                      </span>
                    </div>

                    {/* Batch actions for the entire table ticket */}
                    <div style={{ display: 'flex', gap: '6px' }}>
                      {hasNew && (
                        <button
                          type="button"
                          onClick={() => handleStartTableCooking(tableLabel)}
                          style={{
                            backgroundColor: 'var(--admin-primary, #ff5a36)',
                            color: '#ffffff',
                            border: 'none',
                            borderRadius: '8px',
                            padding: '6px 12px',
                            fontSize: '12px',
                            fontWeight: 700,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                          }}
                        >
                          <Flame size={14} /> Start All Cooking
                        </button>
                      )}
                      {hasCooking && (
                        <button
                          type="button"
                          onClick={() => handleMarkTableReady(tableLabel)}
                          style={{
                            backgroundColor: '#10b981',
                            color: '#ffffff',
                            border: 'none',
                            borderRadius: '8px',
                            padding: '6px 12px',
                            fontSize: '12px',
                            fontWeight: 700,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                          }}
                        >
                          <Check size={14} /> Mark All Ready
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Table Orders List */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {tableOrders.map((order) => {
                      const status = order.status || 'not_started';
                      const itemObj = order.item;
                      const variantAdj =
                        itemObj?.variants?.find((v) => v?.name === order.variant)?.priceAdjustment || 0;
                      const itemBasePrice = typeof itemObj?.price === 'number' ? itemObj.price : 0;
                      const itemTotal = (itemBasePrice + variantAdj) * (order.quantity || 1);
                      const itemImg = itemObj?.imageUrl || '/images/cat_food.jpg';
                      const itemName = itemObj?.name || 'Dish Item';

                      return (
                        <div
                          key={order.orderId}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '10px 12px',
                            borderRadius: '12px',
                            backgroundColor:
                              status === 'preparing'
                                ? 'rgba(255, 90, 54, 0.05)'
                                : status === 'ready'
                                ? '#f0fdf4'
                                : '#f8f9fb',
                            border:
                              status === 'preparing'
                                ? '1px solid rgba(255, 90, 54, 0.25)'
                                : status === 'ready'
                                ? '1px solid #bbf7d0'
                                : '1px solid #edf0f5',
                            gap: '12px',
                          }}
                        >
                          {/* Dish Image + Title */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, minWidth: 0 }}>
                            <img
                              src={itemImg}
                              alt={itemName}
                              style={{
                                width: '46px',
                                height: '46px',
                                borderRadius: '10px',
                                objectFit: 'cover',
                                flexShrink: 0,
                              }}
                              onError={(e) => {
                                (e.target as HTMLImageElement).src = '/images/cat_food.jpg';
                              }}
                            />
                            <div style={{ minWidth: 0 }}>
                              <div style={{ fontSize: '14px', fontWeight: 800, color: '#121417' }}>
                                <span style={{ color: 'var(--admin-primary, #ff5a36)' }}>{order.quantity}x</span>{' '}
                                {itemName}
                              </div>
                              {order.variant && (
                                <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 600 }}>
                                  Variant: {order.variant}
                                </div>
                              )}
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '2px' }}>
                                <span style={{ fontSize: '12px', fontWeight: 700, color: '#121417' }}>
                                  {formatPrice(itemTotal, activeCurrency)}
                                </span>
                                <span style={{ fontSize: '11px', color: '#94a3b8' }}>
                                  <Clock size={10} style={{ display: 'inline', marginRight: '2px' }} />
                                  {formatElapsed(order.placedAt)}
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Individual Order Actions */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                            {status === 'not_started' && (
                              <button
                                type="button"
                                onClick={() => handleStatusChange(order.orderId!, 'preparing')}
                                style={{
                                  backgroundColor: 'var(--admin-primary, #ff5a36)',
                                  color: '#ffffff',
                                  border: 'none',
                                  borderRadius: '8px',
                                  padding: '6px 12px',
                                  fontSize: '12px',
                                  fontWeight: 700,
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                }}
                                title="Start preparing this dish. This will lock the customer from undoing the order."
                              >
                                <Flame size={13} /> Start Cooking
                              </button>
                            )}

                            {status === 'preparing' && (
                              <button
                                type="button"
                                onClick={() => handleStatusChange(order.orderId!, 'ready')}
                                style={{
                                  backgroundColor: '#10b981',
                                  color: '#ffffff',
                                  border: 'none',
                                  borderRadius: '8px',
                                  padding: '6px 12px',
                                  fontSize: '12px',
                                  fontWeight: 700,
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                }}
                              >
                                <Check size={13} /> Mark Ready
                              </button>
                            )}

                            {status === 'ready' && (
                              <button
                                type="button"
                                onClick={() => handleStatusChange(order.orderId!, 'complete')}
                                style={{
                                  backgroundColor: '#16181d',
                                  color: '#ffffff',
                                  border: 'none',
                                  borderRadius: '8px',
                                  padding: '6px 12px',
                                  fontSize: '12px',
                                  fontWeight: 700,
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                }}
                              >
                                <CheckCircle2 size={13} /> Served
                              </button>
                            )}

                            {status !== 'complete' && status !== 'cancelled' && (
                              <button
                                type="button"
                                onClick={() => handleStatusChange(order.orderId!, 'cancelled')}
                                style={{
                                  background: 'none',
                                  border: '1px solid #e2e8f0',
                                  color: '#94a3b8',
                                  borderRadius: '8px',
                                  padding: '6px',
                                  cursor: 'pointer',
                                }}
                                title="Cancel / Reject Order"
                              >
                                <Ban size={14} />
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
