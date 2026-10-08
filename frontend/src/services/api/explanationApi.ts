import { apiGet, resolve } from "./client";
import { getMockRawExplanation, getMockZoneExplanation } from "@/data/mock";
import type { RawExplanation, ZoneExplanation } from "@/types";

/** GET /api/explanations/raw/{detectionId} */
export function fetchRawExplanation(detectionId: string): Promise<RawExplanation> {
  return resolve(
    () => apiGet<RawExplanation>(`/explanations/raw/${detectionId}`),
    () => getMockRawExplanation(detectionId),
  );
}

/** GET /api/explanations/zones/{detectionId} */
export function fetchZoneExplanation(detectionId: string): Promise<ZoneExplanation> {
  return resolve(
    () => apiGet<ZoneExplanation>(`/explanations/zones/${detectionId}`),
    () => getMockZoneExplanation(detectionId),
  );
}
