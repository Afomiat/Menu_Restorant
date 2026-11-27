import { useState } from 'react';
import { todayInEthiopia } from '../utils/kitchenTimer';

export interface DateRange {
  from: string;
  to: string;
}

export type Preset = 'today' | 'week' | 'month' | '30days';

interface FinanceDateRangePickerProps {
  range: DateRange;
  onChange: (range: DateRange) => void;
}

const PRESETS: { id: Preset; label: string }[] = [
  { id: 'today', label: 'Today' },
  { id: 'week', label: 'This Week' },
  { id: 'month', label: 'This Month' },
  { id: '30days', label: 'Last 30 Days' },
];

export default function FinanceDateRangePicker({ range, onChange }: FinanceDateRangePickerProps) {
  const [activePreset, setActivePreset] = useState<string>('month');

  const today = todayInEthiopia();

  const handlePreset = (preset: Preset) => {
    setActivePreset(preset);
    const [y, m, d] = today.split('-').map(Number);
    const date = new Date(Date.UTC(y, m - 1, d));

    let fromStr = today;
    if (preset === 'week') {
      // Start of the current week (Monday)
      const day = date.getUTCDay();
      date.setUTCDate(date.getUTCDate() - day + (day === 0 ? -6 : 1));
      fromStr = date.toISOString().slice(0, 10);
    } else if (preset === 'month') {
      fromStr = `${today.slice(0, 7)}-01`;
    } else if (preset === '30days') {
      fromStr = new Date(date.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    }

    onChange({ from: fromStr, to: today });
  };

  const handleCustomChange = (field: 'from' | 'to', val: string) => {
    setActivePreset('custom');
    onChange({ ...range, [field]: val });
  };

  return (
    <div className="fin-range">
      <div className="fin-seg" role="group" aria-label="Period">
        {PRESETS.map((p) => (
          <button
            key={p.id}
            type="button"
            className={activePreset === p.id ? 'fin-seg-on' : ''}
            aria-pressed={activePreset === p.id}
            onClick={() => handlePreset(p.id)}
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className="fin-dates">
        <input
          type="date"
          aria-label="From"
          className="admin-input-control"
          value={range.from}
          max={range.to}
          onChange={(e) => e.target.value && handleCustomChange('from', e.target.value)}
        />
        <span>to</span>
        <input
          type="date"
          aria-label="To"
          className="admin-input-control"
          value={range.to}
          min={range.from}
          max={today}
          onChange={(e) => e.target.value && handleCustomChange('to', e.target.value)}
        />
      </div>
    </div>
  );
}
