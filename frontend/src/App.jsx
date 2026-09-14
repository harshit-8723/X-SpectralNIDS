// src/App.jsx
// Minimal example of mounting the dashboard. If you're on Next.js App
// Router, put this in a client component (add "use client" at the top
// of Dashboard.jsx and useNIDSSocket.jsx, since both use hooks/state).

import React from "react";
import Dashboard from "./components/Dashboard";

export default function App() {
  return <Dashboard wsUrl="ws://localhost:8000/ws" />;
}
