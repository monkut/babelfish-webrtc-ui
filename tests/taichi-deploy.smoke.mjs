// Smoke test for the TAICHI on-prem deployment.
// Run with: node tests/taichi-deploy.smoke.mjs
//
// Verifies the deployed stack at TAICHI_URL is reachable end-to-end:
//   1. Page loads (SPA HTML served by Caddy)
//   2. /api/health returns 200 with {"status":"healthy",...}
//   3. /api/scenarios returns 200 with a scenarios list (the picker source)
//   4. SPA's bundled bundle code references the expected signaling URL
//
// getUserMedia / WebRTC handshake is intentionally not exercised here —
// browsers refuse mic access on plain HTTP origins, and TAICHI MVP is
// HTTP-only. That test belongs in Phase 5 once HTTPS is back (or with a
// browser launched using --unsafely-treat-insecure-origin-as-secure).

import { chromium } from "playwright";

const TAICHI_URL = process.env.TAICHI_URL || "http://192.168.1.25:8080";
const EXPECTED_SIGNALING = `${TAICHI_URL}/api/offer`;

let exitCode = 0;
function pass(name) {
  console.log(`  ✓ ${name}`);
}
function fail(name, msg) {
  console.log(`  ✗ ${name} — ${msg}`);
  exitCode = 1;
}

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ ignoreHTTPSErrors: true });
const page = await context.newPage();

console.log(`\nSmoke testing ${TAICHI_URL}\n`);

// 1. SPA loads
try {
  const resp = await page.goto(TAICHI_URL, { waitUntil: "domcontentloaded", timeout: 15000 });
  if (!resp || !resp.ok()) {
    fail("SPA loads", `HTTP ${resp?.status()}`);
  } else {
    pass(`SPA loads (HTTP ${resp.status()})`);
  }
} catch (e) {
  fail("SPA loads", e.message);
}

// 2. /api/health from page context
try {
  const health = await page.evaluate(async (url) => {
    const r = await fetch(`${url}/api/health`);
    return { status: r.status, body: await r.json() };
  }, TAICHI_URL);
  if (health.status === 200 && health.body?.status === "healthy") {
    pass(`/api/health → 200 ${JSON.stringify(health.body)}`);
  } else {
    fail("/api/health", `status=${health.status} body=${JSON.stringify(health.body)}`);
  }
} catch (e) {
  fail("/api/health", e.message);
}

// 3. /api/scenarios — the pre-call picker's data source. Unauthenticated.
try {
  const scenarios = await page.evaluate(async (url) => {
    const r = await fetch(`${url}/api/scenarios`);
    return { status: r.status, body: await r.json() };
  }, TAICHI_URL);
  if (scenarios.status === 200 && Array.isArray(scenarios.body?.scenarios)) {
    pass(`/api/scenarios → 200 (${scenarios.body.scenarios.length} scenario(s))`);
  } else {
    fail("/api/scenarios", `status=${scenarios.status} body=${JSON.stringify(scenarios.body)}`);
  }
} catch (e) {
  fail("/api/scenarios", e.message);
}

// 4. Bundle (across all JS chunks loaded during navigation) contains the expected signaling URL.
const jsBodies = [];
page.on("response", async (resp) => {
  const url = resp.url();
  if (url.endsWith(".js") || url.includes("/assets/")) {
    try {
      jsBodies.push(await resp.text());
    } catch {
      /* ignore */
    }
  }
});
try {
  // Force home chunk to load by navigating again with networkidle wait.
  await page.goto(TAICHI_URL, { waitUntil: "networkidle", timeout: 15000 });
  const combined = jsBodies.join("\n");
  if (combined.includes(EXPECTED_SIGNALING)) {
    pass(`bundle contains ${EXPECTED_SIGNALING}`);
  } else {
    fail(
      "bundle signaling URL",
      `did not find ${EXPECTED_SIGNALING} across ${jsBodies.length} JS bodies`,
    );
  }
} catch (e) {
  fail("bundle signaling URL", e.message);
}

await browser.close();
console.log(`\n${exitCode === 0 ? "PASS" : "FAIL"} (exit ${exitCode})\n`);
process.exit(exitCode);
