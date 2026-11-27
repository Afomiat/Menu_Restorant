import { useEffect, useState } from 'react';
import { Download } from 'lucide-react';
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
import { BusyButton, SkeletonBlocks } from './Loading';
import FinanceDateRangePicker, { type DateRange } from './FinanceDateRangePicker';
import FinanceSummaryCards from './FinanceSummaryCards';
import FinanceTrendChart from './FinanceTrendChart';
import FinancePaymentPie from './FinancePaymentPie';
import FinanceTopDishes from './FinanceTopDishes';
import FinanceStaffTable from './FinanceStaffTable';

interface FinanceDashboardProps {
  currency?: string;
}

type MethodTotal = { method: PaymentMethod; payments: number; amount: number };

/** The page's parts for one date range; a part is null when its request failed. */
interface Loaded {
  key: string;
  summary: FinanceSummary | null;
  dishes: DishRevenue[] | null;
  methods: MethodTotal[] | null;
  waiters: WaiterTotals[] | null;
}

function valueOrNull<T>(result: PromiseSettledResult<T>): T | null {
  return result.status === 'fulfilled' ? result.value : null;
}

export default function FinanceDashboard({ currency = 'ETB' }: FinanceDashboardProps) {
  const today = todayInEthiopia();
  const firstOfMonth = `${today.slice(0, 7)}-01`;

  const [range, setRange] = useState<DateRange>({ from: firstOfMonth, to: today });
  const [groupBy, setGroupBy] = useState<'day' | 'week'>('day');

  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [trend, setTrend] = useState<{ key: string; points: TrendPoint[] | null } | null>(null);

  const [downloading, setDownloading] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const rangeKey = `${range.from}|${range.to}`;
  const trendKey = `${rangeKey}|${groupBy}`;

  // Each part loads on its own: one failing request (say, top dishes) leaves the rest of the page working
  useEffect(() => {
    let current = true;
    const key = `${range.from}|${range.to}`;
    Promise.allSettled([
      fetchFinanceSummary(range.from, range.to),
      fetchTopDishes(range.from, range.to, 10),
      fetchPaymentMethods(range.from, range.to),
      fetchStaffPerformance(range.from, range.to),
    ]).then(([summary, dishes, methods, waiters]) => {
      // A slow answer for dates no longer picked must not replace the newer one
      if (!current) return;
      setLoaded({
        key,
        summary: valueOrNull(summary),
        dishes: valueOrNull(dishes),
        methods: valueOrNull(methods),
        waiters: valueOrNull(waiters),
      });
    });
    return () => {
      current = false;
    };
  }, [range]);

  // Daily / weekly only changes the chart, so only the chart reloads
  useEffect(() => {
    let current = true;
    const key = `${range.from}|${range.to}|${groupBy}`;
    fetchFinanceTrend(range.from, range.to, groupBy)
      .then((points) => {
        if (current) setTrend({ key, points });
      })
      .catch(() => {
        if (current) setTrend({ key, points: null });
      });
    return () => {
      current = false;
    };
  }, [range, groupBy]);

  const loading = !loaded || loaded.key !== rangeKey;
  const trendLoading = !trend || trend.key !== trendKey;

  const handleExportCSV = async () => {
    setDownloading(true);
    setExportError(null);
    try {
      await downloadFinanceCSV(range.from, range.to);
    } catch (err: unknown) {
      setExportError(err instanceof Error ? err.message : 'Could not export the CSV');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <section className="admin-kitchen-page-view" aria-label="Finance Dashboard">
      <div className="rpt-header">
        <div>
          <h1 className="admin-top-title" style={{ margin: 0 }}>Finance Dashboard</h1>
          <p className="rpt-subtitle">Revenue, payment channels and staff performance</p>
        </div>
        <div className="fin-controls">
          <FinanceDateRangePicker range={range} onChange={setRange} />
          <BusyButton className="admin-sec-pill-btn fin-export" busy={downloading} icon={<Download size={16} />} onClick={handleExportCSV}>
            Export CSV
          </BusyButton>
        </div>
      </div>

      {exportError && (
        <p role="alert" className="fin-error">
          {exportError}
        </p>
      )}

      {loading ? (
        <SkeletonBlocks
          kpis={4}
          sections={[{ kind: 'panel', lines: 6 }, { kind: 'panel', lines: 4 }, { kind: 'rows', count: 4 }]}
          label="Loading the finance dashboard"
        />
      ) : !loaded.summary && !loaded.dishes && !loaded.methods && !loaded.waiters ? (
        <p role="alert" className="fin-error">
          Couldn&apos;t load the finance figures. Check the connection and pick the dates again.
        </p>
      ) : (
        <>
          <FinanceSummaryCards summary={loaded.summary} currency={currency} />

          <FinanceTrendChart
            data={trend?.points ?? []}
            loading={trendLoading}
            failed={!trendLoading && trend?.points === null}
            groupBy={groupBy}
            onGroupByChange={setGroupBy}
            currency={currency}
          />

          <div className="rpt-two">
            <FinancePaymentPie
              methods={loaded.methods}
              walkoutLoss={loaded.summary?.walkout_loss || 0}
              removedLoss={loaded.summary?.removed_loss || 0}
              currency={currency}
            />
            <FinanceTopDishes dishes={loaded.dishes} currency={currency} />
          </div>

          <FinanceStaffTable waiters={loaded.waiters} currency={currency} />
        </>
      )}
    </section>
  );
}
