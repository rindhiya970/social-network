/**
 * Script to create test users with different roles
 * Run: node scripts/createTestUsers.js
 */

const mongoose = require("mongoose");
const dotenv = require("dotenv");
const User = require("../src/models/User.model");

// Load environment variables
dotenv.config();

const testUsers = [
  {
    name: "Citizen Test User",
    email: "citizen@test.com",
    passwordHash: "password123",
    role: "citizen",
    wardId: null,
  },
  {
    name: "Official Test User",
    email: "official@test.com",
    passwordHash: "password123",
    role: "official",
    wardId: "ward-001",
  },
  {
    name: "Admin Test User",
    email: "admin@test.com",
    passwordHash: "password123",
    role: "admin",
    wardId: null,
  },
];

const createTestUsers = async () => {
  try {
    console.log("🔌 Connecting to MongoDB...");
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ MongoDB Connected\n");

    // Clear existing test users
    console.log("🗑️  Removing existing test users...");
    await User.deleteMany({
      email: { $in: testUsers.map((u) => u.email) },
    });
    console.log("✅ Old test users removed\n");

    // Create new test users
    console.log("👥 Creating test users...\n");
    for (const userData of testUsers) {
      const user = new User(userData);
      await user.save();
      console.log(`✅ Created: ${user.role.toUpperCase()} - ${user.email}`);
    }

    console.log("\n🎉 Test users created successfully!\n");
    console.log("📋 Login Credentials:");
    console.log("=" .repeat(50));
    testUsers.forEach((user) => {
      console.log(`\n${user.role.toUpperCase()}:`);
      console.log(`  Email: ${user.email}`);
      console.log(`  Password: password123`);
    });
    console.log("\n" + "=".repeat(50));

    process.exit(0);
  } catch (error) {
    console.error("❌ Error:", error.message);
    process.exit(1);
  }
};

createTestUsers();
