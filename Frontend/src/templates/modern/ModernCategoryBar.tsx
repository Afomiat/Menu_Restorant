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

  const isMobile = containerWidth < 640;
  const totalCategories = arrangedCategories.length;

  // Wheel mode: when there are more categories than fit on the arc, they roll along it.
  const visibleSlots = isMobile ? 5 : 7;
  const isWheel = totalCategories > visibleSlots;
  const allIndex = Math.max(0, arrangedCategories.findIndex((c) => c.id === 'all'));

  // Index (fractional while dragging) of the category sitting at the arc apex
  const [center, setCenter] = useState(allIndex);
  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef<{ startX: number; startCenter: number; moved: boolean } | null>(null);
  const suppressClickRef = useRef(false);
  const wheelSnapTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const clampCenter = (value: number) => Math.min(totalCategories - 1, Math.max(0, value));

  // Keep the selected category at the apex when it changes from outside (e.g. search reset)
  useEffect(() => {
    if (!isWheel) return;
    const idx = arrangedCategories.findIndex((c) => c.id === activeCategory);
    if (idx >= 0) setCenter(idx);
  }, [activeCategory, isWheel, arrangedCategories]);

  useEffect(() => () => clearTimeout(wheelSnapTimer.current), []);

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
  const middleIndex = (totalCategories - 1) / 2;
  // In wheel mode keep the outermost slots clear of the edge arrows
  const maxDx = Math.min(R_mid * 0.78, (trackWidth / 2) * 0.92) * (isWheel ? 0.8 : 1);
  const halfSpan = isWheel ? (visibleSlots - 1) / 2 : middleIndex;
  const slotPx = halfSpan > 0 ? maxDx / halfSpan : maxDx;
  const btnWidth = Math.min(82, Math.floor(trackWidth / Math.min(totalCategories, visibleSlots)));
  const curveAt = (dx: number) => Math.round(R_mid - Math.sqrt(Math.max(0, R_mid * R_mid - dx * dx)));
  const trackHeight = curveAt(maxDx) + (isMobile ? 104 : 118);

  const handlePointerDown = (e: React.PointerEvent<HTMLElement>) => {
    if (!isWheel) return;
    suppressClickRef.current = false;
    dragRef.current = { startX: e.clientX, startCenter: center, moved: false };
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLElement>) => {
    const drag = dragRef.current;
    if (!drag) return;
    const deltaX = e.clientX - drag.startX;
    if (!drag.moved && Math.abs(deltaX) < 6) return;
    if (!drag.moved) {
      drag.moved = true;
      setIsDragging(true);
      e.currentTarget.setPointerCapture(e.pointerId);
    }
    // Rubber-band slightly past the first/last category
    const raw = drag.startCenter - deltaX / slotPx;
    const clamped = clampCenter(raw);
    setCenter(clamped + (raw - clamped) * 0.25);
  };

  const handlePointerUp = () => {
    const drag = dragRef.current;
    dragRef.current = null;
    if (!drag || !drag.moved) return;
    // Swallow only the click that ends this drag
    suppressClickRef.current = true;
    setTimeout(() => {
      suppressClickRef.current = false;
    }, 0);
    setIsDragging(false);
    setCenter((c) => clampCenter(Math.round(c)));
  };

  const handleWheel = (e: React.WheelEvent<HTMLElement>) => {
    // Only horizontal gestures (trackpad swipe / shift+wheel) roll the arc; vertical scroll stays with the page
    const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.shiftKey ? e.deltaY : 0;
    if (!isWheel || delta === 0) return;
    setIsDragging(true);
    setCenter((c) => clampCenter(c + delta / slotPx));
    clearTimeout(wheelSnapTimer.current);
    wheelSnapTimer.current = setTimeout(() => {
      setIsDragging(false);
      setCenter((c) => clampCenter(Math.round(c)));
    }, 140);
  };

  const handleSelect = (catId: string, idx: number) => {
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      return;
    }
    if (isWheel) setCenter(idx);
    onSelectCategory(catId);
  };

  const roundedCenter = Math.round(center);
  // Vertically align the roll arrows with the discs at the arc ends
  const arrowTop = y_apex_top + 14 + curveAt(Math.min(Cx - 24, R_mid)) + (isMobile ? 17 : 22);
  const canRollLeft = isWheel && roundedCenter > 0;
  const canRollRight = isWheel && roundedCenter < totalCategories - 1;

  return (
    <section
      ref={sectionRef}
      className={`modern-arc-fullwidth-section ${isWheel ? 'is-wheel' : ''}`}
      style={{ minHeight: `${svgHeight}px` }}
      aria-label="Menu Categories"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onWheel={handleWheel}
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

      {/* Category icons placed on the arc midline; in wheel mode they roll along it */}
      <div
        className="modern-arc-items-container"
        style={{
          width: `${trackWidth}px`,
          height: `${trackHeight}px`,
          marginTop: `${y_apex_top + 14}px`,
        }}
      >
        {arrangedCategories.map((cat, idx) => {
          const isActive = activeCategory === cat.id;
          const iconSrc = getCategoryIcon(cat);

          // Position relative to the apex, in slots: 0 = centre, ±halfSpan = arc ends
          const slot = isWheel ? idx - center : idx - middleIndex;
          const normalizedX = halfSpan > 0 ? slot / halfSpan : 0;
          const edgeOverflow = Math.max(0, Math.abs(normalizedX) - 1);
          const opacity = Math.max(0, 1 - edgeOverflow / 0.4);
          const clampedX = Math.max(-1.3, Math.min(1.3, normalizedX));
          const dx = clampedX * maxDx;
          const curveOffset = curveAt(dx);

          return (
            <button
              key={cat.id}
              type="button"
              className={`modern-arc-btn ${isActive ? 'active' : ''}`}
              style={{
                '--curve-y': `${curveOffset}px`,
                width: `${btnWidth}px`,
                left: `calc(50% + ${dx.toFixed(1)}px)`,
                opacity,
                visibility: opacity === 0 ? 'hidden' : 'visible',
                transition: isDragging ? 'none' : undefined,
              } as React.CSSProperties}
              tabIndex={opacity === 0 ? -1 : 0}
              onClick={() => handleSelect(cat.id, idx)}
              aria-pressed={isActive}
              draggable={false}
            >
              {/* Pure White Circular Disc */}
              <div className="modern-arc-disc">
                <img
                  src={iconSrc}
                  alt={cat.name}
                  className="modern-arc-disc-img"
                  loading="lazy"
                  draggable={false}
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

      {isWheel && (
        <>
          <button
            type="button"
            className="modern-arc-roll-btn modern-arc-roll-left"
            style={{ top: `${arrowTop}px` }}
            onClick={() => setCenter(clampCenter(roundedCenter - 1))}
            disabled={!canRollLeft}
            aria-label="Previous categories"
          >
            <ChevronLeft size={16} />
          </button>
          <button
            type="button"
            className="modern-arc-roll-btn modern-arc-roll-right"
            style={{ top: `${arrowTop}px` }}
            onClick={() => setCenter(clampCenter(roundedCenter + 1))}
            disabled={!canRollRight}
            aria-label="Next categories"
          >
            <ChevronRight size={16} />
          </button>
        </>
      )}
    </section>
  );
}
