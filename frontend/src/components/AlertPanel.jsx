// src/components/AlertPanel.jsx
//
// Lights up when the latest prediction is not "Benign". Also keeps a
// short client-side log of recent non-benign predictions so you can see
// a pattern forming, not just the single latest flow.

import React, { useEffect, useRef, useState } from "react";
import { useNIDSSocket } from "../hooks/useNIDSSocket";

const MAX_ALERT_HISTORY = 8;

export default function AlertPanel() {
  const { latest } = useNIDSSocket();
  const [alertLog, setAlertLog] = useState([]);
  const lastFlowIndexRef = useRef(null);

  useEffect(() => {
    if (!latest) return;
    if (latest.flow_index === lastFlowIndexRef.current) return; // avoid double-logging on re-render
    lastFlowIndexRef.current = latest.flow_index;

    if (latest.predicted_label !== "Benign") {
      setAlertLog((prev) => {
        const next = [
          { flow_index: latest.flow_index, label: latest.predicted_label, confidence: latest.confidence },
          ...prev,
        ];
        return next.slice(0, MAX_ALERT_HISTORY);
      });
    }
  }, [latest]);

  const isAttack = latest && latest.predicted_label !== "Benign";

  return (
    <div className={`nids-panel nids-alert-panel ${isAttack ? "is-attack" : ""}`}>
      <div className="nids-panel-title">Alert Status</div>

      {!latest ? (
        <div className="nids-empty-state">Waiting for flows...</div>
      ) : (
        <>
          <div className={`nids-alert-headline ${isAttack ? "attack" : "benign"}`}>
            {isAttack ? `⚠ ${latest.predicted_label}` : "✓ Benign"}
          </div>
          <div className="nids-alert-sub">
            flow #{latest.flow_index} · confidence {(latest.confidence * 100).toFixed(1)}%
          </div>
        </>
      )}

      {alertLog.length > 0 && (
        <div className="nids-alert-history">
          {alertLog.map((a) => (
            <div key={a.flow_index} className="nids-alert-history-item">
              <span className="label">{a.label}</span>
              <span>
                flow #{a.flow_index} · {(a.confidence * 100).toFixed(1)}%
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
