import { apiGet, resolve } from "./client";
import {
  getMockAttackDistribution,
  getMockExplanationComparison,
  getMockModelComparison,
  getMockSummary,
} from "@/data/mock";
import type {
  AnalyticsSummary,
  AttackCategory,
  ExplanationComparison,
  ModelComparisonRow,
} from "@/types";

/** GET /api/analytics/summary */
export function fetchSummary(): Promise<AnalyticsSummary> {
  return resolve(
    () => apiGet<AnalyticsSummary>("/analytics/summary"),
    () => getMockSummary(),
  );
}

/** GET /api/analytics/attack-distribution */
export function fetchAttackDistribution(): Promise<AttackCategory[]> {
  return resolve(
    () => apiGet<AttackCategory[]>("/analytics/attack-distribution"),
    () => getMockAttackDistribution(),
  );
}

/** GET /api/analytics/models */
export function fetchModelComparison(): Promise<ModelComparisonRow[]> {
  return resolve(
    () => apiGet<ModelComparisonRow[]>("/analytics/models"),
    () => getMockModelComparison(),
  );
}

/** GET /api/metrics/explanations */
export function fetchExplanationComparison(): Promise<ExplanationComparison> {
  return resolve(
    () => apiGet<ExplanationComparison>("/metrics/explanations"),
    () => getMockExplanationComparison(),
  );
}
