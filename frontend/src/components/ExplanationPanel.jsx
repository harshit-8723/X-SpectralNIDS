// src/components/ExplanationPanel.jsx
//
// Side-by-side comparison of raw per-bin SHAP (small bar chart) against
// Zone-Grouped SHAP (labeled bars with % contribution). This is the panel
// that visualizes your actual research contribution, so the zone side
// intentionally reads as "labeled findings" rather than raw numbers.

import React from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { useNIDSSocket } from "../hooks/useNIDSSocket";

const POS_COLOR = "#5b8def";
const NEG_COLOR = "#ff4757";

function toChartData(shapDict) {
  return Object.entries(shapDict ?? {}).map(([key, value]) => ({ key, value }));
}

export default function ExplanationPanel() {
  const { latest } = useNIDSSocket();

  const rawData = toChartData(latest?.raw_shap);
  const zoneEntries = Object.entries(latest?.zone_shap ?? {});
  const totalAbsZone = zoneEntries.reduce((sum, [, v]) => sum + Math.abs(v), 0) || 1;

  return (
    <div className="nids-panel">
      <div className="nids-panel-title">Explanation: Raw SHAP vs Zone-Grouped SHAP</div>

      {!latest ? (
        <div className="nids-empty-state">Waiting for flows...</div>
      ) : (
        <div className="nids-explanation-grid">
          {/* Raw per-bin SHAP */}
          <div>
            <div className="nids-panel-title" style={{ marginBottom: 6 }}>
              Raw (per-bin)
            </div>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={rawData} layout="vertical" margin={{ left: 10 }}>
                <XAxis type="number" stroke="#7c8698" fontSize={10} />
                <YAxis type="category" dataKey="key" stroke="#7c8698" fontSize={10} width={45} />
                <Tooltip
                  contentStyle={{ background: "#131722", border: "1px solid #232838", fontSize: 12 }}
                  labelStyle={{ color: "#7c8698" }}
                />
                <Bar dataKey="value" isAnimationActive={false}>
                  {rawData.map((d) => (
                    <Cell key={d.key} fill={d.value >= 0 ? POS_COLOR : NEG_COLOR} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Zone-Grouped SHAP */}
          <div>
            <div className="nids-panel-title" style={{ marginBottom: 6 }}>
              Zone-Grouped
            </div>
            {zoneEntries.map(([zone, value]) => {
              const pct = ((Math.abs(value) / totalAbsZone) * 100).toFixed(1);
              return (
                <div key={zone} className="nids-zone-row">
                  <span>{zone.replace(/_/g, " ")}</span>
                  <span style={{ color: value >= 0 ? POS_COLOR : NEG_COLOR }}>
                    {value >= 0 ? "+" : ""}
                    {value.toFixed(3)} ({pct}%)
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
