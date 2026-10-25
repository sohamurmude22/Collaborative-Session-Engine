import { useEffect, useRef, useState, useCallback } from 'react';
import { WSMessage } from '../types/cse.js';

interface UseSessionSocketProps {
  sessionId?: string;
  onMessage?: (message: WSMessage) => void;
}

export function useSessionSocket({ sessionId, onMessage }: UseSessionSocketProps) {
  const [isConnected, setIsConnected] = useState(false);
  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<any>(null);
  const isUnmountedRef = useRef(false);

  // Store latest onMessage in ref to avoid reconnecting whenever handler references change
  const onMessageRef = useRef(onMessage);
  useEffect(() => {
    onMessageRef.current = onMessage;
  }, [onMessage]);

  const connect = useCallback(() => {
    if (!sessionId || isUnmountedRef.current) return;

    // Clear any existing reconnect timer
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    // If socket is already open or connecting, do not create duplicate
    if (
      socketRef.current &&
      (socketRef.current.readyState === WebSocket.OPEN ||
        socketRef.current.readyState === WebSocket.CONNECTING)
    ) {
      return;
    }

    const token = localStorage.getItem('cse_token');
    const wsUrl = `ws://localhost:5000/ws?token=${token || ''}&session=${sessionId}`;

    try {
      const ws = new WebSocket(wsUrl);
      socketRef.current = ws;

      ws.onopen = () => {
        if (!isUnmountedRef.current) {
          setIsConnected(true);
        }
      };

      ws.onmessage = (event) => {
        try {
          const msg: WSMessage = JSON.parse(event.data);
          if (onMessageRef.current) {
            onMessageRef.current(msg);
          }
        } catch (err) {
          console.error('[WebSocket] Parse error:', err);
        }
      };

      ws.onclose = () => {
        if (!isUnmountedRef.current) {
          setIsConnected(false);
          // Exponential backoff or steady retry every 3s
          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, 3000);
        }
      };

      ws.onerror = () => {
        if (!isUnmountedRef.current) {
          setIsConnected(false);
        }
        ws.close();
      };
    } catch (err) {
      console.error('[WebSocket] Init error:', err);
    }
  }, [sessionId]);

  useEffect(() => {
    isUnmountedRef.current = false;
    connect();

    return () => {
      isUnmountedRef.current = true;
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      if (socketRef.current) {
        // Remove event listeners before closing to prevent reconnection loops on component unmount
        socketRef.current.onclose = null;
        socketRef.current.onerror = null;
        socketRef.current.close();
        socketRef.current = null;
      }
    };
  }, [connect]);

  const sendMessage = useCallback((type: string, payload: any) => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(
        JSON.stringify({
          type,
          sessionId,
          payload,
          timestamp: Date.now()
        })
      );
    }
  }, [sessionId]);

  return { isConnected, sendMessage };
}
