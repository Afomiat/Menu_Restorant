import { useState } from 'react';
import type { TrendPoint } from '../types';
import { formatPrice } from '../utils/currency';

interface FinanceTrendChartProps {
  data: TrendPoint[];
  groupBy: 'day' | 'week';
  onGroupByChange: (groupBy: 'day' | 'week') => void;
  currency?: string;
}

export default function FinanceTrendChart({
  data,
  groupBy,
  onGroupByChange,
  currency = 'ETB',
}: FinanceTrendChartProps) {
  const [hoveredPoint, setHoveredPoint] = useState<TrendPoint | null>(null);
  const money = (val: number) => formatPrice(val, currency);

  const maxVal = Math.max(...data.map((d) => Math.max(d.revenue, d.collected, d.walkout_loss)), 100);

  const formatPeriod = (period: string) => {
    if (groupBy === 'week') {
      return period;
    }
    // "YYYY-MM-DD" -> "MMM DD"
    const parts = period.split('-');
    if (parts.length === 3) {
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const monthIdx = parseInt(parts[1], 10) - 1;
      return `${months[monthIdx] || parts[1]} ${parts[2]}`;
    }
    return period;
  };

  return (
    <div
      style={{
        backgroundColor: '#ffffff',
        borderRadius: '16px',
        border: '1px solid #e2e8f0',
        padding: '20px',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
        <div>
          <h2 style={{ fontSize: '15px', fontWeight: 700, margin: 0, color: '#0f172a' }}>Revenue Trend</h2>
          <span style={{ fontSize: '12px', color: '#64748b' }}>Daily & weekly sales performance</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', backgroundColor: '#f1f5f9', borderRadius: '10px', padding: '3px' }}>
          <button
            type="button"
            onClick={() => onGroupByChange('day')}
            style={{
              padding: '4px 12px',
              fontSize: '12px',
              fontWeight: groupBy === 'day' ? 700 : 500,
              borderRadius: '8px',
              border: 'none',
              backgroundColor: groupBy === 'day' ? '#ffffff' : 'transparent',
              color: groupBy === 'day' ? '#0f172a' : '#64748b',
              boxShadow: groupBy === 'day' ? '0 1px 2px rgba(0,0,0,0.08)' : 'none',
              cursor: 'pointer',
            }}
          >
            Daily
          </button>
          <button
            type="button"
            onClick={() => onGroupByChange('week')}
            style={{
              padding: '4px 12px',
              fontSize: '12px',
              fontWeight: groupBy === 'week' ? 700 : 500,
              borderRadius: '8px',
              border: 'none',
              backgroundColor: groupBy === 'week' ? '#ffffff' : 'transparent',
              color: groupBy === 'week' ? '#0f172a' : '#64748b',
              boxShadow: groupBy === 'week' ? '0 1px 2px rgba(0,0,0,0.08)' : 'none',
              cursor: 'pointer',
            }}
          >
            Weekly
          </button>
        </div>
      </div>

      {hoveredPoint && (
        <div
          style={{
            fontSize: '12px',
            backgroundColor: '#0f172a',
            color: '#ffffff',
            borderRadius: '8px',
            padding: '6px 12px',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '12px',
            alignSelf: 'flex-start',
          }}
        >
          <span><strong>{formatPeriod(hoveredPoint.period)}</strong></span>
          <span>Revenue: {money(hoveredPoint.revenue)}</span>
          <span>Collected: {money(hoveredPoint.collected)}</span>
          {hoveredPoint.walkout_loss > 0 && (
            <span style={{ color: '#f87171' }}>Loss: {money(hoveredPoint.walkout_loss)}</span>
          )}
        </div>
      )}

      {data.length === 0 ? (
        <div style={{ padding: '40px 0', textAlign: 'center', color: '#94a3b8', fontSize: '13px' }}>
          No revenue data found for this date range.
        </div>
      ) : (
        <div style={{ height: '180px', display: 'flex', alignItems: 'flex-end', gap: '8px', paddingBottom: '24px', overflowX: 'auto', position: 'relative' }}>
          {data.map((point) => {
            const heightPercent = Math.max((point.revenue / maxVal) * 100, 3);
            const isHovered = hoveredPoint?.period === point.period;
            return (
              <div
                key={point.period}
                onMouseEnter={() => setHoveredPoint(point)}
                onMouseLeave={() => setHoveredPoint(null)}
                style={{
                  flex: '1 0 28px',
                  maxWidth: '48px',
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'flex-end',
                  alignItems: 'center',
                  cursor: 'pointer',
                  position: 'relative',
                }}
              >
                <div
                  style={{
                    width: '100%',
                    height: `${heightPercent}%`,
                    backgroundColor: isHovered ? 'var(--admin-primary, #ff5a36)' : '#3b82f6',
                    borderRadius: '6px 6px 2px 2px',
                    transition: 'all 0.15s ease',
                    opacity: isHovered ? 1 : 0.85,
                  }}
                />
                <span
                  style={{
                    position: 'absolute',
                    bottom: '0',
                    fontSize: '10px',
                    color: '#64748b',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    maxWidth: '100%',
                    textAlign: 'center',
                  }}
                >
                  {formatPeriod(point.period)}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
