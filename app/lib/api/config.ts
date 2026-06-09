// Single source of truth for the backend endpoint URLs.
//
// `VITE_SIGNALING_URL` is the full `/offer` URL (build-time inlined by Vite).
// Every sibling endpoint (`/token`, `/scenarios`) hangs off the same base, so
// we derive the base by stripping the trailing `/offer` rather than carrying a
// second env var that could drift. This works for both dev
// (`http://localhost:8080/offer`) and the TAICHI Caddy proxy
// (`http://192.168.1.25:8080/api/offer`).

const DEFAULT_SIGNALING_URL = "http://localhost:8080/offer";

export const SIGNALING_URL = import.meta.env.VITE_SIGNALING_URL || DEFAULT_SIGNALING_URL;

const API_BASE = SIGNALING_URL.replace(/\/offer\/?$/, "");

export function apiUrl(path: string): string {
  return `${API_BASE}/${path.replace(/^\//, "")}`;
}
