const { AgentExecutor }        = require('../agents/agentExecutor');
const { GeminiAdapter }        = require('../agents/llmAdapters/geminiAdapter');
const AgentReviewItem          = require('../models/AgentReviewItem.model');
const attendanceIntegrityAgent = require('../agents/attendanceIntegrityAgent');
const atRiskStudentAgent       = require('../agents/atRiskStudentAgent');
const nlAdminQueryAgent        = require('../agents/nlAdminQueryAgent');
const noticeDraftingAgent      = require('../agents/noticeDraftingAgent');
const studentPersonalAgent     = require('../agents/studentPersonalAgent');
const env                      = require('../config/env');

/** Build a production context from req.user and env */
function buildContext(req) {
  const tenantId = req.tenantId || req.headers['x-tenant-id'] || req.user?.institutionId || null;
  return {
    userId:        req.user.userId || req.user.id || req.user._id,
    tenantId:      tenantId,
    institutionId: tenantId,
    internalKey:   env.INTERNAL_SERVICE_KEY,
    serviceUrls: {
      attendanceService: env.ATTENDANCE_SERVICE_URL,
      resultsService:    env.RESULTS_SERVICE_URL,
      feesService:       env.FEES_SERVICE_URL,
      noticeService:     env.NOTICE_SERVICE_URL,
    },
    // _fetch is not set here — tools use the global fetch
  };
}

/** Build production executor (uses real Gemini SDK) */
function buildExecutor() {
  const adapter = new GeminiAdapter(env.GEMINI_API_KEY);
  return new AgentExecutor({ adapter });
}

// ─── POST /api/agents/attendance-integrity ────────────────────────────────────
const runAttendanceIntegrity = async (req, res) => {
  try {
    const { sessionId, prompt } = req.body;
    if (!sessionId) return res.status(400).json({ success: false, error: 'sessionId required' });

    const context  = buildContext(req);
    const executor = buildExecutor();
    const userPrompt = prompt || `Analyse attendance integrity for session ${sessionId}. Check for GPS clusters and shared device fingerprints.`;

    const { result, error, toolCallLog } = await executor.run(
      attendanceIntegrityAgent.agentName,
      userPrompt,
      context,
      { systemPrompt: attendanceIntegrityAgent.systemPrompt }
    );

    if (error) return res.status(500).json({ success: false, error, toolCallLog });

    // Write flagged students to review queue (controller responsibility, not agent)
    if (result && result.toLowerCase().includes('flagged')) {
      const tenantId = req.tenantId || req.headers['x-tenant-id'] || req.user?.institutionId;
      await AgentReviewItem.create({
        institutionId:   tenantId,
        agentName:       'attendanceIntegrityAgent',
        targetStudentId: req.user.userId || req.user.id, // placeholder — real impl parses result
        sessionId:       sessionId,
        summary:         result,
        suggestedAction: 'Faculty review required',
        createdBy:       req.user.userId || req.user.id,
      });
    }

    return res.json({ success: true, data: { result, toolCallLog } });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};

// ─── POST /api/agents/at-risk ─────────────────────────────────────────────────
const runAtRisk = async (req, res) => {
  try {
    const { studentId, prompt } = req.body;
    if (!studentId) return res.status(400).json({ success: false, error: 'studentId required' });

    const context  = buildContext(req);
    const executor = buildExecutor();
    const userPrompt = prompt || `Assess academic risk for student ${studentId}.`;

    const { result, error, toolCallLog } = await executor.run(
      atRiskStudentAgent.agentName,
      userPrompt,
      context,
      { systemPrompt: atRiskStudentAgent.systemPrompt }
    );

    if (error) return res.status(500).json({ success: false, error, toolCallLog });

    // Write to pending-review queue
    const tenantId = req.tenantId || req.headers['x-tenant-id'] || req.user?.institutionId;
    const reviewItem = await AgentReviewItem.create({
      institutionId:   tenantId,
      agentName:       'atRiskStudentAgent',
      targetStudentId: studentId,
      summary:         result || 'No risk detected',
      suggestedAction: result?.match(/recommend (.+?)[.;]/i)?.[1] || '',
      createdBy:       req.user.userId || req.user.id,
    });

    return res.json({ success: true, data: { result, reviewItemId: reviewItem._id, toolCallLog } });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};

// ─── POST /api/agents/nl-query ────────────────────────────────────────────────
const runNlQuery = async (req, res) => {
  try {
    const { prompt } = req.body;
    if (!prompt) return res.status(400).json({ success: false, error: 'prompt required' });

    const context  = buildContext(req);
    const executor = buildExecutor();

    const { result, error, toolCallLog } = await executor.run(
      nlAdminQueryAgent.agentName,
      prompt,
      context,
      { systemPrompt: nlAdminQueryAgent.systemPrompt }
    );

    if (error) return res.status(500).json({ success: false, error, toolCallLog });
    return res.json({ success: true, data: { result, toolCallLog } });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};

// ─── POST /api/agents/notice-draft ───────────────────────────────────────────
const runNoticeDraft = async (req, res) => {
  try {
    const { prompt } = req.body;
    if (!prompt) return res.status(400).json({ success: false, error: 'prompt required' });

    const context  = buildContext(req);
    const executor = buildExecutor();

    const { result, error, toolCallLog } = await executor.run(
      noticeDraftingAgent.agentName,
      prompt,
      context,
      { systemPrompt: noticeDraftingAgent.systemPrompt }
    );

    if (error) return res.status(500).json({ success: false, error, toolCallLog });
    return res.json({ success: true, data: { result, toolCallLog } });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};

// ─── POST /api/agents/student-personal ───────────────────────────────────────
const runStudentPersonal = async (req, res) => {
  try {
    const { prompt } = req.body;
    if (!prompt) return res.status(400).json({ success: false, error: 'prompt required' });

    const context  = buildContext(req);
    const executor = buildExecutor();

    const { result, error, toolCallLog } = await executor.run(
      studentPersonalAgent.agentName,
      prompt,
      context,
      { systemPrompt: studentPersonalAgent.systemPrompt }
    );

    if (error) return res.status(500).json({ success: false, error, toolCallLog });
    return res.json({ success: true, data: { result, toolCallLog } });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};

// ─── GET /api/agents/review-items ───────────────────────────────────────────
const getReviewItems = async (req, res) => {
  try {
    const tenantId = req.tenantId || req.headers['x-tenant-id'] || req.user?.institutionId;
    const { status, agentName } = req.query;

    const filter = {};
    if (tenantId) filter.institutionId = tenantId;
    if (status) filter.status = status;
    if (agentName) filter.agentName = agentName;

    const items = await AgentReviewItem.find(filter).sort({ createdAt: -1 }).lean();
    return res.json({ success: true, data: items });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};

// ─── GET /api/agents/review-items/:id ───────────────────────────────────────
const getReviewItemById = async (req, res) => {
  try {
    const tenantId = req.tenantId || req.headers['x-tenant-id'] || req.user?.institutionId;
    const { id } = req.params;

    const query = { _id: id };
    if (tenantId) query.institutionId = tenantId;

    const item = await AgentReviewItem.findOne(query).lean();
    if (!item) {
      return res.status(404).json({ success: false, error: 'Review item not found' });
    }

    return res.json({ success: true, data: item });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};

module.exports = {
  runAttendanceIntegrity,
  runAtRisk,
  runNlQuery,
  runNoticeDraft,
  runStudentPersonal,
  getReviewItems,
  getReviewItemById,
};
