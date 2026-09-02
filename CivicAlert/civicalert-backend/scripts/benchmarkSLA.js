/**
 * SLA Scheduler benchmark — measures execution time and dirty-check savings
 * at 10, 50, 100 issues.
 * Run: node scripts/benchmarkSLA.js
 */

require("dotenv").config();
const mongoose = require("mongoose");

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log("Connected to MongoDB");

  const Issue = require("../src/models/Issue.model");
  const {
    isOverdue, overdueHours, calculatePriority
  } = require("../src/utils/sla.utils");

  // Fetch actual unresolved issues
  const issues = await Issue.find({ status: { $nin: ["resolved"] } }).limit(200);
  console.log(`Found ${issues.length} unresolved issues in DB`);

  if (issues.length === 0) {
    console.log("No unresolved issues — insert some test data first.");
    await mongoose.disconnect();
    return;
  }

  // Simulate scheduler logic and measure time + write-skip rate
  const sizes = [
    Math.min(10,  issues.length),
    Math.min(50,  issues.length),
    Math.min(issues.length, issues.length),
  ].filter((v, i, a) => a.indexOf(v) === i); // deduplicate

  for (const n of sizes) {
    const sample = issues.slice(0, n);
    let writes = 0, skips = 0;

    const t0 = process.hrtime.bigint();

    for (const issue of sample) {
      const overdueNow  = isOverdue(issue.slaDeadline);
      const newOvHours  = overdueNow ? overdueHours(issue.slaDeadline) : 0;
      const newPriority = calculatePriority(issue);

      const changed =
        issue.priority     !== newPriority ||
        issue.overdueHours !== newOvHours  ||
        issue.overdue      !== overdueNow;

      if (changed) writes++;
      else         skips++;
    }

    const ms = Number(process.hrtime.bigint() - t0) / 1e6;
    const skipPct = ((skips / n) * 100).toFixed(1);

    console.log(
      `n=${String(n).padEnd(4)} | total=${ms.toFixed(1)}ms | avg=${(ms/n).toFixed(2)}ms/issue | writes=${writes} | skips=${skips} (${skipPct}% saved)`
    );
  }

  await mongoose.disconnect();
}

run().catch((e) => { console.error(e.message); process.exit(1); });
