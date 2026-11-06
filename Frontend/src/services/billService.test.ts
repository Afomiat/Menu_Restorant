import { beforeEach, describe, expect, it, vi } from 'vitest';

const get = vi.fn();
const post = vi.fn();
vi.mock('./apiClient', () => ({
  apiClient: { get: (...a: unknown[]) => get(...a), post: (...a: unknown[]) => post(...a) },
}));

import {
  collectBill,
  confirmBill,
  customerRequestBill,
  endShift,
  fetchBills,
  fetchColleagues,
  fetchMyShift,
  handoverBill,
  moveBill,
  requestBill,
  startShift,
} from './billService';

beforeEach(() => {
  get.mockReset().mockResolvedValue({ data: [] });
  post.mockReset().mockResolvedValue({ data: { id: 'b1' } });
});

describe('billService', () => {
  it('calls the bill endpoints with the right bodies', async () => {
    await fetchBills();
    await requestBill('b1');
    await collectBill('b1', { amount: 670, method: 'telebirr', reference: 'TX1' });
    await confirmBill('b1');
    await moveBill('b1', '6');
    await handoverBill('b1', 'w2');
    await fetchColleagues();

    expect(get.mock.calls.map((c) => c[0])).toEqual(['/admin/bills', '/admin/colleagues']);
    expect(post.mock.calls).toEqual([
      ['/admin/bills/b1/request'],
      ['/admin/bills/b1/collect', { amount: 670, method: 'telebirr', reference: 'TX1' }],
      ['/admin/bills/b1/confirm'],
      ['/admin/bills/b1/move', { table_number: '6' }],
      ['/admin/bills/b1/handover', { staff_id: 'w2' }],
    ]);
  });

  it('lets the customer ask with the table QR token', async () => {
    await customerRequestBill('demo-pro', '5', 'tok');
    expect(post).toHaveBeenCalledWith('/menus/demo-pro/bills/request', { table_number: '5', table_token: 'tok' });
  });

  it('reads, starts and ends shifts', async () => {
    get.mockResolvedValueOnce({ data: null });
    expect(await fetchMyShift()).toBeNull();
    await startShift();
    await endShift();
    expect(post.mock.calls.map((c) => c[0])).toEqual(['/admin/shifts/start', '/admin/shifts/end']);
  });
});
