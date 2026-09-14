// src/components/Dashboard.jsx
//
// Layout shell — wraps everything in NIDSSocketProvider (one shared
// connection) and arranges the four independent panels in a grid.
// Swap `url` if your backend isn't on localhost:8000.

import React from "react";
import { NIDSSocketProvider, useNIDSSocket } from "../hooks/useNIDSSocket";
import WaveformPanel from "./WaveformPanel";
import SpectralPanel from "./SpectralPanel";
import AlertPanel from "./AlertPanel";
import ExplanationPanel from "./ExplanationPanel";
import "../styles.css";

function StatusBadge() {
  const { status } = useNIDSSocket();
  const label = {
    open: "Live",
    connecting: "Connecting...",
    closed: "Reconnecting...",
    error: "Reconnecting...",
  }[status];

  return (
    <div className="nids-status nids-mono">
      <span className={`nids-status-dot ${status}`} />
      {label}
    </div>
  );
}

function DashboardInner() {
  return (
    <div className="nids-dashboard">
      <div className="nids-header">
        <div className="nids-title">X-SpectralNIDS — Live Monitor</div>
        <StatusBadge />
      </div>

      <div className="nids-grid">
        <WaveformPanel />
        <SpectralPanel />
        <AlertPanel />
        <ExplanationPanel />
      </div>
    </div>
  );
}

export default function Dashboard({ wsUrl = "ws://localhost:8000/ws" }) {
  return (
    <NIDSSocketProvider url={wsUrl}>
      <DashboardInner />
    </NIDSSocketProvider>
  );
}
