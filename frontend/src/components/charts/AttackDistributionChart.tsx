import { memo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { AttackCategory } from "@/types";
import { axisStyle, chartTooltipStyle } from "./chartTheme";

const PALETTE = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

export const AttackDistributionChart = memo(function AttackDistributionChart({
  data,
  height = 240,
}: {
  data: AttackCategory[];
  height?: number;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 4 }}>
        <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" horizontal={false} />
        <XAxis type="number" {...axisStyle} allowDecimals={false} />
        <YAxis type="category" dataKey="category" {...axisStyle} width={90} />
        <Tooltip {...chartTooltipStyle} formatter={(v: number | string) => [v, "Detections"]} />
        <Bar dataKey="count" isAnimationActive={false} radius={2}>
          {data.map((_, i) => (
            <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
});
