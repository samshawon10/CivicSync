/**
 * Deterministic department team scoring (SLA-safe allocation support).
 *
 * Extracted from `recommendTeams` in controllers/departmentController.js so both
 * the Department Dashboard and the CivicSync AI Gateway use ONE scoring
 * implementation. The AI must never invent an allocation rule (§36, §41): it
 * reads the same score and reasons the officer sees on screen.
 *
 * The function is pure: it takes the team documents, the active-task counts and
 * the case category, and returns a ranked copy. It performs no writes and makes
 * no decision on the user's behalf.
 */

/** Task states that count as live work for a team's workload. */
export const activeTaskStatuses = Object.freeze(['assigned', 'accepted', 'traveling', 'arrived', 'in_progress', 'blocked']);

/**
 * Scores teams for a case.
 * @param {{ teams?: object[], taskCounts?: Record<string, number>, category?: string }} args
 * @returns {Array<object>} the teams, ranked, each with score, reasons and workload
 */
export function scoreTeamsForCase({ teams = [], taskCounts = {}, category = '' } = {}) {
  const wanted = String(category || '').toLowerCase();
  const scored = teams.map((team) => {
    let score = 50;
    const reasons = [];

    // Availability
    if (team.status === 'available') {
      score += 30;
      reasons.push('Team status is Available');
    } else if (team.status === 'busy') {
      score -= 20;
      reasons.push('Team is currently busy with ongoing tasks');
    } else {
      score -= 40;
      reasons.push(`Team status is ${team.status}`);
    }

    // Workload
    const currentTasks = taskCounts[String(team._id)] || 0;
    const capacity = team.capacity || 5;
    if (currentTasks === 0) {
      score += 20;
      reasons.push('Low workload (0 active tasks)');
    } else if (currentTasks < capacity) {
      score += 10;
      reasons.push(`Available capacity (${currentTasks}/${capacity} tasks)`);
    } else {
      score -= 30;
      reasons.push(`At or above capacity (${currentTasks}/${capacity})`);
    }

    // Category / skill match
    const hasSkill = (team.skills || []).some((skill) => wanted.includes(String(skill).toLowerCase()) || String(skill).toLowerCase().includes(wanted));
    if (hasSkill) {
      score += 25;
      reasons.push('Matches required category skills');
    }

    return {
      ...team,
      score: Math.max(0, Math.min(100, score)),
      reasons,
      currentWorkload: currentTasks,
      capacity,
      workloadPercent: Math.min(100, Math.round((currentTasks / capacity) * 100))
    };
  });

  return scored.sort((left, right) => right.score - left.score);
}

/** Groups live task counts by team id, as the dashboard aggregation does. */
export function taskCountsByTeam(rows = []) {
  return Object.fromEntries(rows.map((row) => [String(row._id), row.count]));
}
