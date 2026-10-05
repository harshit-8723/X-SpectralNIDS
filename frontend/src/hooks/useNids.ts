import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchAlerts,
  fetchDetection,
  fetchDetections,
  fetchLatestDetections,
  updateAlertStatus,
} from "@/services/api/detectionApi";
import {
  fetchAttackDistribution,
  fetchExplanationComparison,
  fetchModelComparison,
  fetchSummary,
} from "@/services/api/analyticsApi";
import { fetchLiveSpectrum, fetchTraffic } from "@/services/api/trafficApi";
import {
  fetchRawExplanation,
  fetchZoneExplanation,
} from "@/services/api/explanationApi";
import { fetchSystemStatus } from "@/services/api/systemApi";
import type { AlertStatus, DetectionFilters } from "@/types";

export const useSummary = () =>
  useQuery({ queryKey: ["analytics", "summary"], queryFn: fetchSummary });

export const useAttackDistribution = () =>
  useQuery({ queryKey: ["analytics", "attacks"], queryFn: fetchAttackDistribution });

export const useModelComparison = () =>
  useQuery({ queryKey: ["analytics", "models"], queryFn: fetchModelComparison });

export const useExplanationComparison = () =>
  useQuery({ queryKey: ["metrics", "explanations"], queryFn: fetchExplanationComparison });

export const useTraffic = (windowSeconds: number) =>
  useQuery({
    queryKey: ["traffic", windowSeconds],
    queryFn: () => fetchTraffic(windowSeconds),
  });

export const useLiveSpectrum = () =>
  useQuery({ queryKey: ["traffic", "spectrum"], queryFn: fetchLiveSpectrum });

export const useLatestDetections = (limit = 8) =>
  useQuery({ queryKey: ["detections", "latest", limit], queryFn: () => fetchLatestDetections(limit) });

export const useDetections = (filters: DetectionFilters) =>
  useQuery({
    queryKey: ["detections", filters],
    queryFn: () => fetchDetections(filters),
    placeholderData: (prev) => prev,
  });

export const useDetection = (id: string) =>
  useQuery({ queryKey: ["detection", id], queryFn: () => fetchDetection(id), enabled: !!id });

export const useRawExplanation = (id: string) =>
  useQuery({
    queryKey: ["explanation", "raw", id],
    queryFn: () => fetchRawExplanation(id),
    enabled: !!id,
  });

export const useZoneExplanation = (id: string) =>
  useQuery({
    queryKey: ["explanation", "zone", id],
    queryFn: () => fetchZoneExplanation(id),
    enabled: !!id,
  });

export const useSystemStatus = () =>
  useQuery({
    queryKey: ["system", "health"],
    queryFn: fetchSystemStatus,
    refetchInterval: 30_000,
  });

export const useAlerts = () => useQuery({ queryKey: ["alerts"], queryFn: fetchAlerts });

export function useUpdateAlertStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: AlertStatus }) =>
      updateAlertStatus(id, status),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["alerts"] }),
  });
}
