/**
 * SLA Escalation Scheduler — runs every hour via node-cron.
 *
 * Every run:
 *   1. Recalculates priority for ALL unresolved issues (age increases every hour)
 *   2. Marks overdue=true when slaDeadline has passed
 *   3. Flips status pending → overdue
 *   4. Emits issueStatusUpdated / issueOverdue via Socket.IO
 *   5. Skips DB write when nothing changed (performance)
 */

const cron  = require("node-cron");
const Issue = require("../models/Issue.model");
const { getIO } = require("../config/socket");
const {
  isOverdue,
  overdueHours: calcOverdueHours,
  calculatePriority,
} = require("../utils/sla.utils");

const checkIssues = async () => {
  console.log("⏰ SLA Scheduler: running priority + overdue check…");

  try {
    // Process ALL unresolved issues (priority ages every hour)
    const allUnresolved = await Issue.find({ status: { $nin: ["resolved"] } });

    if (allUnresolved.length === 0) {
      console.log("✅ SLA Scheduler: no unresolved issues.");
      return;
    }

    let priorityUpdates = 0;
    let overdueUpdates  = 0;

    for (const issue of allUnresolved) {
      const overdueNow      = isOverdue(issue.slaDeadline);
      const newOverdueHours = overdueNow ? calcOverdueHours(issue.slaDeadline) : 0;
      const newPriority     = calculatePriority(issue);
      const becameOverdue   = overdueNow && !issue.overdue;

      const priorityChanged = issue.priority     !== newPriority;
      const overdueChanged  = issue.overdueHours !== newOverdueHours ||
                              issue.overdue      !== overdueNow;

      if (!priorityChanged && !overdueChanged) continue;

      // Apply updates
      issue.priority           = newPriority;
      issue.lastPriorityUpdate = new Date();

      if (overdueNow) {
        issue.overdue      = true;
        issue.overdueHours = newOverdueHours;

        // Flip pending → overdue (not acknowledged/in_progress — those are being worked)
        if (issue.status === "pending") {
          issue.status = "overdue";
        }
      }

      await issue.save();

      if (priorityChanged) priorityUpdates++;
      if (becameOverdue)    overdueUpdates++;

      // Emit realtime to all screens
      try {
        const populated = await Issue.findById(issue._id)
          .populate("reportedBy", "name email wardId")
          .populate("assignedTo",  "name email");

        const io = getIO();
        // issueStatusUpdated updates Feed, My Reports, Official Dashboard, Issue Details
        io.to("citizens").emit("issueStatusUpdated", populated.toObject());

        // Extra event when issue first becomes overdue
        if (becameOverdue) {
          io.to("citizens").emit("issueOverdue", populated.toObject());
        }
      } catch { /* socket not ready — skip */ }
    }

    console.log(
      `⏰ SLA Scheduler: ${priorityUpdates} priority updates, ${overdueUpdates} newly overdue.`
    );
  } catch (error) {
    console.error("⏰ SLA Scheduler error:", error.message);
  }
};

const startSLAScheduler = () => {
  // Run every hour at minute 0
  cron.schedule("0 * * * *", checkIssues);

  console.log("⏰ SLA Scheduler started (runs every hour)");
};

module.exports = { startSLAScheduler, checkIssues };
