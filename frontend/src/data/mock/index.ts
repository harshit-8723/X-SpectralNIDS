import type {
  AlertRecord,
  AnalyticsSummary,
  AttackCategory,
  Detection,
  DetectionDetail,
  ExplanationComparison,
  FrequencyFeature,
  ModelComparisonRow,
  RawExplanation,
  ShapZone,
  TrafficPoint,
  ZoneExplanation,
} from "@/types";

/** Deterministic PRNG so mock data is stable across renders. */
function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const ATTACK_TYPES = [
  "DDoS",
  "DoS",
  "Port Scan",
  "Brute Force",
  "Botnet",
  "Other",
];
const PROTOCOLS = ["TCP", "UDP", "ICMP"];
const SEVERITIES = ["low", "medium", "high", "critical"] as const;

function ip(rand: () => number, internal = false) {
  return internal
    ? `10.0.${Math.floor(rand() * 12)}.${Math.floor(rand() * 250) + 2}`
    : `${Math.floor(rand() * 200) + 20}.${Math.floor(rand() * 250)}.${Math.floor(
        rand() * 250,
      )}.${Math.floor(rand() * 250)}`;
}

let cachedDetections: DetectionDetail[] | null = null;

export function getMockDetections(): DetectionDetail[] {
  if (cachedDetections) return cachedDetections;
  const rand = mulberry32(20260812);
  const base = Date.now();
  const items: DetectionDetail[] = [];

  for (let i = 0; i < 240; i++) {
    const isAttack = rand() > 0.55;
    const attackType = isAttack
      ? ATTACK_TYPES[Math.floor(rand() * ATTACK_TYPES.length)]!
      : "Benign";
    const confidence = 0.6 + rand() * 0.399;
    const severity = !isAttack
      ? "low"
      : SEVERITIES[Math.min(3, Math.floor(confidence * 4.2) - 1 + (rand() > 0.7 ? 1 : 0))] ??
        "medium";
    const packets = Math.floor(40 + rand() * 9000);
    const durationMs = Math.floor(500 + rand() * 60000);
    const mean = durationMs / packets;

    items.push({
      id: `det_${(100000 + i).toString(36)}`,
      timestamp: new Date(base - i * 47_000 - Math.floor(rand() * 20_000)).toISOString(),
      source: ip(rand),
      destination: ip(rand, true),
      protocol: PROTOCOLS[Math.floor(rand() * PROTOCOLS.length)]!,
      port: [22, 80, 443, 3389, 8080, 53][Math.floor(rand() * 6)]!,
      attackType,
      prediction: isAttack ? "attack" : "normal",
      confidence: Number(confidence.toFixed(4)),
      severity,
      explanationAvailable: rand() > 0.12,
      traffic: {
        packets,
        bytes: packets * Math.floor(64 + rand() * 900),
        durationMs,
        packetRate: Number((packets / (durationMs / 1000)).toFixed(2)),
        interArrivalMeanMs: Number(mean.toFixed(3)),
        interArrivalStdMs: Number((mean * (0.05 + rand() * 0.6)).toFixed(3)),
        interArrivalMinMs: Number((mean * 0.1).toFixed(3)),
        interArrivalMaxMs: Number((mean * (2 + rand() * 4)).toFixed(3)),
      },
      spectrum: buildSpectrum(i, isAttack),
      dominantFrequency: Number((10 + rand() * 240).toFixed(2)),
      analystSummary: isAttack
        ? "Detection influenced primarily by a strong periodic traffic component in the mid-frequency range."
        : "No dominant periodic component; flow statistics consistent with benign traffic.",
    });
  }
  cachedDetections = items;
  return items;
}

function buildSpectrum(seed: number, isAttack: boolean): FrequencyFeature[] {
  const rand = mulberry32(seed * 7919 + 13);
  const peak = 90 + Math.floor(rand() * 80);
  return Array.from({ length: 256 }, (_, bin) => {
    const frequency = Number(((bin * 500) / 256).toFixed(2));
    const noise = 0.05 + rand() * 0.25;
    const resonance = isAttack
      ? Math.exp(-((bin - peak) ** 2) / 120) * (0.7 + rand() * 0.3)
      : 0;
    return {
      bin,
      frequency,
      magnitude: Number((noise + resonance).toFixed(4)),
    };
  });
}

export function getMockRawExplanation(detectionId: string): RawExplanation {
  const rand = mulberry32(hash(detectionId));
  const features: RawExplanation["features"] = [];
  for (let i = 0; i < 14; i++) {
    const bin = Math.floor(rand() * 256);
    features.push({
      feature: `Frequency Bin ${bin}`,
      bin,
      shapValue: Number(((rand() - 0.35) * 0.45).toFixed(4)),
    });
  }
  for (const f of ["packet_rate", "flow_duration", "mean_iat", "std_iat", "total_bytes"]) {
    features.push({ feature: f, shapValue: Number(((rand() - 0.4) * 0.3).toFixed(4)) });
  }
  features.sort((a, b) => Math.abs(b.shapValue) - Math.abs(a.shapValue));
  return {
    detectionId,
    features,
    metrics: {
      faithfulness: Number((0.6 + rand() * 0.2).toFixed(3)),
      stability: Number((0.55 + rand() * 0.2).toFixed(3)),
      compactness: features.filter((f) => Math.abs(f.shapValue) > 0.05).length,
      latencyMs: Number((40 + rand() * 60).toFixed(1)),
    },
  };
}

const ZONE_DEFS: Array<Omit<ShapZone, "shapValue" | "rank">> = [
  {
    id: "z1",
    name: "Zone 1",
    frequencyStart: 0,
    frequencyEnd: 62.5,
    interpretation: "Low-frequency / long-period flow rhythm",
  },
  {
    id: "z2",
    name: "Zone 2",
    frequencyStart: 62.5,
    frequencyEnd: 156,
    interpretation: "Mid-frequency periodic component",
  },
  {
    id: "z3",
    name: "Zone 3",
    frequencyStart: 156,
    frequencyEnd: 280,
    interpretation: "Upper-mid burst periodicity",
  },
  {
    id: "z4",
    name: "Zone 4",
    frequencyStart: 280,
    frequencyEnd: 500,
    interpretation: "High-frequency micro-burst activity",
  },
];

export function getMockZoneExplanation(detectionId: string): ZoneExplanation {
  const rand = mulberry32(hash(detectionId) + 991);
  const zones = ZONE_DEFS.map((z) => ({
    ...z,
    shapValue: Number(((rand() - 0.2) * 0.8).toFixed(4)),
    rank: 0,
  }))
    .sort((a, b) => Math.abs(b.shapValue) - Math.abs(a.shapValue))
    .map((z, i) => ({ ...z, rank: i + 1 }));

  return {
    detectionId,
    zones,
    metrics: {
      faithfulness: Number((0.6 + rand() * 0.25).toFixed(3)),
      stability: Number((0.6 + rand() * 0.25).toFixed(3)),
      compactness: zones.filter((z) => Math.abs(z.shapValue) > 0.05).length,
      latencyMs: Number((8 + rand() * 25).toFixed(1)),
    },
    analystSummary:
      "The detection was influenced primarily by a strong periodic traffic component grouped in the highest-ranked frequency zone.",
  };
}

export function getMockTraffic(windowSeconds: number): TrafficPoint[] {
  const rand = mulberry32(windowSeconds * 31 + 7);
  const points = 60;
  const step = (windowSeconds * 1000) / points;
  const now = Date.now();
  return Array.from({ length: points }, (_, i) => {
    const suspicious = Math.max(0, Math.floor(20 + rand() * 120 - (i % 9) * 4));
    return {
      timestamp: new Date(now - (points - i) * step).toISOString(),
      normal: Math.floor(400 + rand() * 700),
      suspicious,
      throughputMbps: Number((80 + rand() * 220).toFixed(1)),
    };
  });
}

export function getMockAttackDistribution(): AttackCategory[] {
  const counts = new Map<string, number>();
  for (const d of getMockDetections()) {
    if (d.prediction !== "attack") continue;
    counts.set(d.attackType, (counts.get(d.attackType) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([category, count]) => ({ category, count }))
    .sort((a, b) => b.count - a.count);
}

export function getMockSummary(): AnalyticsSummary {
  const dets = getMockDetections();
  const attacks = dets.filter((d) => d.prediction === "attack");
  return {
    totalTrafficAnalyzed: 1_284_930,
    totalAlerts: attacks.length,
    detectionRate: Number((attacks.length / dets.length).toFixed(4)),
    activeThreats: attacks.filter((a) => a.severity === "critical" || a.severity === "high")
      .length,
    normalTraffic: dets.length - attacks.length,
    suspiciousTraffic: attacks.length,
    avgDetectionLatencyMs: 12.4,
    avgExplanationLatencyMs: 31.8,
    throughputMbps: 184.6,
  };
}

export function getMockModelComparison(): ModelComparisonRow[] {
  return [
    {
      model: "Time-domain only (XGBoost)",
      performance: {
        accuracy: 0.941,
        precision: 0.928,
        recall: 0.913,
        f1: 0.92,
        falsePositiveRate: 0.061,
      },
    },
    {
      model: "Time + frequency-domain (XGBoost)",
      performance: {
        accuracy: 0.967,
        precision: 0.958,
        recall: 0.951,
        f1: 0.954,
        falsePositiveRate: 0.034,
      },
    },
  ];
}

export function getMockExplanationComparison(): ExplanationComparison {
  return {
    raw: { faithfulness: 0.71, stability: 0.64, compactness: 19, latencyMs: 78.2 },
    zone: { faithfulness: 0.74, stability: 0.79, compactness: 3, latencyMs: 16.5 },
  };
}

let cachedAlerts: AlertRecord[] | null = null;

export function getMockAlerts(): AlertRecord[] {
  if (cachedAlerts) return cachedAlerts;
  const statuses = ["new", "investigating", "confirmed", "resolved", "false_positive"] as const;
  const rand = mulberry32(4242);
  cachedAlerts = getMockDetections()
    .filter((d) => d.prediction === "attack")
    .slice(0, 60)
    .map((d, i) => ({
      id: `alt_${(5000 + i).toString(36)}`,
      detectionId: d.id,
      timestamp: d.timestamp,
      severity: d.severity,
      attackType: d.attackType,
      source: d.source,
      destination: d.destination,
      confidence: d.confidence,
      status: statuses[Math.floor(rand() * statuses.length)]!,
    }));
  return cachedAlerts;
}

function hash(value: string) {
  let h = 2166136261;
  for (let i = 0; i < value.length; i++) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export { mulberry32 };
