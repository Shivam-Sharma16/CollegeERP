export const NAV_ITEMS = [
  // SuperAdmin
  { key: "superadmin-dashboard", label: "Dashboard",           icon: "Home",       path: "/superadmin/dashboard",    roles: ["superadmin"] },
  { key: "management",           label: "Management",          icon: "Building",   path: "/superadmin/institutions", roles: ["superadmin"] },
  { key: "settings",             label: "Institution Settings",icon: "Settings",   path: "/superadmin/institutions", roles: ["superadmin"] },

  // Admin
  { key: "admin-dashboard",      label: "Dashboard",           icon: "Home",       path: "/admin/dashboard",         roles: ["admin"] },
  { key: "hods",                 label: "HODs",                icon: "UserTie",    path: "/admin/hods",              roles: ["admin"] },
  { key: "admin-reports",        label: "Reports",             icon: "BarChart",   path: "/admin/reports",           roles: ["admin"] },
  { key: "fee-policy",           label: "Fee Policy",          icon: "Wallet",     path: "/admin/fee-policy",        roles: ["admin"] },
  { key: "inst-notices",         label: "Institution Notices",  icon: "Megaphone",  path: "/admin/notices",           roles: ["admin"] },

  // HOD
  { key: "hod-dashboard",        label: "Dashboard",           icon: "Home",       path: "/hod/dashboard",           roles: ["hod"] },
  { key: "hod-management",       label: "Staff Management",     icon: "Users",      path: "/hod/management",          roles: ["hod"] },
  { key: "academic",             label: "Academic Structure",   icon: "Layers",     path: "/hod/academic-structure",  roles: ["hod"] },
  { key: "assignments",          label: "Teaching Assignments", icon: "Link",       path: "/hod/assignments",         roles: ["hod"] },
  { key: "hod-reports",          label: "Reports",             icon: "BarChart",   path: "/hod/reports",             roles: ["hod"] },

  // CC
  { key: "cc-dashboard",         label: "Dashboard",           icon: "Home",       path: "/cc/dashboard",            roles: ["cc"] },
  { key: "roster",               label: "Student Roster",       icon: "List",       path: "/cc/roster",               roles: ["cc"] },
  { key: "disputes",             label: "Attendance Disputes",  icon: "Flag",       path: "/cc/workspace?tab=disputes", roles: ["cc"] },
  { key: "cc-notices",           label: "Notices",              icon: "Bell",       path: "/cc/workspace?tab=notices",roles: ["cc"] },

  // Faculty
  { key: "faculty-dashboard",    label: "Dashboard",           icon: "Home",       path: "/faculty/dashboard",       roles: ["faculty"] },
  { key: "notes",                label: "Notes",               icon: "FileText",   path: "/faculty/notes",           roles: ["faculty"] },
  { key: "marks-entry",          label: "Marks Entry",          icon: "Edit",       path: "/faculty/marks-entry",     roles: ["faculty"] },
  { key: "analytics",            label: "Subject Analytics",    icon: "BarChart2",  path: "/faculty/analytics",       roles: ["faculty"] },

  // Student
  { key: "student-dashboard",    label: "Dashboard",           icon: "Home",       path: "/student/dashboard",       roles: ["student"] },
  { key: "attendance",           label: "Attendance",           icon: "CheckSquare",path: "/student/attendance",      roles: ["student"] },
  { key: "results",              label: "Results",              icon: "Award",      path: "/student/transcript",      roles: ["student"] },
  { key: "fees",                 label: "Fees",                 icon: "CreditCard", path: "/student/fees",            roles: ["student"] },
  { key: "notices",              label: "Notices",              icon: "Bell",       path: "/student/notices",         roles: ["student"] },

  // Profile (shared)
  { key: "profile",              label: "Profile",              icon: "User",       path: "/profile",                 roles: ["superadmin","admin","hod","cc","faculty","student"] },
];
