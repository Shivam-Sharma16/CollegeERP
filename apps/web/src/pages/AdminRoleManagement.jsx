import { useState, useMemo, useEffect } from 'react';
import { DashboardShell } from '../components/DashboardShell';
import { Table } from '../components/ui/Table';
import { Button } from '../components/ui/Button';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { Modal } from '../components/ui/Modal';
import { EmptyState } from '../components/ui/EmptyState';
import { Skeleton } from '../components/ui/Skeleton';
import { useToast } from '../components/ui/ToastContext';
import { PageTransition } from '../components/ui/PageTransition';

import {
  useListCustomRolesQuery,
  useCreateCustomRoleMutation,
  useDeleteCustomRoleMutation,
} from '../api/rolesApi';
import { useGetCatalogQuery } from '../api/permissionsApi';
import {
  useAssignCustomRoleMutation,
  useSearchUsersQuery,
} from '../api/usersApi';

import {
  Shield,
  ShieldCheck,
  Users,
  UserPlus,
  Plus,
  Search,
  CheckCircle2,
  Trash2,
  Key,
  Layers,
  FileText,
  UserCheck,
} from 'lucide-react';

import styles from './AdminRoleManagement.module.css';

/**
 * Dynamic domain grouping utility:
 * Groups any arbitrary list of permission keys (e.g. "fees.manage", "notice.create", "custom.domain.action")
 * into humanized domain buckets dynamically.
 * Adding any new permission key backend-side requires ZERO frontend code changes to appear in the builder.
 */
export function groupPermissionsByDomain(catalog = []) {
  if (!Array.isArray(catalog) || catalog.length === 0) return [];

  // Known domain label enhancements; any unknown key falls back gracefully
  const domainMeta = {
    fees: { id: 'fees', label: 'Fees & Billing', icon: 'Wallet' },
    notice: { id: 'notices', label: 'Notices & Announcements', icon: 'Megaphone' },
    reports: { id: 'reports', label: 'Reports & Analytics', icon: 'BarChart' },
    role: { id: 'roles', label: 'Roles & Security', icon: 'Shield' },
    department: { id: 'departments', label: 'Department Structure', icon: 'Building' },
    hod: { id: 'people', label: 'People (HODs)', icon: 'Users' },
    faculty: { id: 'people', label: 'People (Faculty)', icon: 'Users' },
    cc: { id: 'people', label: 'People (Class Coordinators)', icon: 'Users' },
    student: { id: 'people', label: 'People (Students)', icon: 'Users' },
    grievance: { id: 'grievances', label: 'Grievance Resolution', icon: 'AlertCircle' },
    calendar: { id: 'calendar', label: 'Academic Calendar', icon: 'Calendar' },
    certificate: { id: 'certificates', label: 'Certificates & Documents', icon: 'Award' },
  };

  const groups = {};

  for (const perm of catalog) {
    if (typeof perm !== 'string') continue;
    const parts = perm.split('.');
    const prefix = parts[0]?.toLowerCase() || 'general';

    const meta = domainMeta[prefix] || {
      id: prefix,
      label: prefix.split(/[-_]/).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
    };

    if (!groups[meta.id]) {
      groups[meta.id] = {
        id: meta.id,
        label: meta.label,
        permissions: [],
      };
    }

    // Format human-friendly action text from the rest of the key
    const actionParts = parts.slice(1);
    const actionFormatted = actionParts.length > 0
      ? actionParts.map(p => p.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())).join(' — ')
      : 'Access';

    groups[meta.id].permissions.push({
      key: perm,
      label: actionFormatted,
      displayKey: perm,
    });
  }

  return Object.values(groups);
}

export default function AdminRoleManagement() {
  const { showToast } = useToast();

  // Queries & Mutations
  const { data: rolesData, isLoading: isRolesLoading, refetch: refetchRoles } = useListCustomRolesQuery();
  const { data: catalogData, isLoading: isCatalogLoading } = useGetCatalogQuery();
  const [createCustomRole, { isLoading: isCreating }] = useCreateCustomRoleMutation();
  const [deleteCustomRole, { isLoading: isDeleting }] = useDeleteCustomRoleMutation();
  const [assignCustomRole, { isLoading: isAssigning }] = useAssignCustomRoleMutation();

  // Primary active tab: 'roles' | 'create' | 'assign'
  const [activeTab, setActiveTab] = useState('roles');

  // Role list search & sorting
  const [roleSearch, setRoleSearch] = useState('');
  const [sortCol, setSortCol] = useState('name');
  const [sortDir, setSortDir] = useState('asc');

  // Create Role Form state
  const [newRoleName, setNewRoleName] = useState('');
  const [newRoleDesc, setNewRoleDesc] = useState('');
  const [selectedPermissions, setSelectedPermissions] = useState(new Set());
  const [permSearch, setPermSearch] = useState('');

  // Assign Role Flow state
  const [userQuery, setUserQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [selectedUser, setSelectedUser] = useState(null);
  const [selectedRoleId, setSelectedRoleId] = useState('');

  // Inspect Permissions Modal
  const [inspectRole, setInspectRole] = useState(null);

  // Delete Confirmation Dialog
  const [roleToDelete, setRoleToDelete] = useState(null);

  // Debounce user search input
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedQuery(userQuery.trim());
    }, 300);
    return () => clearTimeout(handler);
  }, [userQuery]);

  const { data: searchResults, isFetching: isSearchingUsers } = useSearchUsersQuery(
    debouncedQuery,
    { skip: debouncedQuery.length < 2 }
  );

  // Raw roles list
  const roles = useMemo(() => {
    const raw = Array.isArray(rolesData?.data) ? rolesData.data : Array.isArray(rolesData) ? rolesData : [];
    return raw;
  }, [rolesData]);

  // Raw permissions catalog
  const catalog = useMemo(() => {
    const raw = Array.isArray(catalogData?.data) ? catalogData.data : Array.isArray(catalogData) ? catalogData : [];
    return raw;
  }, [catalogData]);

  // Grouped permissions (zero frontend change needed for backend catalog additions)
  const groupedPermissions = useMemo(() => {
    return groupPermissionsByDomain(catalog);
  }, [catalog]);

  // Filtered permission domain groups for builder
  const filteredDomainGroups = useMemo(() => {
    if (!permSearch.trim()) return groupedPermissions;
    const q = permSearch.toLowerCase().trim();

    return groupedPermissions
      .map(group => {
        const matchesGroup = group.label.toLowerCase().includes(q);
        const filteredPerms = group.permissions.filter(p =>
          matchesGroup || p.key.toLowerCase().includes(q) || p.label.toLowerCase().includes(q)
        );
        return { ...group, permissions: filteredPerms };
      })
      .filter(group => group.permissions.length > 0);
  }, [groupedPermissions, permSearch]);

  // Stats calculation
  const totalAssignedUsers = useMemo(() => {
    return roles.reduce((sum, r) => sum + (r.assignedUserCount || r.assignedUsersCount || 0), 0);
  }, [roles]);

  // Filtered roles list for table
  const filteredRoles = useMemo(() => {
    let list = [...roles];
    if (roleSearch.trim()) {
      const q = roleSearch.toLowerCase().trim();
      list = list.filter(r =>
        r.name?.toLowerCase().includes(q) ||
        r.description?.toLowerCase().includes(q)
      );
    }
    list.sort((a, b) => {
      let aVal = a[sortCol];
      let bVal = b[sortCol];
      if (sortCol === 'permissionCount') {
        aVal = a.permissions?.length || 0;
        bVal = b.permissions?.length || 0;
      } else if (sortCol === 'assignedUserCount') {
        aVal = a.assignedUserCount || a.assignedUsersCount || 0;
        bVal = b.assignedUserCount || b.assignedUsersCount || 0;
      } else if (typeof aVal === 'string') {
        aVal = aVal.toLowerCase();
        bVal = (bVal || '').toLowerCase();
      }
      if (aVal < bVal) return sortDir === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
    return list;
  }, [roles, roleSearch, sortCol, sortDir]);

  // ── Permission Checkbox Toggle Handlers ─────────────────────────────────────
  const togglePermission = (key) => {
    setSelectedPermissions(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const toggleDomainGroup = (group) => {
    const groupKeys = group.permissions.map(p => p.key);
    const allSelected = groupKeys.every(k => selectedPermissions.has(k));

    setSelectedPermissions(prev => {
      const next = new Set(prev);
      if (allSelected) {
        groupKeys.forEach(k => next.delete(k));
      } else {
        groupKeys.forEach(k => next.add(k));
      }
      return next;
    });
  };

  const selectAllPermissions = () => {
    setSelectedPermissions(new Set(catalog));
  };

  const clearAllPermissions = () => {
    setSelectedPermissions(new Set());
  };

  // ── Create Role Submit ──────────────────────────────────────────────────────
  const handleCreateRole = async (e) => {
    e.preventDefault();
    if (!newRoleName.trim()) {
      showToast('Please enter a role name', 'error');
      return;
    }
    if (selectedPermissions.size === 0) {
      showToast('Please select at least one permission', 'error');
      return;
    }

    try {
      await createCustomRole({
        name: newRoleName.trim(),
        description: newRoleDesc.trim(),
        permissions: Array.from(selectedPermissions),
      }).unwrap();

      showToast(`Custom role "${newRoleName.trim()}" created successfully!`, 'success');
      setNewRoleName('');
      setNewRoleDesc('');
      setSelectedPermissions(new Set());
      setPermSearch('');
      setActiveTab('roles');
      refetchRoles();
    } catch (err) {
      const msg = err?.data?.error || err?.data?.message || err?.message || 'Failed to create role';
      showToast(msg, 'error');
    }
  };

  // ── Delete Role Submit ──────────────────────────────────────────────────────
  const handleDeleteRoleConfirm = async () => {
    if (!roleToDelete) return;
    try {
      await deleteCustomRole(roleToDelete._id).unwrap();
      showToast(`Role "${roleToDelete.name}" deleted successfully`, 'success');
      setRoleToDelete(null);
      refetchRoles();
    } catch (err) {
      const msg = err?.data?.error || err?.data?.message || err?.message || 'Failed to delete role';
      showToast(msg, 'error');
    }
  };

  // ── Assign Role Submit ──────────────────────────────────────────────────────
  const handleAssignRoleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedUser) {
      showToast('Please select a target user', 'error');
      return;
    }
    if (!selectedRoleId) {
      showToast('Please select a custom role to assign', 'error');
      return;
    }

    try {
      await assignCustomRole({
        userId: selectedUser._id,
        customRoleId: selectedRoleId,
      }).unwrap();

      const assignedRoleObj = roles.find(r => r._id === selectedRoleId);
      showToast(`Assigned "${assignedRoleObj?.name || 'Role'}" to ${selectedUser.name}`, 'success');
      setSelectedUser(null);
      setUserQuery('');
      setSelectedRoleId('');
      setActiveTab('roles');
      refetchRoles();
    } catch (err) {
      const msg = err?.data?.error || err?.data?.message || err?.message || 'Failed to assign role';
      showToast(msg, 'error');
    }
  };

  // Quick action: jump to assign tab with role pre-selected
  const openAssignForRole = (role) => {
    setSelectedRoleId(role._id);
    setActiveTab('assign');
  };

  // Table Columns Definition
  const roleColumns = [
    {
      key: 'name',
      label: 'Role Name',
      sortable: true,
      render: (_, row) => (
        <div className={styles.roleNameCell}>
          <span className={styles.roleNameText}>{row.name}</span>
          {row.description && <span className={styles.roleDescText}>{row.description}</span>}
        </div>
      ),
    },
    {
      key: 'permissionCount',
      label: 'Permission Count',
      sortable: true,
      render: (_, row) => (
        <button
          className={styles.badgePrimary}
          onClick={() => setInspectRole(row)}
          title="Click to view permissions"
          style={{ cursor: 'pointer', border: 'none' }}
        >
          <Key size={13} />
          {row.permissions?.length || 0} Permissions
        </button>
      ),
    },
    {
      key: 'assignedUserCount',
      label: 'Assigned Users',
      sortable: true,
      render: (_, row) => (
        <span className={styles.badgeSuccess}>
          <Users size={13} />
          {row.assignedUserCount ?? row.assignedUsersCount ?? 0} Users
        </span>
      ),
    },
    {
      key: 'createdAt',
      label: 'Created Date',
      sortable: true,
      render: (val) => val ? new Date(val).toLocaleDateString() : 'N/A',
    },
    {
      key: 'actions',
      label: 'Actions',
      sortable: false,
      render: (_, row) => (
        <div className={styles.actionsGroup}>
          <Button
            size="sm"
            variant="outline"
            onClick={() => openAssignForRole(row)}
            title="Assign user to this role"
          >
            <UserPlus size={14} style={{ marginRight: 4 }} />
            Assign
          </Button>
          <Button
            size="sm"
            variant="danger"
            onClick={() => setRoleToDelete(row)}
            title="Delete custom role"
          >
            <Trash2 size={14} />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <DashboardShell
      title="Roles & Permissions"
      subtitle="Define granular custom roles and assign authorization bundles dynamically."
      icon="Shield"
    >
      <PageTransition>
        <div className={styles.container}>
          {/* ── Top Stat Cards ────────────────────────────────────────── */}
          <div className={styles.statsGrid}>
            <div className={styles.statCard}>
              <div className={styles.statIconWrapper}>
                <Shield size={22} />
              </div>
              <div className={styles.statInfo}>
                <span className={styles.statValue}>{roles.length}</span>
                <span className={styles.statLabel}>Custom Roles</span>
              </div>
            </div>

            <div className={styles.statCard}>
              <div className={styles.statIconWrapper} style={{ background: 'rgba(34, 197, 94, 0.12)', color: '#4ade80' }}>
                <UserCheck size={22} />
              </div>
              <div className={styles.statInfo}>
                <span className={styles.statValue}>{totalAssignedUsers}</span>
                <span className={styles.statLabel}>Active Role Assignments</span>
              </div>
            </div>

            <div className={styles.statCard}>
              <div className={styles.statIconWrapper} style={{ background: 'rgba(56, 189, 248, 0.12)', color: '#38bdf8' }}>
                <Key size={22} />
              </div>
              <div className={styles.statInfo}>
                <span className={styles.statValue}>{catalog.length}</span>
                <span className={styles.statLabel}>System Catalog Permissions</span>
              </div>
            </div>
          </div>

          {/* ── Main Tabbed Panel ─────────────────────────────────────── */}
          <div className={styles.mainCard}>
            <div className={styles.tabHeader}>
              <button
                className={`${styles.tabBtn} ${activeTab === 'roles' ? styles.tabBtnActive : ''}`}
                onClick={() => setActiveTab('roles')}
              >
                <Layers size={16} />
                Role List
                <span className={styles.tabBadge}>{roles.length}</span>
              </button>

              <button
                className={`${styles.tabBtn} ${activeTab === 'create' ? styles.tabBtnActive : ''}`}
                onClick={() => setActiveTab('create')}
              >
                <Plus size={16} />
                Create Role
              </button>

              <button
                className={`${styles.tabBtn} ${activeTab === 'assign' ? styles.tabBtnActive : ''}`}
                onClick={() => setActiveTab('assign')}
              >
                <UserPlus size={16} />
                Assign Role
              </button>
            </div>

            <div className={styles.contentPadding}>
              {/* ── TAB 1: Role List ───────────────────────────────────── */}
              {activeTab === 'roles' && (
                <>
                  <div className={styles.toolbar}>
                    <div className={styles.searchBox}>
                      <Search size={16} className={styles.searchIcon} />
                      <input
                        type="text"
                        placeholder="Search custom roles..."
                        value={roleSearch}
                        onChange={(e) => setRoleSearch(e.target.value)}
                        className={styles.searchInput}
                      />
                    </div>
                    <Button onClick={() => setActiveTab('create')} size="sm">
                      <Plus size={16} style={{ marginRight: 6 }} />
                      New Custom Role
                    </Button>
                  </div>

                  {isRolesLoading ? (
                    <Skeleton height="260px" />
                  ) : filteredRoles.length === 0 ? (
                    <EmptyState
                      title="No Custom Roles Found"
                      description={roleSearch ? "No roles match your search query." : "No custom roles created yet. Use the Role Builder to define granular permissions."}
                      actionLabel={!roleSearch ? "Create First Role" : undefined}
                      onAction={!roleSearch ? () => setActiveTab('create') : undefined}
                    />
                  ) : (
                    <Table
                      columns={roleColumns}
                      data={filteredRoles}
                      sortColumn={sortCol}
                      sortDirection={sortDir}
                      onSort={(col) => {
                        if (sortCol === col) setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
                        else { setSortCol(col); setSortDir('asc'); }
                      }}
                    />
                  )}
                </>
              )}

              {/* ── TAB 2: Create Role (Permission Builder) ────────────── */}
              {activeTab === 'create' && (
                <form onSubmit={handleCreateRole} className={styles.formCard}>
                  <div className={styles.formGrid}>
                    <div className={styles.formGroup}>
                      <label className={styles.formLabel}>Role Name *</label>
                      <input
                        type="text"
                        placeholder="e.g. Fee Collector, Exam Auditor"
                        value={newRoleName}
                        onChange={(e) => setNewRoleName(e.target.value)}
                        className={styles.formInput}
                        required
                      />
                    </div>
                    <div className={styles.formGroup}>
                      <label className={styles.formLabel}>Description</label>
                      <input
                        type="text"
                        placeholder="Brief summary of duties granted by this role"
                        value={newRoleDesc}
                        onChange={(e) => setNewRoleDesc(e.target.value)}
                        className={styles.formInput}
                      />
                    </div>
                  </div>

                  {/* Section: Dynamic Grouped Permissions */}
                  <div className={styles.permissionSectionHeader}>
                    <div className={styles.sectionTitleGroup}>
                      <ShieldCheck size={18} color="var(--color-primary-light)" />
                      <span className={styles.sectionTitle}>Permission Catalog</span>
                      <span className={styles.badgePrimary}>
                        {selectedPermissions.size} of {catalog.length} selected
                      </span>
                    </div>

                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <div className={styles.searchBox} style={{ width: '220px' }}>
                        <Search size={14} className={styles.searchIcon} />
                        <input
                          type="text"
                          placeholder="Filter permissions..."
                          value={permSearch}
                          onChange={(e) => setPermSearch(e.target.value)}
                          className={styles.searchInput}
                          style={{ padding: '6px 10px 6px 32px', fontSize: '0.8rem' }}
                        />
                      </div>
                      <Button type="button" variant="outline" size="sm" onClick={selectAllPermissions}>
                        Select All
                      </Button>
                      <Button type="button" variant="ghost" size="sm" onClick={clearAllPermissions}>
                        Clear
                      </Button>
                    </div>
                  </div>

                  {isCatalogLoading ? (
                    <Skeleton height="300px" />
                  ) : filteredDomainGroups.length === 0 ? (
                    <EmptyState
                      title="No Permissions Found"
                      description="No permissions match your search filter."
                    />
                  ) : (
                    <div className={styles.domainGroupsContainer}>
                      {filteredDomainGroups.map((group) => {
                        const groupKeys = group.permissions.map(p => p.key);
                        const selectedInGroup = groupKeys.filter(k => selectedPermissions.has(k)).length;
                        const isAllGroupSelected = selectedInGroup === groupKeys.length;

                        return (
                          <div key={group.id} className={styles.domainCard}>
                            <div className={styles.domainHeader}>
                              <div className={styles.domainTitleBox}>
                                <span style={{ fontWeight: 600, color: 'var(--color-text)' }}>
                                  {group.label}
                                </span>
                                <span className={styles.domainBadge}>
                                  {selectedInGroup} / {group.permissions.length}
                                </span>
                              </div>
                              <button
                                type="button"
                                className={styles.domainToggleBtn}
                                onClick={() => toggleDomainGroup(group)}
                              >
                                {isAllGroupSelected ? 'Deselect All in Group' : 'Select All in Group'}
                              </button>
                            </div>

                            <div className={styles.checkboxGrid}>
                              {group.permissions.map((perm) => {
                                const isChecked = selectedPermissions.has(perm.key);
                                return (
                                  <label
                                    key={perm.key}
                                    className={`${styles.permissionItem} ${isChecked ? styles.permissionItemSelected : ''}`}
                                    onClick={(e) => {
                                      e.preventDefault();
                                      togglePermission(perm.key);
                                    }}
                                  >
                                    <input
                                      type="checkbox"
                                      className={styles.permCheckbox}
                                      checked={isChecked}
                                      onChange={() => {}} // Handled by container label click
                                    />
                                    <div className={styles.permissionContent}>
                                      <span className={styles.permissionLabel}>{perm.label}</span>
                                      <span className={styles.permissionKey}>{perm.displayKey}</span>
                                    </div>
                                  </label>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  <div className={styles.formActionBar}>
                    <div className={styles.selectedSummary}>
                      <CheckCircle2 size={16} color="var(--color-success)" />
                      <span>
                        Role will grant <strong>{selectedPermissions.size}</strong> permission(s).
                      </span>
                    </div>
                    <div style={{ display: 'flex', gap: '10px' }}>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setActiveTab('roles')}
                      >
                        Cancel
                      </Button>
                      <Button
                        type="submit"
                        disabled={isCreating || !newRoleName.trim() || selectedPermissions.size === 0}
                      >
                        {isCreating ? 'Creating Role...' : 'Save & Create Role'}
                      </Button>
                    </div>
                  </div>
                </form>
              )}

              {/* ── TAB 3: Assign Role Flow ────────────────────────────── */}
              {activeTab === 'assign' && (
                <form onSubmit={handleAssignRoleSubmit} className={styles.assignContainer}>
                  {/* Left Column: Pick User & Pick Role */}
                  <div className={styles.assignSection}>
                    <div className={styles.sectionHeader}>
                      <Search size={18} />
                      1. Pick User (Search)
                    </div>

                    <div className={styles.searchBox} style={{ width: '100%' }}>
                      <Search size={16} className={styles.searchIcon} />
                      <input
                        type="text"
                        placeholder="Search by name or email (min 2 chars)..."
                        value={userQuery}
                        onChange={(e) => setUserQuery(e.target.value)}
                        className={styles.searchInput}
                      />
                    </div>

                    {isSearchingUsers && <Skeleton height="60px" />}

                    {debouncedQuery.length >= 2 && !isSearchingUsers && (
                      <div className={styles.userSearchResults}>
                        {(!searchResults || searchResults.length === 0) ? (
                          <div style={{ padding: '16px', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>
                            No users found matching "{debouncedQuery}".
                          </div>
                        ) : (
                          searchResults.map((u) => {
                            const isSelected = selectedUser?._id === u._id;
                            const initials = (u.name || 'U').split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
                            return (
                              <div
                                key={u._id}
                                className={`${styles.userRow} ${isSelected ? styles.userRowSelected : ''}`}
                                onClick={() => setSelectedUser(u)}
                              >
                                <div className={styles.userInfo}>
                                  <div className={styles.userAvatar}>{initials}</div>
                                  <div className={styles.userMeta}>
                                    <span className={styles.userName}>{u.name}</span>
                                    <span className={styles.userEmail}>{u.email}</span>
                                  </div>
                                </div>
                                {u.roles && u.roles.length > 0 && (
                                  <span className={styles.userBadge}>{u.roles.join(', ')}</span>
                                )}
                              </div>
                            );
                          })
                        )}
                      </div>
                    )}

                    {selectedUser && (
                      <div className={styles.selectedSummaryCard} style={{ borderColor: 'var(--color-primary)' }}>
                        <div className={styles.summaryRow}>
                          <span className={styles.summaryLabel}>Selected User:</span>
                          <span className={styles.summaryValue}>{selectedUser.name}</span>
                        </div>
                        <div className={styles.summaryRow}>
                          <span className={styles.summaryLabel}>Email:</span>
                          <span style={{ fontSize: '0.825rem', color: 'var(--color-text-muted)' }}>{selectedUser.email}</span>
                        </div>
                      </div>
                    )}

                    <div className={styles.sectionHeader} style={{ marginTop: '12px' }}>
                      <Shield size={18} />
                      2. Pick Custom Role
                    </div>

                    <select
                      className={styles.formSelect}
                      value={selectedRoleId}
                      onChange={(e) => setSelectedRoleId(e.target.value)}
                    >
                      <option value="">-- Choose a custom role --</option>
                      {roles.map((r) => (
                        <option key={r._id} value={r._id}>
                          {r.name} ({r.permissions?.length || 0} permissions)
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Right Column: Confirmation Summary */}
                  <div className={styles.assignSection}>
                    <div className={styles.sectionHeader}>
                      <CheckCircle2 size={18} color="var(--color-success)" />
                      3. Assignment Summary & Confirmation
                    </div>

                    {(!selectedUser || !selectedRoleId) ? (
                      <div style={{ padding: '30px 20px', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                        Select both a user and a custom role from the left panel to review and confirm assignment.
                      </div>
                    ) : (
                      <div className={styles.selectedSummaryCard}>
                        <div className={styles.summaryRow}>
                          <span className={styles.summaryLabel}>Target User:</span>
                          <span className={styles.summaryValue}>{selectedUser.name}</span>
                        </div>
                        <div className={styles.summaryRow}>
                          <span className={styles.summaryLabel}>User Email:</span>
                          <span style={{ fontSize: '0.85rem' }}>{selectedUser.email}</span>
                        </div>
                        <div className={styles.summaryRow}>
                          <span className={styles.summaryLabel}>Custom Role:</span>
                          <span className={styles.summaryValue} style={{ color: 'var(--color-primary-light)' }}>
                            {roles.find(r => r._id === selectedRoleId)?.name}
                          </span>
                        </div>
                        <div className={styles.summaryRow}>
                          <span className={styles.summaryLabel}>Permissions Granted:</span>
                          <span className={styles.badgePrimary}>
                            {roles.find(r => r._id === selectedRoleId)?.permissions?.length || 0} Permissions
                          </span>
                        </div>

                        <div style={{ marginTop: '8px' }}>
                          <span className={styles.summaryLabel} style={{ display: 'block', marginBottom: '4px' }}>
                            Included Permissions:
                          </span>
                          <div className={styles.permissionTagList}>
                            {roles.find(r => r._id === selectedRoleId)?.permissions?.map(p => (
                              <span key={p} className={styles.permissionTag}>{p}</span>
                            ))}
                          </div>
                        </div>

                        <div style={{ marginTop: '16px' }}>
                          <Button
                            type="submit"
                            style={{ width: '100%' }}
                            disabled={isAssigning}
                          >
                            {isAssigning ? 'Assigning Role...' : 'Confirm & Assign Custom Role'}
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                </form>
              )}
            </div>
          </div>

          {/* ── Modal: Inspect Role Permissions ───────────────────────── */}
          {inspectRole && (
            <Modal
              isOpen={Boolean(inspectRole)}
              onClose={() => setInspectRole(null)}
              title={`Role Permissions: ${inspectRole.name}`}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {inspectRole.description && (
                  <p style={{ fontSize: '0.9rem', color: 'var(--color-text-muted)' }}>
                    {inspectRole.description}
                  </p>
                )}
                <div>
                  <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--color-text)', display: 'block', marginBottom: '8px' }}>
                    Granted Permissions ({inspectRole.permissions?.length || 0}):
                  </span>
                  <div className={styles.permissionTagList} style={{ maxHeight: '280px' }}>
                    {inspectRole.permissions?.map(p => (
                      <span key={p} className={styles.permissionTag}>{p}</span>
                    ))}
                  </div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '10px' }}>
                  <Button variant="outline" size="sm" onClick={() => setInspectRole(null)}>
                    Close
                  </Button>
                </div>
              </div>
            </Modal>
          )}

          {/* ── Dialog: Confirm Delete Role ───────────────────────────── */}
          {roleToDelete && (
            <ConfirmDialog
              isOpen={Boolean(roleToDelete)}
              title="Delete Custom Role"
              message={`Are you sure you want to delete custom role "${roleToDelete.name}"? This action cannot be undone.`}
              confirmLabel={isDeleting ? 'Deleting...' : 'Delete Role'}
              variant="danger"
              onConfirm={handleDeleteRoleConfirm}
              onCancel={() => setRoleToDelete(null)}
            />
          )}
        </div>
      </PageTransition>
    </DashboardShell>
  );
}
