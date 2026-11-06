import type { DailyReport, Decisions, Fault, Problem, ProblemDecision, ProblemReason, ShiftReport, Walkout, WalkoutDecision } from '../types';
import { apiClient } from './apiClient';

/** Waiter or manager: report a problem with one dish of an order. */
export async function reportProblem(orderId: string, orderItemId: string, reason: ProblemReason, note: string): Promise<Problem> {
  return (await apiClient.post<{ data: Problem }>(`/admin/orders/${orderId}/problems`, { order_item_id: orderItemId, reason, note })).data;
}

/** Manager: remake or remove from bill, and who was at fault. */
export async function decideProblem(problemId: string, decision: ProblemDecision, fault: Fault): Promise<Problem> {
  return (await apiClient.post<{ data: Problem }>(`/admin/problems/${problemId}/decision`, { decision, fault })).data;
}

/** Waiter or manager: the customer left without paying. */
export async function markWalkout(billId: string): Promise<Walkout> {
  return (await apiClient.post<{ data: Walkout }>(`/admin/bills/${billId}/walkout`)).data;
}

export async function decideWalkout(billId: string, decision: WalkoutDecision, note: string): Promise<Walkout> {
  return (await apiClient.post<{ data: Walkout }>(`/admin/bills/${billId}/walkout-decision`, { decision, note })).data;
}

/** Manager: problems and walkouts waiting for a decision. */
export async function fetchDecisions(): Promise<Decisions> {
  return (await apiClient.get<{ data: Decisions }>('/admin/decisions')).data;
}

/** Manager: one day's report (YYYY-MM-DD); empty means today. */
export async function fetchDailyReport(date?: string): Promise<DailyReport> {
  const query = date ? `?date=${encodeURIComponent(date)}` : '';
  return (await apiClient.get<{ data: DailyReport }>(`/admin/reports/daily${query}`)).data;
}

/** Waiter or cashier: their own totals for the current (or last) shift. */
export async function fetchMyShiftReport(): Promise<ShiftReport> {
  return (await apiClient.get<{ data: ShiftReport }>('/admin/reports/my-shift')).data;
}
