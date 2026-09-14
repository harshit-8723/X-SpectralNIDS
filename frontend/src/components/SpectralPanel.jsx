// src/components/SpectralPanel.jsx
//
// Shows the FFT-derived frequency bins for the most recent flow as a bar
// chart — a "spectrum snapshot" that updates on every message. Reads
// `freq_domain_features` off the latest message only (not history).

import React from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { useNIDSSocket } from "../hooks/useNIDSSocket";

const GRID = "#1c2231";
const POS_COLOR = "#5b8def";
const NEG_COLOR = "#3ddc97";

export default function SpectralPanel() {
  const { latest } = useNIDSSocket();

  const bins = latest?.freq_domain_features ?? {};
  const data = Object.entries(bins).map(([binId, magnitude]) => ({ binId, magnitude }));

  return (
    <div className="nids-panel">
      <div className="nids-panel-title">Frequency Spectrum (FFT Bins)</div>
      {data.length === 0 ? (
        <div className="nids-empty-state">Waiting for flows...</div>
      ) : (
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={data}>
            <CartesianGrid stroke={GRID} strokeDasharray="3 3" />
            <XAxis dataKey="binId" stroke="#7c8698" fontSize={11} />
            <YAxis stroke="#7c8698" fontSize={11} width={50} />
            <Tooltip
              contentStyle={{ background: "#131722", border: "1px solid #232838", fontSize: 12 }}
              labelStyle={{ color: "#7c8698" }}
            />
            <Bar dataKey="magnitude" isAnimationActive={false}>
              {data.map((d) => (
                <Cell key={d.binId} fill={d.magnitude >= 0 ? POS_COLOR : NEG_COLOR} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
