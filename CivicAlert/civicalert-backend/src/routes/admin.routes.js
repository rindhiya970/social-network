const express = require("express");
const { authenticateJWT } = require("../middleware/auth.middleware");
const { allowRoles }      = require("../middleware/role.middleware");
const {
  getDashboard,
  getOfficials,
  createOfficial,
  updateOfficial,
  deleteOfficial,
  getAdminIssues,
  assignIssue,
} = require("../controllers/admin.controller");

const router = express.Router();

// All admin routes: must be authenticated AND role=admin
router.use(authenticateJWT, allowRoles("admin"));

// Dashboard stats
router.get("/dashboard", getDashboard);

// Officials management
router.get("/officials",       getOfficials);
router.post("/officials",      createOfficial);
router.patch("/officials/:id", updateOfficial);
router.delete("/officials/:id", deleteOfficial);

// Issues + workload
router.get("/issues",          getAdminIssues);
router.post("/issues/:id/assign", assignIssue);

module.exports = router;
