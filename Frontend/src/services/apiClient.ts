const BASE_URL = (import.meta.env.VITE_API_URL as string) || 'https://menu-restorant-1.onrender.com/api/v1';

export class ApiError extends Error {
  status: number;
  data: any;

  constructor(status: number, message: string, data?: any) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

// Session token for customer tracking and 60-second undo (persisted across tab re-opens)
export function getCustomerSessionToken(): string {
  const STORAGE_KEY = 'azai_customer_session_token';
  try {
    let token = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;
    if (!token && typeof sessionStorage !== 'undefined') {
      token = sessionStorage.getItem(STORAGE_KEY);
    }
    if (!token) {
      token = typeof crypto !== 'undefined' && crypto.randomUUID
        ? `sess_${crypto.randomUUID()}`
        : `sess_${Date.now()}_${Math.random().toString(36).substring(2)}`;
    }
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, token);
    }
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.setItem(STORAGE_KEY, token);
    }
    return token;
  } catch {
    return `sess_${Date.now()}_fallback`;
  }
}

// Admin JWT token for staff & KDS operations
export function getAdminToken(): string | null {
  return localStorage.getItem('azai_admin_token');
}

export function setAdminToken(token: string): void {
  localStorage.setItem('azai_admin_token', token);
}

export function removeAdminToken(): void {
  localStorage.removeItem('azai_admin_token');
  localStorage.removeItem('azai_staff_user');
}

export const clearAdminToken = removeAdminToken;

export interface StaffUser {
  id: string;
  email: string;
  role: 'owner' | 'manager' | 'kitchen' | 'waiter' | 'staff' | 'super_admin';
  tenant_id: string;
}

export function getStoredStaff(): StaffUser | null {
  try {
    const raw = localStorage.getItem('azai_staff_user');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export async function loginStaff(email: string, password: string): Promise<{ token: string; user: StaffUser }> {
  const res = await apiClient.post<{ token: string; user: StaffUser }>('/auth/login', {
    email,
    password,
  });
  if (res?.token) {
    setAdminToken(res.token);
    if (res.user) {
      localStorage.setItem('azai_staff_user', JSON.stringify(res.user));
    }
  }
  return res;
}

// Returns the stored staff token. Staff must sign in explicitly: an automatic login
// would bind the session to a fixed restaurant regardless of which admin page is open.
export async function ensureStaffSession(): Promise<string | null> {
  return getAdminToken();
}


interface RequestOptions extends RequestInit {
  requiresAuth?: boolean;
  timeoutMs?: number;
}

async function request<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
  const url = `${BASE_URL}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;

  const headers = new Headers(options.headers || {});
  headers.set('Content-Type', 'application/json');

  // Inject Customer Session Token
  headers.set('X-Session-Token', getCustomerSessionToken());

  // Inject Staff Admin JWT if available or required
  const token = getAdminToken();
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  // 12-second timeout protection (prevents hanging indefinitely on mobile networks)
  const controller = new AbortController();
  const timeoutMs = options.timeoutMs || 12000;
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      headers,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    let data: any = null;
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      try {
        data = await response.json();
      } catch {
        data = null;
      }
    } else {
      try {
        const text = await response.text();
        data = { message: text };
      } catch {}
    }

    if (!response.ok) {
      if (response.status === 401 && endpoint.includes('/admin')) {
        clearAdminToken();
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('azai:auth:unauthorized'));
        }
      }
      const errorMsg = data?.error || data?.message || `HTTP ${response.status}: ${response.statusText}`;
      throw new ApiError(response.status, errorMsg, data);
    }

    return data as T;
  } catch (err: any) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      throw new ApiError(408, 'Request timed out. Please check your connection and try again.');
    }
    throw err;
  }
}

export const apiClient = {
  get: <T>(endpoint: string, options?: RequestOptions) =>
    request<T>(endpoint, { ...options, method: 'GET' }),

  post: <T>(endpoint: string, body?: any, options?: RequestOptions) =>
    request<T>(endpoint, {
      ...options,
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    }),

  put: <T>(endpoint: string, body?: any, options?: RequestOptions) =>
    request<T>(endpoint, {
      ...options,
      method: 'PUT',
      body: body ? JSON.stringify(body) : undefined,
    }),

  patch: <T>(endpoint: string, body?: any, options?: RequestOptions) =>
    request<T>(endpoint, {
      ...options,
      method: 'PATCH',
      body: body ? JSON.stringify(body) : undefined,
    }),

  delete: <T>(endpoint: string, options?: RequestOptions) =>
    request<T>(endpoint, { ...options, method: 'DELETE' }),
};
