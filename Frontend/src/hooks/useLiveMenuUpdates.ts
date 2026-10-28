import { useEffect, useRef } from 'react';

const KITCHEN_WS_URL = (import.meta.env.VITE_WS_URL as string) || 'wss://menu-restorant-1.onrender.com/ws/kitchen';
// The menu socket lives on the same server as the kitchen one: wss://host/ws/kitchen -> wss://host/ws/menu/<slug>
const WS_BASE_URL = KITCHEN_WS_URL.replace(/\/ws\/kitchen\/?$/, '');

// Staff saving a dish can trigger several updates in a row; reload the menu once for all of them
const RELOAD_DELAY_MS = 300;

/**
 * Listens to the restaurant's live menu channel and calls `onMenuUpdated` whenever staff change a
 * price, dish, category, sold-out mark or the branding, so the open menu refreshes without
 * reloading the page. Pass a null slug for menus that do not come from the live backend.
 */
export function useLiveMenuUpdates(slug: string | null, onMenuUpdated: () => void) {
  const onMenuUpdatedRef = useRef(onMenuUpdated);
  onMenuUpdatedRef.current = onMenuUpdated;

  useEffect(() => {
    if (!slug) return;

    let socket: WebSocket | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    let reloadTimer: ReturnType<typeof setTimeout> | undefined;
    let retries = 0;
    let hasConnected = false;
    let stopped = false;

    const scheduleReload = () => {
      clearTimeout(reloadTimer);
      reloadTimer = setTimeout(() => onMenuUpdatedRef.current(), RELOAD_DELAY_MS);
    };

    const connect = () => {
      if (stopped) return;
      const ws = new WebSocket(`${WS_BASE_URL}/ws/menu/${encodeURIComponent(slug)}`);
      socket = ws;

      ws.onopen = () => {
        retries = 0;
        // Changes made while the signal was down were missed: catch up once
        if (hasConnected) scheduleReload();
        hasConnected = true;
      };

      ws.onmessage = (event) => {
        try {
          if (JSON.parse(event.data).event === 'menu:updated') scheduleReload();
        } catch {
          // Ignore anything that is not a menu event
        }
      };

      ws.onclose = () => {
        socket = null;
        if (stopped) return;
        // Back off up to 30s so a backend that is down is not hammered by every open phone
        const delay = Math.min(30000, 1000 * Math.pow(1.5, retries)) + Math.random() * 1000;
        retries += 1;
        retryTimer = setTimeout(connect, delay);
      };

      ws.onerror = () => ws.close();
    };

    // Phones drop sockets while the page is in the background: reconnect as soon as it is back
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && !socket) {
        clearTimeout(retryTimer);
        retries = 0;
        connect();
      }
    };

    connect();
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      stopped = true;
      clearTimeout(retryTimer);
      clearTimeout(reloadTimer);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (socket) {
        socket.onclose = null;
        socket.close();
      }
    };
  }, [slug]);
}
