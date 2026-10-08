import { apiPost, resolve } from "./client";

export type ReportFormat = "pdf" | "csv" | "json";

export interface ReportRequest {
  sections: string[];
  from?: string;
  to?: string;
  format: ReportFormat;
}

export interface ReportJob {
  id: string;
  status: "queued" | "ready" | "unavailable";
  downloadUrl?: string;
  message?: string;
}

/** POST /api/reports */
export function requestReport(request: ReportRequest): Promise<ReportJob> {
  return resolve(
    () => apiPost<ReportJob>("/reports", request),
    () => ({
      id: "report_mock",
      status: "unavailable" as const,
      message: "Report generation requires the backend. Awaiting backend integration.",
    }),
    400,
  );
}
