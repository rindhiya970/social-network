const request = require("supertest");
const app = require("../src/app");
const User = require("../src/models/User.model");

describe("Authentication & Role Protection", () => {
  const citizenData = {
    name: "John Citizen",
    email: "john@citizen.com",
    password: "password123",
  };

  const officialData = {
    name: "Jane Official",
    email: "jane@official.com",
    password: "password123",
    role: "official",
    wardId: "Ward-4",
  };

  beforeEach(async () => {
    // Manually hash password and save official since official registration is not public
    const official = new User({
      name: officialData.name,
      email: officialData.email,
      passwordHash: officialData.password, // Schema hook hashes this
      role: officialData.role,
      wardId: officialData.wardId,
    });
    await official.save();
  });

  describe("POST /api/auth/register", () => {
    it("should register a new citizen successfully", async () => {
      const res = await request(app)
        .post("/api/auth/register")
        .send(citizenData);

      expect(res.status).toBe(201);
      expect(res.body.message).toBe("User registered successfully");
      expect(res.body.token).toBeDefined();
      expect(res.body.user).toBeDefined();
      expect(res.body.user.role).toBe("citizen");
      expect(res.body.user.email).toBe(citizenData.email.toLowerCase());
    });

    it("should reject registration with missing fields", async () => {
      const res = await request(app)
        .post("/api/auth/register")
        .send({
          name: "John",
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain("Please provide all required fields");
    });

    it("should reject registration if email already exists", async () => {
      // First registration
      await request(app).post("/api/auth/register").send(citizenData);

      // Duplicate registration
      const res = await request(app)
        .post("/api/auth/register")
        .send(citizenData);

      expect(res.status).toBe(400);
      expect(res.body.message).toBe("User with this email already exists");
    });

    it("should ignore role override in body and force citizen role", async () => {
      const res = await request(app)
        .post("/api/auth/register")
        .send({
          ...citizenData,
          role: "official", // Attempting override
        });

      expect(res.status).toBe(201);
      expect(res.body.user.role).toBe("citizen");
    });
  });

  describe("POST /api/auth/login", () => {
    beforeEach(async () => {
      // Register the citizen first
      await request(app).post("/api/auth/register").send(citizenData);
    });

    it("should log in a citizen with valid credentials", async () => {
      const res = await request(app)
        .post("/api/auth/login")
        .send({
          email: citizenData.email,
          password: citizenData.password,
        });

      expect(res.status).toBe(200);
      expect(res.body.message).toBe("Login successful");
      expect(res.body.token).toBeDefined();
      expect(res.body.user.role).toBe("citizen");
    });

    it("should log in an official with valid credentials", async () => {
      const res = await request(app)
        .post("/api/auth/login")
        .send({
          email: officialData.email,
          password: officialData.password,
        });

      expect(res.status).toBe(200);
      expect(res.body.message).toBe("Login successful");
      expect(res.body.token).toBeDefined();
      expect(res.body.user.role).toBe("official");
    });

    it("should reject login with invalid credentials", async () => {
      const res = await request(app)
        .post("/api/auth/login")
        .send({
          email: citizenData.email,
          password: "wrongpassword",
        });

      expect(res.status).toBe(401);
      expect(res.body.message).toBe("Invalid email or password");
    });
  });

  describe("Protected Routes & JWT Authentication", () => {
    let citizenToken;
    let officialToken;

    beforeEach(async () => {
      // Register & Login Citizen
      const citizenRes = await request(app)
        .post("/api/auth/register")
        .send(citizenData);
      citizenToken = citizenRes.body.token;

      // Login Official
      const officialLoginRes = await request(app)
        .post("/api/auth/login")
        .send({
          email: officialData.email,
          password: officialData.password,
        });
      officialToken = officialLoginRes.body.token;
    });

    it("should allow a logged-in user to access /api/auth/me", async () => {
      const res = await request(app)
        .get("/api/auth/me")
        .set("Authorization", `Bearer ${citizenToken}`);

      expect(res.status).toBe(200);
      expect(res.body.user.email).toBe(citizenData.email.toLowerCase());
    });

    it("should reject request to protected route if token is missing", async () => {
      const res = await request(app).get("/api/auth/me");

      expect(res.status).toBe(401);
      expect(res.body.message).toBe("Unauthorized: Invalid or missing token");
    });

    it("should reject request to protected route if token is invalid", async () => {
      const res = await request(app)
        .get("/api/auth/me")
        .set("Authorization", "Bearer invalidtoken123");

      expect(res.status).toBe(401);
      expect(res.body.message).toBe("Unauthorized: Invalid or missing token");
    });

    it("should forbid citizen from accessing official endpoints", async () => {
      const res = await request(app)
        .get("/api/official/issues")
        .set("Authorization", `Bearer ${citizenToken}`);

      expect(res.status).toBe(403);
      expect(res.body.message).toContain("Forbidden");
    });

    it("should allow official to access official endpoints", async () => {
      const res = await request(app)
        .get("/api/official/issues")
        .set("Authorization", `Bearer ${officialToken}`);

      expect(res.status).toBe(200);
      expect(res.body.issues).toBeDefined();
    });
  });
});
