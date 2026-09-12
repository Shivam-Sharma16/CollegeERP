const mongoose = require('mongoose');

/**
 * resolveScope middleware
 *
 * Runs after `authenticate`. Queries the DB for the caller's own
 * RoleAssignment(s) and populates req.callerScope:
 *   {
 *     role: 'ADMIN' | 'SUPERADMIN' | 'HOD' | 'CC' | 'FACULTY' | 'STUDENT',
 *     departmentIds: [ObjectId, ...],
 *     sectionIds:    [ObjectId, ...],
 *   }
 *
 * Controllers use req.callerScope to *rebuild* targeting from scratch,
 * never trusting raw client-supplied targeting fields.
 */
const resolveScope = async (req, res, next) => {
  try {
    if (!req.user || !req.user.userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const tenantId = req.tenantId || req.headers['x-tenant-id'] || req.user?.institutionId;
    const query = { userId: new mongoose.Types.ObjectId(req.user.userId) };
    if (tenantId) {
      try {
        query.institutionId = new mongoose.Types.ObjectId(tenantId);
      } catch {
        // if not valid objectid, keep as-is
      }
    }

    const assignments = await mongoose.connection
      .collection('roleassignments')
      .find(query)
      .toArray();

    // Derive the highest-privilege role in the set
    const ROLE_PRIORITY = ['SUPERADMIN', 'ADMIN', 'HOD', 'CC', 'FACULTY', 'STUDENT'];
    let dominantRole = 'STUDENT';
    const departmentIds = new Set();
    const sectionIds = new Set();

    for (const a of assignments) {
      if (a.role && ROLE_PRIORITY.indexOf(a.role) < ROLE_PRIORITY.indexOf(dominantRole)) {
        dominantRole = a.role;
      }
      if (a.departmentId) departmentIds.add(a.departmentId.toString());
      if (a.sectionId)    sectionIds.add(a.sectionId.toString());
    }

    // Also honour roles embedded in the JWT (e.g. SUPERADMIN has no DB assignment)
    if (req.user.roles && Array.isArray(req.user.roles)) {
      for (const r of req.user.roles) {
        if (ROLE_PRIORITY.indexOf(r) < ROLE_PRIORITY.indexOf(dominantRole)) {
          dominantRole = r;
        }
      }
    }

    req.callerScope = {
      role: dominantRole,
      departmentIds: Array.from(departmentIds).map(id => new mongoose.Types.ObjectId(id)),
      sectionIds:    Array.from(sectionIds).map(id => new mongoose.Types.ObjectId(id)),
    };

    next();
  } catch (err) {
    console.error('[resolveScope] Error:', err);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
};

module.exports = { resolveScope };
