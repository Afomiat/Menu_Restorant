import { X, Plus, Minus, Flame, Leaf, ShieldAlert } from 'lucide-react';
import type { MenuItem } from '../../types';
import { formatPrice } from '../../utils/currency';
import { useItemModalLogic } from '../../hooks/useItemModalLogic';
import { useFeatureGate } from '../../hooks/useFeatureGate';

interface ModernItemModalProps {
  item: MenuItem | null;
  currency?: string;
  onClose: () => void;
  onAddToCart: (item: MenuItem, quantity: number, variant: string) => void;
}

export default function ModernItemModal({
  item,
  currency = 'ETB',
  onClose,
  onAddToCart,
}: ModernItemModalProps) {
  const { can } = useFeatureGate();
  const {
    quantity,
    selectedVariant,
    setSelectedVariant,
    unitPrice,
    totalPrice,
    incrementQuantity,
    decrementQuantity,
  } = useItemModalLogic({ item });

  if (!item) return null;

  const handleAdd = () => {
    onAddToCart(item, quantity, selectedVariant);
    onClose();
  };

  return (
    <div
      className="modern-modal-overlay"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-dish-title"
    >
      <div
        className="modern-modal-sheet"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modern-modal-drag-handle" />

        {/* Modal Hero Image */}
        <div className="modern-modal-header">
          <button
            type="button"
            className="modern-modal-close-btn"
            onClick={onClose}
            aria-label="Close modal"
          >
            <X size={18} />
          </button>
          <img
            src={item.imageUrl}
            alt={item.name}
            className="modern-modal-hero-img"
          />
        </div>

        {/* Modal Body */}
        <div className="modern-modal-body" style={!can('ordering') ? { paddingBottom: '32px' } : undefined}>
          <div className="modern-modal-title-row">
            <div>
              <h2 id="modal-dish-title" className="modern-modal-title">
                {item.name}
              </h2>
              {item.subtitle && (
                <p className="modern-card-subtitle" style={{ fontSize: '13px', marginTop: '2px' }}>
                  {item.subtitle}
                </p>
              )}
            </div>
            <div className="modern-modal-price">{formatPrice(unitPrice)}</div>
          </div>

          {/* Tags & Weight */}
          <div className="modern-modal-tags">
            {item.weightLabel && (
              <span className="modern-modal-tag" style={{ fontWeight: 700 }}>
                ⚖️ {item.weightLabel}
              </span>
            )}
            {item.tags.includes('chef-pick') && (
              <span className="modern-modal-tag" style={{ backgroundColor: 'var(--modern-primary-light)', color: 'var(--modern-primary)' }}>
                ⭐ Chef's Pick
              </span>
            )}
            {item.tags.includes('spicy') && (
              <span className="modern-modal-tag" style={{ color: '#e53e3e' }}>
                <Flame size={12} style={{ display: 'inline', marginRight: 4 }} />
                Spicy
              </span>
            )}
            {item.tags.includes('vegetarian') && (
              <span className="modern-modal-tag" style={{ color: '#2b8a3e' }}>
                <Leaf size={12} style={{ display: 'inline', marginRight: 4 }} />
                Vegetarian
              </span>
            )}
            {item.tags.includes('vegan') && (
              <span className="modern-modal-tag" style={{ color: '#2b8a3e' }}>
                <Leaf size={12} style={{ display: 'inline', marginRight: 4 }} />
                Vegan
              </span>
            )}
            {item.tags.includes('gluten-free') && (
              <span className="modern-modal-tag">Gluten-Free</span>
            )}
          </div>

          {/* Description */}
          <p className="modern-modal-desc">
            {item.fullDescription || item.description}
          </p>

          {/* Allergens Warning */}
          {item.allergens && item.allergens.length > 0 && (
            <div className="modern-modal-allergens">
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700, marginBottom: '2px' }}>
                <ShieldAlert size={14} /> Allergen Advisory
              </div>
              <div>Contains: {item.allergens.join(', ')}</div>
            </div>
          )}

          {/* Variants Selector */}
          {item.variants && item.variants.length > 0 && (
            <div>
              <label
                style={{
                  fontSize: '12px',
                  fontWeight: 700,
                  color: 'var(--modern-text-dark)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  display: 'block',
                  marginBottom: '8px',
                }}
              >
                Choose Variant
              </label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {item.variants.map((v) => {
                  const isSelected = selectedVariant === v.name;
                  return (
                    <button
                      key={v.name}
                      type="button"
                      className={`modern-dietary-pill ${isSelected ? 'active' : ''}`}
                      onClick={() => setSelectedVariant(v.name)}
                    >
                      {v.name} {v.priceAdjustment > 0 && `(+${formatPrice(v.priceAdjustment)})`}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        {/* Modal Footer - only rendered when ordering is enabled */}
        {can('ordering') && (
          <div className="modern-modal-footer">
            <div className="modern-modal-qty-control">
              <button
                type="button"
                className="modern-modal-qty-btn"
                onClick={decrementQuantity}
                disabled={quantity <= 1}
                aria-label="Decrease quantity"
              >
                <Minus size={14} />
              </button>
              <span className="modern-modal-qty-text">{quantity}</span>
              <button
                type="button"
                className="modern-modal-qty-btn"
                onClick={incrementQuantity}
                aria-label="Increase quantity"
              >
                <Plus size={14} />
              </button>
            </div>

            {item.available === false ? (
              <button
                type="button"
                className="modern-modal-cta-btn"
                disabled
                style={{ backgroundColor: '#ef4444', cursor: 'not-allowed', opacity: 0.85 }}
              >
                Currently Sold Out
              </button>
            ) : (
              <button
                type="button"
                className="modern-modal-cta-btn"
                onClick={handleAdd}
              >
                Add to Order • {formatPrice(totalPrice, currency)}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
