import { memo } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { TrafficPoint } from "@/types";
import { formatTime } from "@/utils/format";
import { chartTooltipStyle, axisStyle } from "./chartTheme";

export const TrafficChart = memo(function TrafficChart({
  data,
  height = 260,
}: {
  data: TrafficPoint[];
  height?: number;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
        <defs>
          <linearGradient id="gNormal" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--normal)" stopOpacity={0.35} />
            <stop offset="100%" stopColor="var(--normal)" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="gAttack" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--attack)" stopOpacity={0.4} />
            <stop offset="100%" stopColor="var(--attack)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="timestamp" tickFormatter={formatTime} {...axisStyle} minTickGap={40} />
        <YAxis {...axisStyle} width={48} />
        <Tooltip
          {...chartTooltipStyle}
          labelFormatter={(v) => formatTime(String(v))}
        />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        <Area
          type="monotone"
          dataKey="normal"
          name="Normal"
          stroke="var(--normal)"
          fill="url(#gNormal)"
          strokeWidth={1.5}
          isAnimationActive={false}
        />
        <Area
          type="monotone"
          dataKey="suspicious"
          name="Suspicious"
          stroke="var(--attack)"
          fill="url(#gAttack)"
          strokeWidth={1.5}
          isAnimationActive={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
});
