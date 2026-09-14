// src/hooks/useNIDSSocket.jsx
//
// One shared WebSocket connection for the whole dashboard, exposed via
// context so every panel can read the same live stream without opening
// its own socket. Handles reconnection with exponential backoff so a
// backend restart doesn't break the UI — it just shows "reconnecting"
// and picks back up automatically once the server is back.

import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from "react";

const NIDSSocketContext = createContext(null);

const MAX_HISTORY = 50; // how many recent flows we keep in memory for the panels
const INITIAL_BACKOFF_MS = 1000;
const MAX_BACKOFF_MS = 10000;

export function NIDSSocketProvider({ url = "ws://localhost:8000/ws", children }) {
  const [status, setStatus] = useState("connecting"); // 'connecting' | 'open' | 'closed' | 'error'
  const [history, setHistory] = useState([]); // oldest -> newest, capped at MAX_HISTORY

  const wsRef = useRef(null);
  const backoffRef = useRef(INITIAL_BACKOFF_MS);
  const reconnectTimerRef = useRef(null);
  const closedByUsRef = useRef(false);

  const connect = useCallback(() => {
    setStatus("connecting");
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      setStatus("open");
      backoffRef.current = INITIAL_BACKOFF_MS; // reset backoff after a successful connect
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        setHistory((prev) => {
          const next = [...prev, msg];
          return next.length > MAX_HISTORY ? next.slice(next.length - MAX_HISTORY) : next;
        });
      } catch {
        // ignore malformed frames rather than crashing the dashboard
      }
    };

    ws.onerror = () => {
      setStatus("error");
    };

    ws.onclose = () => {
      if (closedByUsRef.current) return; // deliberate unmount, don't reconnect
      setStatus("closed");
      reconnectTimerRef.current = setTimeout(() => {
        backoffRef.current = Math.min(backoffRef.current * 2, MAX_BACKOFF_MS);
        connect();
      }, backoffRef.current);
    };
  }, [url]);

  useEffect(() => {
    closedByUsRef.current = false;
    connect();
    return () => {
      closedByUsRef.current = true;
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      wsRef.current?.close();
    };
  }, [connect]);

  const latest = history.length > 0 ? history[history.length - 1] : null;

  return (
    <NIDSSocketContext.Provider value={{ status, history, latest }}>
      {children}
    </NIDSSocketContext.Provider>
  );
}

export function useNIDSSocket() {
  const ctx = useContext(NIDSSocketContext);
  if (!ctx) {
    throw new Error("useNIDSSocket must be used inside a <NIDSSocketProvider>");
  }
  return ctx;
}
