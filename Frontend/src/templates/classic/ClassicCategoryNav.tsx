import { useRef, useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { Category } from '../../types';

interface ClassicCategoryNavProps {
  categories: Category[];
  activeCategory: string;
  onCategorySelect: (id: string) => void;
}

export default function ClassicCategoryNav({
  categories,
  activeCategory,
  onCategorySelect,
}: ClassicCategoryNavProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const checkScroll = () => {
    if (scrollRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
      setCanScrollLeft(scrollLeft > 6);
      setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 6);
    }
  };

  useEffect(() => {
    checkScroll();
    const el = scrollRef.current;
    if (!el) return;
    el.addEventListener('scroll', checkScroll, { passive: true });
    window.addEventListener('resize', checkScroll);
    return () => {
      el.removeEventListener('scroll', checkScroll);
      window.removeEventListener('resize', checkScroll);
    };
  }, [categories]);

  // Auto-scroll active category into view
  useEffect(() => {
    if (scrollRef.current) {
      const activeEl = scrollRef.current.querySelector<HTMLElement>('.classic-cat-nav-btn.active');
      if (activeEl) {
        activeEl.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
      }
      setTimeout(checkScroll, 300);
    }
  }, [activeCategory]);

  const handleScrollLeft = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollBy({ left: -140, behavior: 'smooth' });
    }
  };

  const handleScrollRight = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollBy({ left: 140, behavior: 'smooth' });
    }
  };

  return (
    <div className="classic-category-nav-container">
      {/* Cute Left Arrow Button */}
      <button
        type="button"
        className={`classic-cat-nav-arrow classic-cat-nav-arrow-left ${!canScrollLeft ? 'is-disabled' : ''}`}
        onClick={handleScrollLeft}
        aria-label="Previous categories"
        disabled={!canScrollLeft}
      >
        <ChevronLeft size={14} />
      </button>

      <div
        ref={scrollRef}
        className="hide-scrollbar classic-category-scroll-track"
      >
        <div className="category-nav-wrapper">
          {categories.map((cat) => {
            const isActive = activeCategory === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => onCategorySelect(cat.id)}
                className={`classic-cat-nav-btn ${isActive ? 'active' : ''}`}
                type="button"
              >
                {cat.name}
                {isActive && <div className="classic-cat-nav-indicator" />}
              </button>
            );
          })}
        </div>
      </div>

      {/* Cute Right Arrow Button */}
      <button
        type="button"
        className={`classic-cat-nav-arrow classic-cat-nav-arrow-right ${!canScrollRight ? 'is-disabled' : ''}`}
        onClick={handleScrollRight}
        aria-label="Next categories"
        disabled={!canScrollRight}
      >
        <ChevronRight size={14} />
      </button>
    </div>
  );
}
