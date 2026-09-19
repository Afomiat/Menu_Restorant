import { useState, useRef, useEffect } from 'react';
import {
  Sandwich,
  Pizza,
  Fish,
  Drumstick,
  CupSoda,
  Coffee,
  Croissant,
  Cake,
  Salad,
  Beef,
  Utensils,
  Sparkles,
  Soup,
  Apple,
  UtensilsCrossed,
  MoreHorizontal,
  Edit2,
  Trash2,
} from 'lucide-react';
import type { Category } from '../types';

interface AdminCategoryCardProps {
  category: Category | { id: 'all'; name: string };
  count: number;
  isActive: boolean;
  onClick: () => void;
  onEdit?: (category: Category) => void;
  onDelete?: (category: Category) => void;
}

// Map category name keywords to charming icons and pastel background tints
function getCategoryIcon(name: string) {
  const lower = name.toLowerCase();

  if (lower.includes('all')) {
    return {
      icon: <UtensilsCrossed size={24} color="#475569" />,
      bg: '#f1f5f9',
    };
  }
  if (lower.includes('special') || lower.includes('chef') || lower.includes('feature')) {
    return {
      icon: <Sparkles size={24} color="#d97706" />,
      bg: '#fef3c7',
    };
  }
  if (lower.includes('starter') || lower.includes('appetizer')) {
    return {
      icon: <Salad size={24} color="#15803d" />,
      bg: '#dcfce7',
    };
  }
  if (lower.includes('main') || lower.includes('entree') || lower.includes('grill') || lower.includes('steak') || lower.includes('beef') || lower.includes('meat')) {
    return {
      icon: <Beef size={24} color="#be123c" />,
      bg: '#ffe4e6',
    };
  }
  if (lower.includes('side') || lower.includes('soup') || lower.includes('fries')) {
    return {
      icon: <Soup size={24} color="#4f46e5" />,
      bg: '#e0e7ff',
    };
  }
  if (lower.includes('dessert') || lower.includes('cake') || lower.includes('sweet') || lower.includes('pastry') || lower.includes('panna')) {
    return {
      icon: <Cake size={24} color="#db2777" />,
      bg: '#fce7f3',
    };
  }
  if (lower.includes('drink') || lower.includes('beverage') || lower.includes('juice') || lower.includes('bar') || lower.includes('cocktail') || lower.includes('wine')) {
    return {
      icon: <CupSoda size={24} color="#0284c7" />,
      bg: '#e0f2fe',
    };
  }
  if (lower.includes('fruit')) {
    return {
      icon: <Apple size={24} color="#65a30d" />,
      bg: '#ecfccb',
    };
  }
  if (lower.includes('snack') || lower.includes('biscuit') || lower.includes('croissant') || lower.includes('bread')) {
    return {
      icon: <Croissant size={24} color="#b45309" />,
      bg: '#fef3c7',
    };
  }
  if (lower.includes('burger') || lower.includes('sandwich')) {
    return {
      icon: <Sandwich size={24} color="#d97706" />,
      bg: '#fef3c7',
    };
  }
  if (lower.includes('pizza')) {
    return {
      icon: <Pizza size={24} color="#ea580c" />,
      bg: '#ffedd5',
    };
  }
  if (lower.includes('coffee') || lower.includes('cafe') || lower.includes('espresso') || lower.includes('tea')) {
    return {
      icon: <Coffee size={24} color="#78350f" />,
      bg: '#fef3c7',
    };
  }
  if (lower.includes('chicken') || lower.includes('wing') || lower.includes('poultry')) {
    return {
      icon: <Drumstick size={24} color="#c2410c" />,
      bg: '#ffedd5',
    };
  }
  if (lower.includes('fish') || lower.includes('seafood') || lower.includes('salmon') || lower.includes('prawn')) {
    return {
      icon: <Fish size={24} color="#0891b2" />,
      bg: '#cffafe',
    };
  }
  if (lower.includes('salad') || lower.includes('vegan') || lower.includes('green')) {
    return {
      icon: <Salad size={24} color="#15803d" />,
      bg: '#dcfce7',
    };
  }

  // Fallback for Food or other general categories
  return {
    icon: <Utensils size={24} color="#ea580c" />,
    bg: '#fff7ed',
  };
}

export default function AdminCategoryCard({
  category,
  count,
  isActive,
  onClick,
  onEdit,
  onDelete,
}: AdminCategoryCardProps) {
  const { icon, bg } = getCategoryIcon(category.name);
  const [menuOpen, setMenuOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const isAll = category.id === 'all';

  // Close dropdown on click outside
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

  return (
    <div
      className={`admin-category-card ${isActive ? 'active' : ''}`}
      onClick={onClick}
      role="button"
      tabIndex={0}
      title={`${category.name} (${count} dishes)`}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          onClick();
        }
      }}
    >
      {/* 3-Dots Action Button for Categories (like Food Cards) */}
      {!isAll && (onEdit || onDelete) && (
        <div ref={dropdownRef} className="admin-cat-menu-wrap" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            className="admin-cat-dots-btn"
            onClick={(e) => {
              e.stopPropagation();
              setMenuOpen(!menuOpen);
            }}
            title="Category options"
            aria-label="Category options"
          >
            <MoreHorizontal size={17} />
          </button>

          {menuOpen && (
            <div className="admin-cat-dropdown">
              {onEdit && (
                <button
                  type="button"
                  className="admin-dropdown-item"
                  onClick={(e) => {
                    e.stopPropagation();
                    setMenuOpen(false);
                    onEdit(category as Category);
                  }}
                >
                  <Edit2 size={14} />
                  <span>Rename</span>
                </button>
              )}

              {onDelete && (
                <button
                  type="button"
                  className="admin-dropdown-item danger"
                  onClick={(e) => {
                    e.stopPropagation();
                    setMenuOpen(false);
                    onDelete(category as Category);
                  }}
                >
                  <Trash2 size={14} />
                  <span>Delete</span>
                </button>
              )}
            </div>
          )}
        </div>
      )}

      <div className="admin-cat-icon-wrap" style={{ backgroundColor: bg }}>
        {icon}
      </div>
      <span className="admin-cat-name">{category.name}</span>
      <span className="admin-cat-count">{count} {count === 1 ? 'item' : 'items'}</span>
    </div>
  );
}
