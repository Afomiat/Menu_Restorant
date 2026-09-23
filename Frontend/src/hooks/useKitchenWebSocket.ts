import { useEffect, useRef, useState, useCallback } from 'react';
import { getAdminToken } from '../services/apiClient';

interface WebSocketEvent {
  tenant_id: string;
  event: string;
  data: any;
}

interface UseKitchenWebSocketOptions {
  token?: string | null;
  onOrderCreated?: (order: any) => void;
  onOrderCancelled?: (orderId: string) => void;
  onOrderStatusUpdated?: (orderId: string, status: string) => void;
  onItemSoldOutToggled?: (itemId: string, isSoldOut: boolean) => void;
}

export function useKitchenWebSocket(options: UseKitchenWebSocketOptions = {}) {
  const [isConnected, setIsConnected] = useState(false);
  const [lastEvent, setLastEvent] = useState<WebSocketEvent | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<any>(null);
  const retryCountRef = useRef<number>(0);
  const optionsRef = useRef<UseKitchenWebSocketOptions>(options);
  optionsRef.current = options;

  // Synthesize an audio notification chime using Web Audio API (Zero external mp3 dependencies)
  const playChime = useCallback(() => {
    try {
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContext) return;
      const ctx = new AudioContext();
      
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
      osc.frequency.setValueAtTime(880.00, ctx.currentTime + 0.12); // A5
      
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      osc.start();
      osc.stop(ctx.currentTime + 0.6);
    } catch {
      // Audio playback suppressed or unsupported
    }
  }, []);

  const isUnmountedRef = useRef(false);

  const connect = useCallback(() => {
    if (isUnmountedRef.current) return;

    const token = optionsRef.current.token || getAdminToken();
    if (!token) {
      setIsConnected(false);
      // Wait for staff session to authenticate, then re-attempt connection
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = setTimeout(() => {
        if (!isUnmountedRef.current) connect();
      }, 1000);
      return;
    }

    const wsUrl = (import.meta.env.VITE_WS_URL as string) || 'ws://localhost:8080/ws/kitchen';
    const fullUrl = `${wsUrl}?token=${encodeURIComponent(token)}`;

    try {
      if (wsRef.current && (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING)) {
        return;
      }

      const ws = new WebSocket(fullUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        if (isUnmountedRef.current) {
          ws.close();
          return;
        }
        setIsConnected(true);
        retryCountRef.current = 0; // Reset backoff counter on successful connection
      };

      ws.onmessage = (event) => {
        if (isUnmountedRef.current) return;
        try {
          const parsed: WebSocketEvent = JSON.parse(event.data);
          setLastEvent(parsed);

          switch (parsed.event) {
            case 'order:created':
              playChime();
              optionsRef.current.onOrderCreated?.(parsed.data);
              break;
            case 'order:cancelled':
              optionsRef.current.onOrderCancelled?.(parsed.data?.order_id);
              break;
            case 'order:status_updated':
              optionsRef.current.onOrderStatusUpdated?.(parsed.data?.order_id, parsed.data?.status);
              break;
            case 'item:sold_out_toggled':
              optionsRef.current.onItemSoldOutToggled?.(parsed.data?.item_id, parsed.data?.is_sold_out);
              break;
          }
        } catch (err) {
          console.error('[WS] Failed to parse message:', err);
        }
      };

      ws.onclose = () => {
        setIsConnected(false);
        wsRef.current = null;
        clearTimeout(reconnectTimeoutRef.current);
        if (isUnmountedRef.current) return;

        // Exponential backoff: min(30s, 1s * 1.5^retry) + random jitter (0-1000ms)
        const retry = retryCountRef.current;
        const delay = Math.min(30000, 1000 * Math.pow(1.5, retry)) + Math.random() * 1000;
        retryCountRef.current = retry + 1;

        reconnectTimeoutRef.current = setTimeout(() => {
          if (!isUnmountedRef.current) {
            connect();
          }
        }, delay);
      };

      ws.onerror = (err) => {
        console.warn('[WS] Connection error:', err);
        ws.close();
      };
    } catch (err) {
      console.error('[WS] Initialization error:', err);
    }
  }, [playChime]);

  // Connect on mount or whenever explicit token changes
  useEffect(() => {
    isUnmountedRef.current = false;
    connect();

    return () => {
      isUnmountedRef.current = true;
      clearTimeout(reconnectTimeoutRef.current);
      if (wsRef.current) {
        wsRef.current.onclose = null;
        wsRef.current.onerror = null;
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [connect, options.token]);

  return { isConnected, lastEvent, playChime };
}
