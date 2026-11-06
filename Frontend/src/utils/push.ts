import { apiClient } from '../services/apiClient';

export type PushState = 'unsupported' | 'off' | 'blocked' | 'on' | 'disabled';

/** Whether this browser can get web push (on iPhone only once the page is on the home screen). */
export function pushSupported(): boolean {
  return typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

/** The VAPID public key as the bytes PushManager.subscribe expects. */
export function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padded = (base64 + '='.repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(padded);
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

export async function fetchPushKey(): Promise<{ enabled: boolean; public_key: string }> {
  return (await apiClient.get<{ data: { enabled: boolean; public_key: string } }>('/admin/push/key')).data;
}

/**
 * Turns on alerts for locked phones: asks permission (must come from a tap), subscribes this
 * browser with the server's key and saves the subscription for the signed-in staff member.
 */
export async function enablePush(): Promise<PushState> {
  if (!pushSupported()) return 'unsupported';
  const key = await fetchPushKey();
  if (!key.enabled) return 'disabled';

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return 'blocked';

  const registration = await navigator.serviceWorker.register('/sw.js');
  await navigator.serviceWorker.ready;
  const subscription =
    (await registration.pushManager.getSubscription()) ||
    (await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(key.public_key) as BufferSource,
    }));
  await apiClient.post('/admin/push/subscribe', subscription.toJSON());
  return 'on';
}
