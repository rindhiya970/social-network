const request = require("supertest");
const app = require("../src/app");
const User = require("../src/models/User.model");

describe("Gemini Vision AI Analysis", () => {
  let citizenToken;

  beforeEach(async () => {
    // Create citizen user
    const citizenRes = await request(app)
      .post("/api/auth/register")
      .send({
        name: "AI Tester",
        email: "ai@test.com",
        password: "password123",
      });
    citizenToken = citizenRes.body.token;
  });

  describe("POST /api/ai/analyze-issue", () => {
    const fakeImageBuffer = Buffer.from("fake-jpeg-image-content");

    it("should parse a valid Gemini AI response correctly", async () => {
      const res = await request(app)
        .post("/api/ai/analyze-issue")
        .set("Authorization", `Bearer ${citizenToken}`)
        .attach("image", fakeImageBuffer, "issue.jpg");

      expect(res.status).toBe(200);
      expect(res.body.title).toBe("Pothole on Main Road");
      expect(res.body.description).toBe("A huge pothole that needs immediate attention.");
      expect(res.body.category).toBe("pothole");
      expect(res.body.confidence).toBe(0.92);
    });

    it("should sanitize and fallback to 'other' if AI returns an invalid category", async () => {
      const res = await request(app)
        .post("/api/ai/analyze-issue")
        .set("Authorization", `Bearer ${citizenToken}`)
        .set("x-test-scenario", "invalid-category")
        .attach("image", fakeImageBuffer, "issue.jpg");

      expect(res.status).toBe(200);
      expect(res.body.category).toBe("other"); // Fallback
      expect(res.body.title).toBe("Pothole on Main Road");
    });

    it("should handle non-JSON responses from Gemini safely", async () => {
      const res = await request(app)
        .post("/api/ai/analyze-issue")
        .set("Authorization", `Bearer ${citizenToken}`)
        .set("x-test-scenario", "invalid-json")
        .attach("image", fakeImageBuffer, "issue.jpg");

      expect(res.status).toBe(422);
      expect(res.body.message).toBe("AI returned an unexpected response. Please fill the form manually.");
    });

    it("should handle non-civic issue detection safely", async () => {
      const res = await request(app)
        .post("/api/ai/analyze-issue")
        .set("Authorization", `Bearer ${citizenToken}`)
        .set("x-test-scenario", "not-civic")
        .attach("image", fakeImageBuffer, "issue.jpg");

      expect(res.status).toBe(422);
      expect(res.body.message).toBe("This image does not appear to show a civic issue. Please upload a relevant photo or fill the form manually.");
    });

    it("should handle unclear image detection safely", async () => {
      const res = await request(app)
        .post("/api/ai/analyze-issue")
        .set("Authorization", `Bearer ${citizenToken}`)
        .set("x-test-scenario", "unclear")
        .attach("image", fakeImageBuffer, "issue.jpg");

      expect(res.status).toBe(422);
      expect(res.body.message).toBe("The image is unclear. Please take a clearer photo or fill the form manually.");
    });

    it("should handle API quota exceeded errors gracefully", async () => {
      const res = await request(app)
        .post("/api/ai/analyze-issue")
        .set("Authorization", `Bearer ${citizenToken}`)
        .set("x-test-scenario", "quota-exceeded")
        .attach("image", fakeImageBuffer, "issue.jpg");

      expect(res.status).toBe(429);
      expect(res.body.message).toContain("AI quota exceeded");
    });

    it("should handle invalid API key errors gracefully", async () => {
      const res = await request(app)
        .post("/api/ai/analyze-issue")
        .set("Authorization", `Bearer ${citizenToken}`)
        .set("x-test-scenario", "api-failure")
        .attach("image", fakeImageBuffer, "issue.jpg");

      expect(res.status).toBe(503);
      expect(res.body.message).toContain("Invalid Gemini API key");
    });
  });
});
