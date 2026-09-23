import { Plus, Minus, Flame, Leaf } from 'lucide-react';
import type { MenuItem } from '../../types';
import { formatNumber } from '../../utils/currency';
import { useFeatureGate } from '../../hooks/useFeatureGate';

interface ModernFoodGridProps {
  items: MenuItem[];
  currency?: string;
  onSelectItem: (item: MenuItem) => void;
  onQuickAdd: (item: MenuItem) => void;
  onQuickSubtract: (itemId: string) => void;
  getItemQuantity: (itemId: string) => number;
}

export default function ModernFoodGrid({
  items,
  currency = 'ETB',
  onSelectItem,
  onQuickAdd,
  onQuickSubtract,
  getItemQuantity,
}: ModernFoodGridProps) {
  const { can } = useFeatureGate();
  if (items.length === 0) {
    return (
      <div className="modern-empty-state">
        <div className="modern-empty-icon">🍽️</div>
        <div className="modern-empty-title">No dishes found</div>
        <p className="modern-empty-desc">
          Try clearing your search or switching to another category.
        </p>
      </div>
    );
  }

  return (
    <div className="modern-food-grid">
      {items.map((item) => {
        const qty = getItemQuantity(item.id);
        const badgeText = item.badge?.includes('%') ? null : item.badge;
        const hasBadge = Boolean(
          badgeText ||
          (item.tags?.includes('chef-pick') ? "Chef's Pick" : null)
        );
        const badgeLabel = badgeText || "Chef's Pick";

        const isSoldOut = item.available === false;

        return (
          <div
            key={item.id}
            className={`modern-food-card ${isSoldOut ? 'sold-out' : ''}`}
            onClick={() => onSelectItem(item)}
            role="button"
            tabIndex={0}
            style={isSoldOut ? { opacity: 0.82 } : undefined}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onSelectItem(item);
              }
            }}
          >
            {/* Image Container */}
            <div className="modern-card-image-wrap">
              <img
                src={item.imageUrl}
                alt={item.name}
                className="modern-card-image"
                loading="lazy"
                style={isSoldOut ? { filter: 'grayscale(50%)' } : undefined}
                onError={(e) => {
                  (e.target as HTMLImageElement).src = '/images/default_food.png';
                }}
              />
              {isSoldOut ? (
                <span
                  className="modern-card-badge sold-out"
                  style={{ backgroundColor: '#ef4444', color: '#ffffff', fontWeight: 800 }}
                >
                  SOLD OUT
                </span>
              ) : (
                hasBadge && <span className="modern-card-badge">{badgeLabel}</span>
              )}
            </div>

            {/* Title & Subtitle */}
            <div className="modern-card-content">
              <h3 className="modern-card-title">{item.name}</h3>
              <p className="modern-card-subtitle">
                {item.subtitle || item.description}
              </p>
              {/* Dietary tags ("Chef's Pick" is already shown as the image badge) */}
              {item.tags?.some((tag) => tag !== 'chef-pick') && (
                <div className="modern-card-tags">
                  {item.tags.includes('spicy') && (
                    <span className="modern-card-tag spicy">
                      <Flame size={10} /> Spicy
                    </span>
                  )}
                  {item.tags.includes('vegetarian') && (
                    <span className="modern-card-tag green">
                      <Leaf size={10} /> Vegetarian
                    </span>
                  )}
                  {item.tags.includes('vegan') && (
                    <span className="modern-card-tag green">
                      <Leaf size={10} /> Vegan
                    </span>
                  )}
                  {item.tags.includes('gluten-free') && (
                    <span className="modern-card-tag">Gluten-Free</span>
                  )}
                </div>
              )}
            </div>

            {/* Price & Action */}
            <div className="modern-card-footer">
              <div className="modern-card-price-box">
                <span className="modern-card-price">
                  {formatNumber(item.price)}
                </span>
                <span className="modern-card-currency">{currency}</span>
              </div>

              {!isSoldOut && (
                can('ordering') ? (
                  qty > 0 ? (
                    <div
                      className="modern-card-qty-pill"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        type="button"
                        className="modern-card-qty-btn"
                        onClick={() => onQuickSubtract(item.id)}
                        aria-label={`Decrease ${item.name} quantity`}
                      >
                        <Minus size={12} />
                      </button>
                      <span className="modern-card-qty-num">{qty}</span>
                      <button
                        type="button"
                        className="modern-card-qty-btn"
                        onClick={() => onQuickAdd(item)}
                        aria-label={`Increase ${item.name} quantity`}
                      >
                        <Plus size={12} />
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      className="modern-card-action-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        onQuickAdd(item);
                      }}
                      aria-label={`Add ${item.name} to tray`}
                    >
                      <Plus size={16} />
                    </button>
                  )
                ) : (
                  <span
                    style={{
                      fontSize: '11px',
                      color: 'var(--modern-text-muted)',
                      fontWeight: 600,
                      padding: '4px 10px',
                      borderRadius: '999px',
                      backgroundColor: 'rgba(0, 0, 0, 0.05)',
                    }}
                  >
                    Details &rarr;
                  </span>
                )
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
