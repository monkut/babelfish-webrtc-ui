// Shared helpers for the unit tests. Modules under app/lib read import.meta.env
// and compute URLs at import time, so tests stub the env first and then import
// the module under test dynamically (after vi.resetModules()).

import { vi } from "vitest";

export const TEST_SIGNALING_URL = "http://backend.test/offer";

// Stub the build-time env to deterministic values, independent of any local .env.
export function stubApiEnv(): void {
  vi.stubEnv("VITE_SIGNALING_URL", TEST_SIGNALING_URL);
  vi.stubEnv("VITE_CLIENT_ID", "test-client");
  vi.stubEnv("VITE_CLIENT_SECRET", "test-secret");
}

// Minimal Response stand-in for mocking global fetch in the node environment.
export function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}
