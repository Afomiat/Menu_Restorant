import { X, Plus, Minus, Trash2, CheckCircle2, ChefHat, ShoppingBag, RotateCcw } from 'lucide-react';
import type { CartItem } from '../../types';
import { formatPrice } from '../../utils/currency';
import { useCartDrawerLogic } from '../../hooks/useCartDrawerLogic';

interface ModernCartDrawerProps {
  cart: CartItem[];
  placedOrders: CartItem[];
  currency?: string;
  isOpen: boolean;
  onClose: () => void;
  onUpdateQuantity: (idx: number, change: number) => void;
  onRemoveItem: (idx: number) => void;
  onPlaceOrder: (tableNum?: string) => void | Promise<any>;
  onUndoOrder: (orderId: string) => void;
  orderError?: string | null;
  initialTab?: 'tray' | 'orders';
  tableNumber?: string | null;
  isTableVerified?: boolean;
}

export default function ModernCartDrawer({
  cart,
  placedOrders,
  currency = 'ETB',
  isOpen,
  onClose,
  onUpdateQuantity,
  onRemoveItem,
  onPlaceOrder,
  onUndoOrder,
  orderError,
  initialTab = 'tray',
  tableNumber,
  isTableVerified = false,
}: ModernCartDrawerProps) {
  const {
    activeTab,
    setActiveTab,
    isSubmitting,
    customerTable,
    totalCartCount,
    totalPlacedCount,
    subtotal,
    placedTotal,
    getItemTotalPrice,
    handlePlaceOrderClick,
  } = useCartDrawerLogic({
    cart,
    placedOrders,
    isOpen,
    tableNumber,
    isTableVerified,
    initialTab,
    ordersTabName: 'orders',
    onPlaceOrder,
    submitDelay: 600,
    inputElementId: 'modern-table-num-input',
  });

  if (!isOpen) return null;

  return (
    <div
      className="modern-modal-overlay"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="cart-sheet-title"
    >
      <div
        className="modern-modal-sheet"
        onClick={(e) => e.stopPropagation()}
        style={{ maxHeight: '88vh' }}
      >
        <div className="modern-modal-drag-handle" />

        {/* Drawer Top Header */}
        <div className="modern-cart-header">
          <div>
            <h2 id="cart-sheet-title" style={{ fontSize: '18px', fontWeight: 800, margin: 0 }}>
              {activeTab === 'tray' ? 'Your Order Tray' : 'Kitchen Status'}
            </h2>
            <div style={{ fontSize: '12px', color: 'var(--modern-text-muted)', marginTop: '2px' }}>
              {customerTable ? `Dine-In • Table ${customerTable}` : 'Dine-In Menu'}
            </div>
          </div>
          <button
            type="button"
            className="modern-header-btn"
            style={{ width: '34px', height: '34px' }}
            onClick={onClose}
            aria-label="Close cart"
          >
            <X size={16} />
          </button>
        </div>

        {/* Tabs: Tray vs Kitchen Orders */}
        <div className="modern-cart-tabs">
          <button
            type="button"
            className={`modern-cart-tab ${activeTab === 'tray' ? 'active' : ''}`}
            onClick={() => setActiveTab('tray')}
          >
            <ShoppingBag size={14} />
            Current Tray ({totalCartCount})
          </button>
          <button
            type="button"
            className={`modern-cart-tab ${activeTab === 'orders' ? 'active' : ''}`}
            onClick={() => setActiveTab('orders')}
          >
            <ChefHat size={14} />
            In Kitchen ({totalPlacedCount})
          </button>
        </div>

        {/* Tab 1: Current Tray Items */}
        {activeTab === 'tray' && (
          <>
            {cart.length === 0 ? (
              <div className="modern-empty-state" style={{ padding: '50px 20px' }}>
                <div className="modern-empty-icon">🛒</div>
                <div className="modern-empty-title">Your tray is empty</div>
                <p className="modern-empty-desc">
                  Browse the menu and add dishes you'd like to enjoy!
                </p>
              </div>
            ) : (
              <div className="modern-cart-items-list">
                {cart.map((cartItem, idx) => {
                  const itemPrice = getItemTotalPrice(cartItem);

                  return (
                    <div key={`${cartItem.item.id}-${cartItem.variant}-${idx}`} className="modern-cart-item-card">
                      <img
                        src={cartItem.item.imageUrl}
                        alt={cartItem.item.name}
                        className="modern-cart-item-img"
                      />
                      <div className="modern-cart-item-info">
                        <div className="modern-cart-item-name">{cartItem.item.name}</div>
                        {cartItem.variant && (
                          <div className="modern-cart-item-variant">{cartItem.variant}</div>
                        )}
                        <div className="modern-cart-item-price">{formatPrice(itemPrice)}</div>
                      </div>

                      <div className="modern-cart-item-stepper">
                        <button
                          type="button"
                          className="modern-cart-stepper-btn"
                          onClick={() => onUpdateQuantity(idx, -1)}
                          aria-label="Decrease quantity"
                        >
                          <Minus size={12} />
                        </button>
                        <span style={{ fontSize: '13px', fontWeight: 700, minWidth: '16px', textAlign: 'center' }}>
                          {cartItem.quantity}
                        </span>
                        <button
                          type="button"
                          className="modern-cart-stepper-btn"
                          onClick={() => onUpdateQuantity(idx, 1)}
                          aria-label="Increase quantity"
                        >
                          <Plus size={12} />
                        </button>
                      </div>

                      <button
                        type="button"
                        className="modern-cart-item-trash"
                        onClick={() => onRemoveItem(idx)}
                        aria-label="Remove item"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            {cart.length > 0 && (
              <div className="modern-cart-summary">
                <div className="modern-summary-row">
                  <span>Subtotal</span>
                  <span>{formatPrice(subtotal, currency)}</span>
                </div>
                <div className="modern-summary-row">
                  <span>Tax & Table Service</span>
                  <span>Included</span>
                </div>
                <div className="modern-summary-row total">
                  <span>Total Due</span>
                  <span style={{ color: 'var(--modern-primary)' }}>
                    {formatPrice(subtotal, currency)}
                  </span>
                </div>

                {/* Table Identification Status */}
                {isTableVerified && customerTable ? (
                  <div
                    style={{
                      marginTop: '14px',
                      marginBottom: '10px',
                      padding: '12px 14px',
                      borderRadius: '12px',
                      backgroundColor: 'rgba(16, 185, 129, 0.08)',
                      border: '1.5px solid rgba(16, 185, 129, 0.25)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      textAlign: 'left',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{ fontSize: '20px' }}>📍</span>
                      <div>
                        <div style={{ fontSize: '14px', fontWeight: 800, color: '#065f46', letterSpacing: '-0.2px' }}>
                          Table {customerTable}
                        </div>
                        <div style={{ fontSize: '11px', color: '#047857', fontWeight: 600 }}>
                          Verified Dine-In QR Session
                        </div>
                      </div>
                    </div>
                    <span
                      style={{
                        fontSize: '10px',
                        fontWeight: 800,
                        padding: '3px 8px',
                        borderRadius: '999px',
                        backgroundColor: '#10b981',
                        color: '#ffffff',
                        letterSpacing: '0.5px',
                        textTransform: 'uppercase',
                      }}
                    >
                      Active
                    </span>
                  </div>
                ) : (
                  <div
                    style={{
                      marginTop: '14px',
                      marginBottom: '10px',
                      padding: '12px 14px',
                      borderRadius: '12px',
                      backgroundColor: 'rgba(245, 158, 11, 0.08)',
                      border: '1.5px dashed rgba(245, 158, 11, 0.35)',
                      textAlign: 'center',
                    }}
                  >
                    <div style={{ fontSize: '13px', fontWeight: 700, color: '#92400e', marginBottom: '3px' }}>
                      📲 Dine-In QR Scan Required
                    </div>
                    <div style={{ fontSize: '11px', color: '#b45309', lineHeight: 1.4 }}>
                      Scan the QR code on your dining table to dispatch orders directly to the kitchen.
                    </div>
                  </div>
                )}

                {orderError && (
                  <div
                    style={{
                      backgroundColor: '#fee2e2',
                      border: '1px solid #fca5a5',
                      borderRadius: '10px',
                      padding: '10px 14px',
                      color: '#b91c1c',
                      fontSize: '12px',
                      fontWeight: 600,
                      marginBottom: '10px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                    }}
                  >
                    <span>⚠️ {orderError}</span>
                  </div>
                )}

                <button
                  type="button"
                  className="modern-modal-cta-btn"
                  style={{
                    width: '100%',
                    marginTop: '4px',
                    opacity: isSubmitting || !isTableVerified ? 0.75 : 1,
                    cursor: !isTableVerified ? 'not-allowed' : 'pointer',
                  }}
                  onClick={handlePlaceOrderClick}
                  disabled={isSubmitting || !isTableVerified}
                >
                  {isSubmitting ? (
                    'Sending to Kitchen...'
                  ) : !isTableVerified ? (
                    <span>Send to Kitchen</span>
                  ) : (
                    <>
                      <CheckCircle2 size={18} />
                      Send to Kitchen • {formatPrice(subtotal, currency)}
                    </>
                  )}
                </button>
              </div>
            )}
          </>
        )}

        {/* Tab 2: Kitchen Placed Orders */}
        {activeTab === 'orders' && (
          <div>
            {placedOrders.length === 0 ? (
              <div className="modern-empty-state" style={{ padding: '50px 20px' }}>
                <div className="modern-empty-icon">👨‍🍳</div>
                <div className="modern-empty-title">No orders in kitchen yet</div>
                <p className="modern-empty-desc">
                  Items you send to the kitchen will appear here in real-time.
                </p>
              </div>
            ) : (
              <>
                {/* 1. CURRENT TABLE BILL PINNED AT THE TOP */}
                <div className="modern-top-bill-card">
                  <div className="modern-top-bill-main">
                    <div className="modern-top-bill-left">
                      <span className="modern-top-bill-tag">Current Table Bill</span>
                      <div className="modern-top-bill-amount">
                        {formatPrice(placedTotal, currency)}
                      </div>
                    </div>

                    <div className="modern-top-bill-right">
                      <div className="modern-top-bill-status">
                        <span className="modern-pulse-dot" /> Kitchen Preparing
                      </div>
                      <div className="modern-top-bill-count">
                        <span>{totalPlacedCount} {totalPlacedCount === 1 ? 'item' : 'items'} ordered</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 2. Scrollable list of kitchen orders */}
                <div
                  className="modern-cart-items-list"
                  style={{
                    paddingTop: '12px',
                    paddingBottom: '20px',
                    maxHeight: '44vh',
                    overflowY: 'auto',
                  }}
                >
                  {placedOrders.map((order, idx) => {
                    const itemTotalPrice = getItemTotalPrice(order);
                    const status = order.status || 'not_started';

                    return (
                      <div
                        key={`${order.orderId || 'order'}-${order.item.id}-${idx}`}
                        className="modern-cart-item-card"
                        style={{
                          backgroundColor: status === 'ready' ? '#f0fdf4' : '#fffdfb',
                          borderColor: status === 'ready' ? '#bbf7d0' : '#ffe8de',
                          alignItems: 'flex-start',
                        }}
                      >
                        <img
                          src={order.item.imageUrl}
                          alt={order.item.name}
                          className="modern-cart-item-img"
                        />
                        <div className="modern-cart-item-info">
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px', flexWrap: 'wrap' }}>
                            {(!status || status === 'not_started') && (
                              <span
                                style={{
                                  backgroundColor: '#fef3c7',
                                  color: '#b45309',
                                  fontSize: '10px',
                                  fontWeight: 700,
                                  padding: '2px 8px',
                                  borderRadius: '999px',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '3px',
                                }}
                              >
                                Sent to Kitchen
                              </span>
                            )}

                            {order.tableNumber && (
                              <span style={{ fontSize: '11px', color: '#8c919a', fontWeight: 600 }}>
                                Table {order.tableNumber}
                              </span>
                            )}
                          </div>
                          <div className="modern-cart-item-name">
                            {order.quantity}x {order.item.name}
                          </div>
                          {order.variant && (
                            <div className="modern-cart-item-variant">{order.variant}</div>
                          )}
                          <div className="modern-cart-item-price" style={{ color: 'var(--modern-primary)' }}>
                            {formatPrice(itemTotalPrice, currency)}
                          </div>
                          <div style={{ fontSize: '11px', color: '#8c919a', marginTop: '2px' }}>
                            Order #{order.orderId?.slice(-4)}
                          </div>
                        </div>

                        {order.orderId && (
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px', flexShrink: 0 }}>
                            {(!status || status === 'not_started') ? (
                              <button
                                type="button"
                                onClick={() => onUndoOrder(order.orderId!)}
                                style={{
                                  background: '#fff',
                                  border: '1px solid #f87171',
                                  borderRadius: '999px',
                                  padding: '4px 12px',
                                  fontSize: '11px',
                                  fontWeight: 700,
                                  color: '#dc2626',
                                  cursor: 'pointer',
                                  whiteSpace: 'nowrap',
                                  transition: 'all 0.2s ease',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                }}
                              >
                                <RotateCcw size={11} /> Undo
                              </button>
                            ) : status === 'preparing' ? (
                              <span
                                style={{
                                  backgroundColor: 'var(--modern-primary)',
                                  color: '#ffffff',
                                  fontSize: '11px',
                                  fontWeight: 700,
                                  padding: '4px 10px',
                                  borderRadius: '999px',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  whiteSpace: 'nowrap',
                                  boxShadow: '0 2px 8px rgba(var(--modern-primary-rgb, 255, 90, 54), 0.3)',
                                }}
                              >
                                <ChefHat size={12} /> Cooking Started
                              </span>
                            ) : status === 'ready' ? (
                              <span
                                style={{
                                  backgroundColor: '#10b981',
                                  color: '#ffffff',
                                  fontSize: '11px',
                                  fontWeight: 700,
                                  padding: '4px 10px',
                                  borderRadius: '999px',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  whiteSpace: 'nowrap',
                                  boxShadow: '0 2px 8px rgba(16, 185, 129, 0.25)',
                                }}
                              >
                                <CheckCircle2 size={12} /> Ready for Table
                              </span>
                            ) : (
                              <span
                                style={{
                                  backgroundColor: '#64748b',
                                  color: '#ffffff',
                                  fontSize: '11px',
                                  fontWeight: 700,
                                  padding: '4px 10px',
                                  borderRadius: '999px',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                Delivered
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
