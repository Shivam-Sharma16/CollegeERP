/**
 * AGENT_ALLOWLISTS — single source of truth for which tools each agent may call.
 *
 * These are hardcoded Sets. The AgentExecutor checks a tool name against this Set
 * BEFORE calling the tool registry. If the name is not in the Set, the call is
 * rejected immediately — the LLM's intent is irrelevant.
 *
 * To add a tool to an agent, it must be added HERE AND have an implementation in
 * toolRegistry.js. There is no dynamic registration.
 */
const AGENT_ALLOWLISTS = Object.freeze({
  attendanceIntegrityAgent: new Set([
    'getSessionRecords',
    'getDeviceFingerprintClusters',
  ]),

  atRiskStudentAgent: new Set([
    'getAttendanceTrend',
    'getMarksTrend',
    'getFeeStatus',
  ]),

  nlAdminQueryAgent: new Set([
    'runAggregationQuery',
  ]),

  noticeDraftingAgent: new Set([
    'createDraftNotice',
  ]),

  studentPersonalAgent: new Set([
    'getOwnAttendance',
    'getOwnMarks',
    'getOwnFees',
    'searchOwnSubjectNotes',
  ]),
});

/** All tool names that exist across every allowlist (union) */
const ALL_TOOL_NAMES = new Set(
  Object.values(AGENT_ALLOWLISTS).flatMap(s => [...s])
);

module.exports = { AGENT_ALLOWLISTS, ALL_TOOL_NAMES };
