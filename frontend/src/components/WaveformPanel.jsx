// src/components/WaveformPanel.jsx
//
// Plots recent flow stats over time — pulls `time_domain_summary` off each
// message in the shared socket history. Works independently of the other
// three panels; only depends on useNIDSSocket().

import React from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { useNIDSSocket } from "../hooks/useNIDSSocket";

const GRID = "#1c2231";
const LINE_PACKETS = "#3ddc97";
const LINE_BYTES = "#5b8def";

export default function WaveformPanel() {
  const { history } = useNIDSSocket();

  const data = history.map((msg) => ({
    flow: msg.flow_index,
    packetsPerSec: msg.time_domain_summary?.["Flow Packets/s"] ?? null,
    bytesPerSec: msg.time_domain_summary?.["Flow Bytes/s"] ?? null,
  }));

  return (
    <div className="nids-panel">
      <div className="nids-panel-title">Time-Domain Flow Stats</div>
      {data.length === 0 ? (
        <div className="nids-empty-state">Waiting for flows...</div>
      ) : (
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={data}>
            <CartesianGrid stroke={GRID} strokeDasharray="3 3" />
            <XAxis dataKey="flow" stroke="#7c8698" fontSize={11} />
            <YAxis yAxisId="left" stroke={LINE_PACKETS} fontSize={11} width={70} />
            <YAxis yAxisId="right" orientation="right" stroke={LINE_BYTES} fontSize={11} width={70} />
            <Tooltip
              contentStyle={{ background: "#131722", border: "1px solid #232838", fontSize: 12 }}
              labelStyle={{ color: "#7c8698" }}
            />
            <Line
              yAxisId="left"
              type="monotone"
              dataKey="packetsPerSec"
              name="Packets/s"
              stroke={LINE_PACKETS}
              dot={false}
              isAnimationActive={false}
            />
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="bytesPerSec"
              name="Bytes/s"
              stroke={LINE_BYTES}
              dot={false}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
