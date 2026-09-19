import { useState, useEffect } from 'react';
import { X, Plus, Minus, Check, Flame, Star, ShieldAlert } from 'lucide-react';
import type { MenuItem } from '../../types';
import { formatPrice } from '../../utils/currency';

interface ClassicItemModalProps {
  item: MenuItem | null;
  currency?: string;
  onClose: () => void;
  onAddToOrder: (item: MenuItem, quantity: number, selectedVariant: string) => void;
}

export default function ClassicItemModal({
  item,
  currency = 'ETB',
  onClose,
  onAddToOrder,
}: ClassicItemModalProps) {
  const [quantity, setQuantity] = useState(1);
  const [selectedVariant, setSelectedVariant] = useState('');
  const [addedAnimation, setAddedAnimation] = useState(false);

  useEffect(() => {
    if (item) {
      setQuantity(1);
      setSelectedVariant(item.variants && item.variants.length > 0 ? item.variants[0].name : '');
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [item]);

  if (!item) return null;

  const variantAdjustment =
    item.variants?.find((v) => v.name === selectedVariant)?.priceAdjustment || 0;
  const unitPrice = item.price + variantAdjustment;
  const totalPrice = unitPrice * quantity;

  const handleAdd = () => {
    onAddToOrder(item, quantity, selectedVariant);
    setAddedAnimation(true);
    setTimeout(() => {
      setAddedAnimation(false);
      onClose();
    }, 600);
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
        zIndex: 100,
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'flex-end',
        animation: 'fadeIn 0.25s ease forwards',
      }}
      onClick={onClose}
    >
      <style
        dangerouslySetInnerHTML={{
          __html: `
            @keyframes fadeIn {
              from { opacity: 0; }
              to { opacity: 1; }
            }
            @keyframes slideSheetUp {
              from { transform: translateY(100%); }
              to { transform: translateY(0); }
            }
          `,
        }}
      />

      <div
        style={{
          width: '100%',
          maxWidth: '520px',
          backgroundColor: '#16171e',
          borderTopLeftRadius: '28px',
          borderTopRightRadius: '28px',
          borderTop: '1px solid rgba(201, 168, 118, 0.25)',
          maxHeight: '90dvh',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
          boxShadow: '0 -10px 40px rgba(0, 0, 0, 0.9)',
          animation: 'slideSheetUp 0.35s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Drag Handle */}
        <div
          style={{
            position: 'absolute',
            top: '8px',
            left: '50%',
            transform: 'translateX(-50%)',
            width: '38px',
            height: '4px',
            borderRadius: '2px',
            backgroundColor: 'rgba(255, 255, 255, 0.3)',
            zIndex: 15,
          }}
        />

        {/* Hero Image Container */}
        <div
          style={{
            position: 'relative',
            width: '100%',
            height: 'clamp(220px, 48vw, 300px)',
            borderTopLeftRadius: '28px',
            borderTopRightRadius: '28px',
            overflow: 'hidden',
            flexShrink: 0,
          }}
        >
          <img
            src={item.imageUrl}
            alt={item.name}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              filter: item.available === false ? 'grayscale(70%) brightness(0.85)' : undefined,
            }}
          />

          {/* Sold Out Badge over Hero Image */}
          {item.available === false && (
            <div
              style={{
                position: 'absolute',
                top: '16px',
                left: '16px',
                backgroundColor: '#ef4444',
                color: '#ffffff',
                fontFamily: 'var(--font-sans)',
                fontSize: '12px',
                fontWeight: 800,
                letterSpacing: '1px',
                padding: '6px 14px',
                borderRadius: '999px',
                boxShadow: '0 4px 14px rgba(239, 68, 68, 0.6)',
                zIndex: 20,
                textTransform: 'uppercase',
              }}
            >
              SOLD OUT
            </div>
          )}

          {/* Gradient Overlay */}
          <div
            style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              height: '90px',
              background: 'linear-gradient(to top, #16171e, transparent)',
            }}
          />

          {/* Circular Close Button over Image */}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{
              position: 'absolute',
              top: '16px',
              right: '16px',
              width: '36px',
              height: '36px',
              borderRadius: '50%',
              backgroundColor: 'rgba(0, 0, 0, 0.55)',
              backdropFilter: 'blur(8px)',
              WebkitBackdropFilter: 'blur(8px)',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              color: '#f2efe9',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 20,
              transition: 'transform 0.2s ease',
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Content Section (matches Screenshot 2 in Dark AURA theme) */}
        <div style={{ padding: '4px 22px 24px', display: 'flex', flexDirection: 'column', gap: '16px', flex: 1 }}>
          {/* Title & Price Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px' }}>
            <div>
              <h2
                style={{
                  fontFamily: 'var(--font-sans)',
                  fontSize: '24px',
                  fontWeight: 700,
                  color: 'var(--text-primary)',
                  margin: 0,
                  lineHeight: 1.2,
                }}
              >
                {item.name}
              </h2>
              {item.subtitle && (
                <p
                  style={{
                    fontFamily: 'var(--font-sans)',
                    fontSize: '13px',
                    color: 'var(--text-secondary)',
                    margin: '4px 0 0 0',
                    fontWeight: 500,
                  }}
                >
                  {item.subtitle}
                </p>
              )}
            </div>

            {/* Price on right */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-end',
                gap: '4px',
              }}
            >
              <div
                style={{
                  fontFamily: 'var(--font-sans)',
                  fontSize: '22px',
                  fontWeight: 700,
                  color: item.available === false ? '#ef4444' : 'var(--accent-gold)',
                  whiteSpace: 'nowrap',
                }}
              >
                {formatPrice(unitPrice, currency)}
              </div>
              {item.available === false && (
                <span
                  style={{
                    fontSize: '10.5px',
                    fontWeight: 800,
                    padding: '3px 8px',
                    borderRadius: '999px',
                    backgroundColor: '#fee2e2',
                    color: '#dc2626',
                    letterSpacing: '0.5px',
                    textTransform: 'uppercase',
                  }}
                >
                  Sold Out
                </span>
              )}
            </div>
          </div>

          {/* Tag Pills Row (matches Screenshot 2) */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
            {item.weightLabel && (
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '5px 12px',
                  borderRadius: '999px',
                  backgroundColor: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  color: 'var(--text-primary)',
                  fontSize: '11px',
                  fontWeight: 600,
                }}
              >
                ⚖️ {item.weightLabel}
              </span>
            )}

            {item.tags?.includes('chef-pick') && (
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '5px 12px',
                  borderRadius: '999px',
                  backgroundColor: 'rgba(201, 168, 118, 0.15)',
                  border: '1px solid rgba(201, 168, 118, 0.3)',
                  color: 'var(--accent-gold)',
                  fontSize: '11px',
                  fontWeight: 600,
                }}
              >
                <Star size={12} fill="var(--accent-gold)" /> Chef's Pick
              </span>
            )}

            {item.tags?.includes('spicy') && (
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '5px 12px',
                  borderRadius: '999px',
                  backgroundColor: 'rgba(230, 80, 70, 0.15)',
                  border: '1px solid rgba(230, 80, 70, 0.3)',
                  color: '#ff7766',
                  fontSize: '11px',
                  fontWeight: 600,
                }}
              >
                <Flame size={12} fill="#ff7766" /> Spicy
              </span>
            )}

            {item.tags?.includes('gluten-free') && (
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '5px 12px',
                  borderRadius: '999px',
                  backgroundColor: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  color: 'var(--text-secondary)',
                  fontSize: '11px',
                  fontWeight: 600,
                }}
              >
                Gluten-Free
              </span>
            )}

            {item.tags?.includes('vegetarian') && (
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '5px 12px',
                  borderRadius: '999px',
                  backgroundColor: 'rgba(70, 160, 90, 0.15)',
                  border: '1px solid rgba(70, 160, 90, 0.3)',
                  color: '#70d080',
                  fontSize: '11px',
                  fontWeight: 600,
                }}
              >
                🌱 Vegetarian
              </span>
            )}
          </div>

          {/* Description Paragraph */}
          <p
            style={{
              fontFamily: 'var(--font-sans)',
              fontSize: '14px',
              lineHeight: 1.6,
              color: 'var(--text-secondary)',
              margin: 0,
            }}
          >
            {item.fullDescription || item.description}
          </p>

          {/* Variant Selection if present */}
          {item.variants && item.variants.length > 0 && (
            <div style={{ marginTop: '4px' }}>
              <span
                style={{
                  display: 'block',
                  fontSize: '11px',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '1px',
                  color: 'var(--text-secondary)',
                  marginBottom: '8px',
                  fontFamily: 'var(--font-sans)',
                }}
              >
                Choose Portion / Variant
              </span>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {item.variants.map((v) => {
                  const isSel = selectedVariant === v.name;
                  return (
                    <button
                      key={v.name}
                      type="button"
                      onClick={() => setSelectedVariant(v.name)}
                      style={{
                        padding: '8px 14px',
                        borderRadius: '999px',
                        border: `1px solid ${isSel ? 'var(--accent-gold)' : 'rgba(255, 255, 255, 0.1)'}`,
                        backgroundColor: isSel ? 'rgba(201, 168, 118, 0.15)' : 'rgba(255, 255, 255, 0.03)',
                        color: isSel ? 'var(--accent-gold)' : 'var(--text-primary)',
                        fontSize: '12px',
                        fontWeight: isSel ? 700 : 500,
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                      }}
                    >
                      {v.name} {v.priceAdjustment > 0 && `(+${formatPrice(v.priceAdjustment)})`}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Allergen Advisory Box (matches Screenshot 2) */}
          {item.allergens && item.allergens.length > 0 && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '12px 14px',
                borderRadius: '12px',
                backgroundColor: 'rgba(201, 168, 118, 0.08)',
                border: '1px solid rgba(201, 168, 118, 0.2)',
                color: 'var(--accent-gold)',
                fontSize: '12px',
                fontWeight: 600,
              }}
            >
              <ShieldAlert size={16} style={{ flexShrink: 0 }} />
              <span>Allergen Advisory: Contains {item.allergens.join(', ')}</span>
            </div>
          )}
        </div>

        {/* Sticky Bottom Action Bar (matches Screenshot 2) */}
        <div
          style={{
            padding: '16px 22px',
            paddingBottom: 'calc(16px + env(safe-area-inset-bottom, 0px))',
            borderTop: '1px solid rgba(255, 255, 255, 0.06)',
            backgroundColor: '#121317',
            display: 'flex',
            alignItems: 'center',
            gap: '14px',
          }}
        >
          {/* Add to Order Button Pill */}
          {item.available === false ? (
            <button
              type="button"
              disabled
              style={{
                flex: 1,
                height: '48px',
                borderRadius: '999px',
                border: 'none',
                backgroundColor: '#ef4444',
                color: '#ffffff',
                fontFamily: 'var(--font-sans)',
                fontSize: '14.5px',
                fontWeight: 800,
                cursor: 'not-allowed',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                letterSpacing: '0.5px',
                textTransform: 'uppercase',
                boxShadow: '0 4px 14px rgba(239, 68, 68, 0.4)',
              }}
            >
              <ShieldAlert size={18} />
              <span>Currently Sold Out</span>
            </button>
          ) : (
            <>
              {/* Stepper Pill */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  backgroundColor: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '999px',
                  padding: '4px',
                  gap: '4px',
                  height: '48px',
                  boxSizing: 'border-box',
                }}
              >
                <button
                  type="button"
                  onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                  disabled={quantity <= 1}
                  aria-label="Decrease quantity"
                  style={{
                    background: 'none',
                    border: 'none',
                    color: quantity <= 1 ? 'rgba(255, 255, 255, 0.2)' : 'var(--text-primary)',
                    width: '38px',
                    height: '38px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: quantity <= 1 ? 'default' : 'pointer',
                    borderRadius: '50%',
                  }}
                >
                  <Minus size={15} />
                </button>
                <span
                  style={{
                    fontFamily: 'var(--font-sans)',
                    fontSize: '16px',
                    fontWeight: 700,
                    width: '28px',
                    textAlign: 'center',
                    color: 'var(--text-primary)',
                  }}
                >
                  {quantity}
                </span>
                <button
                  type="button"
                  onClick={() => setQuantity((q) => q + 1)}
                  aria-label="Increase quantity"
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--text-primary)',
                    width: '38px',
                    height: '38px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    borderRadius: '50%',
                  }}
                >
                  <Plus size={15} />
                </button>
              </div>

              <button
                type="button"
                onClick={handleAdd}
                disabled={addedAnimation}
                style={{
                  flex: 1,
                  height: '48px',
                  borderRadius: '999px',
                  border: 'none',
                  backgroundColor: addedAnimation ? '#46553e' : 'var(--accent-gold)',
                  color: addedAnimation ? '#f2efe9' : '#121316',
                  fontFamily: 'var(--font-sans)',
                  fontSize: '15px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  boxShadow: '0 4px 16px rgba(201, 168, 118, 0.35)',
                  transition: 'all 0.2s ease',
                }}
              >
                {addedAnimation ? (
                  <>
                    <Check size={18} />
                    <span>Added to Tray!</span>
                  </>
                ) : (
                  <span>Add to Order • {formatPrice(totalPrice, currency)}</span>
                )}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
