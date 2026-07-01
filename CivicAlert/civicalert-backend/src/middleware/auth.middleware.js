const passport = require("passport");

// Middleware to verify JWT token
const authenticateJWT = (req, res, next) => {
  passport.authenticate("jwt", { session: false }, (error, user, info) => {
    if (error) {
      return res.status(500).json({ message: "Authentication error", error: error.message });
    }

    if (!user) {
      return res.status(401).json({ message: "Unauthorized: Invalid or missing token" });
    }

    req.user = user;
    next();
  })(req, res, next);
};

module.exports = { authenticateJWT };
