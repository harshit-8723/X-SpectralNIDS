import { apiGet, resolve } from "./client";
import {
  getMockDetections,
  getMockAlerts,
} from "@/data/mock";
import type {
  AlertRecord,
  AlertStatus,
  Detection,
  DetectionDetail,
  DetectionFilters,
  Paginated,
} from "@/types";

/** GET /api/detections */
export function fetchDetections(
  filters: DetectionFilters = {},
): Promise<Paginated<Detection>> {
  return resolve(
    () => apiGet<Paginated<Detection>>("/detections", { ...filters }),
    () => filterDetections(filters),
  );
}

/** GET /api/detections/{id} */
export function fetchDetection(id: string): Promise<DetectionDetail> {
  return resolve(
    () => apiGet<DetectionDetail>(`/detections/${id}`),
    () => {
      const found = getMockDetections().find((d) => d.id === id);
      if (!found) throw new Error(`Detection ${id} not found`);
      return found;
    },
  );
}

/** GET /api/detections?limit=n — latest feed for the overview page */
export function fetchLatestDetections(limit = 8): Promise<Detection[]> {
  return resolve(
    () => apiGet<Detection[]>("/detections", { limit }),
    () => getMockDetections().slice(0, limit),
  );
}

/** GET /api/alerts */
export function fetchAlerts(): Promise<AlertRecord[]> {
  return resolve(
    () => apiGet<AlertRecord[]>("/alerts"),
    () => getMockAlerts(),
  );
}

/** PATCH /api/alerts/{id} — optimistic mock implementation */
export function updateAlertStatus(id: string, status: AlertStatus): Promise<AlertRecord> {
  return resolve(
    () => apiGet<AlertRecord>(`/alerts/${id}`, { status }),
    () => {
      const alert = getMockAlerts().find((a) => a.id === id);
      if (!alert) throw new Error(`Alert ${id} not found`);
      alert.status = status;
      return { ...alert };
    },
    120,
  );
}

function filterDetections(filters: DetectionFilters): Paginated<Detection> {
  const {
    search,
    severity = "all",
    attackType = "all",
    prediction = "all",
    minConfidence = 0,
    source,
    destination,
    page = 1,
    pageSize = 15,
  } = filters;

  const term = search?.trim().toLowerCase();
  const filtered = getMockDetections().filter((d) => {
    if (severity !== "all" && d.severity !== severity) return false;
    if (attackType !== "all" && d.attackType !== attackType) return false;
    if (prediction !== "all" && d.prediction !== prediction) return false;
    if (d.confidence < minConfidence) return false;
    if (source && !d.source.includes(source)) return false;
    if (destination && !d.destination.includes(destination)) return false;
    if (term) {
      const haystack = `${d.id} ${d.source} ${d.destination} ${d.attackType}`.toLowerCase();
      if (!haystack.includes(term)) return false;
    }
    return true;
  });

  const start = (page - 1) * pageSize;
  return {
    items: filtered.slice(start, start + pageSize),
    total: filtered.length,
    page,
    pageSize,
  };
}

export function listAttackTypes(): string[] {
  return [...new Set(getMockDetections().map((d) => d.attackType))].sort();
}
