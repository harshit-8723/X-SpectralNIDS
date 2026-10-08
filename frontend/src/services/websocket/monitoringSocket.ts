import { WS_BASE_URL } from "@/constants";
import type { ConnectionState, MonitoringMessage } from "@/types";

type MessageHandler = (message: MonitoringMessage) => void;
type StateHandler = (state: ConnectionState) => void;

/**
 * Reusable WebSocket service for /ws/monitoring.
 * Falls back gracefully when no backend is reachable — never throws to the UI.
 */
export class MonitoringSocket {
  private socket: WebSocket | null = null;
  private messageHandlers = new Set<MessageHandler>();
  private stateHandlers = new Set<StateHandler>();
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private manuallyClosed = false;
  private attempts = 0;

  state: ConnectionState = "disconnected";

  constructor(private url: string = WS_BASE_URL) {}

  connect() {
    if (typeof window === "undefined") return;
    if (this.socket && this.socket.readyState <= WebSocket.OPEN) return;
    this.manuallyClosed = false;
    this.setState(this.attempts === 0 ? "connecting" : "reconnecting");

    try {
      this.socket = new WebSocket(this.url);
    } catch {
      this.scheduleReconnect();
      return;
    }

    this.socket.onopen = () => {
      this.attempts = 0;
      this.setState("connected");
    };
    this.socket.onmessage = (event) => {
      try {
        const parsed = JSON.parse(String(event.data)) as MonitoringMessage;
        this.messageHandlers.forEach((h) => h(parsed));
      } catch {
        /* ignore malformed frames */
      }
    };
    this.socket.onerror = () => {
      /* handled by onclose */
    };
    this.socket.onclose = () => {
      this.socket = null;
      if (!this.manuallyClosed) this.scheduleReconnect();
      else this.setState("disconnected");
    };
  }

  disconnect() {
    this.manuallyClosed = true;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
    this.socket?.close();
    this.socket = null;
    this.setState("disconnected");
  }

  onMessage(handler: MessageHandler) {
    this.messageHandlers.add(handler);
    return () => this.messageHandlers.delete(handler);
  }

  onStateChange(handler: StateHandler) {
    this.stateHandlers.add(handler);
    handler(this.state);
    return () => this.stateHandlers.delete(handler);
  }

  private scheduleReconnect() {
    this.attempts += 1;
    this.setState("reconnecting");
    const delay = Math.min(15000, 1000 * 2 ** Math.min(this.attempts, 4));
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = setTimeout(() => this.connect(), delay);
  }

  private setState(state: ConnectionState) {
    this.state = state;
    this.stateHandlers.forEach((h) => h(state));
  }
}

let singleton: MonitoringSocket | null = null;

export function getMonitoringSocket() {
  if (!singleton) singleton = new MonitoringSocket();
  return singleton;
}
