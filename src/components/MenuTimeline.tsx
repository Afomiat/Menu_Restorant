import { useState, useEffect, useRef } from 'react';
import type { MenuItem } from '../data/menuData';
import { MENU_ITEMS } from '../data/menuData';

interface MenuTimelineProps {
  items: MenuItem[];
  onItemSelect: (item: MenuItem) => void;
}

// ── Floating Decorations ──────────────────────────────────────────────────
const BasilLeafRight = () => (
  <div
    style={{
      position: 'absolute', right: '10px', top: '10px',
      width: 'clamp(20px, 5vw, 44px)', height: 'clamp(20px, 5vw, 44px)',
      zIndex: 5, pointerEvents: 'none',
      filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.5))',
      transform: 'rotate(15deg) scale(1.1)'
    }}
  >
    <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M50 85C50 85 90 60 85 30C80 0 50 15 50 15C50 15 20 0 15 30C10 60 50 85 50 85Z" fill="url(#basilGrad)" />
      <path d="M50 85V15" stroke="#71aa51" strokeWidth="2" opacity="0.6" />
      <path d="M50 65C62 58 75 55 80 40" stroke="#71aa51" strokeWidth="1.5" opacity="0.4" />
      <path d="M50 50C38 43 25 40 20 25" stroke="#71aa51" strokeWidth="1.5" opacity="0.4" />
      <defs>
        <linearGradient id="basilGrad" x1="50" y1="15" x2="50" y2="85" gradientUnits="userSpaceOnUse">
          <stop stopColor="#67b23c" /><stop offset="1" stopColor="#3d6f21" />
        </linearGradient>
      </defs>
    </svg>
  </div>
);

const SauceBowlLeft = () => (
  <div
    style={{
      position: 'absolute', left: '14px', top: '50%',
      width: 'clamp(22px, 5vw, 32px)', height: 'clamp(22px, 5vw, 32px)',
      zIndex: 5, pointerEvents: 'none',
      filter: 'drop-shadow(0 4px 6px rgba(0,0,0,0.5))'
    }}
  >
    <div style={{ position: 'absolute', right: '-16px', top: '15px', width: '16px', height: '1px', backgroundColor: 'rgba(255, 255, 255, 0.2)' }} />
    <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="50" cy="50" r="46" fill="#1b1c21" stroke="#3b3d4a" strokeWidth="4" />
      <circle cx="50" cy="50" r="34" fill="#f7f5f0" />
      <path d="M44 42L48 46M48 46L54 40M54 56L50 50" stroke="#5c6b4e" strokeWidth="3" strokeLinecap="round" />
    </svg>
  </div>
);

const CherryTomatoesRight = () => (
  <div
    style={{
      position: 'absolute', right: '18px', bottom: '10px',
      width: 'clamp(28px, 7vw, 54px)', height: 'clamp(28px, 7vw, 54px)',
      zIndex: 5, pointerEvents: 'none',
      filter: 'drop-shadow(0 6px 12px rgba(0,0,0,0.6))',
      display: 'flex', gap: '2px', transform: 'rotate(-10deg)'
    }}
  >
    <svg viewBox="0 0 100 100" width="24" height="24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="50" cy="50" r="45" fill="url(#tomatGrad)" />
      <path d="M50 15C48 5 45 8 50 5C55 8 52 5 50 15Z" fill="#3d6f21" />
      <ellipse cx="35" cy="35" rx="8" ry="4" transform="rotate(-30 35 35)" fill="white" opacity="0.5" />
      <defs>
        <linearGradient id="tomatGrad" x1="20" y1="20" x2="80" y2="80" gradientUnits="userSpaceOnUse">
          <stop stopColor="#ff524e" /><stop offset="1" stopColor="#b3100c" />
        </linearGradient>
      </defs>
    </svg>
    <svg viewBox="0 0 100 100" width="20" height="20" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ marginTop: '8px' }}>
      <circle cx="50" cy="50" r="45" fill="url(#tomatGrad)" />
      <ellipse cx="35" cy="35" rx="7" ry="3.5" transform="rotate(-30 35 35)" fill="white" opacity="0.5" />
    </svg>
  </div>
);

const LemonSliceLeft = () => (
  <div
    style={{
      position: 'absolute', left: '10px', top: '20px',
      width: 'clamp(24px, 6vw, 48px)', height: 'clamp(24px, 6vw, 48px)',
      zIndex: 5, pointerEvents: 'none',
      filter: 'drop-shadow(0 4px 6px rgba(0,0,0,0.4))',
      transform: 'rotate(-20deg)'
    }}
  >
    <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M10 50 A40 40 0 0 1 90 50 Z" fill="#ffd13b" stroke="#f4b41a" strokeWidth="3" />
      <path d="M20 45 A30 30 0 0 1 80 45 Z" fill="#fff4c2" />
      <path d="M50 45 L35 25 M50 45 L50 15 M50 45 L65 25 M50 45 L22 45 M50 45 L78 45" stroke="#ffd13b" strokeWidth="2" />
    </svg>
  </div>
);

const OliveBranchRight = () => (
  <div
    style={{
      position: 'absolute', right: '10px', top: '50%',
      width: 'clamp(32px, 7vw, 64px)', height: 'clamp(32px, 7vw, 64px)',
      zIndex: 5, pointerEvents: 'none',
      filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.5))',
      transform: 'rotate(15deg)'
    }}
  >
    <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M10 90 Q 50 50 90 10" stroke="#5c6b4e" strokeWidth="3" strokeLinecap="round" fill="none" />
      
      {/* Leaves */}
      <path d="M 70 30 Q 85 35 90 20 Q 75 15 70 30" fill="#71aa51" />
      <path d="M 50 50 Q 60 65 75 60 Q 65 45 50 50" fill="#71aa51" />
      <path d="M 30 70 Q 20 55 10 60 Q 20 75 30 70" fill="#71aa51" />
      
      {/* Olive 1 (Green) */}
      <ellipse cx="55" cy="30" rx="12" ry="16" transform="rotate(30 55 30)" fill="#7a8c3d" />
      <ellipse cx="51" cy="27" rx="4" ry="6" transform="rotate(30 51 27)" fill="#a7ba63" />
      <circle cx="63" cy="36" r="3" fill="#d6413a" />
      
      {/* Olive 2 (Black) */}
      <ellipse cx="45" cy="65" rx="10" ry="14" transform="rotate(-20 45 65)" fill="#2e1a2c" />
      <ellipse cx="42" cy="61" rx="3" ry="5" transform="rotate(-20 42 61)" fill="#533c51" />
      
      {/* Olive 3 (Black) */}
      <ellipse cx="85" cy="35" rx="8" ry="11" transform="rotate(10 85 35)" fill="#2e1a2c" />
      <ellipse cx="83" cy="32" rx="2" ry="4" transform="rotate(10 83 32)" fill="#533c51" />
    </svg>
  </div>
);

const ChiliPepperRight = () => (
  <div
    style={{
      position: 'absolute', right: '15px', bottom: '20px',
      width: 'clamp(28px, 7vw, 56px)', height: 'clamp(28px, 7vw, 56px)',
      zIndex: 5, pointerEvents: 'none',
      filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.5))',
      transform: 'rotate(-30deg)'
    }}
  >
    <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M80 10 Q 70 60 10 90 Q 50 70 70 30 Z" fill="#d92525" />
      <path d="M72 15 Q 80 10 90 5" stroke="#3d6f21" strokeWidth="5" strokeLinecap="round" fill="none" />
      <path d="M72 20 Q 55 50 20 80" stroke="#ff7370" strokeWidth="3" fill="none" strokeLinecap="round" opacity="0.8" />
    </svg>
  </div>
);

const BasilLeafLeft = () => (
  <div
    style={{
      position: 'absolute', left: '10px', bottom: '10px',
      width: 'clamp(20px, 5vw, 44px)', height: 'clamp(20px, 5vw, 44px)',
      zIndex: 5, pointerEvents: 'none',
      filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.5))',
      transform: 'rotate(-45deg)'
    }}
  >
    <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M50 85C50 85 90 60 85 30C80 0 50 15 50 15C50 15 20 0 15 30C10 60 50 85 50 85Z" fill="url(#basilGrad2)" />
      <path d="M50 85V15" stroke="#71aa51" strokeWidth="2" opacity="0.6" />
      <defs>
        <linearGradient id="basilGrad2" x1="50" y1="15" x2="50" y2="85" gradientUnits="userSpaceOnUse">
          <stop stopColor="#5ea536" /><stop offset="1" stopColor="#325d1a" />
        </linearGradient>
      </defs>
    </svg>
  </div>
);

const RosemarySprigLeft = () => (
  <div
    style={{
      position: 'absolute', left: '15px', bottom: '40px',
      width: 'clamp(24px, 6vw, 48px)', height: 'clamp(24px, 6vw, 48px)',
      zIndex: 5, pointerEvents: 'none',
      filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.5))',
      transform: 'rotate(60deg)'
    }}
  >
    <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M10 90 L 90 10" stroke="#6b5b4e" strokeWidth="2" />
      <path d="M30 70 Q 20 50 40 50" stroke="#5c6b4e" strokeWidth="3" fill="none" strokeLinecap="round" />
      <path d="M50 50 Q 40 30 60 30" stroke="#5c6b4e" strokeWidth="3" fill="none" strokeLinecap="round" />
      <path d="M70 30 Q 60 10 80 10" stroke="#5c6b4e" strokeWidth="3" fill="none" strokeLinecap="round" />
      <path d="M40 80 Q 50 60 30 60" stroke="#5c6b4e" strokeWidth="3" fill="none" strokeLinecap="round" />
      <path d="M60 60 Q 70 40 50 40" stroke="#5c6b4e" strokeWidth="3" fill="none" strokeLinecap="round" />
      <path d="M80 40 Q 90 20 70 20" stroke="#5c6b4e" strokeWidth="3" fill="none" strokeLinecap="round" />
    </svg>
  </div>
);

// ── Detect mobile breakpoint ───────────────────────────────────────────────
function useIsMobile() {
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 640);
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 639px)');
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener('change', handler);
    setIsMobile(mq.matches);
    return () => mq.removeEventListener('change', handler);
  }, []);
  return isMobile;
}

function MobileCard({ item, idx, onItemSelect }: { item: MenuItem; idx: number; onItemSelect: (item: MenuItem) => void }) {
  const globalIdx = MENU_ITEMS.findIndex(m => m.id === item.id);
  const decoIdx = globalIdx >= 0 ? globalIdx % 8 : idx % 8;

  const containerRef = useRef<HTMLDivElement>(null);
  const pathRef = useRef<SVGPathElement>(null);
  const dotRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);
  const plateContainerRef = useRef<HTMLDivElement>(null);
  const plateRingRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleScroll = () => {
      if (!containerRef.current || !pathRef.current || !dotRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const windowHeight = window.innerHeight;
      
      let progress = (windowHeight / 2 - rect.top) / rect.height;
      if (progress < 0) progress = 0;
      if (progress > 1) progress = 1;
      
      try {
        const totalLength = pathRef.current.getTotalLength();
        const point = pathRef.current.getPointAtLength(progress * totalLength);
        dotRef.current.style.left = `${point.x}%`;
        dotRef.current.style.top = `${point.y}%`;
        
        if (ringRef.current) {
          ringRef.current.style.opacity = (progress > 0 && progress < 1) ? '1' : '0';
        }

        if (plateContainerRef.current && plateRingRef.current) {
          const plateRect = plateContainerRef.current.getBoundingClientRect();
          const isTouching = plateRect.top <= windowHeight / 2 && plateRect.bottom >= windowHeight / 2;
          if (isTouching) {
            plateRingRef.current.style.boxShadow = '0 0 25px rgba(201, 168, 118, 0.6)';
            plateRingRef.current.style.borderColor = 'var(--accent-gold)';
            plateContainerRef.current.style.transform = 'scale(1.06) rotate(3deg)';
          } else {
            plateRingRef.current.style.boxShadow = 'none';
            plateRingRef.current.style.borderColor = 'rgba(201, 168, 118, 0.25)';
            plateContainerRef.current.style.transform = '';
          }
        }
      } catch (e) {
        // SVG methods might fail initially
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    setTimeout(handleScroll, 50);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div
      ref={containerRef}
      style={{
        position: 'relative',
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: 'var(--timeline-row-padding)',
        paddingBottom: '48px',
        overflow: 'visible',
      }}
    >
      {/* Vertical winding SVG behind the whole row */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 0,
          pointerEvents: 'none',
        }}
      >
        <svg
          width="100%"
          height="100%"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          {idx % 2 === 0 ? (
            <path
              ref={pathRef}
              d="M 50,0 C 20,20 80,50 50,80 C 30,95 50,100 50,100"
              stroke="rgba(201, 168, 118, 0.2)"
              strokeWidth="1.5"
              vectorEffect="non-scaling-stroke"
            />
          ) : (
            <path
              ref={pathRef}
              d="M 50,0 C 80,20 20,50 50,80 C 70,95 50,100 50,100"
              stroke="rgba(201, 168, 118, 0.2)"
              strokeWidth="1.5"
              vectorEffect="non-scaling-stroke"
            />
          )}
        </svg>
        {/* Central Glowing Dot */}
        <div
          ref={dotRef}
          style={{
            position: 'absolute',
            left: '50%',
            top: '0%',
            transform: 'translate(-50%, -50%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            pointerEvents: 'none',
          }}
        >
          {/* Core bright dot */}
          <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: 'var(--accent-gold)', zIndex: 2 }} />
          {/* Planet Ellipse Orbit */}
          <div ref={ringRef} style={{ position: 'absolute', width: '20px', height: '20px', borderRadius: '50%', border: '1px solid var(--accent-gold)', transform: 'rotateX(65deg)', opacity: 0, zIndex: 1, transition: 'opacity 0.2s ease' }} />
        </div>
      </div>

      {/* Floating decorations */}
      {item.categoryId !== 'drinks' && (
        <>
          {decoIdx === 0 && <BasilLeafRight />}
          {decoIdx === 1 && <SauceBowlLeft />}
          {decoIdx === 2 && <CherryTomatoesRight />}
          {decoIdx === 3 && <LemonSliceLeft />}
          {decoIdx === 4 && <OliveBranchRight />}
          {decoIdx === 5 && <BasilLeafLeft />}
          {decoIdx === 6 && <ChiliPepperRight />}
          {decoIdx === 7 && <RosemarySprigLeft />}
        </>
      )}

      {/* ── Plate: centered, overlaps top of card ── */}
      <div
        ref={plateContainerRef}
        onClick={() => onItemSelect(item)}
        style={{
          width: 'var(--plate-size)',
          height: 'var(--plate-size)',
          position: 'relative',
          cursor: 'pointer',
          flexShrink: 0,
          zIndex: 3,
          transition: 'transform 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
          /* Plate overlaps 50% of its own height into the card below */
          marginBottom: 'calc(var(--plate-size) * -0.5)',
        }}
        className="dish-plate-container"
      >
        {/* Gold orbit ring */}
        <div
          ref={plateRingRef}
          style={{
            position: 'absolute',
            top: '-5px', left: '-5px', right: '-5px', bottom: '-5px',
            borderRadius: '50%',
            border: '1px solid rgba(201, 168, 118, 0.25)',
            transition: 'all 0.4s ease',
            pointerEvents: 'none',
          }}
        />
        {/* Circular plate image */}
        <div
          style={{
            width: '100%',
            height: '100%',
            borderRadius: '50%',
            overflow: 'hidden',
            border: '2px solid rgba(201, 168, 118, 0.2)',
            boxShadow: 'var(--shadow-luxury)',
            backgroundColor: '#1b1d26',
          }}
        >
          <img
            src={item.imageUrl}
            alt={item.name}
            loading={idx === 0 ? 'eager' : 'lazy'}
            style={{
              width: '100%', height: '100%',
              objectFit: 'cover',
              transition: 'transform 0.5s ease',
            }}
            className="dish-image"
          />
        </div>

        {/* Weight badge */}
        {item.weightLabel && (
          <div
            style={{
              position: 'absolute',
              bottom: '4px',
              right: '-8px',
              backgroundColor: 'var(--accent-gold)',
              color: 'var(--bg-dark)',
              fontFamily: 'var(--font-sans)',
              fontSize: '8px',
              fontWeight: 700,
              padding: '3px 6px',
              borderRadius: '1px',
              letterSpacing: '0.5px',
              boxShadow: '0 4px 10px rgba(0,0,0,0.4)',
              zIndex: 4,
            }}
          >
            {item.weightLabel}
          </div>
        )}
      </div>

      {/* ── Text card: sits below plate, plate overlaps it from top ── */}
      <div
        className="dish-info-card"
        onClick={() => onItemSelect(item)}
        style={{
          width: '100%',
          maxWidth: '420px',
          backgroundColor: 'var(--bg-card)',
          border: '1px solid var(--bg-card-border)',
          /* top padding pushes text clear of overlapping plate */
          paddingTop: 'calc(var(--plate-size) * 0.5 + 14px)',
          paddingBottom: '18px',
          paddingLeft: '20px',
          paddingRight: '20px',
          borderRadius: '8px',
          backdropFilter: 'blur(10px)',
          cursor: 'pointer',
          zIndex: 2,
          boxShadow: 'var(--shadow-luxury)',
          transition: 'transform 0.4s cubic-bezier(0.16, 1, 0.3, 1), border-color 0.4s ease',
          position: 'relative',
          WebkitMaskImage: 'linear-gradient(to bottom, transparent 0px, transparent 20px, black 90px)',
          maskImage: 'linear-gradient(to bottom, transparent 0px, transparent 20px, black 90px)',
        }}
      >
        {/* Title & Price */}
        <h3
          style={{
            fontFamily: 'var(--font-serif)',
            fontSize: 'var(--font-size-title)',
            fontWeight: 500,
            fontStyle: 'italic',
            color: 'var(--text-primary)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'baseline',
            lineHeight: '1.2',
            gap: '8px',
          }}
        >
          <span style={{ flexShrink: 1, minWidth: 0 }}>{item.name}</span>
          <span
            style={{
              fontFamily: 'var(--font-sans)',
              fontSize: 'var(--font-size-title)',
              color: 'var(--accent-gold)',
              fontWeight: 500,
              flexShrink: 0,
            }}
          >
            {item.price} Br
          </span>
        </h3>

        {/* Subtitle */}
        {item.subtitle && (
          <span
            style={{
              fontFamily: 'var(--font-serif)',
              fontSize: 'var(--font-size-subtitle)',
              fontStyle: 'italic',
              color: 'var(--accent-gold)',
              textTransform: 'capitalize',
              letterSpacing: '0.5px',
              marginTop: '3px',
              display: 'block',
              opacity: 0.8,
            }}
          >
            {item.subtitle}
          </span>
        )}

        {/* Short description */}
        <p
          style={{
            fontFamily: 'var(--font-serif)',
            fontSize: 'var(--font-size-desc)',
            fontStyle: 'italic',
            color: 'var(--text-secondary)',
            marginTop: '8px',
            lineHeight: '1.5',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          {item.description}
        </p>

        {/* Dietary tags */}
        {item.tags.length > 0 && (
          <div
            style={{
              display: 'flex',
              gap: '5px',
              flexWrap: 'wrap',
              marginTop: '10px',
            }}
          >
            {item.tags.map((tag) => {
              const colors: Record<string, { bg: string; border: string; text: string }> = {
                vegetarian: { bg: 'rgba(70,85,62,0.15)', border: 'rgba(70,85,62,0.4)', text: '#a4c090' },
                spicy:       { bg: 'rgba(114,44,42,0.15)', border: 'rgba(114,44,42,0.4)', text: '#e69895' },
                'gluten-free': { bg: 'rgba(44,74,99,0.15)', border: 'rgba(44,74,99,0.4)', text: '#9bc2e6' },
                'chef-pick':  { bg: 'rgba(92,67,35,0.15)', border: 'rgba(92,67,35,0.4)', text: '#dec093' },
              };
              const c = colors[tag] ?? colors['chef-pick'];
              return (
                <span
                  key={tag}
                  style={{
                    padding: '2px 7px',
                    borderRadius: '3px',
                    border: `1px solid ${c.border}`,
                    backgroundColor: c.bg,
                    color: c.text,
                    fontSize: '9px',
                    fontFamily: 'var(--font-sans)',
                    fontWeight: 500,
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                  }}
                >
                  {tag}
                </span>
              );
            })}
          </div>
        )}

        {/* Catalog deco line */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            marginTop: '10px',
            gap: '6px',
            opacity: 0.6,
          }}
        >
          <span
            style={{
              fontFamily: 'var(--font-sans)',
              fontSize: '8px',
              textTransform: 'uppercase',
              letterSpacing: '1.5px',
              color: 'var(--text-primary)',
              fontWeight: 500,
            }}
          >
            catalog
          </span>
          <div style={{ height: '1px', backgroundColor: 'rgba(255,255,255,0.15)', flexGrow: 1, maxWidth: '40px' }} />
          <div
            style={{
              width: '4px', height: '4px',
              borderRadius: '50%',
              border: '1px solid var(--accent-gold)',
              backgroundColor: 'transparent',
            }}
          />
        </div>
      </div>
    </div>
  );
}

// ── Desktop Side-by-Side Card ──────────────────────────────────────────────
function DesktopCard({ item, idx, onItemSelect }: { item: MenuItem; idx: number; onItemSelect: (item: MenuItem) => void }) {
  const globalIdx = MENU_ITEMS.findIndex(m => m.id === item.id);
  const decoIdx = globalIdx >= 0 ? globalIdx % 8 : idx % 8;

  const isLeft = idx % 2 === 0;
  const containerRef = useRef<HTMLDivElement>(null);
  const pathRef = useRef<SVGPathElement>(null);
  const dotRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);
  const plateContainerRef = useRef<HTMLDivElement>(null);
  const plateRingRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleScroll = () => {
      if (!containerRef.current || !pathRef.current || !dotRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const windowHeight = window.innerHeight;
      
      let progress = (windowHeight / 2 - rect.top) / rect.height;
      if (progress < 0) progress = 0;
      if (progress > 1) progress = 1;
      
      try {
        const totalLength = pathRef.current.getTotalLength();
        const point = pathRef.current.getPointAtLength(progress * totalLength);
        dotRef.current.style.left = `${point.x}%`;
        dotRef.current.style.top = `${point.y}%`;
        
        if (ringRef.current) {
          ringRef.current.style.opacity = (progress > 0 && progress < 1) ? '1' : '0';
        }

        if (plateContainerRef.current && plateRingRef.current) {
          const plateRect = plateContainerRef.current.getBoundingClientRect();
          const isTouching = plateRect.top <= windowHeight / 2 && plateRect.bottom >= windowHeight / 2;
          if (isTouching) {
            plateRingRef.current.style.boxShadow = '0 0 25px rgba(201, 168, 118, 0.6)';
            plateRingRef.current.style.borderColor = 'var(--accent-gold)';
            plateContainerRef.current.style.transform = 'scale(1.06) rotate(3deg)';
          } else {
            plateRingRef.current.style.boxShadow = 'none';
            plateRingRef.current.style.borderColor = 'rgba(201, 168, 118, 0.25)';
            plateContainerRef.current.style.transform = '';
          }
        }
      } catch (e) {
        // SVG methods might fail initially
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    setTimeout(handleScroll, 50);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const PlateElement = (
    <div
      ref={plateContainerRef}
      onClick={() => onItemSelect(item)}
      style={{
        width: 'var(--plate-size)',
        height: 'var(--plate-size)',
        position: 'relative',
        cursor: 'pointer',
        flexShrink: 0,
        zIndex: 2,
        transition: 'transform 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
      }}
      className="dish-plate-container"
    >
      {/* Orbit ring */}
      <div
        ref={plateRingRef}
        style={{
          position: 'absolute',
          top: '-6px', left: '-6px', right: '-6px', bottom: '-6px',
          borderRadius: '50%',
          border: '1px solid rgba(201, 168, 118, 0.25)',
          transition: 'all 0.4s ease',
          pointerEvents: 'none',
        }}
      />

      {/* Plate image */}
      <div
        style={{
          width: '100%', height: '100%',
          borderRadius: '50%',
          overflow: 'hidden',
          border: '2px solid rgba(201, 168, 118, 0.15)',
          boxShadow: 'var(--shadow-luxury)',
          backgroundColor: '#1b1d26',
        }}
      >
        <img
          src={item.imageUrl}
          alt={item.name}
          loading={idx === 0 ? 'eager' : 'lazy'}
          style={{ width: '100%', height: '100%', objectFit: 'cover', transition: 'transform 0.5s ease' }}
          className="dish-image"
        />
      </div>

      {/* Weight badge */}
      {item.weightLabel && (
        <div
          style={{
            position: 'absolute',
            top: '50%',
            transform: 'translateY(-50%)',
            left: isLeft ? '-12px' : 'auto',
            right: !isLeft ? '-12px' : 'auto',
            backgroundColor: 'var(--accent-gold)',
            color: 'var(--bg-dark)',
            fontFamily: 'var(--font-sans)',
            fontSize: 'clamp(8px, 1.5vw, 10px)',
            fontWeight: 700,
            padding: '4px 6px',
            borderRadius: '1px',
            letterSpacing: '0.5px',
            boxShadow: '0 4px 10px rgba(0,0,0,0.4)',
            zIndex: 3,
          }}
        >
          {item.weightLabel}
        </div>
      )}
    </div>
  );

  const CardElement = (
    <div
      onClick={() => onItemSelect(item)}
      style={{
        width: '100%',
        maxWidth: '520px',
        backgroundColor: 'var(--bg-card)',
        border: '1px solid var(--bg-card-border)',
        paddingTop: '20px',
        paddingBottom: '20px',
        paddingLeft: isLeft ? 'var(--card-padding-overlap)' : '24px',
        paddingRight: !isLeft ? 'var(--card-padding-overlap)' : '24px',
        borderRadius: '4px',
        backdropFilter: 'blur(10px)',
        cursor: 'pointer',
        zIndex: 1,
        marginLeft: isLeft ? 'var(--card-overlap-margin)' : '0',
        marginRight: !isLeft ? 'var(--card-overlap-margin)' : '0',
        boxShadow: 'var(--shadow-luxury)',
        transition: 'transform 0.4s cubic-bezier(0.16, 1, 0.3, 1), border-color 0.4s ease',
        WebkitMaskImage: isLeft 
          ? 'linear-gradient(to right, transparent 0px, transparent 20px, black 100px)' 
          : 'linear-gradient(to left, transparent 0px, transparent 20px, black 100px)',
        maskImage: isLeft 
          ? 'linear-gradient(to right, transparent 0px, transparent 20px, black 100px)' 
          : 'linear-gradient(to left, transparent 0px, transparent 20px, black 100px)',
      }}
      className="dish-info-card"
    >
      {/* Title & Price */}
      <h3
        style={{
          fontFamily: 'var(--font-serif)',
          fontSize: 'var(--font-size-title)',
          fontWeight: 500,
          fontStyle: 'italic',
          color: 'var(--text-primary)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'baseline',
          lineHeight: '1.2',
          gap: '8px',
        }}
      >
        <span style={{ flexShrink: 1, minWidth: 0 }}>{item.name}</span>
        <span
          style={{
            fontFamily: 'var(--font-sans)',
            fontSize: 'var(--font-size-title)',
            color: 'var(--accent-gold)',
            fontWeight: 500,
            flexShrink: 0,
          }}
        >
          {item.price} Birr
        </span>
      </h3>

      {/* Subtitle */}
      {item.subtitle && (
        <span
          style={{
            fontFamily: 'var(--font-serif)',
            fontSize: 'var(--font-size-subtitle)',
            fontStyle: 'italic',
            color: 'var(--accent-gold)',
            textTransform: 'capitalize',
            letterSpacing: '0.5px',
            marginTop: '3px',
            display: 'block',
            opacity: 0.8,
          }}
        >
          {item.subtitle}
        </span>
      )}

      {/* Description */}
      <p
        style={{
          fontFamily: 'var(--font-serif)',
          fontSize: 'var(--font-size-desc)',
          fontStyle: 'italic',
          color: 'var(--text-secondary)',
          marginTop: '8px',
          lineHeight: '1.5',
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
        }}
      >
        {item.description}
      </p>

      {/* Dietary tags */}
      {item.tags.length > 0 && (
        <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap', marginTop: '10px' }}>
          {item.tags.map((tag) => {
            const colors: Record<string, { bg: string; border: string; text: string }> = {
              vegetarian: { bg: 'rgba(70,85,62,0.15)', border: 'rgba(70,85,62,0.4)', text: '#a4c090' },
              spicy:       { bg: 'rgba(114,44,42,0.15)', border: 'rgba(114,44,42,0.4)', text: '#e69895' },
              'gluten-free': { bg: 'rgba(44,74,99,0.15)', border: 'rgba(44,74,99,0.4)', text: '#9bc2e6' },
              'chef-pick':  { bg: 'rgba(92,67,35,0.15)', border: 'rgba(92,67,35,0.4)', text: '#dec093' },
            };
            const c = colors[tag] ?? colors['chef-pick'];
            return (
              <span
                key={tag}
                style={{
                  padding: '2px 8px',
                  borderRadius: '3px',
                  border: `1px solid ${c.border}`,
                  backgroundColor: c.bg,
                  color: c.text,
                  fontSize: '10px',
                  fontFamily: 'var(--font-sans)',
                  fontWeight: 500,
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                }}
              >
                {tag}
              </span>
            );
          })}
        </div>
      )}

      {/* Catalog deco line */}
      <div style={{ display: 'flex', alignItems: 'center', marginTop: '12px', gap: '6px', opacity: 0.7 }}>
        <span style={{ fontFamily: 'var(--font-sans)', fontSize: '9px', textTransform: 'uppercase', letterSpacing: '1.5px', color: 'var(--text-primary)', fontWeight: 500 }}>
          catalog
        </span>
        <div style={{ height: '1px', backgroundColor: 'rgba(255, 255, 255, 0.15)', flexGrow: 1, maxWidth: '40px' }} />
        <div style={{ width: '4px', height: '4px', borderRadius: '50%', border: '1px solid var(--accent-gold)', backgroundColor: 'transparent' }} />
      </div>
    </div>
  );

  return (
    <div
      key={item.id}
      ref={containerRef}
      style={{
        position: 'relative',
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        padding: 'var(--timeline-row-padding)',
        overflow: 'visible',
      }}
    >
      {/* SVG winding path */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 0, pointerEvents: 'none' }}>
        <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none" fill="none" xmlns="http://www.w3.org/2000/svg">
          {isLeft ? (
            <path ref={pathRef} d="M 50,0 C 15,25 15,45 50,60 C 85,75 85,90 50,100" stroke="rgba(201, 168, 118, 0.25)" strokeWidth="1.2" vectorEffect="non-scaling-stroke" />
          ) : (
            <path ref={pathRef} d="M 50,0 C 85,25 85,45 50,60 C 15,75 15,90 50,100" stroke="rgba(201, 168, 118, 0.25)" strokeWidth="1.2" vectorEffect="non-scaling-stroke" />
          )}
        </svg>
        {/* Central glowing dot */}
        <div ref={dotRef} style={{ position: 'absolute', left: '50%', top: '0%', transform: 'translate(-50%, -50%)', display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
          <div style={{ width: '7px', height: '7px', borderRadius: '50%', backgroundColor: 'var(--accent-gold)', zIndex: 2 }} />
          <div ref={ringRef} style={{ position: 'absolute', width: '22px', height: '22px', borderRadius: '50%', border: '1px solid var(--accent-gold)', transform: 'rotateX(65deg)', opacity: 0, zIndex: 1, transition: 'opacity 0.2s ease' }} />
        </div>
      </div>

      {/* Floating decorations */}
      {item.categoryId !== 'drinks' && (
        <>
          {decoIdx === 0 && <BasilLeafRight />}
          {decoIdx === 1 && <SauceBowlLeft />}
          {decoIdx === 2 && <CherryTomatoesRight />}
          {decoIdx === 3 && <LemonSliceLeft />}
          {decoIdx === 4 && <OliveBranchRight />}
          {decoIdx === 5 && <BasilLeafLeft />}
          {decoIdx === 6 && <ChiliPepperRight />}
          {decoIdx === 7 && <RosemarySprigLeft />}
        </>
      )}

      {/* Two-column split grid */}
      <div style={{ 
        display: 'flex', 
        width: '100%', 
        alignItems: 'center', 
        zIndex: 10,
        transform: isLeft ? 'translateX(40px)' : 'translateX(-40px)',
        transition: 'transform 0.4s ease'
      }}>
        <div style={{ width: '50%', display: 'flex', justifyContent: 'flex-end', alignItems: 'center', position: 'relative' }}>
          {isLeft ? PlateElement : CardElement}
        </div>
        <div style={{ width: '50%', display: 'flex', justifyContent: 'flex-start', alignItems: 'center', position: 'relative' }}>
          {isLeft ? CardElement : PlateElement}
        </div>
      </div>
    </div>
  );
}

// ── Main Export ────────────────────────────────────────────────────────────
export default function MenuTimeline({ items, onItemSelect }: MenuTimelineProps) {
  const isMobile = useIsMobile();

  if (items.length === 0) {
    return (
      <div
        style={{
          padding: '60px 24px',
          textAlign: 'center',
          fontFamily: 'var(--font-sans)',
          color: 'var(--text-secondary)',
        }}
      >
        No items found matching your search.
      </div>
    );
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        padding: '16px 0 60px 0',
        width: '100%',
      }}
    >
      {items.map((item, idx) =>
        isMobile ? (
          <MobileCard key={item.id} item={item} idx={idx} onItemSelect={onItemSelect} />
        ) : (
          <DesktopCard key={item.id} item={item} idx={idx} onItemSelect={onItemSelect} />
        )
      )}
    </div>
  );
}
