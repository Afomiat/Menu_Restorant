import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getAdminToken, loginStaff, NO_RESTAURANT_LOGIN_MESSAGE } from './apiClient';

function loginResponse(tenantId: string) {
  return {
    ok: true,
    status: 200,
    headers: new Headers({ 'content-type': 'application/json' }),
    json: async () => ({ token: 'jwt-token', user: { id: 'u1', email: 'a@b.c', role: 'owner', tenant_id: tenantId } }),
  };
}

beforeEach(() => localStorage.clear());
afterEach(() => vi.unstubAllGlobals());

describe('loginStaff', () => {
  it('saves the session for a restaurant staff account', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(loginResponse('00000000-0000-0000-0000-00000000000d')));

    await loginStaff('owner@pro.azai.local', 'password123');

    expect(getAdminToken()).toBe('jwt-token');
  });

  it('refuses an account with no restaurant and saves nothing', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(loginResponse('00000000-0000-0000-0000-000000000000')));

    await expect(loginStaff('superadmin@azai.local', 'password123')).rejects.toThrow(NO_RESTAURANT_LOGIN_MESSAGE);
    expect(getAdminToken()).toBeNull();
    expect(localStorage.getItem('azai_staff_user')).toBeNull();
  });
});
