/**
 * Centralized API data contracts for X-SpectralNIDS.
 * These mirror the future FastAPI response schemas.
 */

export type Prediction = "normal" | "attack";
export type Severity = "low" | "medium" | "high" | "critical";
export type AlertStatus =
  | "new"
  | "investigating"
  | "confirmed"
  | "resolved"
  | "false_positive";

export interface Detection {
  id: string;
  timestamp: string;
  source: string;
  destination: string;
  protocol?: string;
  port?: number;
  attackType: string;
  prediction: Prediction;
  confidence: number;
  severity: Severity;
  explanationAvailable?: boolean;
}

export interface TrafficStats {
  packets: number;
  bytes: number;
  durationMs: number;
  packetRate: number;
  interArrivalMeanMs: number;
  interArrivalStdMs: number;
  interArrivalMinMs: number;
  interArrivalMaxMs: number;
}

export interface FrequencyFeature {
  bin: number;
  frequency: number;
  magnitude: number;
  shapValue?: number;
}

export interface ShapFeature {
  feature: string;
  bin?: number;
  shapValue: number;
}

export interface ShapZone {
  id: string;
  name: string;
  frequencyStart: number;
  frequencyEnd: number;
  shapValue: number;
  rank: number;
  interpretation?: string;
}

export interface ExplanationMetrics {
  faithfulness?: number;
  stability?: number;
  compactness?: number;
  latencyMs?: number;
}

export interface RawExplanation {
  detectionId: string;
  features: ShapFeature[];
  metrics: ExplanationMetrics;
}

export interface ZoneExplanation {
  detectionId: string;
  zones: ShapZone[];
  metrics: ExplanationMetrics;
  analystSummary?: string;
}

export interface DetectionDetail extends Detection {
  traffic: TrafficStats;
  spectrum: FrequencyFeature[];
  dominantFrequency: number;
  analystSummary?: string;
}

export interface TrafficPoint {
  timestamp: string;
  normal: number;
  suspicious: number;
  throughputMbps: number;
}

export interface AttackCategory {
  category: string;
  count: number;
}

export interface AnalyticsSummary {
  totalTrafficAnalyzed: number;
  totalAlerts: number;
  detectionRate: number;
  activeThreats: number;
  normalTraffic: number;
  suspiciousTraffic: number;
  avgDetectionLatencyMs: number;
  avgExplanationLatencyMs: number;
  throughputMbps: number;
}

export interface DetectionPerformance {
  accuracy: number;
  precision: number;
  recall: number;
  f1: number;
  falsePositiveRate: number;
}

export interface ModelComparisonRow {
  model: string;
  performance: DetectionPerformance;
}

export interface ExplanationComparison {
  raw: ExplanationMetrics;
  zone: ExplanationMetrics;
}

export interface SystemStatus {
  backendConnected: boolean;
  websocketConnected: boolean;
  streaming: boolean;
  modelVersion: string;
  apiUrl: string;
  wsUrl: string;
}

export interface AlertRecord {
  id: string;
  detectionId: string;
  timestamp: string;
  severity: Severity;
  attackType: string;
  source: string;
  destination: string;
  confidence: number;
  status: AlertStatus;
}

export interface DetectionFilters {
  search?: string;
  severity?: Severity | "all";
  attackType?: string | "all";
  prediction?: Prediction | "all";
  minConfidence?: number;
  source?: string;
  destination?: string;
  page?: number;
  pageSize?: number;
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface LiveWindow {
  source: string;
  destination: string;
  protocol: string;
  packets: number;
  durationMs: number;
  interArrivalMeanMs: number;
  interArrivalStdMs: number;
  prediction: Prediction;
  confidence: number;
}

export interface MonitoringMessage {
  type: "traffic_update";
  timestamp: string;
  traffic: TrafficPoint;
  window: LiveWindow;
  frequency: FrequencyFeature[];
  detection?: Detection;
}

export type ConnectionState =
  | "connecting"
  | "connected"
  | "disconnected"
  | "reconnecting";
