const ROLES = {
  SUPERADMIN: 'SUPERADMIN',
  ADMIN: 'ADMIN',
  HOD: 'HOD',
  FACULTY: 'FACULTY',
  CC: 'CC',
  STUDENT: 'STUDENT',
  STAFF: 'STAFF'
};

const SCOPE_LEVELS = {
  GLOBAL: 'GLOBAL',
  INSTITUTION: 'INSTITUTION',
  DEPARTMENT: 'DEPARTMENT',
  SECTION: 'SECTION'
};

// Fixed catalog of granular permission keys defined by the SYSTEM.
// Admins can toggle these on/off per CustomRole, but cannot invent new keys.
const PERMISSION_CATALOG = [
  "department.manage",
  "hod.manage",
  "faculty.manage",
  "cc.manage",
  "notice.create.institution",
  "notice.create.department",
  "fees.manage",
  "fees.view_reports",
  "reports.view.institution",
  "reports.view.department",
  "role.manage",              // can this role grant/edit other custom roles
  "student.manage",
  "grievance.resolve",
  "calendar.manage",
  "certificate.issue"
];

// Implied permissions granted by fixed roles in the system hierarchy.
// Custom roles are additive on top of this.
const FIXED_ROLE_PERMISSIONS = {
  SUPERADMIN: [...PERMISSION_CATALOG],
  ADMIN: [...PERMISSION_CATALOG],
  HOD: [
    "department.manage",
    "faculty.manage",
    "cc.manage",
    "notice.create.department",
    "reports.view.department",
    "student.manage"
  ],
  FACULTY: [
    "notice.create.department"
  ],
  CC: [
    "notice.create.department",
    "student.manage"
  ],
  STUDENT: [],
  STAFF: []
};

module.exports = {
  ROLES,
  SCOPE_LEVELS,
  PERMISSION_CATALOG,
  FIXED_ROLE_PERMISSIONS
};
