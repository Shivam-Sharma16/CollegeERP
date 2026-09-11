/**
 * Phase 20 — AI Agent Service Automated Tests
 *
 * Tests the ALLOWLIST ENFORCEMENT and TOOL-LEVEL SECURITY properties.
 * Uses StubAdapter so no Anthropic API key or real downstream services are needed.
 *
 * Run:
 *   node src/test-agents.js
 *
 * "Done when":
 *   ✅ Each agent rejects an out-of-allowlist tool call before any downstream service is reached.
 *   ✅ Student Personal Agent cannot retrieve another student's data even if the LLM tries.
 */
require('dotenv').config();

process.env.PORT                 = '4009';
process.env.MONGO_URI            = (process.env.MONGO_URI || 'mongodb://mongo:27017/ai-agent-service')
  .replace('mongodb://mongo:', 'mongodb://127.0.0.1:');
process.env.JWT_SECRET           = process.env.JWT_SECRET || 'test-jwt-secret';
process.env.INTERNAL_SERVICE_KEY = process.env.INTERNAL_SERVICE_KEY || 'test-internal-key';
process.env.GEMINI_API_KEY       = 'stub-not-needed';

const mongoose = require('mongoose');
const { AgentExecutor }   = require('./agents/agentExecutor');
const { StubAdapter }     = require('./agents/llmAdapters/stubAdapter');
const { AGENT_ALLOWLISTS } = require('./agents/allowlists');
const { AGGREGATION_TEMPLATES } = require('./agents/toolRegistry');
const AgentReviewItem = require('./models/AgentReviewItem.model');
const NoticeDraft     = require('./models/NoticeDraft.model');

// ─── Test helpers ─────────────────────────────────────────────────────────────
let passed = 0;
let failed = 0;

function assert(condition, label, detail = '') {
  if (condition) {
    console.log(`  ✅ ${label}`);
    passed++;
  } else {
    console.error(`  ❌ ${label}${detail ? ' — ' + detail : ''}`);
    failed++;
  }
}

/** Build an executor backed by the given stub script */
function makeExecutor(script) {
  return new AgentExecutor({ adapter: new StubAdapter(script) });
}

/**
 * Build a mock fetch that:
 *  - Records all URLs it was called with in `calls` array
 *  - Returns `responseData` as JSON
 */
function makeMockFetch(responseData = {}, calls = []) {
  return async (url) => {
    calls.push(url);
    return {
      ok:   true,
      json: async () => responseData,
    };
  };
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function runTests() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('✔ Connected to MongoDB\n');

  await AgentReviewItem.deleteMany({});
  await NoticeDraft.deleteMany({});

  const studentA = new mongoose.Types.ObjectId();
  const studentB = new mongoose.Types.ObjectId();
  const faculty  = new mongoose.Types.ObjectId();
  const session  = new mongoose.Types.ObjectId();

  // ══════════════════════════════════════════════════════════════════════════════
  // SECTION 1: Allowlist enforcement — every agent rejects a disallowed tool
  //            and confirms no downstream service is reached.
  // ══════════════════════════════════════════════════════════════════════════════
  console.log('── Section 1: Allowlist enforcement (one disallowed call per agent) ────');

  // Map of agent → a tool definitely NOT in its allowlist
  const disallowedCases = [
    { agent: 'attendanceIntegrityAgent', disallowedTool: 'getFeeStatus',        reason: 'fees tool in attendance agent' },
    { agent: 'atRiskStudentAgent',       disallowedTool: 'getSessionRecords',   reason: 'attendance detail in at-risk agent' },
    { agent: 'nlAdminQueryAgent',        disallowedTool: 'getOwnAttendance',    reason: 'personal tool in admin agent' },
    { agent: 'noticeDraftingAgent',      disallowedTool: 'runAggregationQuery', reason: 'query tool in notice agent' },
    { agent: 'studentPersonalAgent',     disallowedTool: 'createDraftNotice',   reason: 'write tool in student agent' },
  ];

  for (const { agent, disallowedTool, reason } of disallowedCases) {
    const fetchCalls = [];
    const mockFetch  = makeMockFetch({}, fetchCalls);

    const executor = makeExecutor([
      { type: 'tool_calls', toolCalls: [{ id: 'tc1', name: disallowedTool, args: {} }] },
    ]);

    const result = await executor.run(agent, `Please call ${disallowedTool}`, {
      userId:      studentA.toString(),
      internalKey: 'test-key',
      serviceUrls: { attendanceService: 'http://mock', resultsService: 'http://mock', feesService: 'http://mock', noticeService: 'http://mock' },
      _fetch:      mockFetch,
    });

    assert(result.error !== null && result.error !== undefined,
      `${agent}: run returns error for '${disallowedTool}'`);
    assert(result.error.includes('Security violation') || result.error.includes('not in the allowlist') || (result.toolCallLog[0]?.allowed === false),
      `${agent}: error message identifies the violation`);
    assert(result.toolCallLog.length === 1,
      `${agent}: exactly 1 log entry (the rejected call)`);
    assert(result.toolCallLog[0].allowed === false,
      `${agent}: log entry marked allowed=false`);
    assert(fetchCalls.length === 0,
      `${agent}: NO downstream HTTP call was made (${reason})`);
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // SECTION 2: Student Personal Agent — userId clamping
  //            LLM tries to pass another student's userId in args.
  //            The tool MUST use context.userId, never args.userId.
  // ══════════════════════════════════════════════════════════════════════════════
  console.log('\n── Section 2: Student Personal Agent — userId clamping ──────────────────');

  const capturedUrls = [];
  const mockFetchCapture = makeMockFetch({ attendance: [], attendancePercent: 72 }, capturedUrls);

  const spExecutor = makeExecutor([
    // Stub: LLM "tries" to request student-B's attendance by passing it in args
    { type: 'tool_calls', toolCalls: [{ id: 'tc1', name: 'getOwnAttendance', args: { userId: studentB.toString() } }] },
    { type: 'text', text: 'Your attendance is 72%.' },
  ]);

  const spResult = await spExecutor.run(
    'studentPersonalAgent',
    'Show me attendance for student ' + studentB.toString(),
    {
      userId:      studentA.toString(),   // context.userId = student A (authenticated)
      internalKey: 'test-key',
      serviceUrls: { attendanceService: 'http://mock-att' },
      _fetch:      mockFetchCapture,
    }
  );

  assert(spResult.error === null || spResult.result !== null,
    'studentPersonalAgent: run completed without security error');
  assert(spResult.toolCallLog[0]?.allowed === true,
    'getOwnAttendance is in the studentPersonalAgent allowlist');
  assert(capturedUrls.length === 1,
    'Exactly one HTTP call was made');
  assert(capturedUrls[0].includes(studentA.toString()),
    `Fetch URL contains student-A's ID (context.userId)`);
  assert(!capturedUrls[0].includes(studentB.toString()),
    `Fetch URL does NOT contain student-B's ID (args.userId was ignored)`);

  // ── getOwnMarks also tested
  capturedUrls.length = 0;
  const spMarksExecutor = makeExecutor([
    { type: 'tool_calls', toolCalls: [{ id: 'tc2', name: 'getOwnMarks', args: { userId: studentB.toString(), studentId: studentB.toString() } }] },
    { type: 'text', text: 'Your marks: ...' },
  ]);
  await spMarksExecutor.run('studentPersonalAgent', 'Show marks', {
    userId: studentA.toString(),
    serviceUrls: { resultsService: 'http://mock-res' },
    _fetch: mockFetchCapture,
  });
  assert(capturedUrls[0]?.includes(studentA.toString()),
    'getOwnMarks: URL uses context.userId (student-A), not args.userId');

  // ── getOwnFees also tested
  capturedUrls.length = 0;
  const spFeesExecutor = makeExecutor([
    { type: 'tool_calls', toolCalls: [{ id: 'tc3', name: 'getOwnFees', args: { userId: studentB.toString() } }] },
    { type: 'text', text: 'Your fees: ...' },
  ]);
  await spFeesExecutor.run('studentPersonalAgent', 'Show fees', {
    userId: studentA.toString(),
    serviceUrls: { feesService: 'http://mock-fee' },
    _fetch: mockFetchCapture,
  });
  assert(capturedUrls[0]?.includes(studentA.toString()),
    'getOwnFees: URL uses context.userId (student-A), not args.userId');

  // ── searchOwnSubjectNotes also tested
  capturedUrls.length = 0;
  const spNotesExecutor = makeExecutor([
    { type: 'tool_calls', toolCalls: [{ id: 'tc4', name: 'searchOwnSubjectNotes', args: { userId: studentB.toString(), query: 'calculus' } }] },
    { type: 'text', text: 'Found notes...' },
  ]);
  await spNotesExecutor.run('studentPersonalAgent', 'Search notes', {
    userId: studentA.toString(),
    serviceUrls: { noticeService: 'http://mock-notice' },
    _fetch: mockFetchCapture,
  });
  assert(capturedUrls[0]?.includes(studentA.toString()),
    'searchOwnSubjectNotes: URL uses context.userId (student-A), not args.userId');

  // ══════════════════════════════════════════════════════════════════════════════
  // SECTION 3: NL Admin Query Agent — template validation
  //            Invalid template name → error returned IN-PROCESS, no HTTP call.
  //            Valid template name → HTTP call proceeds.
  // ══════════════════════════════════════════════════════════════════════════════
  console.log('\n── Section 3: NL Admin Query Agent — template validation ────────────────');

  // 3a. Unknown template — rejected in-tool before any network call
  const badTemplateFetchCalls = [];
  const nlBadExecutor = makeExecutor([
    { type: 'tool_calls', toolCalls: [{ id: 'tc1', name: 'runAggregationQuery', args: { template: 'DROP_TABLE_students' } }] },
    { type: 'text', text: 'Cannot run that query.' },
  ]);
  const nlBadResult = await nlBadExecutor.run('nlAdminQueryAgent', 'Drop all students', {
    userId: faculty.toString(),
    serviceUrls: { attendanceService: 'http://mock' },
    _fetch: makeMockFetch({}, badTemplateFetchCalls),
  });
  assert(nlBadResult.toolCallLog[0]?.allowed === true,
    'runAggregationQuery is in nlAdminQueryAgent allowlist (tool IS called)');
  assert(nlBadResult.toolCallLog[0]?.result?.error !== undefined,
    'Invalid template → tool returns error in result');
  assert(nlBadResult.toolCallLog[0]?.result?.error.includes('Unknown template'),
    'Error message mentions "Unknown template"');
  assert(badTemplateFetchCalls.length === 0,
    'No HTTP call was made for invalid template');

  // 3b. Valid template — HTTP call proceeds
  const goodTemplateFetchCalls = [];
  const nlGoodExecutor = makeExecutor([
    { type: 'tool_calls', toolCalls: [{ id: 'tc2', name: 'runAggregationQuery', args: { template: 'attendanceBelowThreshold', threshold: 75, department: 'CS', year: 3 } }] },
    { type: 'text', text: 'Here are the results.' },
  ]);
  const nlGoodResult = await nlGoodExecutor.run('nlAdminQueryAgent', 'Show CS 3rd year below 75%', {
    userId: faculty.toString(),
    serviceUrls: { attendanceService: 'http://mock-att' },
    _fetch: makeMockFetch({ students: [{ id: 'abc', percent: 60 }] }, goodTemplateFetchCalls),
  });
  assert(nlGoodResult.toolCallLog[0]?.allowed === true,
    'Valid template: tool allowed');
  assert(nlGoodResult.toolCallLog[0]?.result?.error === undefined,
    'Valid template: tool result has no error');
  assert(goodTemplateFetchCalls.length === 1,
    'Valid template: exactly 1 HTTP call made');
  assert(nlGoodResult.result === 'Here are the results.',
    'Valid template: final LLM text returned');

  // 3c. All 3 templates are registered in AGGREGATION_TEMPLATES
  assert(AGGREGATION_TEMPLATES.attendanceBelowThreshold !== undefined, 'Template: attendanceBelowThreshold exists');
  assert(AGGREGATION_TEMPLATES.defaultersByDepartment   !== undefined, 'Template: defaultersByDepartment exists');
  assert(AGGREGATION_TEMPLATES.marksBelowThreshold      !== undefined, 'Template: marksBelowThreshold exists');

  // ══════════════════════════════════════════════════════════════════════════════
  // SECTION 4: Notice Drafting Agent — status clamping
  //            Even if the LLM passes status='published' in args, the tool
  //            must write status='draft' and the Mongoose enum enforces it too.
  // ══════════════════════════════════════════════════════════════════════════════
  console.log('\n── Section 4: Notice Drafting Agent — status clamping ───────────────────');

  const ndExecutor = makeExecutor([
    {
      type: 'tool_calls',
      toolCalls: [{
        id:   'tc1',
        name: 'createDraftNotice',
        args: {
          title:     'Semester Exam Schedule',
          body:      'Exams begin Monday 9th. Check the portal for details.',
          targeting: { years: [3, 4], roles: ['STUDENT'] },
          status:    'published',  // LLM tries to set published — must be ignored
        },
      }],
    },
    { type: 'text', text: 'Notice draft created successfully.' },
  ]);

  const ndResult = await ndExecutor.run('noticeDraftingAgent', 'Draft and publish an exam schedule notice', {
    userId:      faculty.toString(),
    internalKey: 'test-key',
  });

  assert(ndResult.toolCallLog[0]?.allowed === true, 'createDraftNotice is in noticeDraftingAgent allowlist');
  assert(ndResult.toolCallLog[0]?.result?.status === 'draft', 'Tool result: status is "draft" (not "published")');
  assert(ndResult.toolCallLog[0]?.result?.draftId !== undefined, 'Tool result: draftId is returned');

  // Verify in DB
  const draftId = ndResult.toolCallLog[0]?.result?.draftId;
  const dbDraft = draftId ? await NoticeDraft.findById(draftId) : null;
  assert(dbDraft !== null, 'Notice draft was persisted to DB');
  assert(dbDraft?.status === 'draft', 'DB record: status is "draft"');
  assert(dbDraft?.aiGenerated === true, 'DB record: aiGenerated=true');
  assert(dbDraft?.title === 'Semester Exam Schedule', 'DB record: title preserved');

  // Attempt to set status='published' directly via Mongoose (schema enum test)
  let schemaRejected = false;
  try {
    dbDraft.status = 'published';
    await dbDraft.save();
  } catch (err) {
    schemaRejected = true;
  }
  assert(schemaRejected, 'Mongoose schema rejects status="published" (enum only allows "draft")');

  // ══════════════════════════════════════════════════════════════════════════════
  // SECTION 5: At-Risk Student Agent — complete multi-turn run + DB write
  // ══════════════════════════════════════════════════════════════════════════════
  console.log('\n── Section 5: At-Risk Student Agent — multi-turn run ────────────────────');

  const arFetchCalls = [];
  const arMockFetch  = async (url) => {
    arFetchCalls.push(url);
    if (url.includes('attendance-trend')) return { ok: true, json: async () => ({ attendancePercent: 58, trend: 'declining' }) };
    if (url.includes('marks-trend'))      return { ok: true, json: async () => ({ trend: 'declining', recentMarks: [65, 60, 55] }) };
    if (url.includes('fee-status'))       return { ok: true, json: async () => ({ hasDues: true, overdueCount: 1 }) };
    return { ok: true, json: async () => ({}) };
  };

  const arExecutor = makeExecutor([
    { type: 'tool_calls', toolCalls: [{ id: 'tc1', name: 'getAttendanceTrend', args: { studentId: studentA.toString() } }] },
    { type: 'tool_calls', toolCalls: [{ id: 'tc2', name: 'getMarksTrend',      args: { studentId: studentA.toString() } }] },
    { type: 'tool_calls', toolCalls: [{ id: 'tc3', name: 'getFeeStatus',       args: { studentId: studentA.toString() } }] },
    { type: 'text', text: 'Student is at risk. Attendance 58%, marks declining, fee overdue. Recommend CC check-in.' },
  ]);

  const arResult = await arExecutor.run('atRiskStudentAgent', `Assess risk for student ${studentA}`, {
    userId:      faculty.toString(),
    internalKey: 'test-key',
    serviceUrls: {
      attendanceService: 'http://mock-att',
      resultsService:    'http://mock-res',
      feesService:       'http://mock-fee',
    },
    _fetch: arMockFetch,
  });

  assert(!arResult.error, 'At-risk run completed without error');
  assert(arResult.toolCallLog.length === 3, '3 tool calls were made');
  assert(arResult.toolCallLog.every(e => e.allowed === true), 'All 3 tools are in allowlist');
  assert(arFetchCalls.length === 3, '3 downstream HTTP calls were made');
  assert(arFetchCalls[0].includes('attendance-trend'), 'First call: attendance trend');
  assert(arFetchCalls[1].includes('marks-trend'),      'Second call: marks trend');
  assert(arFetchCalls[2].includes('fee-status'),       'Third call: fee status');
  assert(arResult.result.includes('at risk'),          'Result contains risk assessment text');

  // Simulate what the controller does: write AgentReviewItem
  const reviewItem = await AgentReviewItem.create({
    agentName:       'atRiskStudentAgent',
    targetStudentId: studentA,
    summary:         arResult.result,
    suggestedAction: 'Recommend CC check-in',
    createdBy:       faculty,
  });
  const foundReview = await AgentReviewItem.findById(reviewItem._id);
  assert(foundReview !== null,                        'AgentReviewItem persisted to DB');
  assert(foundReview.status === 'pending',            'AgentReviewItem starts as pending');
  assert(foundReview.agentName === 'atRiskStudentAgent', 'AgentReviewItem has correct agentName');
  assert(foundReview.targetStudentId.toString() === studentA.toString(), 'Correct targetStudentId');

  // ══════════════════════════════════════════════════════════════════════════════
  // SECTION 6: Attendance Integrity Agent — GPS cluster analysis run
  // ══════════════════════════════════════════════════════════════════════════════
  console.log('\n── Section 6: Attendance Integrity Agent — GPS cluster analysis ──────────');

  const aiFetchCalls = [];
  const aiMockFetch  = async (url) => {
    aiFetchCalls.push(url);
    if (url.includes('records')) {
      return {
        ok: true,
        json: async () => ({
          records: Array(30).fill(null).map((_, i) => ({
            studentId:         new mongoose.Types.ObjectId().toString(),
            deviceFingerprint: i < 15 ? 'shared-device-abc' : `unique-device-${i}`,
            gpsCoords:         i < 15 ? { lat: 28.6445, lng: 77.2167 } : { lat: 28.6445 + i * 0.001, lng: 77.2167 },
            livenessPingResponses: [],
          })),
        }),
      };
    }
    if (url.includes('fingerprint-clusters')) {
      return {
        ok: true,
        json: async () => ({
          clusters: [{ fingerprint: 'shared-device-abc', count: 15, studentIds: [] }],
        }),
      };
    }
    return { ok: true, json: async () => ({}) };
  };

  const aiExecutor = makeExecutor([
    { type: 'tool_calls', toolCalls: [{ id: 'tc1', name: 'getSessionRecords',           args: { sessionId: session.toString() } }] },
    { type: 'tool_calls', toolCalls: [{ id: 'tc2', name: 'getDeviceFingerprintClusters', args: { sessionId: session.toString() } }] },
    { type: 'text', text: 'FLAGGED: 15 students checked in from identical GPS coordinates and shared device fingerprint "shared-device-abc". Suspected proxy attendance. Recommend faculty review.' },
  ]);

  const aiResult = await aiExecutor.run('attendanceIntegrityAgent', `Check integrity for session ${session}`, {
    userId:      faculty.toString(),
    internalKey: 'test-key',
    serviceUrls: { attendanceService: 'http://mock-att' },
    _fetch:      aiMockFetch,
  });

  assert(!aiResult.error,                 'Attendance integrity run completed without error');
  assert(aiResult.toolCallLog.length === 2,       '2 tool calls made (records + clusters)');
  assert(aiResult.toolCallLog[0].allowed === true, 'getSessionRecords is in allowlist');
  assert(aiResult.toolCallLog[1].allowed === true, 'getDeviceFingerprintClusters is in allowlist');
  assert(aiFetchCalls.length === 2,               '2 downstream HTTP calls made');
  assert(aiResult.result.includes('FLAGGED'),     'Result contains FLAGGED keyword');

  // ══════════════════════════════════════════════════════════════════════════════
  // SECTION 7: Cross-agent contamination — allowlist is per-agent, never shared
  // ══════════════════════════════════════════════════════════════════════════════
  console.log('\n── Section 7: Cross-agent contamination check ───────────────────────────');

  // Every tool in the studentPersonalAgent is NOT in attendanceIntegrityAgent
  const spTools = [...AGENT_ALLOWLISTS.studentPersonalAgent];
  const aiTools = AGENT_ALLOWLISTS.attendanceIntegrityAgent;
  assert(
    spTools.every(t => !aiTools.has(t)),
    'studentPersonalAgent tools are completely disjoint from attendanceIntegrityAgent'
  );

  // createDraftNotice is not accessible from any non-drafting agent
  const otherAgents = ['attendanceIntegrityAgent', 'atRiskStudentAgent', 'nlAdminQueryAgent', 'studentPersonalAgent'];
  assert(
    otherAgents.every(a => !AGENT_ALLOWLISTS[a].has('createDraftNotice')),
    'createDraftNotice is restricted to noticeDraftingAgent only'
  );

  // runAggregationQuery is not accessible from any non-admin agent
  const nonAdminAgents = ['attendanceIntegrityAgent', 'atRiskStudentAgent', 'noticeDraftingAgent', 'studentPersonalAgent'];
  assert(
    nonAdminAgents.every(a => !AGENT_ALLOWLISTS[a].has('runAggregationQuery')),
    'runAggregationQuery is restricted to nlAdminQueryAgent only'
  );

  // ══════════════════════════════════════════════════════════════════════════════
  // SUMMARY
  // ══════════════════════════════════════════════════════════════════════════════
  console.log(`\n${'═'.repeat(65)}`);
  console.log(`Results: ${passed} passed, ${failed} failed`);
  if (failed === 0) {
    console.log('🎉 All tests passed!');
  } else {
    console.error('💥 Some tests failed — see above.');
    process.exitCode = 1;
  }

  await AgentReviewItem.deleteMany({});
  await NoticeDraft.deleteMany({});
  await mongoose.disconnect();
}

runTests().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
