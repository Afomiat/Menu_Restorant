import { useState } from 'react';
import { Calendar } from 'lucide-react';
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

export default function FinanceDateRangePicker({ range, onChange }: FinanceDateRangePickerProps) {
  const [activePreset, setActivePreset] = useState<string>('month');

  const today = todayInEthiopia();

  const handlePreset = (preset: Preset) => {
    setActivePreset(preset);
    const [y, m, d] = today.split('-').map(Number);
    const date = new Date(Date.UTC(y, m - 1, d));

    let fromStr = today;
    const toStr = today;

    if (preset === 'today') {
      fromStr = today;
    } else if (preset === 'week') {
      // Start of current week (Monday)
      const day = date.getUTCDay();
      const diff = date.getUTCDate() - day + (day === 0 ? -6 : 1);
      date.setUTCDate(diff);
      fromStr = date.toISOString().slice(0, 10);
    } else if (preset === 'month') {
      // First day of current month
      fromStr = `${today.slice(0, 7)}-01`;
    } else if (preset === '30days') {
      const past = new Date(date.getTime() - 30 * 24 * 60 * 60 * 1000);
      fromStr = past.toISOString().slice(0, 10);
    }

    onChange({ from: fromStr, to: toStr });
  };

  const handleCustomChange = (field: 'from' | 'to', val: string) => {
    setActivePreset('custom');
    onChange({ ...range, [field]: val });
  };

  const presets: { id: Preset; label: string }[] = [
    { id: 'today', label: 'Today' },
    { id: 'week', label: 'This Week' },
    { id: 'month', label: 'This Month' },
    { id: '30days', label: 'Last 30 Days' },
  ];

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
      {/* Quick presets */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', backgroundColor: '#f1f5f9', borderRadius: '10px', padding: '3px' }}>
        {presets.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => handlePreset(p.id)}
            style={{
              padding: '5px 12px',
              fontSize: '12px',
              fontWeight: activePreset === p.id ? 700 : 500,
              borderRadius: '8px',
              border: 'none',
              backgroundColor: activePreset === p.id ? '#ffffff' : 'transparent',
              color: activePreset === p.id ? '#0f172a' : '#64748b',
              boxShadow: activePreset === p.id ? '0 1px 2px rgba(0,0,0,0.08)' : 'none',
              cursor: 'pointer',
            }}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Date Pickers */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: '#475569' }}>
        <Calendar size={16} color="#64748b" />
        <input
          type="date"
          className="admin-input-control"
          style={{ width: 'auto', padding: '4px 8px', fontSize: '12px', height: '32px' }}
          value={range.from}
          onChange={(e) => e.target.value && handleCustomChange('from', e.target.value)}
        />
        <span>to</span>
        <input
          type="date"
          className="admin-input-control"
          style={{ width: 'auto', padding: '4px 8px', fontSize: '12px', height: '32px' }}
          value={range.to}
          onChange={(e) => e.target.value && handleCustomChange('to', e.target.value)}
        />
      </div>
    </div>
  );
}
