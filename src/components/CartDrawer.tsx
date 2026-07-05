import { ShoppingBag, X, Plus, Minus, Trash2, CheckCircle2 } from 'lucide-react';
import type { MenuItem } from '../data/menuData';

export interface CartItem {
  item: MenuItem;
  quantity: number;
  variant: string;
  notes?: string;
}

interface CartDrawerProps {
  cart: CartItem[];
  tableNumber: string | null;
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  onUpdateQuantity: (idx: number, change: number) => void;
  onRemoveItem: (idx: number) => void;
  onClearCart: () => void;
}

export default function CartDrawer({
  cart,
  tableNumber,
  isOpen,
  setIsOpen,
  onUpdateQuantity,
  onRemoveItem,
  onClearCart
}: CartDrawerProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [orderId, setOrderId] = useState('');

  const totalPrice = cart.reduce((sum, current) => {
    const variantAdjustment = current.item.variants?.find(v => v.name === current.variant)?.priceAdjustment || 0;
    return sum + (current.item.price + variantAdjustment) * current.quantity;
  }, 0);

  const handlePlaceOrder = () => {
    setIsSubmitting(true);
    // Simulate API delay
    setTimeout(() => {
      setIsSubmitting(false);
      setIsSuccess(true);
      setOrderId(`ORD-${Math.floor(1000 + Math.random() * 9000)}`);
      onClearCart();
    }, 1500);
  };

  const handleClose = () => {
    if (!isSubmitting) {
      setIsOpen(false);
      setIsSuccess(false);
    }
  };

  return (
    <>
      {/* Dark Backdrop Overlay */}
      {(isOpen || isSuccess) && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.2)',
            backdropFilter: 'blur(2px)',
            zIndex: 90
          }}
          onClick={handleClose}
        />
      )}

      {/* Side Drawer Box */}
      <div
        className={`cart-side-drawer ${(isOpen || isSuccess) ? 'open' : ''}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: '24px',
            borderBottom: '1px solid rgba(255,255,255,0.03)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}
        >
          <h3
            style={{
              fontFamily: 'var(--font-serif)',
              fontSize: '20px',
              fontWeight: 500,
              color: 'var(--text-primary)'
            }}
          >
            {isSuccess ? 'Order Confirmed' : 'Your Order Tray'}
          </h3>
          <button
            onClick={handleClose}
            disabled={isSubmitting}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              padding: '4px'
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Success State */}
        {isSuccess ? (
          <div
            style={{
              padding: '40px 24px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              textAlign: 'center',
              gap: '16px',
              overflowY: 'auto'
            }}
          >
            <CheckCircle2 size={64} style={{ color: '#5c6b4e' }} />
            <div>
              <span
                style={{
                  fontFamily: 'var(--font-sans)',
                  fontSize: '11px',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: '2px',
                  color: 'var(--accent-gold)',
                  display: 'block',
                  marginBottom: '4px'
                }}
              >
                Kitchen Received Order
              </span>
              <h4
                style={{
                  fontFamily: 'var(--font-serif)',
                  fontSize: '24px',
                  fontWeight: 500,
                  color: 'var(--text-primary)'
                }}
              >
                Enjoy Your Meal
              </h4>
              <span
                style={{
                  fontFamily: 'var(--font-sans)',
                  fontSize: '12px',
                  color: 'var(--text-secondary)',
                  opacity: 0.8,
                  display: 'block',
                  marginTop: '8px'
                }}
              >
                Order Reference: {orderId}
              </span>
            </div>
            <p
              style={{
                fontFamily: 'var(--font-sans)',
                fontSize: '14px',
                color: 'var(--text-secondary)',
                lineHeight: '1.6',
                maxWidth: '300px'
              }}
            >
              Your dishes are being prepared with care. {tableNumber ? `They will be served straight to Table ${tableNumber}.` : 'They will be served to you shortly.'}
            </p>
            <button
              onClick={handleClose}
              style={{
                marginTop: '12px',
                backgroundColor: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.08)',
                color: 'var(--text-primary)',
                padding: '10px 24px',
                fontSize: '12px',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '1px',
                cursor: 'pointer',
                borderRadius: '2px',
                transition: 'var(--transition-smooth)'
              }}
            >
              Back to Menu
            </button>
          </div>
        ) : (
          /* Main Cart Content */
          <>
            {cart.length === 0 ? (
              /* Empty State */
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexGrow: 1,
                  padding: '40px 24px',
                  textAlign: 'center',
                  gap: '16px'
                }}
              >
                <ShoppingBag size={48} style={{ color: 'var(--accent-gold)', opacity: 0.2 }} />
                <h4 style={{ fontFamily: 'var(--font-serif)', fontSize: '18px', color: 'var(--text-primary)', fontWeight: 500 }}>
                  Your Tray is Empty
                </h4>
                <p style={{ fontFamily: 'var(--font-sans)', fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.6', maxWidth: '280px' }}>
                  Browse our gourmet menu and add your favorite dishes to start building your dining experience.
                </p>
                <button
                  onClick={handleClose}
                  style={{
                    marginTop: '8px',
                    backgroundColor: 'var(--accent-gold)',
                    color: 'var(--bg-dark)',
                    border: 'none',
                    padding: '10px 20px',
                    fontSize: '11px',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '1.5px',
                    cursor: 'pointer',
                    borderRadius: '2px',
                    transition: 'var(--transition-smooth)'
                  }}
                >
                  Browse Menu
                </button>
              </div>
            ) : (
              /* Cart List State */
              <div style={{ display: 'flex', flexDirection: 'column', flexGrow: 1, overflow: 'hidden', position: 'relative' }}>
                <div
                  style={{
                    flexGrow: 1,
                    overflowY: 'auto',
                    padding: '0 24px 140px 24px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '16px'
                  }}
                >
                  {cart.map((cartItem, idx) => {
                    const variantAdjustment = cartItem.item.variants?.find(v => v.name === cartItem.variant)?.priceAdjustment || 0;
                    const itemPrice = cartItem.item.price + variantAdjustment;
                    
                    return (
                      <div
                        key={`${cartItem.item.id}-${cartItem.variant}-${idx}`}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '16px',
                          paddingBottom: '16px',
                          borderBottom: '1px solid rgba(255,255,255,0.03)'
                        }}
                      >
                        {/* Tiny circular photo */}
                        <div
                          style={{
                            width: '50px',
                            height: '50px',
                            borderRadius: '50%',
                            overflow: 'hidden',
                            border: '1px solid rgba(201,168,118,0.2)',
                            flexShrink: 0
                          }}
                        >
                          <img
                            src={cartItem.item.imageUrl}
                            alt={cartItem.item.name}
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          />
                        </div>

                        {/* Title details */}
                        <div style={{ flexGrow: 1, minWidth: 0 }}>
                          <span
                            style={{
                              fontFamily: 'var(--font-serif)',
                              fontSize: '15px',
                              fontWeight: 500,
                              color: 'var(--text-primary)',
                              display: 'block'
                            }}
                          >
                            {cartItem.item.name}
                          </span>
                          {cartItem.variant && (
                            <span
                              style={{
                                fontFamily: 'var(--font-sans)',
                                fontSize: '11px',
                                color: 'var(--accent-gold)',
                                display: 'block',
                                marginTop: '1px'
                              }}
                            >
                              {cartItem.variant}
                            </span>
                          )}
                          <span
                            style={{
                              fontFamily: 'var(--font-sans)',
                              fontSize: '13px',
                              color: 'var(--text-secondary)',
                              display: 'block',
                              marginTop: '2px'
                            }}
                          >
                            {itemPrice} Birr each
                          </span>
                        </div>

                        {/* Quantity edits */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <button
                            onClick={() => onUpdateQuantity(idx, -1)}
                            style={{
                              backgroundColor: 'rgba(255,255,255,0.03)',
                              border: '1px solid rgba(255,255,255,0.05)',
                              color: 'var(--text-secondary)',
                              width: '24px',
                              height: '24px',
                              borderRadius: '2px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              cursor: 'pointer'
                            }}
                          >
                            <Minus size={10} />
                          </button>
                          <span
                            style={{
                              fontFamily: 'var(--font-sans)',
                              fontSize: '13px',
                              fontWeight: 600,
                              width: '18px',
                              textAlign: 'center',
                              color: 'var(--text-primary)'
                            }}
                          >
                            {cartItem.quantity}
                          </span>
                          <button
                            onClick={() => onUpdateQuantity(idx, 1)}
                            style={{
                              backgroundColor: 'rgba(255,255,255,0.03)',
                              border: '1px solid rgba(255,255,255,0.05)',
                              color: 'var(--text-secondary)',
                              width: '24px',
                              height: '24px',
                              borderRadius: '2px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              cursor: 'pointer'
                            }}
                          >
                            <Plus size={10} />
                          </button>
                          <button
                            onClick={() => onRemoveItem(idx)}
                            style={{
                              background: 'none',
                              border: 'none',
                              color: '#a94a42',
                              cursor: 'pointer',
                              padding: '4px',
                              display: 'flex',
                              alignItems: 'center',
                              marginLeft: '4px'
                            }}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Bottom checkout action */}
                <div
                  style={{
                    position: 'absolute',
                    bottom: 0,
                    left: 0,
                    right: 0,
                    padding: '20px 24px',
                    paddingBottom: 'calc(24px + env(safe-area-inset-bottom, 0px))',
                    borderTop: '1px solid rgba(255,255,255,0.06)',
                    backgroundColor: 'rgba(21, 22, 28, 0.55)',
                    backdropFilter: 'blur(16px)',
                    WebkitBackdropFilter: 'blur(16px)',
                    zIndex: 10,
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: '16px'
                    }}
                  >
                    <span
                      style={{
                        fontFamily: 'var(--font-sans)',
                        fontSize: '13px',
                        textTransform: 'uppercase',
                        letterSpacing: '1px',
                        color: 'var(--text-secondary)'
                      }}
                    >
                      Total Value
                    </span>
                    <span
                      style={{
                        fontFamily: 'var(--font-sans)',
                        fontSize: '22px',
                        fontWeight: 600,
                        color: 'var(--accent-gold)'
                      }}
                    >
                      {totalPrice} Birr
                    </span>
                  </div>

                  {/* Submission triggers */}
                  <button
                    onClick={handlePlaceOrder}
                    disabled={isSubmitting}
                    style={{
                      width: '100%',
                      height: '48px',
                      borderRadius: '30px',
                      border: 'none',
                      backgroundColor: isSubmitting ? '#46553e' : 'var(--accent-gold)',
                      color: isSubmitting ? '#f2efe9' : 'var(--bg-dark)',
                      fontFamily: 'var(--font-serif)',
                      fontStyle: 'italic',
                      fontSize: '16px',
                      fontWeight: 600,
                      textTransform: 'none',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
                      boxShadow: isSubmitting ? 'none' : '0 8px 20px rgba(201, 168, 118, 0.4)'
                    }}
                  >
                    {isSubmitting ? (
                      <span>Sending to Kitchen...</span>
                    ) : (
                      <span>
                        Place order
                      </span>
                    )}
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}

// Inline useState hook shim if missing, but it is imported at the top
import { useState } from 'react';
