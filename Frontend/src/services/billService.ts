import type { Bill, Colleague, PaymentMethod, Shift } from '../types';
import { apiClient } from './apiClient';

/** A waiter's own bills, or every bill for cashiers and managers (open ones and today's closed ones). */
export async function fetchBills(): Promise<Bill[]> {
  const res = await apiClient.get<{ data: Bill[] }>('/admin/bills');
  return res?.data || [];
}

export async function requestBill(billId: string): Promise<Bill> {
  return (await apiClient.post<{ data: Bill }>(`/admin/bills/${billId}/request`)).data;
}

export async function collectBill(billId: string, input: { amount: number; method: PaymentMethod; reference?: string }): Promise<Bill> {
  return (await apiClient.post<{ data: Bill }>(`/admin/bills/${billId}/collect`, input)).data;
}

export async function confirmBill(billId: string): Promise<Bill> {
  return (await apiClient.post<{ data: Bill }>(`/admin/bills/${billId}/confirm`)).data;
}

/** Moves the bill to another table, or merges it with that table's bill. */
export async function moveBill(billId: string, tableNumber: string): Promise<Bill> {
  return (await apiClient.post<{ data: Bill }>(`/admin/bills/${billId}/move`, { table_number: tableNumber })).data;
}

export async function handoverBill(billId: string, staffId: string): Promise<Bill> {
  return (await apiClient.post<{ data: Bill }>(`/admin/bills/${billId}/handover`, { staff_id: staffId })).data;
}

export async function fetchColleagues(): Promise<Colleague[]> {
  const res = await apiClient.get<{ data: Colleague[] }>('/admin/colleagues');
  return res?.data || [];
}

/** The customer's "Ask for the bill" button, proven by the table's QR token. */
export async function customerRequestBill(slug: string, tableNumber: string, tableToken: string): Promise<void> {
  await apiClient.post(`/menus/${slug}/bills/request`, { table_number: tableNumber, table_token: tableToken });
}

export async function fetchMyShift(): Promise<Shift | null> {
  const res = await apiClient.get<{ data: Shift | null }>('/admin/shifts/me');
  return res?.data ?? null;
}

export async function startShift(): Promise<Shift> {
  return (await apiClient.post<{ data: Shift }>('/admin/shifts/start')).data;
}

/** Refused (409) while a waiter still holds unpaid bills; the error says how many. */
export async function endShift(): Promise<Shift> {
  return (await apiClient.post<{ data: Shift }>('/admin/shifts/end')).data;
}
