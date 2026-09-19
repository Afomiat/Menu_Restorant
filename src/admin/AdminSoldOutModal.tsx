import { useState, useEffect, useRef } from 'react';
import { X, Search, CheckSquare, Square, AlertCircle, Save } from 'lucide-react';
import type { MenuItem } from '../types';
import { formatCurrency } from '../utils/currency';

interface AdminSoldOutModalProps {
  isOpen: boolean;
  items: MenuItem[];
  currency: string;
  onClose: () => void;
  onSaveSoldOut: (soldOutItemIds: Set<string>) => void;
}

export default function AdminSoldOutModal({
  isOpen,
  items,
  currency,
  onClose,
  onSaveSoldOut,
}: AdminSoldOutModalProps) {
  // Set of item IDs that are marked as sold out (available === false)
  const [soldOutIds, setSoldOutIds] = useState<Set<string>>(new Set());
  const [searchFilter, setSearchFilter] = useState('');
  const prevOpenRef = useRef(false);

  useEffect(() => {
    if (isOpen && !prevOpenRef.current) {
      const initial = new Set<string>();
      items.forEach((it) => {
        if (it.available === false) {
          initial.add(it.id);
        }
      });
      setSoldOutIds(initial);
      setSearchFilter('');
    }
    prevOpenRef.current = isOpen;
  }, [isOpen, items]);

  if (!isOpen) return null;

  const toggleItem = (id: string) => {
    setSoldOutIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    const all = new Set<string>();
    items.forEach((it) => all.add(it.id));
    setSoldOutIds(all);
  };

  const handleClearAll = () => {
    setSoldOutIds(new Set());
  };

  const handleSave = () => {
    onSaveSoldOut(soldOutIds);
    onClose();
  };

  const filteredItems = items.filter((item) => {
    if (!searchFilter.trim()) return true;
    const q = searchFilter.toLowerCase();
    return (
      item.name.toLowerCase().includes(q) ||
      (item.subtitle && item.subtitle.toLowerCase().includes(q)) ||
      item.categoryId.toLowerCase().includes(q)
    );
  });

  return (
    <div className="admin-modal-overlay" onClick={onClose}>
      <div
        className="admin-modal-dialog"
        style={{ maxWidth: '640px', maxHeight: '88vh' }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="admin-modal-header">
          <div>
            <h3 className="admin-modal-title">Manage Sold Out Dishes</h3>
            <p style={{ fontSize: '12.5px', color: 'var(--admin-text-muted)', margin: '2px 0 0 0' }}>
              Select foods that are out of stock. Selected items will be marked as <strong>Sold Out</strong> on the customer menu.
            </p>
          </div>
          <button
            type="button"
            className="admin-modal-close-btn"
            onClick={onClose}
            aria-label="Close modal"
          >
            <X size={20} />
          </button>
        </div>

        {/* Search & Quick Select Bar */}
        <div style={{ padding: '16px 24px 0 24px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div className="admin-search-box" style={{ maxWidth: '100%' }}>
            <Search size={16} className="admin-search-icon" />
            <input
              type="text"
              className="admin-search-input-field"
              placeholder="Search dishes by name or category..."
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              autoFocus
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
            <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--admin-text-main)' }}>
              <strong>{soldOutIds.size}</strong> of {items.length} dishes marked as Sold Out
            </span>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                type="button"
                className="admin-sec-pill-btn"
                style={{ height: '32px', fontSize: '12px', padding: '0 12px' }}
                onClick={handleSelectAll}
              >
                Select All
              </button>
              <button
                type="button"
                className="admin-sec-pill-btn"
                style={{ height: '32px', fontSize: '12px', padding: '0 12px' }}
                onClick={handleClearAll}
              >
                Mark All In Stock
              </button>
            </div>
          </div>
        </div>

        {/* List of Menu Foods with Checkboxes */}
        <div className="admin-modal-body" style={{ padding: '16px 24px', overflowY: 'auto' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {filteredItems.map((item) => {
              const isSoldOut = soldOutIds.has(item.id);

              return (
                <div
                  key={item.id}
                  onClick={() => toggleItem(item.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '12px 16px',
                    borderRadius: 'var(--admin-radius-sm)',
                    border: isSoldOut ? '1px solid #fca5a5' : '1px solid var(--admin-border)',
                    backgroundColor: isSoldOut ? '#fef2f2' : '#ffffff',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    userSelect: 'none',
                  }}
                >
                  {/* Left: Checkbox + Dish info */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px', minWidth: 0 }}>
                    <div style={{ color: isSoldOut ? '#ef4444' : 'var(--admin-text-subtle)' }}>
                      {isSoldOut ? <CheckSquare size={20} /> : <Square size={20} />}
                    </div>

                    <div
                      style={{
                        width: '42px',
                        height: '42px',
                        borderRadius: '50%',
                        overflow: 'hidden',
                        flexShrink: 0,
                        backgroundColor: '#f1f5f9',
                      }}
                    >
                      <img
                        src={item.imageUrl || '/images/cat_food.jpg'}
                        alt={item.name}
                        style={{
                          width: '100%',
                          height: '100%',
                          objectFit: 'cover',
                          filter: isSoldOut ? 'grayscale(80%)' : 'none',
                        }}
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = '/images/cat_food.jpg';
                        }}
                      />
                    </div>

                    <div style={{ minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: '14px',
                          fontWeight: 700,
                          color: isSoldOut ? '#991b1b' : 'var(--admin-text-main)',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {item.name}
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--admin-text-muted)' }}>
                        {formatCurrency(item.price, currency)} • <span style={{ textTransform: 'capitalize' }}>{item.categoryId}</span>
                      </div>
                    </div>
                  </div>

                  {/* Right: Sold Out Status Badge */}
                  <div>
                    {isSoldOut ? (
                      <span
                        style={{
                          fontSize: '11.5px',
                          fontWeight: 800,
                          padding: '4px 10px',
                          borderRadius: '999px',
                          backgroundColor: '#ef4444',
                          color: '#ffffff',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                        }}
                      >
                        <AlertCircle size={12} />
                        SOLD OUT
                      </span>
                    ) : (
                      <span
                        style={{
                          fontSize: '11.5px',
                          fontWeight: 600,
                          padding: '4px 10px',
                          borderRadius: '999px',
                          backgroundColor: '#ecfdf5',
                          color: '#059669',
                        }}
                      >
                        In Stock
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer with Primary Save Button */}
        <div className="admin-modal-footer">
          <button type="button" className="admin-sec-pill-btn" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="admin-save-pill-btn"
            style={{ backgroundColor: 'var(--admin-primary)', padding: '0 24px' }}
            onClick={handleSave}
          >
            <Save size={16} />
            Save Sold Out Status
          </button>
        </div>
      </div>
    </div>
  );
}
