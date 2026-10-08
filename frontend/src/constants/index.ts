export const APP_NAME = "X-SpectralNIDS";
export const APP_FULL_TITLE =
  "X-SpectralNIDS: Zone-Grouped Explainable AI for Frequency-Domain Network Intrusion Detection";

export const API_BASE_URL =
  (import.meta.env["VITE_API_BASE_URL"] as string | undefined) ?? "/api";
export const WS_BASE_URL =
  (import.meta.env["VITE_WS_BASE_URL"] as string | undefined) ??
  "ws://localhost:8000/ws/monitoring";

/** When false, service layer resolves against the mock adapter. */
export const USE_REAL_API =
  (import.meta.env["VITE_USE_REAL_API"] as string | undefined) === "true";

export const TIME_WINDOWS = [
  { label: "1m", value: 60 },
  { label: "5m", value: 300 },
  { label: "15m", value: 900 },
  { label: "1h", value: 3600 },
] as const;

export const SEVERITY_ORDER = ["low", "medium", "high", "critical"] as const;

/** Number of FFT bins produced by the feature pipeline (matches spectrum payload). */
export const FREQUENCY_BINS = 256;

/** Dataset configured for the backend; undefined until backend configuration exists. */
export const DATASET_NAME = import.meta.env["VITE_DATASET_NAME"] as string | undefined;
