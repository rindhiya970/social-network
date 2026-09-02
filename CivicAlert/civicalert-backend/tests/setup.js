const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");

// Set environment variables for tests
process.env.JWT_SECRET = "test_secret_key_for_civicalert_jwt";
process.env.NODE_ENV = "test";
process.env.GEMINI_API_KEY = "test-mock-key-not-real";

let mongoServer;

// Mock Socket.IO globally
jest.mock("../src/config/socket", () => {
  const mockEmit = jest.fn();
  const mockTo = jest.fn(() => ({ emit: mockEmit }));
  const mockIO = { to: mockTo, emit: mockEmit };
  return {
    init: jest.fn(() => mockIO),
    getIO: jest.fn(() => mockIO),
  };
});

beforeAll(async () => {
  // Increase timeout for starting memory server on slower environments
  jest.setTimeout(30000);
  mongoServer = await MongoMemoryServer.create();
  const mongoUri = mongoServer.getUri();
  await mongoose.connect(mongoUri);
});

afterAll(async () => {
  await mongoose.disconnect();
  if (mongoServer) {
    await mongoServer.stop();
  }
});

beforeEach(async () => {
  // Clear database collections before each test
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    await collections[key].deleteMany({});
  }
});
