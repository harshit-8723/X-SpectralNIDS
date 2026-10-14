import { apiGet, apiPost } from "./client";

export interface ReplayStatus {
  status?: string;
  running: boolean;
  file: string;
  model_name: string;
  rows_per_tick: number;
  tick_seconds: number;
  ticks_emitted: number;
  rows_emitted: number;
  last_error: string | null;
}

export function fetchReplayStatus(): Promise<ReplayStatus> {
  return apiGet<ReplayStatus>("/replay/status");
}

export function startReplay(cycle = true): Promise<ReplayStatus> {
  return apiPost<ReplayStatus>("/replay/start", { cycle });
}

export function stopReplay(): Promise<ReplayStatus> {
  return apiPost<ReplayStatus>("/replay/stop");
}
