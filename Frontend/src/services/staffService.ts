import type { StaffMember, StaffRole } from '../types';
import { apiClient } from './apiClient';

export interface NewStaffInput {
  full_name: string;
  phone: string;
  email?: string;
  password: string;
  role: StaffRole;
}

/** Only the fields that are set are changed. */
export interface StaffChanges {
  full_name?: string;
  role?: StaffRole;
  is_active?: boolean;
  password?: string;
}

/** Manager: every staff account of the restaurant, active ones first. */
export async function fetchStaff(): Promise<StaffMember[]> {
  const res = await apiClient.get<{ data: StaffMember[] }>('/admin/staff');
  return res?.data || [];
}

/** Manager: add a staff member; errors carry the server's reason (e.g. phone already used). */
export async function createStaff(input: NewStaffInput): Promise<StaffMember> {
  const res = await apiClient.post<{ data: StaffMember }>('/admin/staff', input);
  return res.data;
}

export async function updateStaff(id: string, changes: StaffChanges): Promise<StaffMember> {
  const res = await apiClient.patch<{ data: StaffMember }>(`/admin/staff/${id}`, changes);
  return res.data;
}
