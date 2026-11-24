import { useEffect, useState } from 'react';
import { Download, Loader2, AlertCircle } from 'lucide-react';
import type { DishRevenue, FinanceSummary, PaymentMethod, TrendPoint, WaiterTotals } from '../types';
import {
  fetchFinanceSummary,
  fetchFinanceTrend,
  fetchPaymentMethods,
  fetchStaffPerformance,
  fetchTopDishes,
  downloadFinanceCSV,
} from '../services/financeService';
import { todayInEthiopia } from '../utils/kitchenTimer';
import FinanceDateRangePicker, { type DateRange } from './FinanceDateRangePicker';
import FinanceSummaryCards from './FinanceSummaryCards';
import FinanceTrendChart from './FinanceTrendChart';
import FinancePaymentPie from './FinancePaymentPie';
import FinanceTopDishes from './FinanceTopDishes';
import FinanceStaffTable from './FinanceStaffTable';

interface FinanceDashboardProps {
  currency?: string;
}

export default function FinanceDashboard({ currency = 'ETB' }: FinanceDashboardProps) {
  const today = todayInEthiopia();
  const firstOfMonth = `${today.slice(0, 7)}-01`;

  const [range, setRange] = useState<DateRange>({ from: firstOfMonth, to: today });
  const [groupBy, setGroupBy] = useState<'day' | 'week'>('day');

  const [summary, setSummary] = useState<FinanceSummary | null>(null);
  const [trend, setTrend] = useState<TrendPoint[]>([]);
  const [dishes, setDishes] = useState<DishRevenue[]>([]);
  const [methods, setMethods] = useState<{ method: PaymentMethod; payments: number; amount: number }[]>([]);
  const [waiters, setWaiters] = useState<WaiterTotals[]>([]);

  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    Promise.all([
      fetchFinanceSummary(range.from, range.to),
      fetchFinanceTrend(range.from, range.to, groupBy),
      fetchTopDishes(range.from, range.to, 10),
      fetchPaymentMethods(range.from, range.to),
      fetchStaffPerformance(range.from, range.to),
    ])
      .then(([sumData, trendData, dishesData, methodsData, waitersData]) => {
        if (cancelled) return;
        setSummary(sumData);
        setTrend(trendData);
        setDishes(dishesData);
        setMethods(methodsData);
        setWaiters(waitersData);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Failed to load finance data');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [range, groupBy]);

  const handleExportCSV = async () => {
    setDownloading(true);
    try {
      await downloadFinanceCSV(range.from, range.to);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to export CSV');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <section className="admin-kitchen-page-view" aria-label="Finance Dashboard">
      {/* Header with Title, Date Range Picker & CSV Export */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '16px',
          marginBottom: '20px',
        }}
      >
        <div>
          <h1 className="admin-top-title" style={{ margin: 0 }}>Finance Dashboard</h1>
          <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#64748b' }}>
            Comprehensive revenue analytics, payment channels and staff performance
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <FinanceDateRangePicker range={range} onChange={setRange} />

          <button
            type="button"
            className="admin-sec-pill-btn"
            onClick={handleExportCSV}
            disabled={downloading}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '12px',
              padding: '6px 14px',
              height: '34px',
            }}
          >
            {downloading ? <Loader2 size={14} className="admin-spin" /> : <Download size={14} />}
            Export CSV
          </button>
        </div>
      </div>

      {error && (
        <div
          role="alert"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            backgroundColor: '#fef2f2',
            color: '#dc2626',
            border: '1px solid #fecaca',
            borderRadius: '12px',
            padding: '12px 16px',
            fontSize: '13px',
            marginBottom: '16px',
          }}
        >
          <AlertCircle size={16} />
          {error}
        </div>
      )}

      {loading ? (
        <div style={{ padding: '60px 0', textAlign: 'center', color: '#94a3b8' }}>
          <Loader2 size={32} className="admin-spin" style={{ margin: '0 auto 12px' }} />
          <div>Loading finance dashboard data...</div>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: '24px' }}>
          {/* 1. KPI Summary Cards */}
          {summary && <FinanceSummaryCards summary={summary} currency={currency} />}

          {/* 2. Revenue Trend Bar Chart */}
          <FinanceTrendChart
            data={trend}
            groupBy={groupBy}
            onGroupByChange={setGroupBy}
            currency={currency}
          />

          {/* 3. Row: Payment Channels & Top Dishes */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
            <FinancePaymentPie
              methods={methods}
              walkoutLoss={summary?.walkout_loss || 0}
              removedLoss={summary?.removed_loss || 0}
              currency={currency}
            />
            <FinanceTopDishes dishes={dishes} currency={currency} />
          </div>

          {/* 4. Staff Performance Table */}
          <FinanceStaffTable waiters={waiters} currency={currency} />
        </div>
      )}
    </section>
  );
}
