// Single source of truth for the backend endpoint URLs.
//
// Caddy serves the SPA and proxies `/api/*` on the same origin, so by default
// we target the page's own origin (`window.location.origin + /api/offer`). One
// build then works on every origin with no mixed-content: loaded over
// `https://192.168.1.25` it calls the HTTPS API (mic-capable), loaded over
// `http://192.168.1.25:8080` it calls the HTTP API. `VITE_SIGNALING_URL`
// overrides this for dev, where the SPA (`:5173`) and backend (`:8080`) are
// different origins. Sibling endpoints (`/token`, `/scenarios`) are derived by
// stripping the trailing `/offer`.

const DEFAULT_DEV_SIGNALING_URL = "http://localhost:8080/offer";

function resolveSignalingUrl(): string {
  const fromEnv = import.meta.env.VITE_SIGNALING_URL;
  if (fromEnv) return fromEnv;
  if (typeof window !== "undefined") return `${window.location.origin}/api/offer`;
  return DEFAULT_DEV_SIGNALING_URL;
}

export const SIGNALING_URL = resolveSignalingUrl();

const API_BASE = SIGNALING_URL.replace(/\/offer\/?$/, "");

export function apiUrl(path: string): string {
  return `${API_BASE}/${path.replace(/^\//, "")}`;
}
