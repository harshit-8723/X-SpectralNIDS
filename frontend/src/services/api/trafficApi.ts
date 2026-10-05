import { apiGet, resolve } from "./client";
import { getMockDetections, getMockTraffic } from "@/data/mock";
import type { FrequencyFeature, TrafficPoint } from "@/types";

/** GET /api/traffic?window=seconds */
export function fetchTraffic(windowSeconds: number): Promise<TrafficPoint[]> {
  return resolve(
    () => apiGet<TrafficPoint[]>("/traffic", { window: windowSeconds }),
    () => getMockTraffic(windowSeconds),
  );
}

/** GET /api/traffic/spectrum — current FFT window */
export function fetchLiveSpectrum(): Promise<FrequencyFeature[]> {
  return resolve(
    () => apiGet<FrequencyFeature[]>("/traffic/spectrum"),
    () => getMockDetections()[0]!.spectrum,
  );
}
