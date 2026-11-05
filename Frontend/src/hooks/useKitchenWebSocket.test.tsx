import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook } from '@testing-library/react';
import { useKitchenWebSocket } from './useKitchenWebSocket';

/** A WebSocket the test drives by hand. */
class FakeSocket {
  static OPEN = 1;
  static CONNECTING = 0;
  static last: FakeSocket | null = null;
  readyState = FakeSocket.CONNECTING;
  onopen: (() => void) | null = null;
  onmessage: ((e: { data: string }) => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: ((e: unknown) => void) | null = null;
  url: string;
  constructor(url: string) {
    this.url = url;
    FakeSocket.last = this;
  }
  close() {}
  receive(event: string, data: unknown) {
    act(() => this.onmessage?.({ data: JSON.stringify({ tenant_id: 't', event, data }) }));
  }
}

let audioContexts = 0;
class FakeAudioContext {
  currentTime = 0;
  destination = {};
  constructor() {
    audioContexts++;
  }
  createOscillator() {
    return { type: '', frequency: { setValueAtTime: vi.fn() }, connect: vi.fn(), start: vi.fn(), stop: vi.fn() };
  }
  createGain() {
    return { gain: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() }, connect: vi.fn() };
  }
}

beforeEach(() => {
  audioContexts = 0;
  vi.stubGlobal('WebSocket', FakeSocket);
  vi.stubGlobal('AudioContext', FakeAudioContext);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('useKitchenWebSocket', () => {
  it('passes the Pro food-ready and very-late events on', () => {
    const onOrderReady = vi.fn();
    const onOrderVeryLate = vi.fn();
    renderHook(() => useKitchenWebSocket({ token: 'jwt', onOrderReady, onOrderVeryLate }));
    const socket = FakeSocket.last!;

    socket.receive('order:ready', { order_id: 'o1', table_number: '5' });
    socket.receive('order:very_late', { order_id: 'o2', table_number: '7', target_minutes: 15, cooking_minutes: 31 });

    expect(onOrderReady).toHaveBeenCalledWith({ order_id: 'o1', table_number: '5' });
    expect(onOrderVeryLate).toHaveBeenCalledWith({ order_id: 'o2', table_number: '7', target_minutes: 15, cooking_minutes: 31 });
    expect(socket.url).toContain('token=jwt');
  });

  it('chimes for new orders unless the screen rings its own bell', () => {
    const onOrderCreated = vi.fn();
    const { unmount } = renderHook(() => useKitchenWebSocket({ token: 'jwt', onOrderCreated }));
    FakeSocket.last!.receive('order:created', { id: 'o1' });
    expect(audioContexts).toBe(1);
    expect(onOrderCreated).toHaveBeenCalledTimes(1);
    unmount();

    renderHook(() => useKitchenWebSocket({ token: 'jwt', onOrderCreated, chimeOnNewOrder: false }));
    FakeSocket.last!.receive('order:created', { id: 'o2' });
    expect(audioContexts).toBe(1);
    expect(onOrderCreated).toHaveBeenCalledTimes(2);
  });
});

describe('useKitchenWebSocket staff alerts', () => {
  it('passes bill, table and shift events to onStaffAlert and ignores others', () => {
    const onStaffAlert = vi.fn();
    renderHook(() => useKitchenWebSocket({ token: 'jwt', onStaffAlert }));
    const socket = FakeSocket.last!;

    socket.receive('bill:requested', { bill_id: 'b1', table_number: '5' });
    socket.receive('table:open_bill_rescanned', { bill_id: 'b1', table_number: '5' });
    socket.receive('shift:open_bills', { count: 2 });
    socket.receive('menu:updated', null);

    expect(onStaffAlert.mock.calls.map((c) => c[0])).toEqual(['bill:requested', 'table:open_bill_rescanned', 'shift:open_bills']);
    expect(onStaffAlert.mock.calls[0][1]).toEqual({ bill_id: 'b1', table_number: '5' });
  });
});
