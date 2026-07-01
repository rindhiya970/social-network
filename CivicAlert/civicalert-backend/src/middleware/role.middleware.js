// Middleware to check user roles
const allowRoles = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized: User not authenticated" });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ 
        message: "Forbidden: You do not have permission to access this resource",
        requiredRole: roles,
        yourRole: req.user.role
      });
    }

    next();
  };
};

module.exports = { allowRoles };
