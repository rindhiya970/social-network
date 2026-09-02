/**
 * sla.utils.js — Single source of truth for all SLA, priority and countdown logic.
 *
 * Used by: Issue model · issue.controller · official.controller · slaScheduler
 * Frontend: NEVER calculates priority — only displays issue.priority from DB.
 * Frontend: Calculates countdown client-side from issue.slaDeadline.
 */

// ── SLA hours per category ────────────────────────────
const SLA_HOURS = {
  garbage:     24,
  power:       5,
  water:       48,
  drainage:    48,
  pothole:     72,
  streetlight: 72,
  road:        96,
  other:       72,
};

// ── Category base scores (Improvement 1) ─────────────
const CATEGORY_SCORE = {
  power:       5,
  water:       25,
  drainage:    20,
  pothole:     20,
  streetlight: 15,
  garbage:     10,
  road:        10,
  other:        5,
};

// ── Return SLA deadline Date for a given category ─────
const calculateSLADeadline = (category, from = new Date()) => {
  const hours = SLA_HOURS[category] ?? 72;
  return new Date(from.getTime() + hours * 60 * 60 * 1000);
};

// ── Whether the SLA has expired ───────────────────────
const isOverdue = (slaDeadline) =>
  Boolean(slaDeadline) && new Date() > new Date(slaDeadline);

// ── Hours the SLA has been exceeded (0 if not overdue) ─
const overdueHours = (slaDeadline) => {
  const diff = Date.now() - new Date(slaDeadline).getTime();
  return diff > 0 ? Math.floor(diff / (1000 * 60 * 60)) : 0;
};

/**
 * Human-readable remaining time string (client-side display only).
 * Never store this — always recompute from slaDeadline.
 *
 * Examples:
 *   "2d 5h remaining"
 *   "5h 22m remaining"
 *   "48m remaining"
 *   "⚠ SLA expires soon" (< 6h remaining, not yet overdue)
 *   "Overdue by 2h"
 *   "Overdue by 3d 5h"
 */
const remainingTime = (slaDeadline) => {
  if (!slaDeadline) return null;
  const ms = new Date(slaDeadline).getTime() - Date.now();

  if (ms <= 0) {
    // Overdue
    const totalMin = Math.floor(-ms / (1000 * 60));
    const h = Math.floor(totalMin / 60);
    const d = Math.floor(h / 24);
    if (d > 0) return `Overdue by ${d}d ${h % 24}h`;
    if (h > 0) return `Overdue by ${h}h`;
    return `Overdue by ${totalMin}m`;
  }

  const totalMin = Math.floor(ms / (1000 * 60));
  const d = Math.floor(totalMin / (60 * 24));
  const h = Math.floor((totalMin % (60 * 24)) / 60);
  const m = totalMin % 60;

  // < 6 hours remaining — show warning
  if (d === 0 && h < 6) {
    if (h === 0) return `⚠ SLA expires in ${m}m`;
    return `⚠ SLA expires in ${h}h ${m}m`;
  }

  if (d > 0) return `${d}d ${h}h remaining`;
  if (h > 0) return `${h}h ${m}m remaining`;
  return `${m}m remaining`;
};

/**
 * Weighted priority calculation — the ONLY place priority is computed.
 * Stored in MongoDB. Never recalculated on the frontend.
 *
 * Score weights:
 *   Category base          power=30, water=25, drainage/pothole=20,
 *                          streetlight=15, garbage/road=10, other=5
 *   AI confidence          95-100→+20  85-94→+15  70-84→+10  <70→+5
 *   upvoteCount × 2        max +40
 *   Age every 6h           max +20
 *   Overdue                +30
 *
 * Critical ≥ 75 | High ≥ 45 | Medium ≥ 20 | Low < 20
 *
 * @param {{
 *   category: string,
 *   upvoteCount?: number,
 *   createdAt?: Date|string,
 *   slaDeadline?: Date|string,
 *   aiConfidence?: number,   // 0-100, from Gemini analysis
 * }} issue
 * @returns {'low'|'medium'|'high'|'critical'}
 */
const calculatePriority = (issue) => {
  if (!issue) return "low";

  let score = 0;

  // 1. Category base score
  score += CATEGORY_SCORE[issue.category] ?? 5;

  // 2. AI confidence (optional — only present if issue was AI-analyzed)
  const confidence = issue.aiConfidence ?? 0;
  if (confidence >= 95)      score += 20;
  else if (confidence >= 85) score += 15;
  else if (confidence >= 70) score += 10;
  else if (confidence > 0)   score += 5;

  // 3. Community upvotes (+2 per vote, max +40)
  score += Math.min((issue.upvoteCount ?? 0) * 2, 40);

  // 4. Age (+1 every 6 hours, max +20)
  if (issue.createdAt) {
    const ageHours = (Date.now() - new Date(issue.createdAt).getTime()) / (1000 * 60 * 60);
    score += Math.min(Math.floor(ageHours / 6), 20);
  }

  // 5. Overdue bonus (+30)
  if (isOverdue(issue.slaDeadline)) score += 30;

  // Map score to priority level
  if (score >= 75) return "critical";
  if (score >= 45) return "high";
  if (score >= 20) return "medium";
  return "low";
};

module.exports = {
  SLA_HOURS,
  CATEGORY_SCORE,
  calculateSLADeadline,
  isOverdue,
  overdueHours,
  remainingTime,
  calculatePriority,
};
