import { type CSSProperties } from 'react';
import { Search, X } from 'lucide-react';

export interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  variant?: 'modern' | 'classic' | 'admin' | 'default';
  className?: string;
  style?: CSSProperties;
  autoFocus?: boolean;
  ariaLabel?: string;
  size?: 'sm' | 'md' | 'lg';
}

export default function SearchBar({
  value,
  onChange,
  placeholder = 'Search dishes...',
  variant = 'default',
  className = '',
  style,
  autoFocus = false,
  ariaLabel = 'Search dishes',
  size = 'md',
}: SearchBarProps) {
  const isClassic = variant === 'classic';
  const isModern = variant === 'modern';

  const iconSize = isClassic ? 12 : isModern ? 18 : 16;
  const clearIconSize = isClassic ? 11 : isModern ? 16 : 14;

  if (isClassic) {
    return (
      <div
        className={`classic-search-container ${className}`}
        style={{
          position: 'relative',
          width: 'clamp(115px, 32vw, 320px)',
          flexShrink: 1,
          ...style,
        }}
      >
        <Search
          size={iconSize}
          style={{
            position: 'absolute',
            left: '10px',
            top: '50%',
            transform: 'translateY(-50%)',
            color: 'var(--text-secondary, #94a3b8)',
            pointerEvents: 'none',
          }}
        />
        <input
          type="text"
          placeholder={placeholder}
          value={value}
          autoFocus={autoFocus}
          onChange={(e) => onChange(e.target.value)}
          aria-label={ariaLabel}
          style={{
            width: '100%',
            backgroundColor: 'rgba(255, 255, 255, 0.04)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '20px',
            padding: '7px 28px 7px 28px',
            fontFamily: 'var(--font-sans, inherit)',
            fontSize: '13px',
            color: 'var(--text-primary, #ffffff)',
            outline: 'none',
            transition: 'var(--transition-smooth, all 0.2s ease)',
            WebkitTextSizeAdjust: '100%',
          }}
          onFocus={(e) => {
            e.target.style.borderColor = 'var(--accent-gold, #c9a876)';
            e.target.style.backgroundColor = 'rgba(255, 255, 255, 0.06)';
          }}
          onBlur={(e) => {
            e.target.style.borderColor = 'rgba(255, 255, 255, 0.08)';
            e.target.style.backgroundColor = 'rgba(255, 255, 255, 0.04)';
          }}
        />
        {value && (
          <button
            type="button"
            onClick={() => onChange('')}
            aria-label="Clear search"
            style={{
              position: 'absolute',
              right: '8px',
              top: '50%',
              transform: 'translateY(-50%)',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--text-secondary, #94a3b8)',
              display: 'flex',
              alignItems: 'center',
              padding: '2px',
            }}
          >
            <X size={clearIconSize} />
          </button>
        )}
      </div>
    );
  }

  if (isModern) {
    return (
      <div className={`modern-search-box ${className}`} style={style}>
        <Search size={iconSize} className="modern-search-icon" />
        <input
          type="text"
          className="modern-search-input"
          placeholder={placeholder}
          value={value}
          autoFocus={autoFocus}
          onChange={(e) => onChange(e.target.value)}
          aria-label={ariaLabel}
        />
        {value && (
          <button
            type="button"
            className="modern-search-clear"
            onClick={() => onChange('')}
            aria-label="Clear search"
          >
            <X size={clearIconSize} />
          </button>
        )}
      </div>
    );
  }

  // Admin or Default Variant
  return (
    <div
      className={`admin-search-box ${className}`}
      style={{
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        width: '100%',
        ...style,
      }}
    >
      <Search
        size={iconSize}
        className="admin-search-icon"
        style={{
          position: 'absolute',
          left: '14px',
          color: 'var(--admin-text-subtle, #94a3b8)',
          pointerEvents: 'none',
        }}
      />
      <input
        type="text"
        className="admin-search-input-field"
        placeholder={placeholder}
        value={value}
        autoFocus={autoFocus}
        onChange={(e) => onChange(e.target.value)}
        aria-label={ariaLabel}
        style={{
          width: '100%',
          height: size === 'sm' ? '36px' : size === 'lg' ? '48px' : '42px',
          padding: '0 36px 0 40px',
          fontSize: '13.5px',
        }}
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange('')}
          aria-label="Clear search"
          style={{
            position: 'absolute',
            right: '10px',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: 'var(--admin-text-muted, #64748b)',
            display: 'flex',
            alignItems: 'center',
            padding: '4px',
          }}
        >
          <X size={clearIconSize} />
        </button>
      )}
    </div>
  );
}
