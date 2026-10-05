import { API_BASE_URL, USE_REAL_API } from "@/constants";

/**
 * Thin HTTP client. Every service function funnels through here when
 * VITE_USE_REAL_API is enabled; otherwise the mock adapter is used.
 */
export async function apiGet<T>(path: string, params?: Record<string, unknown>): Promise<T> {
  const url = new URL(`${API_BASE_URL}${path}`, window.location.origin);
  for (const [key, value] of Object.entries(params ?? {})) {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, String(value));
    }
  }
  const res = await fetch(url.toString(), { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`Request failed (${res.status}) for ${path}`);
  return (await res.json()) as T;
}

export async function apiPost<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? null : JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Request failed (${res.status}) for ${path}`);
  return (await res.json()) as T;
}

/** Resolve real API when configured, otherwise a mock value (with latency). */
export async function resolve<T>(real: () => Promise<T>, mock: () => T, delay = 220): Promise<T> {
  if (USE_REAL_API) return real();
  await new Promise((r) => setTimeout(r, delay));
  return mock();
}
