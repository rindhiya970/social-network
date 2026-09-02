/**
 * Phase 7 Migration Script
 * Backfills slaDeadline, overdue, overdueHours, priority, lastPriorityUpdate
 * for all existing issues that were created before Phase 7.
 *
 * Run: node scripts/migratePhase7.js
 */

require("dotenv").config();
const mongoose = require("mongoose");
const { calculateSLADeadline, calculatePriority, isOverdue, overdueHours } = require("../src/utils/sla.utils");

async function migrate() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log("Connected to MongoDB");

  // Use the raw collection to avoid validation errors on old documents
  const collection = mongoose.connection.collection("issues");

  const cursor = collection.find({});
  let updated = 0;
  let skipped = 0;

  for await (const doc of cursor) {
    const needsUpdate =
      !doc.priority ||
      !doc.slaDeadline ||
      doc.overdue === undefined ||
      doc.overdueHours === undefined;

    if (!needsUpdate) { skipped++; continue; }

    const slaDeadline = doc.slaDeadline
      ? new Date(doc.slaDeadline)
      : calculateSLADeadline(doc.category, new Date(doc.createdAt));

    const overdueNow = doc.status !== "resolved" && isOverdue(slaDeadline);
    const ovHours    = overdueNow ? overdueHours(slaDeadline) : 0;

    // Build a minimal issue-like object for priority calculation
    const pseudoIssue = {
      upvoteCount: doc.upvoteCount ?? 0,
      createdAt:   doc.createdAt,
      slaDeadline,
      category:    doc.category,
      overdue:     overdueNow,
    };
    const priority = calculatePriority(pseudoIssue);

    await collection.updateOne(
      { _id: doc._id },
      {
        $set: {
          slaDeadline,
          overdue:            overdueNow,
          overdueHours:       ovHours,
          priority,
          lastPriorityUpdate: new Date(),
        },
      }
    );
    updated++;
  }

  console.log(`✅ Migration complete: ${updated} updated, ${skipped} skipped (already have Phase 7 fields).`);
  await mongoose.disconnect();
}

migrate().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
