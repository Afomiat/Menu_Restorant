import type { Category } from '../data/menuData';

interface CategoryNavProps {
  categories: Category[];
  activeCategory: string;
  onCategorySelect: (id: string) => void;
}

export default function CategoryNav({
  categories,
  activeCategory,
  onCategorySelect
}: CategoryNavProps) {
  return (
    <div
      className="hide-scrollbar"
      style={{
        display: 'flex',
        overflowX: 'auto',
        backgroundColor: 'transparent',
        width: '100%'
      }}
    >
      <div className="category-nav-wrapper">
        {categories.map((cat) => {
          const isActive = activeCategory === cat.id;
          return (
            <button
              key={cat.id}
              onClick={() => onCategorySelect(cat.id)}
              style={{
                background: 'none',
                border: 'none',
                padding: '6px 4px',
                color: isActive ? 'var(--accent-gold)' : 'var(--text-secondary)',
                fontFamily: 'var(--font-serif)',
                fontSize: 'clamp(14px, 1.8vw, 17px)',
                fontStyle: 'italic',
                fontWeight: 500,
                textTransform: 'capitalize',
                letterSpacing: '0.5px',
                cursor: 'pointer',
                transition: 'var(--transition-smooth)',
                position: 'relative',
                whiteSpace: 'nowrap'
              }}
            >
              {cat.name}
              {isActive && (
                <div
                  style={{
                    position: 'absolute',
                    bottom: '-8px',
                    left: '10%',
                    right: '10%',
                    height: '2px',
                    backgroundColor: 'var(--accent-gold)',
                    boxShadow: 'var(--shadow-glow)',
                    animation: 'fadeIn 0.3s ease forwards'
                  }}
                />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
