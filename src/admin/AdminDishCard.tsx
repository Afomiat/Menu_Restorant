import { useState, useRef, useEffect } from 'react';
import { MoreHorizontal, Edit2, Trash2, CheckCircle2, XCircle } from 'lucide-react';
import type { MenuItem } from '../types';
import { formatCurrency } from '../utils/currency';

interface AdminDishCardProps {
  item: MenuItem;
  categoryName: string;
  currency: string;
  onEdit: (item: MenuItem) => void;
  onDelete: (itemId: string) => void;
  onUpdatePrice: (itemId: string, newPrice: number) => void;
  onToggleStock: (itemId: string) => void;
}

export default function AdminDishCard({
  item,
  categoryName,
  currency,
  onEdit,
  onDelete,
  onUpdatePrice,
  onToggleStock,
}: AdminDishCardProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [isEditingPrice, setIsEditingPrice] = useState(false);
  const [priceInput, setPriceInput] = useState(item.price.toString());
  const dropdownRef = useRef<HTMLDivElement>(null);

  const isAvailable = item.available !== false;

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }
    if (menuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [menuOpen]);

  const handlePriceBlur = () => {
    setIsEditingPrice(false);
    const parsed = parseFloat(priceInput);
    if (!isNaN(parsed) && parsed >= 0 && parsed !== item.price) {
      onUpdatePrice(item.id, parsed);
    } else {
      setPriceInput(item.price.toString());
    }
  };

  const handlePriceKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handlePriceBlur();
    } else if (e.key === 'Escape') {
      setIsEditingPrice(false);
      setPriceInput(item.price.toString());
    }
  };

  return (
    <div className={`admin-dish-card ${!isAvailable ? 'out-of-stock' : ''}`}>
      {/* Top Header: Image & Dropdown */}
      <div className="admin-dish-card-header">
        <div className="admin-dish-img-wrap">
          <img
            src={item.imageUrl || '/images/cat_food.jpg'}
            alt={item.name}
            className="admin-dish-img"
            loading="lazy"
            onError={(e) => {
              (e.target as HTMLImageElement).src = '/images/cat_food.jpg';
            }}
          />
          {!isAvailable && (
            <div className="admin-dish-sold-badge-overlay">
              <span>SOLD OUT</span>
            </div>
          )}
        </div>

        <div ref={dropdownRef}>
          <button
            type="button"
            className="admin-dish-dots-btn"
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label="Dish actions"
          >
            <MoreHorizontal size={20} />
          </button>

          {menuOpen && (
            <div className="admin-dish-dropdown">
              <button
                type="button"
                className="admin-dropdown-item"
                onClick={() => {
                  setMenuOpen(false);
                  onEdit(item);
                }}
              >
                <Edit2 size={14} />
                <span>Edit Dish</span>
              </button>

              <button
                type="button"
                className="admin-dropdown-item"
                onClick={() => {
                  setMenuOpen(false);
                  onToggleStock(item.id);
                }}
              >
                {isAvailable ? <XCircle size={14} /> : <CheckCircle2 size={14} />}
                <span>{isAvailable ? 'Mark Sold Out' : 'Mark In Stock'}</span>
              </button>

              <button
                type="button"
                className="admin-dropdown-item danger"
                onClick={() => {
                  setMenuOpen(false);
                  onDelete(item.id);
                }}
              >
                <Trash2 size={14} />
                <span>Delete</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Body Information */}
      <div className="admin-dish-info">
        <span className="admin-dish-category-label">{categoryName}</span>

        <div className="admin-dish-title-row">
          <h4 className="admin-dish-title" title={item.name}>
            {item.name}
          </h4>
        </div>

        {/* Dietary and promotional tags */}
        {item.tags && item.tags.length > 0 && (
          <div className="admin-dish-tags">
            {item.tags.map((tag) => (
              <span key={tag} className={`admin-tag-chip ${tag}`}>
                {tag.replace('-', ' ')}
              </span>
            ))}
          </div>
        )}

        <p className="admin-dish-desc">
          {item.description || 'Freshly prepared with authentic ingredients.'}
        </p>

        {/* Footer: Price with Quick Edit + Stock Pill */}
        <div className="admin-dish-footer">
          <div className="admin-dish-price-wrap">
            {isEditingPrice ? (
              <input
                type="number"
                step="0.01"
                autoFocus
                className="admin-dish-price-input"
                value={priceInput}
                onChange={(e) => setPriceInput(e.target.value)}
                onBlur={handlePriceBlur}
                onKeyDown={handlePriceKeyDown}
              />
            ) : (
              <span
                className="admin-dish-price"
                title="Click to edit price"
                style={{ cursor: 'pointer' }}
                onClick={() => setIsEditingPrice(true)}
              >
                {formatCurrency(item.price, currency)}
              </span>
            )}
          </div>

          <button
            type="button"
            className={`admin-dish-stock-pill ${isAvailable ? 'in-stock' : 'out-of-stock'}`}
            onClick={() => onToggleStock(item.id)}
            title="Click to toggle availability"
          >
            {isAvailable ? (
              <>
                <CheckCircle2 size={12} />
                <span>In Stock</span>
              </>
            ) : (
              <>
                <XCircle size={12} />
                <span>Sold Out</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
