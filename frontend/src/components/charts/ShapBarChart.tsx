import { memo } from "react";
import {
  Bar,
  BarChart,
  Cell,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { axisStyle, chartTooltipStyle } from "./chartTheme";

export interface ShapBarDatum {
  label: string;
  value: number;
}

/** Horizontal SHAP contribution chart. Positive = pushes toward attack. */
export const ShapBarChart = memo(function ShapBarChart({
  data,
  height,
}: {
  data: ShapBarDatum[];
  height?: number;
}) {
  return (
    <ResponsiveContainer width="100%" height={height ?? Math.max(160, data.length * 26 + 30)}>
      <BarChart
        data={data}
        layout="vertical"
        margin={{ top: 4, right: 16, left: 8, bottom: 4 }}
        barCategoryGap={4}
      >
        <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" horizontal={false} />
        <XAxis type="number" {...axisStyle} tickFormatter={(v) => Number(v).toFixed(2)} />
        <YAxis type="category" dataKey="label" {...axisStyle} width={130} />
        <Tooltip
          {...chartTooltipStyle}
          formatter={(v: number | string) => [Number(v).toFixed(4), "SHAP"]}
        />
        <ReferenceLine x={0} stroke="var(--border)" />
        <Bar dataKey="value" isAnimationActive={false} radius={2}>
          {data.map((d, i) => (
            <Cell key={i} fill={d.value >= 0 ? "var(--attack)" : "var(--normal)"} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
});
