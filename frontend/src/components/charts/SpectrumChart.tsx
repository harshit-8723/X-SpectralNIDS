import { memo } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { FrequencyFeature } from "@/types";
import { axisStyle, chartTooltipStyle } from "./chartTheme";

export const SpectrumChart = memo(function SpectrumChart({
  data,
  dominantFrequency,
  dominantBin,
  range,
  height = 240,
}: {
  data: FrequencyFeature[];
  dominantFrequency?: number;
  dominantBin?: number;
  range?: [number, number];
  height?: number;
}) {
  const filtered = range
    ? data.filter((d) => d.frequency >= range[0] && d.frequency <= range[1])
    : data;
  const selectedDominant = dominantBin ?? dominantFrequency;

  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={filtered} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
        <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
        <XAxis
          dataKey="frequency"
          {...axisStyle}
          type="number"
          domain={["dataMin", "dataMax"]}
          tickFormatter={(v) => `${Number(v).toFixed(0)}`}
          minTickGap={30}
        />
        <YAxis {...axisStyle} width={48} tickFormatter={(v) => Number(v).toFixed(2)} />
        <Tooltip
          {...chartTooltipStyle}
          labelFormatter={(v) => `Feature FFT bin ${Number(v).toFixed(0)}`}
          formatter={(v: number | string) => [Number(v).toFixed(4), "Magnitude"]}
        />
        {selectedDominant !== undefined && (
          <ReferenceLine
            x={selectedDominant}
            stroke="var(--research)"
            strokeDasharray="4 4"
            label={{
              value: "dominant",
              fill: "var(--research)",
              fontSize: 10,
              position: "top",
            }}
          />
        )}
        <Line
          type="monotone"
          dataKey="magnitude"
          stroke="var(--info)"
          dot={false}
          strokeWidth={1.4}
          isAnimationActive={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
});
