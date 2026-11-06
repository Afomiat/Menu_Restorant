import { beforeEach, describe, expect, it, vi } from 'vitest';

const get = vi.fn();
const post = vi.fn();
vi.mock('./apiClient', () => ({
  apiClient: { get: (...a: unknown[]) => get(...a), post: (...a: unknown[]) => post(...a) },
}));

import {
  decideProblem,
  decideWalkout,
  fetchDailyReport,
  fetchDecisions,
  fetchMyShiftReport,
  markWalkout,
  reportProblem,
} from './problemService';

beforeEach(() => {
  get.mockReset().mockResolvedValue({ data: {} });
  post.mockReset().mockResolvedValue({ data: {} });
});

describe('problemService', () => {
  it('reports and decides problems and walkouts', async () => {
    await reportProblem('o1', 'i1', 'cold', 'cold coffee');
    await decideProblem('p1', 'remake', 'kitchen');
    await markWalkout('b1');
    await decideWalkout('b1', 'waiter_pays', 'agreed');

    expect(post.mock.calls).toEqual([
      ['/admin/orders/o1/problems', { order_item_id: 'i1', reason: 'cold', note: 'cold coffee' }],
      ['/admin/problems/p1/decision', { decision: 'remake', fault: 'kitchen' }],
      ['/admin/bills/b1/walkout'],
      ['/admin/bills/b1/walkout-decision', { decision: 'waiter_pays', note: 'agreed' }],
    ]);
  });

  it('loads decisions and reports', async () => {
    await fetchDecisions();
    await fetchDailyReport('2026-11-05');
    await fetchDailyReport();
    await fetchMyShiftReport();

    expect(get.mock.calls.map((c) => c[0])).toEqual([
      '/admin/decisions',
      '/admin/reports/daily?date=2026-11-05',
      '/admin/reports/daily',
      '/admin/reports/my-shift',
    ]);
  });
});
