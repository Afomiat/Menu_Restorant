import { useState, useEffect } from 'react';
import { X, Plus, Minus, Check, Leaf, AlertTriangle, ShieldCheck } from 'lucide-react';
import type { MenuItem } from '../data/menuData';

interface ItemDetailModalProps {
  item: MenuItem | null;
  onClose: () => void;
  onAddToOrder: (item: MenuItem, quantity: number, selectedVariant: string) => void;
}

export default function ItemDetailModal({
  item,
  onClose,
  onAddToOrder
}: ItemDetailModalProps) {
  const [quantity, setQuantity] = useState(1);
  const [selectedVariant, setSelectedVariant] = useState('');
  const [addedAnimation, setAddedAnimation] = useState(false);

  useEffect(() => {
    if (item) {
      setQuantity(1);
      setSelectedVariant(item.variants ? item.variants[0].name : '');
    }
  }, [item]);

  if (!item) return null;

  const handleAdd = () => {
    onAddToOrder(item, quantity, selectedVariant);
    setAddedAnimation(true);
    setTimeout(() => {
      setAddedAnimation(false);
      onClose();
    }, 800);
  };

  const getDietaryTagStyle = (tag: string) => {
    switch (tag) {
      case 'vegetarian': return { bg: 'rgba(70, 85, 62, 0.2)', border: 'rgba(70, 85, 62, 0.4)', text: '#a4c090' };
      case 'spicy': return { bg: 'rgba(114, 44, 42, 0.2)', border: 'rgba(114, 44, 42, 0.4)', text: '#e69895' };
      case 'gluten-free': return { bg: 'rgba(44, 74, 99, 0.2)', border: 'rgba(44, 74, 99, 0.4)', text: '#9bc2e6' };
      default: return { bg: 'rgba(92, 67, 35, 0.2)', border: 'rgba(92, 67, 35, 0.4)', text: '#dec093' };
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        backdropFilter: 'blur(8px)',
        zIndex: 100,
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'flex-end',
        animation: 'fadeIn 0.3s ease forwards'
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '520px',
          backgroundColor: '#121316',
          borderTopLeftRadius: '20px',
          borderTopRightRadius: '20px',
          borderTop: '1px solid rgba(201, 168, 118, 0.2)',
          maxHeight: '92dvh',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
          animation: 'slideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* CSS Slide Up Animation Keyframe Inline */}
        <style dangerouslySetInnerHTML={{ __html: `
          @keyframes slideUp {
            from { transform: translateY(100%); }
            to   { transform: translateY(0); }
          }
          input, select, textarea { font-size: max(16px, 1em); }
        `}} />

        {/* Close Button */}
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            right: '16px',
            top: '16px',
            width: '36px',
            height: '36px',
            borderRadius: '50%',
            backgroundColor: 'rgba(12, 13, 16, 0.6)',
            backdropFilter: 'blur(4px)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            color: 'var(--text-primary)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10
          }}
        >
          <X size={18} />
        </button>

        {/* Large Image Header */}
        <div style={{ position: 'relative', width: '100%', height: 'clamp(180px, 42vw, 260px)', overflow: 'hidden' }}>
          <img
            src={item.imageUrl}
            alt={item.name}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover'
            }}
          />
          {/* Bottom Gradient overlay */}
          <div
            style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              height: '80px',
              background: 'linear-gradient(to top, #121316, transparent)'
            }}
          />
          {/* Weight / Calorie Tag */}
          {item.weightLabel && (
            <div
              style={{
                position: 'absolute',
                bottom: '16px',
                right: '20px',
                backgroundColor: 'var(--accent-gold)',
                color: 'var(--bg-dark)',
                fontFamily: 'var(--font-sans)',
                fontSize: '10px',
                fontWeight: 700,
                padding: '4px 10px',
                borderRadius: '2px',
                letterSpacing: '1px'
              }}
            >
              {item.weightLabel}
            </div>
          )}
        </div>

        {/* Content Container */}
        <div style={{ padding: '0 20px', paddingBottom: 'calc(28px + env(safe-area-inset-bottom, 0px))', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Title & Price */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <h2
                style={{
                  fontFamily: 'var(--font-serif)',
                  fontSize: '26px',
                  fontWeight: 500,
                  color: 'var(--text-primary)'
                }}
              >
                {item.name}
              </h2>
              <span
                style={{
                  fontFamily: 'var(--font-sans)',
                  fontSize: '20px',
                  fontWeight: 500,
                  color: 'var(--accent-gold)'
                }}
              >
                {item.price} Birr
              </span>
            </div>
            {item.subtitle && (
              <span
                style={{
                  fontFamily: 'var(--font-sans)',
                  fontSize: '13px',
                  color: 'var(--accent-gold)',
                  opacity: 0.8,
                  textTransform: 'uppercase',
                  letterSpacing: '1.5px',
                  display: 'block',
                  marginTop: '2px'
                }}
              >
                {item.subtitle}
              </span>
            )}
          </div>

          {/* Description */}
          <p
            style={{
              fontFamily: 'var(--font-sans)',
              fontSize: '14px',
              lineHeight: '1.6',
              color: 'var(--text-secondary)'
            }}
          >
            {item.fullDescription || item.description}
          </p>

          {/* Dietary Tags Row */}
          {item.tags.length > 0 && (
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {item.tags.map((tag) => {
                const colors = getDietaryTagStyle(tag);
                return (
                  <div
                    key={tag}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      padding: '4px 10px',
                      borderRadius: '4px',
                      border: `1px solid ${colors.border}`,
                      backgroundColor: colors.bg,
                      color: colors.text,
                      fontSize: '11px',
                      fontWeight: 500,
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px'
                    }}
                  >
                    {tag === 'vegetarian' && <Leaf size={10} />}
                    {tag === 'chef-pick' && <ShieldCheck size={10} />}
                    <span>{tag}</span>
                  </div>
                );
              })}
            </div>
          )}

          {/* Variant Selection if available */}
          {item.variants && item.variants.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <span
                style={{
                  fontFamily: 'var(--font-sans)',
                  fontSize: '11px',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: '1.5px',
                  color: 'var(--text-secondary)'
                }}
              >
                Choose Portion Size
              </span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {item.variants.map((v) => {
                  const isSel = selectedVariant === v.name;
                  return (
                    <label
                      key={v.name}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '12px 16px',
                        borderRadius: '4px',
                        border: '1px solid',
                        borderColor: isSel ? 'var(--accent-gold)' : 'rgba(255, 255, 255, 0.05)',
                        backgroundColor: isSel ? 'rgba(201, 168, 118, 0.05)' : 'rgba(22, 23, 29, 0.4)',
                        cursor: 'pointer',
                        transition: 'var(--transition-smooth)'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <input
                          type="radio"
                          name="variant"
                          value={v.name}
                          checked={isSel}
                          onChange={() => setSelectedVariant(v.name)}
                          style={{
                            accentColor: 'var(--accent-gold)',
                            cursor: 'pointer'
                          }}
                        />
                        <span
                          style={{
                            fontFamily: 'var(--font-sans)',
                            fontSize: '14px',
                            fontWeight: isSel ? 600 : 400,
                            color: isSel ? 'var(--text-primary)' : 'var(--text-secondary)'
                          }}
                        >
                          {v.name}
                        </span>
                      </div>
                      <span
                        style={{
                          fontFamily: 'var(--font-sans)',
                          fontSize: '13px',
                          color: isSel ? 'var(--accent-gold)' : 'var(--text-secondary)',
                          fontWeight: isSel ? 600 : 400
                        }}
                      >
                        {v.priceAdjustment > 0 ? `+${v.priceAdjustment} Birr` : 'Included'}
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          {/* Allergens Notice if available */}
          {item.allergens && item.allergens.length > 0 && (
            <div
              style={{
                display: 'flex',
                gap: '10px',
                padding: '12px 16px',
                backgroundColor: 'rgba(255, 255, 255, 0.02)',
                border: '1px solid rgba(255, 255, 255, 0.04)',
                borderRadius: '4px'
              }}
            >
              <AlertTriangle size={16} style={{ color: 'var(--accent-gold)', flexShrink: 0, marginTop: '2px' }} />
              <div>
                <span
                  style={{
                    fontFamily: 'var(--font-sans)',
                    fontSize: '11px',
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    letterSpacing: '1px',
                    color: 'var(--text-secondary)',
                    display: 'block'
                  }}
                >
                  Allergen Warning
                </span>
                <span
                  style={{
                    fontFamily: 'var(--font-sans)',
                    fontSize: '12px',
                    color: 'var(--text-secondary)',
                    opacity: 0.8
                  }}
                >
                  Contains: {item.allergens.join(', ')}
                </span>
              </div>
            </div>
          )}

          {/* Quantity Controls & Add to Order Button */}
          <div
            style={{
              display: 'flex',
              gap: '16px',
              alignItems: 'center',
              marginTop: '10px',
              width: '100%'
            }}
          >
            {/* Quantity select */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                backgroundColor: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: '24px',
                height: '48px',
                padding: '4px',
                gap: '4px'
              }}
            >
              <button
                onClick={() => setQuantity(Math.max(1, quantity - 1))}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-secondary)',
                  cursor: 'pointer',
                  width: '40px',
                  height: '40px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: '50%',
                  transition: 'background-color 0.2s ease, color 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.08)';
                  e.currentTarget.style.color = 'var(--text-primary)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                  e.currentTarget.style.color = 'var(--text-secondary)';
                }}
              >
                <Minus size={16} />
              </button>
              <span
                style={{
                  fontFamily: 'var(--font-sans)',
                  fontSize: '16px',
                  fontWeight: 600,
                  width: '24px',
                  textAlign: 'center',
                  color: 'var(--text-primary)'
                }}
              >
                {quantity}
              </span>
              <button
                onClick={() => setQuantity(quantity + 1)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-secondary)',
                  cursor: 'pointer',
                  width: '40px',
                  height: '40px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: '50%',
                  transition: 'background-color 0.2s ease, color 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.08)';
                  e.currentTarget.style.color = 'var(--text-primary)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                  e.currentTarget.style.color = 'var(--text-secondary)';
                }}
              >
                <Plus size={16} />
              </button>
            </div>

            {/* Add Button */}
            <button
              onClick={handleAdd}
              disabled={addedAnimation}
              style={{
                marginLeft: 'auto',
                height: '48px',
                padding: '0 40px',
                borderRadius: '30px',
                border: 'none',
                backgroundColor: addedAnimation ? '#46553e' : 'var(--accent-gold)',
                color: addedAnimation ? '#f2efe9' : 'var(--bg-dark)',
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
                boxShadow: addedAnimation ? 'none' : '0 8px 20px rgba(201, 168, 118, 0.4)',
              }}
            >
              {addedAnimation ? (
                <>
                  <Check size={18} />
                  Added!
                </>
              ) : (
                <>
                  Add to order
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
