import { useState } from 'react';
import { ShoppingBag, X, Plus, Minus, Trash2, CheckCircle2, ChefHat, Clock, Flame } from 'lucide-react';
import type { MenuItem } from '../data/menuData';

export interface CartItem {
  item: MenuItem;
  quantity: number;
  variant: string;
  notes?: string;
  orderId?: string;
  placedAt?: number;
  status?: 'not_started' | 'pending' | 'complete';
}

interface CartDrawerProps {
  cart: CartItem[];
  tableNumber: string | null;
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  onUpdateQuantity: (idx: number, change: number) => void;
  onRemoveItem: (idx: number) => void;
  onPlaceOrder: () => void;
  placedOrders: CartItem[];
  onUndoOrder: (orderId: string) => void;
}

export default function CartDrawer({
  cart,
  isOpen,
  setIsOpen,
  onUpdateQuantity,
  onRemoveItem,
  onPlaceOrder,
  placedOrders,
  onUndoOrder
}: CartDrawerProps) {
  const [activeTab, setActiveTab] = useState<'tray' | 'kitchen'>('tray');
  const [isSubmitting, setIsSubmitting] = useState(false);  const totalPrice = cart.reduce((sum, current) => {
    const variantAdjustment = current.item.variants?.find(v => v.name === current.variant)?.priceAdjustment || 0;
    return sum + (current.item.price + variantAdjustment) * current.quantity;
  }, 0);

  const handlePlaceOrder = () => {
    setIsSubmitting(true);
    // Simulate API delay
    setTimeout(() => {
      setIsSubmitting(false);
      onPlaceOrder();
      setActiveTab('kitchen');
    }, 1500);
  };

  const handleClose = () => {
    if (!isSubmitting) {
      setIsOpen(false);
      setTimeout(() => setActiveTab('tray'), 300);
    }
  };

  return (
    <>
      {/* Dark Backdrop Overlay */}
      {isOpen && (
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
        className={`cart-side-drawer ${isOpen ? 'open' : ''}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: '24px 24px 16px 24px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}
        >
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

        {/* Tab Bar */}
        {placedOrders.length > 0 && (
          <div style={{ display: 'flex', padding: '0 24px 16px 24px', borderBottom: '1px solid rgba(255,255,255,0.03)', gap: '16px' }}>
            <button
              onClick={() => setActiveTab('tray')}
              style={{
                flex: 1,
                background: activeTab === 'tray' ? 'rgba(201, 168, 118, 0.15)' : 'rgba(255,255,255,0.02)',
                border: `1px solid ${activeTab === 'tray' ? 'var(--accent-gold)' : 'rgba(255,255,255,0.05)'}`,
                color: activeTab === 'tray' ? 'var(--accent-gold)' : 'var(--text-secondary)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                padding: '10px',
                borderRadius: '8px',
                transition: 'all 0.3s ease'
              }}
            >
              <ShoppingBag size={16} />
              <span style={{ fontFamily: 'var(--font-sans)', fontSize: '13px', fontWeight: 500 }}>Current Tray</span>
            </button>
            <button
              onClick={() => setActiveTab('kitchen')}
              style={{
                flex: 1,
                background: activeTab === 'kitchen' ? 'rgba(201, 168, 118, 0.15)' : 'rgba(255,255,255,0.02)',
                border: `1px solid ${activeTab === 'kitchen' ? 'var(--accent-gold)' : 'rgba(255,255,255,0.05)'}`,
                color: activeTab === 'kitchen' ? 'var(--accent-gold)' : 'var(--text-secondary)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                padding: '10px',
                borderRadius: '8px',
                transition: 'all 0.3s ease'
              }}
            >
              <ChefHat size={16} />
              <span style={{ fontFamily: 'var(--font-sans)', fontSize: '13px', fontWeight: 500 }}>Kitchen Orders</span>
            </button>
          </div>
        )}

        {/* Main Cart Content */}
        <>
            {(activeTab === 'tray' ? cart : placedOrders).length === 0 ? (
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
                {activeTab === 'tray' ? (
                  <>
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
                  </>
                ) : (
                  <>
                    <ChefHat size={48} style={{ color: 'var(--accent-gold)', opacity: 0.2 }} />
                    <h4 style={{ fontFamily: 'var(--font-serif)', fontSize: '18px', color: 'var(--text-primary)', fontWeight: 500 }}>
                      No Orders Sent Yet
                    </h4>
                    <p style={{ fontFamily: 'var(--font-sans)', fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.6', maxWidth: '280px' }}>
                      Items you send to the kitchen will appear here.
                    </p>
                    <button
                      onClick={() => setActiveTab('tray')}
                      style={{
                        marginTop: '8px',
                        backgroundColor: 'rgba(255,255,255,0.03)',
                        color: 'var(--text-primary)',
                        border: '1px solid rgba(255,255,255,0.08)',
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
                      View Tray
                    </button>
                  </>
                )}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', flexGrow: 1, overflow: 'hidden', position: 'relative' }}>
                <div
                  style={{
                    flexGrow: 1,
                    overflowY: 'auto',
                    padding: activeTab === 'tray' ? '0 24px 140px 24px' : '0 24px 40px 24px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '16px'
                  }}
                >
                  {(activeTab === 'tray' ? cart : placedOrders).map((cartItem, idx) => {
                    const variantAdjustment = cartItem.item.variants?.find(v => v.name === cartItem.variant)?.priceAdjustment || 0;
                    const itemPrice = cartItem.item.price + variantAdjustment;
                    
                    return (
                      <div
                        key={`${cartItem.item.id}-${cartItem.variant}-${idx}`}
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '12px',
                          paddingBottom: '16px',
                          borderBottom: '1px solid rgba(255,255,255,0.03)'
                        }}
                      >
                        {/* Top Row: Image on left, Controls on right */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
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

                          {/* Quantity edits or read-only */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                            {activeTab === 'tray' ? (
                              <>
                                <div
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    backgroundColor: 'rgba(255,255,255,0.03)',
                                    border: '1px solid rgba(255,255,255,0.08)',
                                    borderRadius: '20px',
                                    padding: '2px 4px',
                                    gap: '2px'
                                  }}
                                >
                                  <button
                                    onClick={() => onUpdateQuantity(idx, -1)}
                                    style={{
                                      background: 'none',
                                      border: 'none',
                                      color: 'var(--text-secondary)',
                                      width: '24px',
                                      height: '24px',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      cursor: 'pointer',
                                      borderRadius: '50%',
                                      transition: 'background-color 0.2s'
                                    }}
                                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.05)'}
                                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                                  >
                                    <Minus size={12} />
                                  </button>
                                  <span
                                    style={{
                                      fontFamily: 'var(--font-sans)',
                                      fontSize: '13px',
                                      fontWeight: 600,
                                      width: '20px',
                                      textAlign: 'center',
                                      color: 'var(--text-primary)'
                                    }}
                                  >
                                    {cartItem.quantity}
                                  </span>
                                  <button
                                    onClick={() => onUpdateQuantity(idx, 1)}
                                    style={{
                                      background: 'none',
                                      border: 'none',
                                      color: 'var(--text-secondary)',
                                      width: '24px',
                                      height: '24px',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      cursor: 'pointer',
                                      borderRadius: '50%',
                                      transition: 'background-color 0.2s'
                                    }}
                                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.05)'}
                                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                                  >
                                    <Plus size={12} />
                                  </button>
                                </div>
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
                                    marginLeft: '2px'
                                  }}
                                >
                                  <Trash2 size={14} />
                                </button>
                              </>
                            ) : (
                              <>
                                <div
                                  style={{
                                    backgroundColor: 'rgba(255,255,255,0.03)',
                                    border: '1px solid rgba(255,255,255,0.05)',
                                    color: 'var(--text-primary)',
                                    height: '28px',
                                    width: '28px',
                                    minWidth: '28px',
                                    minHeight: '28px',
                                    borderRadius: '50%',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontFamily: 'var(--font-sans)',
                                    flexShrink: 0
                                  }}
                                >
                                  <span style={{ fontSize: '12px', fontWeight: 600, transform: 'translateY(-1px)' }}>{cartItem.quantity}</span>
                                  <span style={{ fontSize: '9px', marginLeft: '1px', opacity: 0.7, fontWeight: 500, transform: 'translateY(1px)' }}>x</span>
                                </div>

                                {/* Undo Button if not_started */}
                                {cartItem.status === 'not_started' && cartItem.orderId && (
                                  <button
                                    onClick={() => onUndoOrder(cartItem.orderId!)}
                                    title="Delete Order"
                                    style={{
                                      background: 'none',
                                      border: '1px solid rgba(255, 100, 100, 0.3)',
                                      backgroundColor: 'rgba(255, 100, 100, 0.05)',
                                      color: '#ff6666',
                                      cursor: 'pointer',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      borderRadius: '50%',
                                      height: '28px',
                                      width: '28px',
                                      transition: 'all 0.3s ease',
                                      flexShrink: 0
                                    }}
                                  >
                                    <Trash2 size={12} />
                                  </button>
                                )}
                              </>
                            )}
                          </div>
                        </div>

                        {/* Bottom Row: Info on left, Status tag on right */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px' }}>
                          {/* Title details */}
                          <div style={{ flexGrow: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '2px' }}>
                            <span
                              style={{
                                fontFamily: 'var(--font-serif)',
                                fontSize: '15px',
                                fontWeight: 500,
                                color: 'var(--text-primary)',
                                display: 'block',
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis'
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
                                  display: 'block'
                                }}
                              >
                                {cartItem.variant}
                              </span>
                            )}
                          </div>

                          {/* Right side: Status and Price */}
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px', flexShrink: 0 }}>
                            {/* Status Tag for Kitchen */}
                            {activeTab === 'kitchen' && (
                              <div>
                                {cartItem.status === 'complete' ? (
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', backgroundColor: 'rgba(100, 200, 100, 0.1)', border: '1px solid rgba(100, 200, 100, 0.3)', padding: '2px 8px', borderRadius: '4px', color: '#8cd98c' }}>
                                    <CheckCircle2 size={10} />
                                    <span style={{ fontSize: '10px', fontWeight: 600, textTransform: 'uppercase' }}>Complete</span>
                                  </div>
                                ) : cartItem.status === 'pending' ? (
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', backgroundColor: 'rgba(201, 168, 118, 0.1)', border: '1px solid rgba(201, 168, 118, 0.3)', padding: '2px 8px', borderRadius: '4px', color: 'var(--accent-gold)' }}>
                                    <Flame size={10} />
                                    <span style={{ fontSize: '10px', fontWeight: 600, textTransform: 'uppercase' }}>Pending</span>
                                  </div>
                                ) : (
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', backgroundColor: 'rgba(255, 100, 100, 0.1)', border: '1px solid #ff6666', padding: '2px 8px', borderRadius: '20px', color: '#ff6666' }}>
                                    <Clock size={10} />
                                    <span style={{ fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', whiteSpace: 'nowrap' }}>Not Started</span>
                                  </div>
                                )}
                              </div>
                            )}
                            
                            {/* Price */}
                            <span
                              style={{
                                fontFamily: 'var(--font-sans)',
                                fontSize: '12px',
                                color: 'var(--text-secondary)',
                                fontWeight: 500
                              }}
                            >
                              {itemPrice} Birr
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Bottom checkout action - ONLY visible on Tray tab */}
                {activeTab === 'tray' && (
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
                )}
              </div>
            )}
          </>
      </div>
    </>
  );
}
