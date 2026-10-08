/**
 * Alert service surface. Implementations currently live in detectionApi so the
 * mock adapter shares one detection store; re-exported here so callers can use
 * a stable, dedicated module once FastAPI exposes /api/alerts.
 */
export { fetchAlerts, updateAlertStatus } from "./detectionApi";
