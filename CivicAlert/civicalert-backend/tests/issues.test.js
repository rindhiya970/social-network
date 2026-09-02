const request = require("supertest");
const app = require("../src/app");
const User = require("../src/models/User.model");
const Issue = require("../src/models/Issue.model");
const { calculateSLADeadline } = require("../src/utils/sla.utils");

describe("Issue Management", () => {
  let citizenToken;
  let citizenUser;

  const validIssue = {
    title: "Water leakage on road",
    description: "Main pipe is broken and water is flowing everywhere.",
    category: "water",
    location: {
      type: "Point",
      coordinates: [80.2707, 13.0827], // Chennai
    },
    wardId: "Ward-12",
  };

  beforeEach(async () => {
    // Create citizen user
    const citizenRes = await request(app)
      .post("/api/auth/register")
      .send({
        name: "Issue Reporter",
        email: "reporter@test.com",
        password: "password123",
      });
    citizenToken = citizenRes.body.token;
    citizenUser = await User.findOne({ email: "reporter@test.com" });
  });

  describe("POST /api/issues", () => {
    it("should allow a citizen to report an issue successfully", async () => {
      const res = await request(app)
        .post("/api/issues")
        .set("Authorization", `Bearer ${citizenToken}`)
        .send(validIssue);

      expect(res.status).toBe(201);
      expect(res.body.message).toBe("Issue reported successfully");
      expect(res.body.issue).toBeDefined();
      expect(res.body.issue.title).toBe(validIssue.title);
      expect(res.body.issue.status).toBe("pending");
      expect(res.body.issue.reportedBy._id).toBe(citizenUser._id.toString());

      // Verify SLA Deadline was created correctly based on category 'water' (48h)
      const expectedDeadline = calculateSLADeadline("water", new Date(res.body.issue.createdAt));
      expect(new Date(res.body.issue.slaDeadline).getTime()).toBeCloseTo(expectedDeadline.getTime(), -3); // Allow minor ms drift
    });

    it("should reject creation if title is missing", async () => {
      const { title, ...noTitle } = validIssue;
      const res = await request(app)
        .post("/api/issues")
        .set("Authorization", `Bearer ${citizenToken}`)
        .send(noTitle);

      expect(res.status).toBe(400);
      expect(res.body.message).toBe("title, description, and category are required");
    });

    it("should reject creation if location coordinates are invalid", async () => {
      const invalidLocationIssue = {
        ...validIssue,
        location: {
          type: "Point",
          coordinates: [200, 13.0827], // Longitude 200 is invalid (-180..180)
        },
      };

      const res = await request(app)
        .post("/api/issues")
        .set("Authorization", `Bearer ${citizenToken}`)
        .send(invalidLocationIssue);

      expect(res.status).toBe(400);
      expect(res.body.message).toContain("coordinates must be [longitude, latitude] with valid ranges");
    });
  });

  describe("GET /api/issues", () => {
    beforeEach(async () => {
      // Create a few issues
      await new Issue({
        title: "Pothole on Cross Street",
        description: "Large deep pothole on the intersection.",
        category: "pothole",
        location: { type: "Point", coordinates: [80.27, 13.08] },
        reportedBy: citizenUser._id,
        status: "pending",
      }).save();

      await new Issue({
        title: "Garbage pile-up",
        description: "Garbage hasn't been collected in a week.",
        category: "garbage",
        location: { type: "Point", coordinates: [80.28, 13.09] },
        reportedBy: citizenUser._id,
        status: "resolved",
      }).save();
    });

    it("should fetch all issues for public feed", async () => {
      const res = await request(app).get("/api/issues");

      expect(res.status).toBe(200);
      expect(res.body.issues).toHaveLength(2);
      expect(res.body.total).toBe(2);
    });

    it("should filter issues by status", async () => {
      const res = await request(app).get("/api/issues?status=resolved");

      expect(res.status).toBe(200);
      expect(res.body.issues).toHaveLength(1);
      expect(res.body.issues[0].title).toBe("Garbage pile-up");
    });

    it("should filter issues by category", async () => {
      const res = await request(app).get("/api/issues?category=pothole");

      expect(res.status).toBe(200);
      expect(res.body.issues).toHaveLength(1);
      expect(res.body.issues[0].title).toBe("Pothole on Cross Street");
    });
  });

  describe("GET /api/issues/my", () => {
    let anotherCitizenToken;

    beforeEach(async () => {
      // Issue for citizenUser
      await new Issue({
        title: "Pothole on Cross Street",
        description: "Large deep pothole on the intersection.",
        category: "pothole",
        location: { type: "Point", coordinates: [80.27, 13.08] },
        reportedBy: citizenUser._id,
      }).save();

      // Create another citizen
      const anotherRes = await request(app)
        .post("/api/auth/register")
        .send({
          name: "Other Citizen",
          email: "other@test.com",
          password: "password123",
        });
      anotherCitizenToken = anotherRes.body.token;
    });

    it("should retrieve only the logged-in citizen's reports", async () => {
      // Request as first citizen
      const res1 = await request(app)
        .get("/api/issues/my")
        .set("Authorization", `Bearer ${citizenToken}`);

      expect(res1.status).toBe(200);
      expect(res1.body.issues).toHaveLength(1);
      expect(res1.body.issues[0].title).toBe("Pothole on Cross Street");

      // Request as second citizen (has no issues reported)
      const res2 = await request(app)
        .get("/api/issues/my")
        .set("Authorization", `Bearer ${anotherCitizenToken}`);

      expect(res2.status).toBe(200);
      expect(res2.body.issues).toHaveLength(0);
    });
  });
});
