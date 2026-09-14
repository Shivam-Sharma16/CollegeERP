import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import AdminRoleManagement, { groupPermissionsByDomain } from '../pages/AdminRoleManagement';
import * as reactRedux from 'react-redux';

// ── Mock react-redux ──────────────────────────────────────────────────────────
vi.mock('react-redux', () => ({
  useSelector: vi.fn(),
  useDispatch: vi.fn(),
  useStore: vi.fn(),
  Provider: ({ children }) => <>{children}</>,
}));

// ── Mock ToastContext ────────────────────────────────────────────────────────
const mockShowToast = vi.fn();
vi.mock('../components/ui/ToastContext', () => ({
  useToast: () => ({ showToast: mockShowToast }),
}));

// ── Mock useAuth ─────────────────────────────────────────────────────────────
vi.mock('../hooks/useAuth', () => ({
  useAuth: () => ({
    user: { id: 'u1', name: 'Admin Jane', roles: ['ADMIN'], institutionId: 'inst1' },
    token: 'jwt-token',
    isAuthenticated: true,
  }),
}));

// ── Mock API hooks ────────────────────────────────────────────────────────────
const mockCreateRole = vi.fn();
const mockDeleteRole = vi.fn();
const mockAssignRole = vi.fn();

vi.mock('../api/rolesApi', () => ({
  useListCustomRolesQuery: vi.fn(),
  useCreateCustomRoleMutation: vi.fn(() => [mockCreateRole, { isLoading: false }]),
  useDeleteCustomRoleMutation: vi.fn(() => [mockDeleteRole, { isLoading: false }]),
}));

vi.mock('../api/permissionsApi', () => ({
  useGetCatalogQuery: vi.fn(),
}));

vi.mock('../api/usersApi', () => ({
  useAssignCustomRoleMutation: vi.fn(() => [mockAssignRole, { isLoading: false }]),
  useSearchUsersQuery: vi.fn(),
  useGetOwnProfileQuery: vi.fn(() => ({ data: { name: 'Admin Jane' } })),
}));

vi.mock('../api/authApi', () => ({
  useLogoutMutation: vi.fn(() => [vi.fn(), { isLoading: false }]),
}));

vi.mock('../components/student/AiAgentPanel', () => ({
  AiAgentPanel: () => <div data-testid="ai-agent-panel" />,
}));

vi.mock('../components/ui/NotificationDropdown', () => ({
  NotificationDropdown: () => <div data-testid="notification-dropdown" />,
}));

import * as rolesApi from '../api/rolesApi';
import * as permissionsApi from '../api/permissionsApi';
import * as usersApi from '../api/usersApi';

describe('Phase 80: Admin Role & Permission Builder', () => {
  const mockRoles = [
    {
      _id: 'role1',
      name: 'Fee Auditor',
      description: 'Audit fees and view reports',
      permissions: ['fees.manage', 'fees.view_reports'],
      assignedUserCount: 4,
      createdAt: '2026-03-01T10:00:00Z',
    },
    {
      _id: 'role2',
      name: 'Notice Broadcaster',
      description: 'Publishes announcements',
      permissions: ['notice.create.institution', 'notice.create.department'],
      assignedUserCount: 2,
      createdAt: '2026-03-02T10:00:00Z',
    },
  ];

  const mockCatalog = [
    'department.manage',
    'hod.manage',
    'faculty.manage',
    'cc.manage',
    'notice.create.institution',
    'notice.create.department',
    'fees.manage',
    'fees.view_reports',
    'reports.view.institution',
    'reports.view.department',
    'role.manage',
    'student.manage',
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    reactRedux.useDispatch.mockReturnValue(vi.fn());
    reactRedux.useSelector.mockReturnValue(false);

    rolesApi.useListCustomRolesQuery.mockReturnValue({
      data: mockRoles,
      isLoading: false,
      refetch: vi.fn(),
    });

    permissionsApi.useGetCatalogQuery.mockReturnValue({
      data: mockCatalog,
      isLoading: false,
    });

    usersApi.useSearchUsersQuery.mockReturnValue({
      data: [
        { _id: 'user_alice', name: 'Alice Smith', email: 'alice@college.edu', roles: ['FACULTY'] },
      ],
      isFetching: false,
    });
  });

  describe('Dynamic Catalog Grouping (groupPermissionsByDomain)', () => {
    test('groups permissions into domain categories correctly', () => {
      const groups = groupPermissionsByDomain(mockCatalog);
      const groupLabels = groups.map(g => g.label);

      expect(groupLabels).toContain('Fees & Billing');
      expect(groupLabels).toContain('Notices & Announcements');
      expect(groupLabels).toContain('Reports & Analytics');
      expect(groupLabels.some(l => l.includes('People'))).toBe(true);

      const feesGroup = groups.find(g => g.id === 'fees');
      expect(feesGroup.permissions.map(p => p.key)).toEqual(['fees.manage', 'fees.view_reports']);
    });

    test('dynamically groups NEW unknown backend permission keys with ZERO frontend code changes', () => {
      // Backend adds brand new permission keys without any frontend changes
      const backendExtendedCatalog = [
        ...mockCatalog,
        'library.book_borrow',
        'library.catalog_manage',
        'transport.route_plan',
        'hostel.room_allocate',
        'ai_agent.run_task',
      ];

      const groups = groupPermissionsByDomain(backendExtendedCatalog);

      const libraryGroup = groups.find(g => g.id === 'library');
      expect(libraryGroup).toBeDefined();
      expect(libraryGroup.label).toBe('Library');
      expect(libraryGroup.permissions.map(p => p.key)).toEqual([
        'library.book_borrow',
        'library.catalog_manage',
      ]);

      const transportGroup = groups.find(g => g.id === 'transport');
      expect(transportGroup).toBeDefined();
      expect(transportGroup.label).toBe('Transport');

      const hostelGroup = groups.find(g => g.id === 'hostel');
      expect(hostelGroup).toBeDefined();
      expect(hostelGroup.label).toBe('Hostel');

      const aiAgentGroup = groups.find(g => g.id === 'ai_agent');
      expect(aiAgentGroup).toBeDefined();
      expect(aiAgentGroup.label).toBe('Ai Agent');
    });
  });

  describe('Role List Rendering', () => {
    test('renders role list with name, permission count, and assigned-user count', () => {
      render(
        <MemoryRouter>
          <AdminRoleManagement />
        </MemoryRouter>
      );

      // Verify Role Names
      expect(screen.getByText('Fee Auditor')).toBeInTheDocument();
      expect(screen.getByText('Notice Broadcaster')).toBeInTheDocument();

      // Verify Permission Counts
      expect(screen.getAllByText('2 Permissions').length).toBe(2);

      // Verify Assigned User Counts
      expect(screen.getByText('4 Users')).toBeInTheDocument();
      expect(screen.getByText('2 Users')).toBeInTheDocument();
    });
  });

  describe('Create Role Flow', () => {
    test('renders Create Role form with dynamically grouped checkboxes and creates role', async () => {
      mockCreateRole.mockReturnValue({
        unwrap: () => Promise.resolve({ _id: 'role_new', name: 'Examiner' }),
      });

      render(
        <MemoryRouter>
          <AdminRoleManagement />
        </MemoryRouter>
      );

      // Switch to Create Role tab
      const createTab = screen.getByRole('button', { name: /create role/i });
      fireEvent.click(createTab);

      // Verify form elements appear
      expect(screen.getByPlaceholderText(/e\.g\. Fee Collector/i)).toBeInTheDocument();
      expect(screen.getByText(/Permission Catalog/i)).toBeInTheDocument();

      // Domain groups should be rendered
      expect(screen.getByText('Fees & Billing')).toBeInTheDocument();
      expect(screen.getByText('Notices & Announcements')).toBeInTheDocument();
      expect(screen.getByText('fees.manage')).toBeInTheDocument();

      // Fill in role name
      const nameInput = screen.getByPlaceholderText(/e\.g\. Fee Collector/i);
      fireEvent.change(nameInput, { target: { value: 'Examiner' } });

      // Click on a permission checkbox item
      const feeManageItem = screen.getByText('fees.manage').closest('label');
      fireEvent.click(feeManageItem);

      // Submit form
      const submitBtn = screen.getByRole('button', { name: /save & create role/i });
      expect(submitBtn).not.toBeDisabled();
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(mockCreateRole).toHaveBeenCalledWith({
          name: 'Examiner',
          description: '',
          permissions: ['fees.manage'],
        });
      });
    });
  });

  describe('Assign Role Flow', () => {
    test('renders Assign Role flow, picks user, picks role, and confirms assignment', async () => {
      mockAssignRole.mockReturnValue({
        unwrap: () => Promise.resolve({ success: true }),
      });

      render(
        <MemoryRouter>
          <AdminRoleManagement />
        </MemoryRouter>
      );

      // Switch to Assign Role tab
      const assignTab = screen.getByRole('button', { name: /assign role/i });
      fireEvent.click(assignTab);

      // Search user
      const userSearchInput = screen.getByPlaceholderText(/Search by name or email/i);
      fireEvent.change(userSearchInput, { target: { value: 'Alice' } });

      // User search result should appear
      await waitFor(() => {
        expect(screen.getByText('Alice Smith')).toBeInTheDocument();
      });

      // Select user
      fireEvent.click(screen.getByText('Alice Smith'));

      // Select custom role
      const roleSelect = screen.getByRole('combobox');
      fireEvent.change(roleSelect, { target: { value: 'role1' } });

      // Verify confirmation summary shows up
      expect(screen.getByText('3. Assignment Summary & Confirmation')).toBeInTheDocument();
      const confirmBtn = screen.getByRole('button', { name: /confirm & assign custom role/i });
      expect(confirmBtn).toBeInTheDocument();

      // Click confirm
      fireEvent.click(confirmBtn);

      await waitFor(() => {
        expect(mockAssignRole).toHaveBeenCalledWith({
          userId: 'user_alice',
          customRoleId: 'role1',
        });
      });
    });
  });
});
