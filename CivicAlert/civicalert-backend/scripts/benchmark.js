/**
 * CivicAlert API Benchmark Script
 * Measures actual latency for all key endpoints.
 * Run: node scripts/benchmark.js
 * Requires the server to be running on PORT 5000 and a valid JWT token.
 */

require("dotenv").config();
const http = require("http");

const BASE = `http://localhost:${process.env.PORT || 5000}`;
const RUNS = 10; // requests per endpoint

// ── Replace with a real token from POST /api/auth/login ──
const TOKEN = process.env.BENCHMARK_TOKEN || "";
const ISSUE_ID = process.env.BENCHMARK_ISSUE_ID || "";  // a real issue _id

// ────────────────────────────────────────────────────────
// Helper: measure one HTTP call
// ────────────────────────────────────────────────────────
function request(method, path, body, token) {
  return new Promise((resolve, reject) => {
    const data  = body ? JSON.stringify(body) : null;
    const start = process.hrtime.bigint();

    const options = {
      hostname: "localhost",
      port: process.env.PORT || 5000,
      path,
      method,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(data  ? { "Content-Length": Buffer.byteLength(data) } : {}),
      },
    };

    const req = http.request(options, (res) => {
      let raw = "";
      res.on("data", (c) => (raw += c));
      res.on("end", () => {
        const ms = Number(process.hrtime.bigint() - start) / 1e6;
        resolve({ status: res.statusCode, ms, body: raw.substring(0, 100) });
      });
    });

    req.on("error", reject);
    if (data) req.write(data);
    req.end();
  });
}

// ────────────────────────────────────────────────────────
// Helper: run N times and compute stats
// ────────────────────────────────────────────────────────
async function bench(label, fn, n = RUNS) {
  const times = [];
  let errors  = 0;

  for (let i = 0; i < n; i++) {
    try {
      const { ms, status } = await fn();
      if (status >= 200 && status < 400) times.push(ms);
      else errors++;
    } catch { errors++; }
    // small delay between requests
    await new Promise((r) => setTimeout(r, 50));
  }

  if (times.length === 0) {
    console.log(`${label}: ALL FAILED (${errors}/${n} errors)`);
    return;
  }

  times.sort((a, b) => a - b);
  const mean   = (times.reduce((s, v) => s + v, 0) / times.length).toFixed(1);
  const median = times[Math.floor(times.length / 2)].toFixed(1);
  const min    = times[0].toFixed(1);
  const max    = times[times.length - 1].toFixed(1);
  const p95    = times[Math.floor(times.length * 0.95)].toFixed(1);

  console.log(
    `${label.padEnd(45)} mean=${mean}ms  median=${median}ms  min=${min}ms  max=${max}ms  p95=${p95}ms  ok=${times.length}/${n}`
  );
}

// ────────────────────────────────────────────────────────
// Main
// ────────────────────────────────────────────────────────
(async () => {
  console.log("=".repeat(110));
  console.log("CivicAlert API Benchmark");
  console.log(`Base URL : ${BASE}`);
  console.log(`Runs     : ${RUNS} per endpoint`);
  console.log(`Token    : ${TOKEN ? "✅ present" : "❌ missing (auth endpoints will fail)"}`);
  console.log(`Issue ID : ${ISSUE_ID || "(not set — :id endpoints will skip)"}`);
  console.log("=".repeat(110));

  // ── Unauthenticated ──
  await bench("GET /                   (health check)",
    () => request("GET", "/"));

  await bench("GET /api/issues         (public feed)",
    () => request("GET", "/api/issues"));

  await bench("GET /api/issues?page=1&limit=20",
    () => request("GET", "/api/issues?page=1&limit=20"));

  if (ISSUE_ID) {
    await bench(`GET /api/issues/:id     (single issue)`,
      () => request("GET", `/api/issues/${ISSUE_ID}`));
  }

  // ── Authenticated ──
  if (TOKEN) {
    await bench("GET /api/auth/me        (JWT verify)",
      () => request("GET", "/api/auth/me", null, TOKEN));

    await bench("GET /api/issues/my      (my issues)",
      () => request("GET", "/api/issues/my", null, TOKEN));

    await bench("GET /api/official/issues (official dashboard)",
      () => request("GET", "/api/official/issues", null, TOKEN));

    if (ISSUE_ID) {
      await bench("GET /api/official/issues/:id (issue details)",
        () => request("GET", `/api/official/issues/${ISSUE_ID}`, null, TOKEN));
    }
  } else {
    console.log("⚠  Skipping authenticated endpoints — set BENCHMARK_TOKEN env var");
    console.log("   Run: export BENCHMARK_TOKEN=$(curl -s -X POST http://localhost:5000/api/auth/login -H 'Content-Type: application/json' -d '{\"email\":\"citizen@test.com\",\"password\":\"password123\"}' | node -pe \"JSON.parse(require('fs').readFileSync('/dev/stdin','utf8')).token\")");
  }

  console.log("=".repeat(110));
  console.log("Done.");
})();
