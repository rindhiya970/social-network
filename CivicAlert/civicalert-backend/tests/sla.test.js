const {
  SLA_HOURS,
  calculateSLADeadline,
  isOverdue,
  overdueHours,
  calculatePriority,
} = require("../src/utils/sla.utils");
const Issue = require("../src/models/Issue.model");
const User = require("../src/models/User.model");
const { checkIssues } = require("../src/jobs/slaScheduler");

describe("SLA & Priority Logic", () => {
  describe("SLA Deadline Calculations", () => {
    it("should calculate correct SLA hours for each category", () => {
      expect(SLA_HOURS.power).toBe(5);
      expect(SLA_HOURS.garbage).toBe(24);
      expect(SLA_HOURS.water).toBe(48);
      expect(SLA_HOURS.drainage).toBe(48);
      expect(SLA_HOURS.pothole).toBe(72);
      expect(SLA_HOURS.streetlight).toBe(72);
      expect(SLA_HOURS.road).toBe(96);
      expect(SLA_HOURS.other).toBe(72);
    });

    it("should calculate correct SLA deadline Date", () => {
      const now = new Date();
      const deadline = calculateSLADeadline("power", now);
      const diffMs = deadline.getTime() - now.getTime();
      const diffHours = diffMs / (1000 * 60 * 60);

      expect(diffHours).toBe(5);
    });
  });

  describe("Overdue Detection", () => {
    it("should detect when an issue is overdue", () => {
      const pastDate = new Date(Date.now() - 3600 * 1000); // 1 hour ago
      const futureDate = new Date(Date.now() + 3600 * 1000); // 1 hour from now

      expect(isOverdue(pastDate)).toBe(true);
      expect(isOverdue(futureDate)).toBe(false);
    });

    it("should return correct overdue hours", () => {
      const pastDate = new Date(Date.now() - 2.5 * 3600 * 1000); // 2.5 hours ago
      expect(overdueHours(pastDate)).toBe(2);

      const futureDate = new Date(Date.now() + 3600 * 1000);
      expect(overdueHours(futureDate)).toBe(0);
    });
  });

  describe("Priority Weighting", () => {
    it("should assign correct priority level based on category and age", () => {
      // 1. low priority: category 'other' (base 5), no upvotes, created just now, not overdue
      const issueLow = {
        category: "other",
        upvoteCount: 0,
        createdAt: new Date(),
        slaDeadline: new Date(Date.now() + 72 * 3600 * 1000),
      };
      expect(calculatePriority(issueLow)).toBe("low"); // Score: 5 (low < 20)

      // 2. medium priority: category 'water' (base 25)
      const issueMed = {
        category: "water",
        upvoteCount: 0,
        createdAt: new Date(),
        slaDeadline: new Date(Date.now() + 48 * 3600 * 1000),
      };
      expect(calculatePriority(issueMed)).toBe("medium"); // Score: 25 (medium >= 20)

      // 3. high priority: category 'power' (base 5) + 20 upvotes (score +40)
      const issueHigh = {
        category: "power",
        upvoteCount: 20,
        createdAt: new Date(),
        slaDeadline: new Date(Date.now() + 5 * 3600 * 1000),
      };
      expect(calculatePriority(issueHigh)).toBe("high"); // Score: 5 + 40 = 45 (high >= 45)

      // 4. critical priority: power (base 5) + overdue (+30) + 20 upvotes (+40)
      const issueCrit = {
        category: "power",
        upvoteCount: 20,
        createdAt: new Date(Date.now() - 24 * 3600 * 1000),
        slaDeadline: new Date(Date.now() - 19 * 3600 * 1000), // Overdue by 19 hours
      };
      // Score: 5 (base) + 40 (upvotes) + 4 (age: 24h / 6 = 4) + 30 (overdue) = 79 (critical >= 75)
      expect(calculatePriority(issueCrit)).toBe("critical");
    });
  });

  describe("SLA Scheduler Trigger", () => {
    let citizen;

    beforeEach(async () => {
      citizen = new User({
        name: "Test Citizen",
        email: "citizen@test.com",
        passwordHash: "password",
      });
      await citizen.save();
    });

    it("should flip overdue pending issues to 'overdue' and update priority", async () => {
      // Create a pending issue whose deadline has passed (e.g. reported 10 hours ago for power - SLA is 5 hours)
      const createdAt = new Date(Date.now() - 10 * 3600 * 1000);
      const slaDeadline = new Date(createdAt.getTime() + 5 * 3600 * 1000); // Overdue by 5 hours

      const issue = new Issue({
        title: "Power lines down",
        description: "Dangerous power lines on the road.",
        category: "power",
        location: { type: "Point", coordinates: [80.27, 13.08] },
        reportedBy: citizen._id,
        status: "pending",
        createdAt,
        slaDeadline,
        priority: "low",
      });
      // Save directly, bypass pre-save hook resetting deadline
      await Issue.collection.insertOne(issue);

      // Run scheduler check
      await checkIssues();

      // Retrieve issue
      const updated = await Issue.findById(issue._id);
      expect(updated.status).toBe("overdue");
      expect(updated.overdue).toBe(true);
      expect(updated.overdueHours).toBe(5);
      // Priority should increase due to overdue bonus (+30) and category base (5)
      // Score: 5 (base) + 1 (age: 10/6) + 30 (overdue) = 36 (medium)
      expect(updated.priority).toBe("medium");
    });
  });
});
