import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { apiClient, getAdminToken, loginStaff, NO_RESTAURANT_LOGIN_MESSAGE, setAdminToken } from './apiClient';

function jsonResponse(status: number, body: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: '',
    headers: new Headers({ 'content-type': 'application/json' }),
    json: async () => body,
  };
}

function loginResponse(tenantId: string) {
  return jsonResponse(200, {
    token: 'jwt-token',
    user: { id: 'u1', email: 'a@b.c', full_name: 'Hana', role: 'manager', tenant_id: tenantId },
  });
}

function sentBody(fetchMock: ReturnType<typeof vi.fn>) {
  return JSON.parse(fetchMock.mock.calls[0][1].body);
}

beforeEach(() => localStorage.clear());
afterEach(() => vi.unstubAllGlobals());

describe('loginStaff', () => {
  it('saves the session for a restaurant staff account', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(loginResponse('00000000-0000-0000-0000-00000000000d')));

    await loginStaff('manager@pro.azai.local', 'password123');

    expect(getAdminToken()).toBe('jwt-token');
    expect(JSON.parse(localStorage.getItem('azai_staff_user')!).full_name).toBe('Hana');
  });

  it('signs in by phone at the restaurant whose page is open', async () => {
    const fetchMock = vi.fn().mockResolvedValue(loginResponse('00000000-0000-0000-0000-00000000000d'));
    vi.stubGlobal('fetch', fetchMock);

    await loginStaff(' 0911 200 001 ', 'password123', 'demo-pro');

    expect(sentBody(fetchMock)).toEqual({ phone: '0911 200 001', restaurant: 'demo-pro', password: 'password123' });
  });

  it('signs in by email when the text has an @', async () => {
    const fetchMock = vi.fn().mockResolvedValue(loginResponse('00000000-0000-0000-0000-00000000000d'));
    vi.stubGlobal('fetch', fetchMock);

    await loginStaff('manager@pro.azai.local', 'password123', 'demo-pro');

    expect(sentBody(fetchMock)).toEqual({ email: 'manager@pro.azai.local', password: 'password123' });
  });

  it('refuses an account with no restaurant and saves nothing', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(loginResponse('00000000-0000-0000-0000-000000000000')));

    await expect(loginStaff('superadmin@azai.local', 'password123')).rejects.toThrow(NO_RESTAURANT_LOGIN_MESSAGE);
    expect(getAdminToken()).toBeNull();
    expect(localStorage.getItem('azai_staff_user')).toBeNull();
  });

  it('shows the readable reason when an account is turned off', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(jsonResponse(403, { error: 'STAFF_INACTIVE', message: 'this account has been turned off; ask your manager' }))
    );

    await expect(loginStaff('0911200003', 'password123', 'demo-pro')).rejects.toThrow('this account has been turned off; ask your manager');
  });
});

describe('request errors', () => {
  it('keeps plain error text as it is', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(409, { error: 'another staff member already uses this phone number' })));

    await expect(apiClient.post('/admin/staff', {})).rejects.toThrow('another staff member already uses this phone number');
  });

  it('tells the dashboard why staff were signed out', async () => {
    setAdminToken('jwt-token');
    const listener = vi.fn();
    window.addEventListener('azai:auth:unauthorized', listener);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(401, { error: 'STAFF_INACTIVE', message: 'turned off' })));

    await expect(apiClient.get('/admin/orders')).rejects.toThrow('turned off');

    expect(getAdminToken()).toBeNull();
    expect((listener.mock.calls[0][0] as CustomEvent).detail).toEqual({ code: 'STAFF_INACTIVE' });
    window.removeEventListener('azai:auth:unauthorized', listener);
  });
});
