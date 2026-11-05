import { describe, expect, it } from 'vitest';
import { customerEstimate, formatDuration, formatWaited, parsePrepMinutes, timerState } from './kitchenTimer';

const MIN = 60_000;
const start = 1_000_000;

describe('timerState', () => {
  it('is green before 80% of the target, yellow from 80%, red from 100%', () => {
    expect(timerState(start, 10, start + 7.9 * MIN).color).toBe('green');
    expect(timerState(start, 10, start + 8 * MIN).color).toBe('yellow');
    expect(timerState(start, 10, start + 9.9 * MIN).color).toBe('yellow');
    expect(timerState(start, 10, start + 10 * MIN).color).toBe('red');
    expect(timerState(start, 10, start + 25 * MIN).ratio).toBe(2.5);
  });

  it('never counts negative time', () => {
    expect(timerState(start, 10, start - MIN).elapsedMs).toBe(0);
  });
});

describe('formatting', () => {
  it('formats durations as m:ss and h:mm:ss', () => {
    expect(formatDuration(0)).toBe('0:00');
    expect(formatDuration(245_000)).toBe('4:05');
    expect(formatDuration(3_730_000)).toBe('1:02:10');
  });

  it('formats waiting time like the kitchen screen today', () => {
    expect(formatWaited(start, start + 30_000)).toBe('just now');
    expect(formatWaited(start, start + 5 * MIN)).toBe('5m ago');
    expect(formatWaited(start, start + 70 * MIN)).toBe('1h 10m ago');
  });
});

describe('customerEstimate', () => {
  it('shows the prep time before cooking starts', () => {
    expect(customerEstimate('not_started', 15, undefined, start)).toBe('About 15 min');
    expect(customerEstimate('pending_grace', 15, undefined, start)).toBe('About 15 min');
  });

  it('counts down while cooking and never goes negative', () => {
    expect(customerEstimate('preparing', 15, start, start + 8 * MIN)).toBe('Ready in about 7 min');
    expect(customerEstimate('preparing', 15, start, start + 14.5 * MIN)).toBe('Ready in about 1 min');
    expect(customerEstimate('preparing', 15, start, start + 15 * MIN)).toBe('Almost ready');
    expect(customerEstimate('preparing', 15, start, start + 40 * MIN)).toBe('Almost ready');
  });

  it('shows nothing once ready, or without a target (Basic and Plus)', () => {
    expect(customerEstimate('ready', 15, start, start)).toBeNull();
    expect(customerEstimate('complete', 15, start, start)).toBeNull();
    expect(customerEstimate('not_started', undefined, undefined, start)).toBeNull();
  });
});

describe('parsePrepMinutes', () => {
  it('accepts 1 to 240 minutes and treats anything else as the default', () => {
    expect(parsePrepMinutes(15)).toBe(15);
    expect(parsePrepMinutes('20')).toBe(20);
    expect(parsePrepMinutes('')).toBeNull();
    expect(parsePrepMinutes(null)).toBeNull();
    expect(parsePrepMinutes(0)).toBeNull();
    expect(parsePrepMinutes(241)).toBeNull();
  });
});
