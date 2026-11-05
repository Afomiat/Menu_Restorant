import type { OrderStatus } from '../types';

export type TimerColor = 'green' | 'yellow' | 'red';

/** Share of the target at which the timer turns yellow, then red. */
export const YELLOW_AT = 0.8;
export const RED_AT = 1;

export interface TimerState {
  elapsedMs: number;
  /** elapsed / target: 1 means the prep time has run out. */
  ratio: number;
  color: TimerColor;
}

/** How far a cooking order is into its target time. */
export function timerState(startedAt: number, targetMinutes: number, now: number): TimerState {
  const elapsedMs = Math.max(0, now - startedAt);
  const targetMs = Math.max(1, targetMinutes) * 60_000;
  const ratio = elapsedMs / targetMs;
  const color: TimerColor = ratio >= RED_AT ? 'red' : ratio >= YELLOW_AT ? 'yellow' : 'green';
  return { elapsedMs, ratio, color };
}

/** "4:05" for minutes and seconds; "1:02:10" past an hour. */
export function formatDuration(ms: number): string {
  const total = Math.floor(Math.max(0, ms) / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = String(total % 60).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`;
}

/** "just now", "5m ago", "1h 10m ago": how long an order has waited. */
export function formatWaited(since: number, now: number): string {
  const minutes = Math.floor(Math.max(0, now - since) / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m ago`;
}

/**
 * The customer's ready estimate (Pro): "About 15 min" before cooking starts, then
 * "Ready in about 7 min" counting down, then "Almost ready" past the target. Never negative.
 * Returns null when there is nothing to estimate.
 */
export function customerEstimate(
  status: OrderStatus | undefined,
  targetMinutes: number | undefined,
  startedAt: number | undefined,
  now: number
): string | null {
  if (!targetMinutes || targetMinutes <= 0) return null;
  if (!status || status === 'not_started' || status === 'pending_grace' || status === 'received') {
    return `About ${targetMinutes} min`;
  }
  if (status === 'preparing') {
    if (!startedAt) return `About ${targetMinutes} min`;
    const leftMinutes = Math.ceil((startedAt + targetMinutes * 60_000 - now) / 60_000);
    return leftMinutes > 0 ? `Ready in about ${leftMinutes} min` : 'Almost ready';
  }
  return null;
}

/** A typed prep time as whole minutes (1 to 240), or null for the restaurant default. */
export function parsePrepMinutes(value: unknown): number | null {
  const n = typeof value === 'number' ? value : parseInt(String(value ?? ''), 10);
  return Number.isFinite(n) && n >= 1 && n <= 240 ? Math.round(n) : null;
}
