import { useState } from 'react';
import type { TrendPoint } from '../types';
import { formatPrice } from '../utils/currency';
import FinancePartFailed from './FinancePartFailed';

interface FinanceTrendChartProps {
  data: TrendPoint[];
  /** The chart's own data is on its way (after switching daily / weekly) */
  loading?: boolean;
  failed?: boolean;
  groupBy: 'day' | 'week';
  onGroupByChange: (groupBy: 'day' | 'week') => void;
  currency?: string;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export default function FinanceTrendChart({
  data,
  loading = false,
  failed = false,
  groupBy,
  onGroupByChange,
  currency = 'ETB',
}: FinanceTrendChartProps) {
  const [picked, setPicked] = useState<TrendPoint | null>(null);
  const money = (val: number) => formatPrice(val, currency);

  const maxVal = Math.max(...data.map((d) => Math.max(d.revenue, d.collected, d.walkout_loss)), 100);

  const formatPeriod = (period: string) => {
    if (groupBy === 'week') return period;
    // "YYYY-MM-DD" -> "Nov 21"
    const parts = period.split('-');
    if (parts.length === 3) return `${MONTHS[parseInt(parts[1], 10) - 1] || parts[1]} ${parts[2]}`;
    return period;
  };

  return (
    <div className="rpt-panel" role="region" aria-label="Revenue Trend">
      <div className="fin-panel-head">
        <div>
          <h2 className="rpt-panel-title" style={{ marginBottom: 4 }}>Revenue Trend</h2>
          <p className="rpt-muted" style={{ margin: 0 }}>Sales per day or per week</p>
        </div>
        <div className="fin-seg" role="group" aria-label="Group by">
          {(['day', 'week'] as const).map((g) => (
            <button
              key={g}
              type="button"
              className={groupBy === g ? 'fin-seg-on' : ''}
              aria-pressed={groupBy === g}
              onClick={() => {
                setPicked(null);
                onGroupByChange(g);
              }}
            >
              {g === 'day' ? 'Daily' : 'Weekly'}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div role="status" aria-label="Loading the chart" className="sk-wrap">
          <span className="sk" style={{ display: 'block', height: 180, borderRadius: 12 }} />
        </div>
      ) : failed ? (
        <FinancePartFailed />
      ) : data.length === 0 ? (
        <p className="rpt-empty fin-empty">No revenue data found for this date range.</p>
      ) : (
        <>
          <p className="fin-tip" aria-live="polite">
            {picked ? (
              <>
                <strong>{formatPeriod(picked.period)}</strong>
                <span>Revenue {money(picked.revenue)}</span>
                <span>Collected {money(picked.collected)}</span>
                {picked.walkout_loss > 0 && <span className="rpt-bad">Loss {money(picked.walkout_loss)}</span>}
              </>
            ) : (
              <span className="rpt-muted">Point at or tap a bar to see its numbers.</span>
            )}
          </p>
          <div className="fin-chart">
            {data.map((point) => {
              const heightPercent = Math.max((point.revenue / maxVal) * 100, 3);
              const isPicked = picked?.period === point.period;
              return (
                <button
                  key={point.period}
                  type="button"
                  className={`fin-bar-col ${isPicked ? 'fin-bar-col-on' : ''}`}
                  aria-label={`${formatPeriod(point.period)}: ${money(point.revenue)}`}
                  onMouseEnter={() => setPicked(point)}
                  onFocus={() => setPicked(point)}
                  onClick={() => setPicked(point)}
                >
                  <span className="fin-bar-fill" style={{ height: `${heightPercent}%` }} />
                  <span className="fin-bar-label">{formatPeriod(point.period)}</span>
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
