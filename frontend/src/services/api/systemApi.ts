import { API_BASE_URL, WS_BASE_URL } from "@/constants";
import { apiGet, resolve } from "./client";
import type { SystemStatus } from "@/types";

/** GET /api/health */
export function fetchSystemStatus(): Promise<SystemStatus> {
  return resolve(
    () => apiGet<SystemStatus>("/health"),
    () => ({
      backendConnected: false,
      websocketConnected: false,
      streaming: false,
      modelVersion: "xgboost-fft-v0.1 (mock)",
      apiUrl: API_BASE_URL,
      wsUrl: WS_BASE_URL,
    }),
    150,
  );
}
