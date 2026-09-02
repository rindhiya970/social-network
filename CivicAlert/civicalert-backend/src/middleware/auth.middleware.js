const passport = require("passport");

/**
 * Verify JWT token and attach user to req.user.
 * Also blocks disabled accounts (isActive: false).
 */
const authenticateJWT = (req, res, next) => {
  passport.authenticate("jwt", { session: false }, (error, user, info) => {
    if (error) {
      return res.status(500).json({ message: "Authentication error", error: error.message });
    }

    if (!user) {
      return res.status(401).json({ message: "Unauthorized: Invalid or missing token" });
    }

    // Block disabled official/admin accounts
    if (user.isActive === false) {
      return res.status(403).json({ message: "Account disabled. Contact the administrator." });
    }

    req.user = user;
    next();
  })(req, res, next);
};

module.exports = { authenticateJWT };
