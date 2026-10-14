import { API_BASE_URL, USE_REAL_API } from "@/constants";

class ApiRequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "ApiRequestError";
  }
}

// Keep real calls limited to routes implemented by this backend. Add routes
// here only when the backend actually provides them; the resolver below will
// use each service's existing mock for every other path.
const BACKEND_GET_PATHS = new Set(["/health", "/replay/status"]);
const BACKEND_POST_PATHS = new Set(["/replay/start", "/replay/stop"]);

/**
 * Thin HTTP client. Every service function funnels through here when
 * VITE_USE_REAL_API is enabled; otherwise the mock adapter is used.
 */
export async function apiGet<T>(path: string, params?: Record<string, unknown>): Promise<T> {
  if (!BACKEND_GET_PATHS.has(path)) {
    throw new ApiRequestError(`No backend GET route is configured for ${path}`, 404);
  }
  const url = new URL(`${API_BASE_URL}${path}`, window.location.origin);
  for (const [key, value] of Object.entries(params ?? {})) {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, String(value));
    }
  }
  const res = await fetch(url.toString(), { headers: { Accept: "application/json" } });
  if (!res.ok) {
    throw new ApiRequestError(`Request failed (${res.status}) for ${path}`, res.status);
  }
  return (await res.json()) as T;
}

export async function apiPost<T>(path: string, body?: unknown): Promise<T> {
  if (!BACKEND_POST_PATHS.has(path)) {
    throw new ApiRequestError(`No backend POST route is configured for ${path}`, 404);
  }
  const res = await fetch(`${API_BASE_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? null : JSON.stringify(body),
  });
  if (!res.ok) {
    throw new ApiRequestError(`Request failed (${res.status}) for ${path}`, res.status);
  }
  return (await res.json()) as T;
}

/** Resolve real API when configured, otherwise a mock value (with latency). */
export async function resolve<T>(real: () => Promise<T>, mock: () => T, delay = 220): Promise<T> {
  if (USE_REAL_API) {
    try {
      return await real();
    } catch (error) {
      if (error instanceof ApiRequestError && error.status === 404) return mock();
      throw error;
    }
  }
  await new Promise((r) => setTimeout(r, delay));
  return mock();
}
