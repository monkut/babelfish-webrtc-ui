// Guards the same-origin endpoint derivation: with VITE_SIGNALING_URL unset
// the app targets the page's own origin (`/api/offer`), so one build works on
// every Caddy origin; the env var overrides this for split-origin dev.

import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

async function importConfig() {
  return import("../app/lib/api/config");
}

describe("config endpoint resolution", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  test("VITE_SIGNALING_URL overrides the signaling endpoint", async () => {
    vi.stubEnv("VITE_SIGNALING_URL", "http://backend.test/offer");
    const { SIGNALING_URL, apiUrl } = await importConfig();

    expect(SIGNALING_URL).toBe("http://backend.test/offer");
    expect(apiUrl("/token")).toBe("http://backend.test/token");
    expect(apiUrl("scenarios")).toBe("http://backend.test/scenarios");
  });

  test("derives same-origin /api endpoints when VITE_SIGNALING_URL is unset", async () => {
    vi.stubEnv("VITE_SIGNALING_URL", "");
    vi.stubGlobal("window", { location: { origin: "https://192.168.1.25" } });
    const { SIGNALING_URL, apiUrl } = await importConfig();

    expect(SIGNALING_URL).toBe("https://192.168.1.25/api/offer");
    expect(apiUrl("/token")).toBe("https://192.168.1.25/api/token");
  });

  test("falls back to the dev backend without env or window (SSR)", async () => {
    vi.stubEnv("VITE_SIGNALING_URL", "");
    const { SIGNALING_URL } = await importConfig();

    expect(SIGNALING_URL).toBe("http://localhost:8080/offer");
  });
});
