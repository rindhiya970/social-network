const request = require("supertest");
const app = require("../src/app");
const User = require("../src/models/User.model");
const Issue = require("../src/models/Issue.model");

describe("Issue Upvoting", () => {
  let citizenToken;
  let citizenUser;
  let anotherCitizenToken;
  let anotherCitizenUser;
  let issue;

  beforeEach(async () => {
    // Create citizen user (issue owner)
    const citizenRes = await request(app)
      .post("/api/auth/register")
      .send({
        name: "Issue Owner",
        email: "owner@test.com",
        password: "password123",
      });
    citizenToken = citizenRes.body.token;
    citizenUser = await User.findOne({ email: "owner@test.com" });

    // Create another citizen user (voter)
    const anotherRes = await request(app)
      .post("/api/auth/register")
      .send({
        name: "Voter Citizen",
        email: "voter@test.com",
        password: "password123",
      });
    anotherCitizenToken = anotherRes.body.token;
    anotherCitizenUser = await User.findOne({ email: "voter@test.com" });

    // Create an issue belonging to the first citizen
    issue = await new Issue({
      title: "Streetlight is broken",
      description: "Dark street is unsafe at night.",
      category: "streetlight",
      location: { type: "Point", coordinates: [80.27, 13.08] },
      reportedBy: citizenUser._id,
    }).save();
  });

  describe("POST /api/issues/:id/upvote", () => {
    it("should allow a citizen to upvote another citizen's issue", async () => {
      const res = await request(app)
        .post(`/api/issues/${issue._id}/upvote`)
        .set("Authorization", `Bearer ${anotherCitizenToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.upvoted).toBe(true);
      expect(res.body.upvoteCount).toBe(1);

      // Verify DB state
      const updatedIssue = await Issue.findById(issue._id);
      expect(updatedIssue.upvoteCount).toBe(1);
      expect(updatedIssue.upvotes).toContainEqual(anotherCitizenUser._id);
    });

    it("should toggle (remove) upvote if clicked again by same user", async () => {
      // First upvote
      await request(app)
        .post(`/api/issues/${issue._id}/upvote`)
        .set("Authorization", `Bearer ${anotherCitizenToken}`);

      // Second upvote (toggles off)
      const res = await request(app)
        .post(`/api/issues/${issue._id}/upvote`)
        .set("Authorization", `Bearer ${anotherCitizenToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.upvoted).toBe(false);
      expect(res.body.upvoteCount).toBe(0);

      // Verify DB state
      const updatedIssue = await Issue.findById(issue._id);
      expect(updatedIssue.upvoteCount).toBe(0);
      expect(updatedIssue.upvotes).not.toContainEqual(anotherCitizenUser._id);
    });

    it("should prevent the issue owner from upvoting their own issue", async () => {
      const res = await request(app)
        .post(`/api/issues/${issue._id}/upvote`)
        .set("Authorization", `Bearer ${citizenToken}`);

      expect(res.status).toBe(409);
      expect(res.body.message).toBe("You cannot upvote your own issue");

      // Verify DB state remains unchanged
      const updatedIssue = await Issue.findById(issue._id);
      expect(updatedIssue.upvoteCount).toBe(0);
    });
  });
});
