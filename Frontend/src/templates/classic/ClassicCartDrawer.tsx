import { ShoppingBag, X, Plus, Minus, Trash2, CheckCircle2, ChefHat, RotateCcw } from 'lucide-react';
import type { CartItem } from '../../types';
import { formatPrice } from '../../utils/currency';
import { useCartDrawerLogic } from '../../hooks/useCartDrawerLogic';

interface ClassicCartDrawerProps {
  cart: CartItem[];
  tableNumber: string | null;
  currency?: string;
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  onUpdateQuantity: (idx: number, change: number) => void;
  onRemoveItem: (idx: number) => void;
  onPlaceOrder: (customTableNumber?: string) => void;
  placedOrders: CartItem[];
  onUndoOrder: (orderId: string) => void;
  orderError?: string | null;
  isTableVerified?: boolean;
}

export default function ClassicCartDrawer({
  cart,
  tableNumber,
  currency = 'ETB',
  isOpen,
  setIsOpen,
  onUpdateQuantity,
  onRemoveItem,
  onPlaceOrder,
  placedOrders,
  onUndoOrder,
  orderError,
  isTableVerified = false,
}: ClassicCartDrawerProps) {
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
    initialTab: 'tray',
    ordersTabName: 'kitchen',
    onPlaceOrder,
    submitDelay: 800,
  });

  const handleClose = () => {
    if (!isSubmitting) {
      setIsOpen(false);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Dark Overlay */}
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.7)',
          backdropFilter: 'blur(6px)',
          WebkitBackdropFilter: 'blur(6px)',
          zIndex: 90,
          animation: 'fadeIn 0.25s ease forwards',
        }}
        onClick={handleClose}
      />

      {/* Drawer Container (Mobile-friendly bottom/side sheet) */}
      <div
        className={`cart-side-drawer ${isOpen ? 'open' : ''}`}
        onClick={(e) => e.stopPropagation()}
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          bottom: 0,
          width: '100%',
          maxWidth: '460px',
          backgroundColor: '#15161c',
          borderLeft: '1px solid rgba(201, 168, 118, 0.2)',
          zIndex: 100,
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '-10px 0 40px rgba(0, 0, 0, 0.9)',
          animation: 'drawerSlideIn 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        }}
      >
        <style
          dangerouslySetInnerHTML={{
            __html: `
              @keyframes drawerSlideIn {
                from { transform: translateX(100%); }
                to { transform: translateX(0); }
              }
            `,
          }}
        />

        {/* Top Handle on Mobile */}
        <div
          style={{
            width: '36px',
            height: '4px',
            borderRadius: '2px',
            backgroundColor: 'rgba(255, 255, 255, 0.2)',
            margin: '8px auto 0 auto',
          }}
        />

        {/* 1. Header (Matches Screenshot 1 & 3 in Dark Theme) */}
        <div
          style={{
            padding: '14px 22px 14px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div>
            <h2
              style={{
                fontFamily: 'var(--font-sans)',
                fontSize: '22px',
                fontWeight: 700,
                color: 'var(--text-primary)',
                margin: 0,
                letterSpacing: '-0.3px',
              }}
            >
              {activeTab === 'tray' ? 'Your Order Tray' : 'Kitchen Status'}
            </h2>
            <p
              style={{
                fontFamily: 'var(--font-sans)',
                fontSize: '13px',
                color: 'var(--text-secondary)',
                margin: '2px 0 0 0',
                fontWeight: 500,
              }}
            >
              Dine-In • Table {customerTable ? customerTable : 'Not set'}
            </p>
          </div>

          <button
            type="button"
            onClick={handleClose}
            disabled={isSubmitting}
            aria-label="Close"
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '50%',
              backgroundColor: 'rgba(255, 255, 255, 0.06)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              color: 'var(--text-primary)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'background-color 0.2s',
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* 2. Pill Tabs (Matches Screenshot 1 & 3: "Current Tray (X)" and "In Kitchen (Y)") */}
        <div
          style={{
            padding: '0 20px 14px',
            display: 'flex',
            gap: '10px',
            borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
          }}
        >
          <button
            type="button"
            onClick={() => setActiveTab('tray')}
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              padding: '10px 14px',
              borderRadius: '999px',
              border: activeTab === 'tray' ? '1px solid var(--accent-gold)' : '1px solid rgba(255, 255, 255, 0.06)',
              backgroundColor: activeTab === 'tray' ? 'rgba(201, 168, 118, 0.15)' : 'rgba(255, 255, 255, 0.03)',
              color: activeTab === 'tray' ? 'var(--accent-gold)' : 'var(--text-secondary)',
              fontFamily: 'var(--font-sans)',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.2s ease',
            }}
          >
            <ShoppingBag size={15} />
            <span>Current Tray ({totalCartCount})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('kitchen')}
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              padding: '10px 14px',
              borderRadius: '999px',
              border: activeTab === 'kitchen' ? '1px solid var(--accent-gold)' : '1px solid rgba(255, 255, 255, 0.06)',
              backgroundColor: activeTab === 'kitchen' ? 'rgba(201, 168, 118, 0.15)' : 'rgba(255, 255, 255, 0.03)',
              color: activeTab === 'kitchen' ? 'var(--accent-gold)' : 'var(--text-secondary)',
              fontFamily: 'var(--font-sans)',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.2s ease',
            }}
          >
            <ChefHat size={15} />
            <span>In Kitchen ({totalPlacedCount})</span>
          </button>
        </div>

        {/* ── TAB 1: Current Order Tray (Matches Screenshot 3) ── */}
        {activeTab === 'tray' && (
          <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
            {cart.length === 0 ? (
              /* Empty Tray View */
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flex: 1,
                  padding: '40px 24px',
                  textAlign: 'center',
                  gap: '12px',
                }}
              >
                <div
                  style={{
                    width: '60px',
                    height: '60px',
                    borderRadius: '50%',
                    backgroundColor: 'rgba(201, 168, 118, 0.08)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--accent-gold)',
                  }}
                >
                  <ShoppingBag size={28} />
                </div>
                <h4 style={{ fontFamily: 'var(--font-sans)', fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                  Your Tray is Empty
                </h4>
                <p style={{ fontFamily: 'var(--font-sans)', fontSize: '13px', color: 'var(--text-secondary)', maxWidth: '280px', margin: 0 }}>
                  Add your favorite dishes from the menu to build your table order.
                </p>
                <button
                  onClick={handleClose}
                  style={{
                    marginTop: '8px',
                    backgroundColor: 'var(--accent-gold)',
                    color: '#121316',
                    border: 'none',
                    padding: '10px 24px',
                    borderRadius: '999px',
                    fontSize: '13px',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  Browse Menu
                </button>
              </div>
            ) : (
              /* Populated Tray Items List */
              <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
                <div
                  style={{
                    flex: 1,
                    overflowY: 'auto',
                    padding: '16px 20px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px',
                  }}
                >
                  {cart.map((cartItem, idx) => {
                    const itemUnitTotal = getItemTotalPrice(cartItem);

                    return (
                      <div
                        key={`${cartItem.item.id}-${cartItem.variant}-${idx}`}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '14px',
                          padding: '14px',
                          backgroundColor: '#1b1d26',
                          border: '1px solid rgba(255, 255, 255, 0.06)',
                          borderRadius: '16px',
                        }}
                      >
                        {/* Square Food Photo */}
                        <img
                          src={cartItem.item.imageUrl}
                          alt={cartItem.item.name}
                          style={{
                            width: '58px',
                            height: '58px',
                            borderRadius: '12px',
                            objectFit: 'cover',
                            border: '1px solid rgba(201, 168, 118, 0.15)',
                            flexShrink: 0,
                          }}
                        />

                        {/* Title & Price */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <h4
                            style={{
                              fontFamily: 'var(--font-sans)',
                              fontSize: '15px',
                              fontWeight: 700,
                              color: 'var(--text-primary)',
                              margin: 0,
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                            }}
                          >
                            {cartItem.item.name}
                          </h4>
                          {cartItem.variant && (
                            <span style={{ fontSize: '11px', color: 'var(--accent-gold)', display: 'block', marginTop: '1px' }}>
                              {cartItem.variant}
                            </span>
                          )}
                          <span
                            style={{
                              fontFamily: 'var(--font-sans)',
                              fontSize: '14px',
                              fontWeight: 700,
                              color: 'var(--accent-gold)',
                              display: 'block',
                              marginTop: '2px',
                            }}
                          >
                            {formatPrice(itemUnitTotal, currency)}
                          </span>
                        </div>

                        {/* Stepper Pill & Delete Icon (Matches Screenshot 3) */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              backgroundColor: 'rgba(255, 255, 255, 0.06)',
                              border: '1px solid rgba(255, 255, 255, 0.08)',
                              borderRadius: '20px',
                              padding: '2px 4px',
                              gap: '4px',
                            }}
                          >
                            <button
                              type="button"
                              onClick={() => onUpdateQuantity(idx, -1)}
                              aria-label="Decrease"
                              style={{
                                background: 'none',
                                border: 'none',
                                color: 'var(--text-primary)',
                                width: '26px',
                                height: '26px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: 'pointer',
                              }}
                            >
                              <Minus size={13} />
                            </button>
                            <span
                              style={{
                                fontFamily: 'var(--font-sans)',
                                fontSize: '13px',
                                fontWeight: 700,
                                minWidth: '18px',
                                textAlign: 'center',
                                color: 'var(--text-primary)',
                              }}
                            >
                              {cartItem.quantity}
                            </span>
                            <button
                              type="button"
                              onClick={() => onUpdateQuantity(idx, 1)}
                              aria-label="Increase"
                              style={{
                                background: 'none',
                                border: 'none',
                                color: 'var(--text-primary)',
                                width: '26px',
                                height: '26px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: 'pointer',
                              }}
                            >
                              <Plus size={13} />
                            </button>
                          </div>

                          <button
                            type="button"
                            onClick={() => onRemoveItem(idx)}
                            aria-label="Remove"
                            style={{
                              background: 'none',
                              border: 'none',
                              color: '#ff6666',
                              opacity: 0.8,
                              cursor: 'pointer',
                              padding: '4px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* 3. Summary & Confirm Action (Matches Screenshot 3) */}
                <div
                  style={{
                    padding: '18px 20px',
                    paddingBottom: 'calc(18px + env(safe-area-inset-bottom, 0px))',
                    borderTop: '1px solid rgba(255, 255, 255, 0.08)',
                    backgroundColor: '#111216',
                  }}
                >
                  {/* Subtotal & Tax */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '14px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: 'var(--text-secondary)' }}>
                      <span>Subtotal</span>
                      <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{formatPrice(subtotal, currency)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: 'var(--text-secondary)' }}>
                      <span>Tax & Table Service</span>
                      <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>Included</span>
                    </div>

                    {/* Total Due with dashed border */}
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        fontSize: '18px',
                        fontWeight: 700,
                        paddingTop: '8px',
                        borderTop: '1px dashed rgba(255, 255, 255, 0.1)',
                      }}
                    >
                      <span style={{ color: 'var(--text-primary)' }}>Total Due</span>
                      <span style={{ color: 'var(--accent-gold)' }}>{formatPrice(subtotal, currency)}</span>
                    </div>
                  </div>

                  {/* Table Identification Status */}
                  {isTableVerified && customerTable ? (
                    <div
                      style={{
                        marginBottom: '14px',
                        padding: '12px 14px',
                        borderRadius: '12px',
                        backgroundColor: 'rgba(201, 168, 118, 0.08)',
                        border: '1.5px solid rgba(201, 168, 118, 0.3)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{ fontSize: '18px' }}>📍</span>
                        <div>
                          <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--accent-gold)' }}>
                            Table {customerTable}
                          </div>
                          <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                            Verified Dine-In QR Session
                          </div>
                        </div>
                      </div>
                      <span
                        style={{
                          fontSize: '10px',
                          fontWeight: 700,
                          padding: '3px 8px',
                          borderRadius: '999px',
                          backgroundColor: 'rgba(201, 168, 118, 0.2)',
                          color: 'var(--accent-gold)',
                          border: '1px solid var(--accent-gold)',
                          textTransform: 'uppercase',
                        }}
                      >
                        Active
                      </span>
                    </div>
                  ) : (
                    <div
                      style={{
                        marginBottom: '14px',
                        padding: '12px 14px',
                        borderRadius: '12px',
                        backgroundColor: 'rgba(201, 168, 118, 0.06)',
                        border: '1.5px dashed rgba(201, 168, 118, 0.3)',
                        textAlign: 'center',
                      }}
                    >
                      <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--accent-gold)', marginBottom: '3px' }}>
                        📲 Dine-In QR Scan Required
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                        Scan the QR code on your dining table to dispatch orders directly to the kitchen.
                      </div>
                    </div>
                  )}

                  {orderError && (
                    <div
                      style={{
                        backgroundColor: 'rgba(239, 68, 68, 0.15)',
                        border: '1px solid rgba(239, 68, 68, 0.4)',
                        borderRadius: '12px',
                        padding: '10px 14px',
                        color: '#fca5a5',
                        fontSize: '12px',
                        fontWeight: 600,
                        marginBottom: '12px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                      }}
                    >
                      <span>⚠️ {orderError}</span>
                    </div>
                  )}

                  {/* Confirm & Send Button */}
                  <button
                    type="button"
                    onClick={handlePlaceOrderClick}
                    disabled={isSubmitting || !isTableVerified}
                    style={{
                      width: '100%',
                      height: '50px',
                      borderRadius: '999px',
                      border: '1px solid var(--accent-gold)',
                      backgroundColor:
                        isSubmitting || !isTableVerified
                          ? 'rgba(201, 168, 118, 0.15)'
                          : 'var(--accent-gold)',
                      color: isSubmitting || !isTableVerified ? 'var(--text-secondary)' : '#121316',
                      fontFamily: 'var(--font-sans)',
                      fontSize: '15px',
                      fontWeight: 700,
                      cursor: !isTableVerified ? 'not-allowed' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      boxShadow: isTableVerified ? '0 4px 18px rgba(201, 168, 118, 0.3)' : 'none',
                      transition: 'all 0.2s ease',
                      opacity: isSubmitting || !isTableVerified ? 0.75 : 1,
                    }}
                  >
                    {isSubmitting ? (
                      <span>Sending to Kitchen...</span>
                    ) : !isTableVerified ? (
                      <span>Send to Kitchen</span>
                    ) : (
                      <>
                        <CheckCircle2 size={18} />
                        <span>Send to Kitchen • {formatPrice(subtotal, currency)}</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── TAB 2: Kitchen Status (Matches Screenshot 1) ── */}
        {activeTab === 'kitchen' && (
          <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden', padding: '16px 20px' }}>
            {placedOrders.length === 0 ? (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flex: 1,
                  textAlign: 'center',
                  gap: '12px',
                }}
              >
                <ChefHat size={40} style={{ color: 'var(--accent-gold)', opacity: 0.5 }} />
                <h4 style={{ fontFamily: 'var(--font-sans)', fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                  No Orders in Kitchen
                </h4>
                <p style={{ fontFamily: 'var(--font-sans)', fontSize: '13px', color: 'var(--text-secondary)', maxWidth: '280px', margin: 0 }}>
                  Dishes confirmed from your tray will appear here with live kitchen status.
                </p>
                <button
                  onClick={() => setActiveTab('tray')}
                  style={{
                    marginTop: '8px',
                    backgroundColor: 'var(--accent-gold)',
                    color: '#121316',
                    border: 'none',
                    padding: '10px 24px',
                    borderRadius: '999px',
                    fontSize: '13px',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  View Order Tray
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
                {/* Banner Card: "CURRENT TABLE BILL" (Matches Screenshot 1) */}
                <div
                  style={{
                    backgroundColor: '#111216',
                    border: '1px solid rgba(201, 168, 118, 0.3)',
                    borderRadius: '18px',
                    padding: '16px 20px',
                    marginBottom: '16px',
                    flexShrink: 0,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                    <span
                      style={{
                        fontFamily: 'var(--font-sans)',
                        fontSize: '11px',
                        fontWeight: 700,
                        letterSpacing: '1px',
                        textTransform: 'uppercase',
                        color: 'var(--accent-gold)',
                      }}
                    >
                      CURRENT TABLE BILL
                    </span>
                    <span
                      style={{
                        backgroundColor: 'rgba(201, 168, 118, 0.15)',
                        border: '1px solid var(--accent-gold)',
                        color: 'var(--accent-gold)',
                        fontSize: '11px',
                        fontWeight: 700,
                        padding: '3px 10px',
                        borderRadius: '999px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '5px',
                      }}
                    >
                      <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: 'var(--accent-gold)' }} />
                      Kitchen Preparing
                    </span>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: '6px' }}>
                    <span
                      style={{
                        fontFamily: 'var(--font-sans)',
                        fontSize: '26px',
                        fontWeight: 800,
                        color: 'var(--text-primary)',
                      }}
                    >
                      {formatPrice(placedTotal, currency)}
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 600 }}>
                        {totalPlacedCount} item{totalPlacedCount !== 1 ? 's' : ''} ordered
                      </span>
                    </div>
                  </div>
                </div>

                {/* Placed Items List (Matches Screenshot 1) */}
                <div
                  style={{
                    flex: 1,
                    overflowY: 'auto',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px',
                    paddingBottom: '20px',
                  }}
                >
                  {placedOrders.map((order, idx) => {
                    const itemTotal = getItemTotalPrice(order);
                    const status = order.status || 'not_started';

                    return (
                      <div
                        key={`${order.orderId || 'order'}-${order.item.id}-${idx}`}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '14px',
                          padding: '14px',
                          backgroundColor: '#1b1d26',
                          border: '1px solid rgba(255, 255, 255, 0.06)',
                          borderRadius: '16px',
                        }}
                      >
                        {/* Square Food Photo */}
                        <img
                          src={order.item.imageUrl}
                          alt={order.item.name}
                          style={{
                            width: '56px',
                            height: '56px',
                            borderRadius: '12px',
                            objectFit: 'cover',
                            border: '1px solid rgba(201, 168, 118, 0.2)',
                            flexShrink: 0,
                          }}
                        />

                        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          {/* Row 1: Badges & Undo Button */}
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                              {(!status || status === 'not_started') && (
                                <span
                                  style={{
                                    backgroundColor: 'rgba(255, 255, 255, 0.08)',
                                    color: 'var(--text-secondary)',
                                    border: '1px solid rgba(255, 255, 255, 0.15)',
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

                              <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600 }}>
                                Table {order.tableNumber || customerTable || '?'}
                              </span>
                            </div>

                            {/* Action / Live Status Badge */}
                            {order.orderId && (
                              <div style={{ flexShrink: 0 }}>
                                {(!status || status === 'not_started') ? (
                                  <button
                                    type="button"
                                    onClick={() => onUndoOrder(order.orderId!)}
                                    style={{
                                      background: 'none',
                                      border: '1px solid rgba(248, 113, 113, 0.5)',
                                      borderRadius: '999px',
                                      padding: '4px 10px',
                                      color: '#f87171',
                                      fontSize: '11px',
                                      fontWeight: 700,
                                      cursor: 'pointer',
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
                                      backgroundColor: 'var(--accent-gold)',
                                      color: '#121316',
                                      fontSize: '11px',
                                      fontWeight: 800,
                                      padding: '4px 10px',
                                      borderRadius: '999px',
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '4px',
                                      whiteSpace: 'nowrap',
                                      boxShadow: '0 2px 8px rgba(201, 168, 118, 0.3)',
                                    }}
                                  >
                                    <ChefHat size={12} /> Cooking
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
                                    <CheckCircle2 size={12} /> Ready
                                  </span>
                                ) : (
                                  <span
                                    style={{
                                      backgroundColor: 'rgba(100, 116, 139, 0.4)',
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

                          {/* Row 2: Dish Name on Left + Price on Right */}
                          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '8px' }}>
                            <div
                              style={{
                                fontFamily: 'var(--font-sans)',
                                fontSize: '15px',
                                fontWeight: 700,
                                color: 'var(--text-primary)',
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                flex: 1,
                              }}
                            >
                              {order.quantity}x {order.item.name}
                            </div>
                            <div
                              style={{
                                fontSize: '14px',
                                fontWeight: 700,
                                color: 'var(--accent-gold)',
                                flexShrink: 0,
                                textAlign: 'right',
                              }}
                            >
                              {formatPrice(itemTotal, currency)}
                            </div>
                          </div>

                          {/* Row 3: Description/Portion on Left + Order # on Right */}
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                            <div
                              style={{
                                fontSize: '11px',
                                color: order.variant ? 'var(--accent-gold)' : 'var(--text-secondary)',
                                opacity: order.variant ? 0.9 : 0.65,
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                flex: 1,
                              }}
                            >
                              {order.variant || order.item.subtitle || 'Dine-In Kitchen Order'}
                            </div>
                            <div
                              style={{
                                fontSize: '11px',
                                color: 'var(--text-secondary)',
                                opacity: 0.65,
                                flexShrink: 0,
                                textAlign: 'right',
                              }}
                            >
                              Order #{order.orderId?.slice(-4)}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
