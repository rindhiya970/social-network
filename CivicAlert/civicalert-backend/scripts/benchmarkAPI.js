/**
 * CivicAlert Full API + SLA Benchmark
 * Usage:
 *   1. Start the server: npm run dev
 *   2. Run: node scripts/benchmarkAPI.js
 *
 * Measures: mean, median, min, max latency for each endpoint
 */

require("dotenv").config();
const http = require("http");

const PORT  = process.env.PORT || 5000;
const RUNS  = 10;
const EMAIL = "citizen@test.com";
const PASS  = "password123";

function req(method, path, body, token) {
  return new Promise((resolve) => {
    const data = body ? JSON.stringify(body) : null;
    const t0   = process.hrtime.bigint();
    const opts = {
      hostname: "localhost", port: PORT, path, method,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(data  ? { "Content-Length": Buffer.byteLength(data) } : {}),
      },
    };
    const r = http.request(opts, (res) => {
      let d = "";
      res.on("data", (c) => (d += c));
      res.on("end", () => {
        const ms = Number(process.hrtime.bigint() - t0) / 1e6;
        resolve({ status: res.statusCode, ms, body: d });
      });
    });
    r.on("error", () => resolve({ status: 0, ms: 0, body: "" }));
    if (data) r.write(data);
    r.end();
  });
}

async function stats(label, fn) {
  const times = [];
  for (let i = 0; i < RUNS; i++) {
    const { ms, status } = await fn();
    if (ms > 0 && status > 0) times.push(ms);
    await new Promise((r) => setTimeout(r, 100));
  }
  if (!times.length) { console.log(`${label.padEnd(50)} FAILED`); return null; }
  times.sort((a, b) => a - b);
  const mean   = (times.reduce((s, v) => s + v, 0) / times.length).toFixed(1);
  const median = times[Math.floor(times.length / 2)].toFixed(1);
  const min    = times[0].toFixed(1);
  const max    = times[times.length - 1].toFixed(1);
  console.log(`${label.padEnd(50)} mean=${mean}ms  median=${median}ms  min=${min}ms  max=${max}ms`);
  return { mean: +mean, median: +median, min: +min, max: +max };
}

(async () => {
  console.log("=".repeat(100));
  console.log("CIVICALERT API BENCHMARK");
  console.log(`Server: http://localhost:${PORT}   Runs: ${RUNS} per endpoint`);
  console.log("=".repeat(100));

  // Step 1: login to get token + first issue id
  const login = await req("POST", "/api/auth/login", { email: EMAIL, password: PASS });
  if (login.status !== 200) {
    console.error("Login failed — start the server first: npm run dev");
    process.exit(1);
  }
  const token = JSON.parse(login.body).token;
  console.log("✅ Authenticated\n");

  // Get a real issue id
  const issuesRes = await req("GET", "/api/issues", null, token);
  let issueId = "";
  try {
    const issues = JSON.parse(issuesRes.body).issues;
    if (issues && issues.length > 0) issueId = issues[0]._id;
  } catch {}
  console.log(`Issue ID for single-issue tests: ${issueId || "(none found)"}\n`);

  // ── Benchmarks ──
  console.log("── Unauthenticated ──");
  await stats("GET / (health)", () => req("GET", "/"));
  await stats("GET /api/issues", () => req("GET", "/api/issues"));
  await stats("GET /api/issues?page=1&limit=20", () => req("GET", "/api/issues?page=1&limit=20"));
  if (issueId) {
    await stats(`GET /api/issues/:id`, () => req("GET", `/api/issues/${issueId}`));
  }

  console.log("\n── Authenticated (citizen) ──");
  await stats("POST /api/auth/login", () =>
    req("POST", "/api/auth/login", { email: EMAIL, password: PASS })
  );
  await stats("GET /api/auth/me", () => req("GET", "/api/auth/me", null, token));
  await stats("GET /api/issues/my", () => req("GET", "/api/issues/my", null, token));

  console.log("\n── Official endpoints ──");
  // Try official login
  const oLogin = await req("POST", "/api/auth/login", { email: "official@test.com", password: "password123" });
  let oToken = "";
  if (oLogin.status === 200) {
    oToken = JSON.parse(oLogin.body).token;
    await stats("GET /api/official/issues", () => req("GET", "/api/official/issues", null, oToken));
    if (issueId) {
      await stats("GET /api/official/issues/:id", () => req("GET", `/api/official/issues/${issueId}`, null, oToken));
    }
  } else {
    console.log("Official login failed — skipping official endpoints");
  }

  // ── SLA scheduler in-process benchmark ──
  console.log("\n── SLA Scheduler (in-process, no DB writes) ──");
  const mongoose = require("mongoose");
  await mongoose.connect(process.env.MONGO_URI);
  const Issue = require("../src/models/Issue.model");
  const { isOverdue, overdueHours, calculatePriority } = require("../src/utils/sla.utils");

  const allIssues = await Issue.find({ status: { $nin: ["resolved"] } });
  console.log(`Unresolved issues in DB: ${allIssues.length}`);

  for (const n of [10, 50, 100, allIssues.length].filter((v, i, a) => a.indexOf(v) === i && v <= allIssues.length)) {
    const sample = allIssues.slice(0, n);
    let writes = 0, skips = 0;
    const t0 = process.hrtime.bigint();
    for (const issue of sample) {
      const overdueNow  = isOverdue(issue.slaDeadline);
      const newOvHours  = overdueNow ? overdueHours(issue.slaDeadline) : 0;
      const newPriority = calculatePriority(issue);
      const changed =
        issue.priority !== newPriority ||
        issue.overdue  !== overdueNow  ||
        issue.overdueHours !== newOvHours;
      if (changed) writes++;
      else skips++;
    }
    const ms      = (Number(process.hrtime.bigint() - t0) / 1e6).toFixed(2);
    const skipPct = ((skips / n) * 100).toFixed(0);
    console.log(`  n=${String(n).padEnd(5)} total=${ms}ms  avg=${(ms/n).toFixed(3)}ms/issue  writes=${writes}  skips=${skips} (${skipPct}% DB writes avoided)`);
  }

  await mongoose.disconnect();
  console.log("\n" + "=".repeat(100));
  console.log("BENCHMARK COMPLETE");
  console.log("=".repeat(100));
})();
