import { API_BASE_URL, WS_BASE_URL } from "@/constants";
import { apiGet } from "./client";
import type { SystemStatus } from "@/types";

function offlineStatus(): SystemStatus {
  return {
    backendConnected: false,
    websocketConnected: false,
    streaming: false,
    modelVersion: "offline",
    apiUrl: API_BASE_URL,
    wsUrl: WS_BASE_URL,
  };
}

/** GET /api/health — always hits the replay backend; never substitutes mock health. */
export function fetchSystemStatus(): Promise<SystemStatus> {
  return apiGet<SystemStatus>("/health").catch(() => offlineStatus());
}
