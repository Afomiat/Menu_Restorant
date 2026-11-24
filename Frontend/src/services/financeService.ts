import type { DishRevenue, FinanceSummary, PaymentMethod, TrendPoint, WaiterTotals } from '../types';
import { apiClient, getAdminToken } from './apiClient';

const BASE_URL = (import.meta.env.VITE_API_URL as string) || 'https://menu-restorant-1.onrender.com/api/v1';

export async function fetchFinanceSummary(from: string, to: string): Promise<FinanceSummary> {
  const query = `?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;
  return (await apiClient.get<{ data: FinanceSummary }>(`/admin/finance/summary${query}`)).data;
}

export async function fetchFinanceTrend(from: string, to: string, groupBy: 'day' | 'week' = 'day'): Promise<TrendPoint[]> {
  const query = `?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&group=${encodeURIComponent(groupBy)}`;
  return (await apiClient.get<{ data: TrendPoint[] }>(`/admin/finance/trend${query}`)).data;
}

export async function fetchTopDishes(from: string, to: string, limit = 10): Promise<DishRevenue[]> {
  const query = `?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&limit=${limit}`;
  return (await apiClient.get<{ data: DishRevenue[] }>(`/admin/finance/top-dishes${query}`)).data;
}

export async function fetchPaymentMethods(from: string, to: string): Promise<{ method: PaymentMethod; payments: number; amount: number }[]> {
  const query = `?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;
  return (await apiClient.get<{ data: { method: PaymentMethod; payments: number; amount: number }[] }>(`/admin/finance/payment-methods${query}`)).data;
}

export async function fetchStaffPerformance(from: string, to: string): Promise<WaiterTotals[]> {
  const query = `?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;
  return (await apiClient.get<{ data: WaiterTotals[] }>(`/admin/finance/staff${query}`)).data;
}

export async function downloadFinanceCSV(from: string, to: string): Promise<void> {
  const token = getAdminToken();
  const query = `?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;
  const res = await fetch(`${BASE_URL}/admin/finance/summary.csv${query}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) {
    throw new Error('Failed to download CSV report');
  }
  const blob = await res.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `finance-report-${from}-to-${to}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(url);
}
