import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor, fireEvent } from '@testing-library/react';
import FinanceDashboard from './FinanceDashboard';
import * as financeService from '../services/financeService';
import type { DishRevenue, FinanceSummary, TrendPoint, WaiterTotals } from '../types';

vi.mock('../services/financeService', () => ({
  fetchFinanceSummary: vi.fn(),
  fetchFinanceTrend: vi.fn(),
  fetchTopDishes: vi.fn(),
  fetchPaymentMethods: vi.fn(),
  fetchStaffPerformance: vi.fn(),
  downloadFinanceCSV: vi.fn(),
}));

const mockSummary: FinanceSummary = {
  from: '2026-11-01',
  to: '2026-11-23',
  sales_total: 48500,
  collected: 44200,
  confirmed: 40000,
  collected_not_confirmed: 4200,
  walkout_loss: 1200,
  removed_loss: 800,
};

const mockTrend: TrendPoint[] = [
  { period: '2026-11-21', revenue: 15000, collected: 14000, walkout_loss: 500 },
  { period: '2026-11-22', revenue: 20000, collected: 19000, walkout_loss: 0 },
];

const mockDishes: DishRevenue[] = [
  { item_name: 'Doro Wat', quantity_sold: 24, revenue: 12480 },
  { item_name: 'Tibs', quantity_sold: 20, revenue: 9000 },
];

const mockMethods = [
  { method: 'cash' as const, payments: 45, amount: 28000 },
  { method: 'telebirr' as const, payments: 20, amount: 14200 },
];

const mockWaiters: WaiterTotals[] = [
  {
    waiter_id: 'w1',
    waiter_name: 'Abebe Kebede',
    bills: 24,
    sales: 18500,
    collected: 17200,
    confirmed: 16000,
    collected_not_confirmed: 1200,
    walkouts: 2,
  },
];

describe('FinanceDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(financeService.fetchFinanceSummary).mockResolvedValue(mockSummary);
    vi.mocked(financeService.fetchFinanceTrend).mockResolvedValue(mockTrend);
    vi.mocked(financeService.fetchTopDishes).mockResolvedValue(mockDishes);
    vi.mocked(financeService.fetchPaymentMethods).mockResolvedValue(mockMethods);
    vi.mocked(financeService.fetchStaffPerformance).mockResolvedValue(mockWaiters);
    vi.mocked(financeService.downloadFinanceCSV).mockResolvedValue(undefined);
  });

  afterEach(() => {
    cleanup();
  });

  it('renders all sections and KPI cards with formatted data', async () => {
    render(<FinanceDashboard currency="ETB" />);

    expect(screen.getByRole('status', { name: 'Loading the finance dashboard' })).toBeTruthy();

    await waitFor(() => {
      expect(screen.getByText('Finance Dashboard')).toBeTruthy();
    });

    // KPI Cards
    expect(screen.getByText('Total Revenue')).toBeTruthy();
    expect(screen.getByText('48,500 ETB')).toBeTruthy();
    expect(screen.getByText('Total Collected')).toBeTruthy();
    expect(screen.getByText('44,200 ETB')).toBeTruthy();
    expect(screen.getByText('Pending Confirmation')).toBeTruthy();
    expect(screen.getByText('4,200 ETB')).toBeTruthy();
    expect(screen.getByText('Total Losses')).toBeTruthy();
    expect(screen.getByText('2,000 ETB')).toBeTruthy(); // 1200 + 800

    // Trend section
    expect(screen.getByText('Revenue Trend')).toBeTruthy();

    // Payment breakdown
    expect(screen.getByText('Payment Breakdown')).toBeTruthy();
    expect(screen.getByText('Cash')).toBeTruthy();
    expect(screen.getByText('Telebirr')).toBeTruthy();

    // Top dishes
    expect(screen.getByText('Top Dishes by Revenue')).toBeTruthy();
    expect(screen.getByText('Doro Wat')).toBeTruthy();
    expect(screen.getByText('Tibs')).toBeTruthy();

    // Staff table
    expect(screen.getByText('Staff Billing Performance')).toBeTruthy();
    expect(screen.getByText('Abebe Kebede')).toBeTruthy();
  });

  it('triggers CSV download when Export CSV button is clicked', async () => {
    render(<FinanceDashboard currency="ETB" />);

    await waitFor(() => {
      expect(screen.getByText('Export CSV')).toBeTruthy();
    });

    const exportBtn = screen.getByText('Export CSV');
    fireEvent.click(exportBtn);

    await waitFor(() => {
      expect(financeService.downloadFinanceCSV).toHaveBeenCalledTimes(1);
    });
  });

  it('switches trend grouping between daily and weekly', async () => {
    render(<FinanceDashboard currency="ETB" />);

    await waitFor(() => {
      expect(screen.getByText('Weekly')).toBeTruthy();
    });

    const weeklyBtn = screen.getByText('Weekly');
    fireEvent.click(weeklyBtn);

    await waitFor(() => {
      expect(financeService.fetchFinanceTrend).toHaveBeenCalledWith(expect.any(String), expect.any(String), 'week');
    });
  });

  it('keeps the other sections when one part fails to load', async () => {
    vi.mocked(financeService.fetchTopDishes).mockRejectedValue(new Error('Request failed with status code 500'));

    render(<FinanceDashboard currency="ETB" />);

    const dishes = await screen.findByRole('region', { name: 'Top Dishes by Revenue' });
    expect(dishes.textContent).toContain("Couldn't load this part right now");
    // The rest of the page still shows its numbers
    expect(screen.getByText('48,500 ETB')).toBeTruthy();
    expect(screen.getByText('Abebe Kebede')).toBeTruthy();
  });

  it('shows one error when nothing could be loaded', async () => {
    const fail = new Error('Network error');
    vi.mocked(financeService.fetchFinanceSummary).mockRejectedValue(fail);
    vi.mocked(financeService.fetchTopDishes).mockRejectedValue(fail);
    vi.mocked(financeService.fetchPaymentMethods).mockRejectedValue(fail);
    vi.mocked(financeService.fetchStaffPerformance).mockRejectedValue(fail);

    render(<FinanceDashboard currency="ETB" />);

    expect((await screen.findByRole('alert')).textContent).toContain("Couldn't load the finance figures");
  });

  it('reloads only the chart when switching to weekly, and shows a failed export on the page', async () => {
    vi.mocked(financeService.downloadFinanceCSV).mockRejectedValue(new Error('Export failed'));
    render(<FinanceDashboard currency="ETB" />);

    fireEvent.click(await screen.findByRole('button', { name: 'Weekly' }));
    await waitFor(() => expect(financeService.fetchFinanceTrend).toHaveBeenCalledTimes(2));
    expect(financeService.fetchFinanceSummary).toHaveBeenCalledTimes(1);
    expect(screen.getByText('48,500 ETB')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Export CSV' }));
    expect((await screen.findByRole('alert')).textContent).toBe('Export failed');
  });

  it('renders graceful empty states when datasets are empty', async () => {
    vi.mocked(financeService.fetchFinanceSummary).mockResolvedValue({
      ...mockSummary,
      sales_total: 0,
      collected: 0,
      confirmed: 0,
      collected_not_confirmed: 0,
      walkout_loss: 0,
      removed_loss: 0,
    });
    vi.mocked(financeService.fetchTopDishes).mockResolvedValue([]);
    vi.mocked(financeService.fetchPaymentMethods).mockResolvedValue([]);
    vi.mocked(financeService.fetchStaffPerformance).mockResolvedValue([]);
    vi.mocked(financeService.fetchFinanceTrend).mockResolvedValue([]);

    render(<FinanceDashboard currency="ETB" />);

    await waitFor(() => {
      expect(screen.getByText('No revenue data found for this date range.')).toBeTruthy();
      expect(screen.getByText('No payment transactions in this period.')).toBeTruthy();
      expect(screen.getByText('No dish sales in this period.')).toBeTruthy();
      expect(screen.getByText('No staff billing activity recorded in this period.')).toBeTruthy();
    });
  });
});
