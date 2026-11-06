import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const get = vi.fn();
const post = vi.fn();
vi.mock('../services/apiClient', () => ({
  apiClient: { get: (...a: unknown[]) => get(...a), post: (...a: unknown[]) => post(...a) },
}));

import { enablePush, pushSupported, urlBase64ToUint8Array } from './push';

const subscription = { toJSON: () => ({ endpoint: 'https://push.example/1', keys: { p256dh: 'k', auth: 'a' } }) };

function fakeBrowser(permission: NotificationPermission, existing: unknown = null) {
  const subscribe = vi.fn(async () => subscription);
  const registration = { pushManager: { getSubscription: vi.fn(async () => existing), subscribe } };
  vi.stubGlobal('Notification', { permission, requestPermission: vi.fn(async () => permission) });
  vi.stubGlobal('PushManager', function PushManager() {});
  Object.defineProperty(navigator, 'serviceWorker', {
    configurable: true,
    value: { register: vi.fn(async () => registration), ready: Promise.resolve(registration) },
  });
  return { subscribe, registration };
}

beforeEach(() => {
  get.mockReset().mockResolvedValue({ data: { enabled: true, public_key: 'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U' } });
  post.mockReset().mockResolvedValue({});
});
afterEach(() => {
  vi.unstubAllGlobals();
  // jsdom has no service worker; take the fake one away again
  delete (navigator as unknown as Record<string, unknown>).serviceWorker;
});

describe('push', () => {
  it('turns the VAPID key into bytes', () => {
    expect(Array.from(urlBase64ToUint8Array('AQID'))).toEqual([1, 2, 3]);
    expect(Array.from(urlBase64ToUint8Array('_-8'))).toEqual([255, 239]);
  });

  it('says when the browser cannot get push', async () => {
    expect(pushSupported()).toBe(false);
    expect(await enablePush()).toBe('unsupported');
  });

  it('subscribes and saves the subscription once permission is given', async () => {
    const { subscribe } = fakeBrowser('granted');

    expect(await enablePush()).toBe('on');
    expect(subscribe).toHaveBeenCalledWith(expect.objectContaining({ userVisibleOnly: true }));
    expect(post).toHaveBeenCalledWith('/admin/push/subscribe', { endpoint: 'https://push.example/1', keys: { p256dh: 'k', auth: 'a' } });
  });

  it('reuses an existing subscription', async () => {
    const { subscribe } = fakeBrowser('granted', subscription);

    expect(await enablePush()).toBe('on');
    expect(subscribe).not.toHaveBeenCalled();
    expect(post).toHaveBeenCalledTimes(1);
  });

  it('stops when permission is refused or the server has push off', async () => {
    fakeBrowser('denied');
    expect(await enablePush()).toBe('blocked');
    expect(post).not.toHaveBeenCalled();

    get.mockResolvedValue({ data: { enabled: false, public_key: '' } });
    fakeBrowser('granted');
    expect(await enablePush()).toBe('disabled');
  });
});
