import { useRef, useState, useEffect, useMemo } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { Category, MenuItem } from '../../types';

interface ModernCategoryBarProps {
  categories: Category[];
  activeCategory: string;
  onSelectCategory: (categoryId: string) => void;
  items: MenuItem[];
}

export default function ModernCategoryBar({
  categories,
  activeCategory,
  onSelectCategory,
  items,
}: ModernCategoryBarProps) {
  const sectionRef = useRef<HTMLElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState<number>(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth < 768 ? window.innerWidth : Math.min(window.innerWidth, 1200);
    }
    return 400;
  });

  // Measure actual rendered width to ensure 1:1 SVG pixel-to-CSS-pixel ratio (zero distortion)
  useEffect(() => {
    if (!sectionRef.current) return;
    const updateWidth = () => {
      if (sectionRef.current) {
        const rect = sectionRef.current.getBoundingClientRect();
        if (rect.width > 0) {
          setContainerWidth(Math.round(rect.width));
        }
      }
    };
    updateWidth();
    const ro = new ResizeObserver(() => updateWidth());
    ro.observe(sectionRef.current);
    window.addEventListener('resize', updateWidth);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', updateWidth);
    };
  }, []);

  // Helper to determine the circular thumbnail for each category
  const getCategoryIcon = (category: Category): string => {
    if (category.iconUrl) return category.iconUrl;
    if (category.id === 'all') return '/images/cat_all.jpg';
    const itemInCat = items.find((it) => it.categoryId === category.id && it.imageUrl);
    if (itemInCat) return itemInCat.imageUrl;
    return '/images/cat_food.jpg';
  };

  // Dynamically arrange categories with "All" placed centrally and symmetric balance
  const arrangedCategories = useMemo(() => {
    const hasAll = categories.find((c) => c.id.toLowerCase() === 'all' || c.name.toLowerCase() === 'all');
    const nonAllCats = categories.filter((c) => c.id.toLowerCase() !== 'all' && c.name.toLowerCase() !== 'all');

    const allCat: Category = hasAll || {
      id: 'all',
      name: 'All',
      sortOrder: 0,
      iconUrl: '/images/cat_all.jpg',
    };

    if (nonAllCats.length === 0) {
      return [allCat];
    }

    // Perfectly balanced center placement for "All" across any category count
    const half = Math.floor(nonAllCats.length / 2);
    const left = nonAllCats.slice(0, half);
    const right = nonAllCats.slice(half);

    return [...left, allCat, ...right];
  }, [categories]);

  // Determine if we should use horizontal carousel mode (when too many items for a phone screen)
  const isMobile = containerWidth < 640;
  const isCarouselMode = isMobile && arrangedCategories.length > 5;

  // Scroll tracking state for cute left/right arrow buttons
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const checkScroll = () => {
    if (scrollContainerRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollContainerRef.current;
      setCanScrollLeft(scrollLeft > 6);
      setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 6);
    }
  };

  useEffect(() => {
    if (isCarouselMode) {
      checkScroll();
      const el = scrollContainerRef.current;
      if (!el) return;
      el.addEventListener('scroll', checkScroll, { passive: true });
      window.addEventListener('resize', checkScroll);
      return () => {
        el.removeEventListener('scroll', checkScroll);
        window.removeEventListener('resize', checkScroll);
      };
    }
  }, [isCarouselMode, arrangedCategories]);

  // Auto-scroll active category into view in carousel mode
  useEffect(() => {
    if (isCarouselMode && scrollContainerRef.current) {
      const activeEl = scrollContainerRef.current.querySelector<HTMLElement>('.modern-scroll-cat-btn.active');
      if (activeEl) {
        activeEl.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
      }
      setTimeout(checkScroll, 300);
    }
  }, [activeCategory, isCarouselMode]);

  const handleScrollLeft = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollBy({ left: -150, behavior: 'smooth' });
    }
  };

  const handleScrollRight = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollBy({ left: 150, behavior: 'smooth' });
    }
  };

  // Pure Circle Geometry Calculations for Arc Mode
  const W = containerWidth;
  const Cx = W / 2;

  // Radius of outer circular curve (gentle arch)
  const R_outer = Math.round(W * (isMobile ? 1.05 : 0.98));
  const bandThickness = Math.round(isMobile ? Math.min(132, W * 0.33) : 142);
  const R_inner = R_outer - bandThickness;

  const y_apex_top = 8;
  const Cy = y_apex_top + R_outer;

  // Endpoints where arcs touch left (x=0) and right (x=W) edges
  const dx_edge = Cx;
  const y_top_edge = Cy - Math.sqrt(Math.max(0, R_outer * R_outer - dx_edge * dx_edge));
  const y_bot_edge = Cy - Math.sqrt(Math.max(0, R_inner * R_inner - dx_edge * dx_edge));
  const svgHeight = Math.ceil(y_bot_edge) + 6;

  // Exact concentric circular arc path
  const arcPath = [
    `M 0,${y_top_edge.toFixed(2)}`,
    `A ${R_outer} ${R_outer} 0 0 1 ${W},${y_top_edge.toFixed(2)}`,
    `L ${W},${y_bot_edge.toFixed(2)}`,
    `A ${R_inner} ${R_inner} 0 0 0 0,${y_bot_edge.toFixed(2)}`,
    'Z',
  ].join(' ');

  // Midline circle for button placement
  const R_mid = (R_outer + R_inner) / 2;
  const trackWidth = Math.min(W - (isMobile ? 16 : 32), isMobile ? 480 : 680);
  const totalCategories = arrangedCategories.length;
  const middleIndex = (totalCategories - 1) / 2;
  const maxDx = Math.min(R_mid * 0.78, (trackWidth / 2) * 0.92);

  if (isCarouselMode) {
    // Clean, responsive horizontal scroll carousel for 6+ categories on mobile phones
    return (
      <section
        ref={sectionRef}
        className="modern-category-carousel-section"
        aria-label="Menu Categories"
      >
        <div className="modern-carousel-inner-wrap">
          {/* Cute Left Nav Arrow Button */}
          <button
            type="button"
            className={`modern-carousel-nav-btn modern-carousel-nav-left ${!canScrollLeft ? 'is-disabled' : ''}`}
            onClick={handleScrollLeft}
            aria-label="Previous categories"
            disabled={!canScrollLeft}
          >
            <ChevronLeft size={16} />
          </button>

          <div
            ref={scrollContainerRef}
            className="modern-category-carousel-track"
          >
            {arrangedCategories.map((cat) => {
              const isActive = activeCategory === cat.id;
              const iconSrc = getCategoryIcon(cat);

              return (
                <button
                  key={cat.id}
                  type="button"
                  className={`modern-scroll-cat-btn ${isActive ? 'active' : ''}`}
                  onClick={() => onSelectCategory(cat.id)}
                  aria-pressed={isActive}
                >
                  <div className="modern-scroll-cat-disc">
                    <img
                      src={iconSrc}
                      alt={cat.name}
                      className="modern-scroll-cat-img"
                      loading="lazy"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = '/images/cat_food.jpg';
                      }}
                    />
                  </div>
                  <span className="modern-scroll-cat-label">{cat.name}</span>
                  {isActive && <div className="modern-arc-active-bar" />}
                </button>
              );
            })}
          </div>

          {/* Cute Right Nav Arrow Button */}
          <button
            type="button"
            className={`modern-carousel-nav-btn modern-carousel-nav-right ${!canScrollRight ? 'is-disabled' : ''}`}
            onClick={handleScrollRight}
            aria-label="Next categories"
            disabled={!canScrollRight}
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </section>
    );
  }

  return (
    <section
      ref={sectionRef}
      className="modern-arc-fullwidth-section"
      style={{ minHeight: `${svgHeight}px` }}
      aria-label="Menu Categories"
    >
      {/* 100% Pure Circular Concentric SVG Band */}
      <svg
        className="modern-arc-fullwidth-svg"
        width={W}
        height={svgHeight}
        viewBox={`0 0 ${W} ${svgHeight}`}
        aria-hidden="true"
      >
        <path d={arcPath} fill="#edf1f6" />
      </svg>

      {/* Category Icons Track positioned along the exact mathematically symmetric arc */}
      <div
        className="modern-arc-items-container"
        style={{
          maxWidth: `${trackWidth}px`,
          marginTop: `${y_apex_top + 14}px`,
        }}
      >
        {arrangedCategories.map((cat, idx) => {
          const isActive = activeCategory === cat.id;
          const iconSrc = getCategoryIcon(cat);

          // Mathematically exact normalized X from -1 (leftmost) to 0 (center apex) to +1 (rightmost)
          const normalizedX = middleIndex > 0 ? (idx - middleIndex) / middleIndex : 0;
          const dx = normalizedX * maxDx;

          // Pure circle formula: Y offset = R_mid - sqrt(R_mid^2 - dx^2) (100% symmetric at dx and -dx)
          const curveOffset = Math.round(
            R_mid - Math.sqrt(Math.max(0, R_mid * R_mid - dx * dx))
          );

          return (
            <button
              key={cat.id}
              type="button"
              className={`modern-arc-btn ${isActive ? 'active' : ''}`}
              style={{
                '--curve-y': `${curveOffset}px`,
                transform: `translateY(${curveOffset}px)`,
              } as React.CSSProperties}
              onClick={() => onSelectCategory(cat.id)}
              aria-pressed={isActive}
            >
              {/* Pure White Circular Disc */}
              <div className="modern-arc-disc">
                <img
                  src={iconSrc}
                  alt={cat.name}
                  className="modern-arc-disc-img"
                  loading="lazy"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = '/images/cat_food.jpg';
                  }}
                />
              </div>

              {/* Category Label */}
              <span className="modern-arc-btn-label">{cat.name}</span>

              {/* Active Black Rounded Pill Indicator */}
              {isActive && <div className="modern-arc-active-bar" />}
            </button>
          );
        })}
      </div>
    </section>
  );
}
