const jwt = require("jsonwebtoken");
const passport = require("passport");
const User = require("../models/User.model");

// Generate JWT token
const generateToken = (userId) => {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET, {
    expiresIn: "7d",
  });
};

// @route   POST /api/auth/register
// @desc    Register a new citizen user
// @access  Public
const register = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    // Validation
    if (!name || !email || !password) {
      return res.status(400).json({ message: "Please provide all required fields: name, email, password" });
    }

    if (password.length < 6) {
      return res.status(400).json({ message: "Password must be at least 6 characters long" });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: "User with this email already exists" });
    }

    // Create new user with role automatically set to "citizen"
    const user = new User({
      name,
      email,
      passwordHash: password, // Will be hashed by pre-save hook
      role: "citizen", // Enforced - users cannot choose their role during registration
    });

    await user.save();

    // Generate token
    const token = generateToken(user._id);

    res.status(201).json({
      message: "User registered successfully",
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        wardId: user.wardId,
        createdAt: user.createdAt,
      },
    });
  } catch (error) {
    console.error("Registration error:", error);
    res.status(500).json({ message: "Server error during registration", error: error.message });
  }
};

// @route   POST /api/auth/login
// @desc    Login user and return JWT token
// @access  Public
const login = async (req, res) => {
  passport.authenticate("local", { session: false }, (error, user, info) => {
    if (error) {
      return res.status(500).json({ message: "Authentication error", error: error.message });
    }

    if (!user) {
      return res.status(401).json({ message: info?.message || "Invalid email or password" });
    }

    // Generate token
    const token = generateToken(user._id);

    res.status(200).json({
      message: "Login successful",
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        wardId: user.wardId,
        createdAt: user.createdAt,
      },
    });
  })(req, res);
};

// @route   GET /api/auth/me
// @desc    Get currently logged-in user
// @access  Private
const getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.status(200).json({
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        wardId: user.wardId,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
    });
  } catch (error) {
    console.error("Get me error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

module.exports = {
  register,
  login,
  getMe,
};
