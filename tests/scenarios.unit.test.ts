import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { jsonResponse, stubApiEnv } from "./helpers";

async function importScenarios() {
  return import("../app/lib/api/scenarios");
}

describe("fetchScenarios", () => {
  beforeEach(() => {
    vi.resetModules();
    stubApiEnv();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  test("returns the scenario list from GET /scenarios", async () => {
    const scenarios = [
      { slug: "screener-ja", name: "Phone Screener (JA)", version: "3" },
      { slug: "demo", name: "Demo", version: "1" },
    ];
    const fetchMock = vi.fn(async () => jsonResponse({ scenarios }));
    vi.stubGlobal("fetch", fetchMock);
    const { fetchScenarios } = await importScenarios();

    await expect(fetchScenarios()).resolves.toEqual(scenarios);
    expect(fetchMock).toHaveBeenCalledExactlyOnceWith("http://backend.test/scenarios");
  });

  test("throws on a non-OK response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => jsonResponse({}, 500)),
    );
    const { fetchScenarios } = await importScenarios();

    await expect(fetchScenarios()).rejects.toThrow("Scenario list failed: 500");
  });
});
