import { useEffect, useRef, useState } from "react";
import { getMonitoringSocket } from "@/services/websocket/monitoringSocket";
import type { ConnectionState, MonitoringMessage } from "@/types";

/**
 * Subscribes to the monitoring WebSocket. When no backend is reachable the
 * hook simply reports the connection state — it never fabricates live data.
 */
export function useMonitoringStream(enabled = true) {
  const [state, setState] = useState<ConnectionState>("disconnected");
  const [messages, setMessages] = useState<MonitoringMessage[]>([]);
  const bufferRef = useRef<MonitoringMessage[]>([]);

  useEffect(() => {
    if (!enabled) return;
    const socket = getMonitoringSocket();
    const offState = socket.onStateChange(setState);
    const offMessage = socket.onMessage((message) => {
      bufferRef.current = [message, ...bufferRef.current].slice(0, 100);
    });
    socket.connect();

    const flush = setInterval(() => {
      if (bufferRef.current.length) setMessages([...bufferRef.current]);
    }, 500);

    return () => {
      clearInterval(flush);
      offState();
      offMessage();
      socket.disconnect();
    };
  }, [enabled]);

  return { state, messages };
}
