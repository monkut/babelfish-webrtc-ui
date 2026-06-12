import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { jsonResponse, stubApiEnv } from "./helpers";

const TOKEN_URL = "http://backend.test/token";

async function importAuth() {
  return import("../app/lib/api/auth");
}

describe("getAccessToken", () => {
  beforeEach(() => {
    vi.resetModules();
    stubApiEnv();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  test("exchanges client credentials at POST /token", async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ access_token: "tok-1", expires_in: 3600 }));
    vi.stubGlobal("fetch", fetchMock);
    const { getAccessToken } = await importAuth();

    await expect(getAccessToken()).resolves.toBe("tok-1");

    expect(fetchMock).toHaveBeenCalledExactlyOnceWith(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ client_id: "test-client", client_secret: "test-secret" }),
    });
  });

  test("caches the token and refreshes it after expiry", async () => {
    vi.useFakeTimers();
    let tokenCount = 0;
    const fetchMock = vi.fn(async () => {
      tokenCount += 1;
      return jsonResponse({ access_token: `tok-${tokenCount}`, expires_in: 3600 });
    });
    vi.stubGlobal("fetch", fetchMock);
    const { getAccessToken } = await importAuth();

    await expect(getAccessToken()).resolves.toBe("tok-1");
    await expect(getAccessToken()).resolves.toBe("tok-1"); // cached — no second request
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // Past expiry (the cache refreshes 30 s early) a new token is fetched.
    vi.advanceTimersByTime(3600 * 1000);
    await expect(getAccessToken()).resolves.toBe("tok-2");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  test("throws on a non-OK token response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => jsonResponse({ detail: "nope" }, 401)),
    );
    const { getAccessToken } = await importAuth();

    await expect(getAccessToken()).rejects.toThrow("Token request failed: 401");
  });

  test("throws without calling the backend when credentials are unset", async () => {
    vi.stubEnv("VITE_CLIENT_ID", "");
    vi.stubEnv("VITE_CLIENT_SECRET", "");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const { getAccessToken } = await importAuth();

    await expect(getAccessToken()).rejects.toThrow(
      "Missing VITE_CLIENT_ID / VITE_CLIENT_SECRET — cannot authenticate.",
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
