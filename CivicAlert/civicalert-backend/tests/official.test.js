const request = require("supertest");
const app = require("../src/app");
const User = require("../src/models/User.model");
const Issue = require("../src/models/Issue.model");

describe("Official Issue Workflow", () => {
  let citizenToken;
  let citizenUser;
  let officialToken;
  let officialUser;
  let issue;

  beforeEach(async () => {
    // Create citizen
    const citizenRes = await request(app)
      .post("/api/auth/register")
      .send({
        name: "Citizen Joe",
        email: "joe@citizen.com",
        password: "password123",
      });
    citizenToken = citizenRes.body.token;
    citizenUser = await User.findOne({ email: "joe@citizen.com" });

    // Seed official directly (since no public signup exists)
    officialUser = new User({
      name: "Official Bob",
      email: "bob@official.com",
      passwordHash: "password123",
      role: "official",
      wardId: "Ward-7",
    });
    await officialUser.save();

    // Login official to get token
    const loginRes = await request(app)
      .post("/api/auth/login")
      .send({
        email: "bob@official.com",
        password: "password123",
      });
    officialToken = loginRes.body.token;

    // Create a pending issue (matching official's ward)
    issue = await new Issue({
      title: "Broken Drainage on 5th Ave",
      description: "Severe drainage issue flooding the pavement.",
      category: "drainage",
      location: { type: "Point", coordinates: [80.27, 13.08] },
      reportedBy: citizenUser._id,
      wardId: "Ward-7",
      status: "pending",
    }).save();
  });

  describe("GET /api/official/issues", () => {
    it("should allow official to view pending and assigned issues", async () => {
      const res = await request(app)
        .get("/api/official/issues")
        .set("Authorization", `Bearer ${officialToken}`);

      expect(res.status).toBe(200);
      expect(res.body.pendingIssues).toHaveLength(1);
      expect(res.body.pendingIssues[0].title).toBe(issue.title);
      expect(res.body.assignedIssues).toHaveLength(0);
    });

    it("should reject view access for citizens", async () => {
      const res = await request(app)
        .get("/api/official/issues")
        .set("Authorization", `Bearer ${citizenToken}`);

      expect(res.status).toBe(403);
    });
  });

  describe("PATCH /api/official/issues/:id/status", () => {
    it("should allow official to accept a pending issue (pending -> acknowledged)", async () => {
      const res = await request(app)
        .patch(`/api/official/issues/${issue._id}/status`)
        .set("Authorization", `Bearer ${officialToken}`)
        .send({ status: "acknowledged" });

      expect(res.status).toBe(200);
      expect(res.body.message).toBe("Issue status updated to acknowledged");
      expect(res.body.issue.status).toBe("acknowledged");
      expect(res.body.issue.assignedTo._id).toBe(officialUser._id.toString());
    });

    it("should allow official to transition from acknowledged -> in_progress", async () => {
      // Setup issue as Acknowledged and Assigned
      issue.status = "acknowledged";
      issue.assignedTo = officialUser._id;
      await issue.save();

      const res = await request(app)
        .patch(`/api/official/issues/${issue._id}/status`)
        .set("Authorization", `Bearer ${officialToken}`)
        .send({ status: "in_progress" });

      expect(res.status).toBe(200);
      expect(res.body.issue.status).toBe("in_progress");
    });

    it("should allow official to transition from in_progress -> resolved", async () => {
      // Setup issue as In Progress and Assigned
      issue.status = "in_progress";
      issue.assignedTo = officialUser._id;
      await issue.save();

      const res = await request(app)
        .patch(`/api/official/issues/${issue._id}/status`)
        .set("Authorization", `Bearer ${officialToken}`)
        .send({ status: "resolved" });

      expect(res.status).toBe(200);
      expect(res.body.issue.status).toBe("resolved");
    });

    it("should reject invalid transitions (e.g. pending -> in_progress directly)", async () => {
      const res = await request(app)
        .patch(`/api/official/issues/${issue._id}/status`)
        .set("Authorization", `Bearer ${officialToken}`)
        .send({ status: "in_progress" });

      expect(res.status).toBe(422);
      expect(res.body.message).toContain("Invalid transition");
    });

    it("should block citizens from performing status updates", async () => {
      const res = await request(app)
        .patch(`/api/official/issues/${issue._id}/status`)
        .set("Authorization", `Bearer ${citizenToken}`)
        .send({ status: "acknowledged" });

      expect(res.status).toBe(403);
    });
  });
});
