import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import AdminReports from '../pages/AdminReports';
import AdminFeePolicy, { FEE_GROUPS } from '../pages/AdminFeePolicy';
import * as reactRedux from 'react-redux';

// ── Mock react-redux ──────────────────────────────────────────────────────────
vi.mock('react-redux', () => ({
  useSelector: vi.fn(),
  useDispatch: vi.fn(),
  useStore: vi.fn(),
  Provider: ({ children }) => <>{children}</>,
}));

// ── Mock ToastContext & useAuth ───────────────────────────────────────────────
const mockShowToast = vi.fn();
vi.mock('../components/ui/ToastContext', () => ({
  useToast: () => ({ showToast: mockShowToast }),
}));

vi.mock('../hooks/useAuth', () => ({
  useAuth: () => ({
    user: { id: 'admin1', name: 'Admin Jane', roles: ['ADMIN'], institutionId: 'inst1' },
    token: 'jwt-token',
    isAuthenticated: true,
  }),
}));

vi.mock('../api/authApi', () => ({
  useLogoutMutation: vi.fn(() => [vi.fn(), { isLoading: false }]),
}));

vi.mock('../api/usersApi', () => ({
  useGetOwnProfileQuery: vi.fn(() => ({ data: { name: 'Admin Jane' } })),
}));

vi.mock('../components/ui/NotificationDropdown', () => ({
  NotificationDropdown: () => <div data-testid="notification-dropdown" />,
}));

vi.mock('../components/student/AiAgentPanel', () => ({
  AiAgentPanel: () => <div data-testid="ai-agent-panel" />,
}));

// ── Mock Recharts (renders lightweight mocks for jsdom) ───────────────────────
vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }) => <div>{children}</div>,
  BarChart: ({ children }) => <div data-testid="bar-chart">{children}</div>,
  LineChart: ({ children }) => <div data-testid="line-chart">{children}</div>,
  Bar: () => <div data-testid="bar" />,
  Line: () => <div data-testid="line" />,
  XAxis: () => <div />,
  YAxis: () => <div />,
  CartesianGrid: () => <div />,
  Tooltip: () => <div />,
  Legend: () => <div />,
}));

// ── Mock APIs ─────────────────────────────────────────────────────────────────
vi.mock('../api/departmentsApi', () => ({
  useListDepartmentsQuery: vi.fn(),
}));

vi.mock('../api/reportsApi', () => ({
  useGetOverviewQuery: vi.fn(),
  useGetAttendanceTrendQuery: vi.fn(),
  useGetAcademicPerformanceQuery: vi.fn(),
  useGetFacultyWorkloadQuery: vi.fn(),
}));

const mockCreateFeeStructure = vi.fn();
vi.mock('../api/feesApi', () => ({
  useListFeeStructuresQuery: vi.fn(),
  useGetDefaultersQuery: vi.fn(),
  useCreateFeeStructureMutation: vi.fn(() => [mockCreateFeeStructure, { isLoading: false }]),
}));

import * as departmentsApi from '../api/departmentsApi';
import * as reportsApi from '../api/reportsApi';
import * as feesApi from '../api/feesApi';

describe('Phase 81: Analytics Dashboard & Fee Groups', () => {
  const mockDepartments = [
    { _id: 'dept_cse', name: 'Computer Science', code: 'CSE' },
    { _id: 'dept_ece', name: 'Electronics', code: 'ECE' },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    reactRedux.useDispatch.mockReturnValue(vi.fn());
    reactRedux.useSelector.mockReturnValue(false);

    departmentsApi.useListDepartmentsQuery.mockReturnValue({
      data: { data: mockDepartments },
      isLoading: false,
    });
  });

  // ════════════════════════════════════════════════════════════════════════════
  // 1. Analytics Dashboard Tests
  // ════════════════════════════════════════════════════════════════════════════
  describe('Analytics Dashboard & Department Filter', () => {
    beforeEach(() => {
      reportsApi.useGetOverviewQuery.mockReturnValue({
        data: {
          overall: { totalStudents: 150, totalFaculty: 25, totalDepartments: 2 },
          departments: [
            { departmentId: 'dept_cse', name: 'Computer Science', code: 'CSE', totalStudents: 100, totalFaculty: 15 },
            { departmentId: 'dept_ece', name: 'Electronics', code: 'ECE', totalStudents: 50, totalFaculty: 10 },
          ],
        },
        isFetching: false,
        isError: false,
      });

      reportsApi.useGetAttendanceTrendQuery.mockReturnValue({
        data: {
          trend: [
            { date: '2026-03-01', attendancePercentage: 85 },
            { date: '2026-03-02', attendancePercentage: 90 },
          ],
        },
        isFetching: false,
        isError: false,
      });

      reportsApi.useGetAcademicPerformanceQuery.mockReturnValue({
        data: {
          trend: [
            { examType: 'Midterm', averagePercentage: 78, passingRate: 88 },
            { examType: 'Finals', averagePercentage: 82, passingRate: 92 },
          ],
        },
        isFetching: false,
        isError: false,
      });

      reportsApi.useGetFacultyWorkloadQuery.mockReturnValue({
        data: {
          facultyWorkload: [
            { facultyId: 'f1', name: 'Dr. Alan Turing', totalSubjects: 3, totalSections: 4, isOverloaded: false },
          ],
        },
        isFetching: false,
        isError: false,
      });
    });

    test('renders 4 analytics chart cards using Phase 36 report-builder pattern', () => {
      render(
        <MemoryRouter>
          <AdminReports />
        </MemoryRouter>
      );

      // Verify the 4 chart titles exist
      expect(screen.getByText('Student / Faculty Counts')).toBeInTheDocument();
      expect(screen.getByText('Attendance Trend')).toBeInTheDocument();
      expect(screen.getByText('Academic Performance')).toBeInTheDocument();
      expect(screen.getByText('Faculty Workload')).toBeInTheDocument();

      // Verify department select is rendered
      expect(screen.getByLabelText(/Department/i)).toBeInTheDocument();
      expect(screen.getByText('Computer Science')).toBeInTheDocument();
      expect(screen.getByText('Electronics')).toBeInTheDocument();
    });

    test('switching department filter refetches all 4 analytics cards together with departmentId', () => {
      render(
        <MemoryRouter>
          <AdminReports />
        </MemoryRouter>
      );

      // Initially all 4 hooks called with departmentId: undefined (all departments)
      expect(reportsApi.useGetOverviewQuery).toHaveBeenCalledWith({ departmentId: undefined });
      expect(reportsApi.useGetAttendanceTrendQuery).toHaveBeenCalledWith({ departmentId: undefined });
      expect(reportsApi.useGetAcademicPerformanceQuery).toHaveBeenCalledWith({ departmentId: undefined });
      expect(reportsApi.useGetFacultyWorkloadQuery).toHaveBeenCalledWith({ departmentId: undefined });

      // Switch department filter to 'dept_cse'
      const deptSelect = screen.getByLabelText(/Department/i);
      fireEvent.change(deptSelect, { target: { value: 'dept_cse', name: 'departmentId' } });

      // All 4 hooks refetched synchronously with { departmentId: 'dept_cse' }
      expect(reportsApi.useGetOverviewQuery).toHaveBeenCalledWith({ departmentId: 'dept_cse' });
      expect(reportsApi.useGetAttendanceTrendQuery).toHaveBeenCalledWith({ departmentId: 'dept_cse' });
      expect(reportsApi.useGetAcademicPerformanceQuery).toHaveBeenCalledWith({ departmentId: 'dept_cse' });
      expect(reportsApi.useGetFacultyWorkloadQuery).toHaveBeenCalledWith({ departmentId: 'dept_cse' });
    });
  });

  // ════════════════════════════════════════════════════════════════════════════
  // 2. Fee Management & Fee Groups Tests
  // ════════════════════════════════════════════════════════════════════════════
  describe('Fee Management Page & Groups', () => {
    const mockFeeStructures = [
      {
        _id: 'fs1',
        departmentId: 'dept_cse',
        year: 2,
        semester: 3,
        studentGroup: 'general',
        totalAmount: 50000,
        installments: [{ label: 'Inst 1', amount: 25000, dueDate: '2026-04-01' }],
        createdAt: '2026-03-01T10:00:00Z',
      },
      {
        _id: 'fs2',
        departmentId: 'dept_cse',
        year: 2,
        semester: 3,
        studentGroup: 'tfws',
        totalAmount: 15000,
        installments: [{ label: 'Inst 1', amount: 15000, dueDate: '2026-04-01' }],
        createdAt: '2026-03-01T10:00:00Z',
      },
    ];

    const mockAllDefaulters = [
      {
        _id: 'u1',
        name: 'Bob Marley',
        email: 'bob@college.edu',
        feeGroup: 'general',
        yearNumber: 2,
        overdueInstallments: [{ amount: 25000 }],
      },
      {
        _id: 'u2',
        name: 'John Doe',
        email: 'john@college.edu',
        feeGroup: 'general',
        yearNumber: 2,
        overdueInstallments: [{ amount: 25000 }],
      },
      {
        _id: 'u3',
        name: 'Alice Wonder',
        email: 'alice@college.edu',
        feeGroup: 'tfws',
        yearNumber: 2,
        overdueInstallments: [{ amount: 15000 }],
      },
    ];

    beforeEach(() => {
      feesApi.useListFeeStructuresQuery.mockReturnValue({
        data: { data: mockFeeStructures },
        isLoading: false,
        refetch: vi.fn(),
      });

      // Default defaulters query return
      feesApi.useGetDefaultersQuery.mockImplementation((params) => {
        if (!params?.feeGroup) {
          return { data: { data: mockAllDefaulters }, isLoading: false, isFetching: false };
        }
        const filtered = mockAllDefaulters.filter(d => d.feeGroup === params.feeGroup);
        return { data: { data: filtered }, isLoading: false, isFetching: false };
      });
    });

    test('renders table of FeeStructures with Year × Semester × Group visible columns', () => {
      render(
        <MemoryRouter>
          <AdminFeePolicy />
        </MemoryRouter>
      );

      // Verify column headers exist
      expect(screen.getByText('Year')).toBeInTheDocument();
      expect(screen.getByText('Semester')).toBeInTheDocument();
      expect(screen.getByText('Group')).toBeInTheDocument();

      // Verify row values: Year 2, Sem 3, General & TFWS badges
      expect(screen.getAllByText('Year 2').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Sem 3').length).toBeGreaterThan(0);
      expect(screen.getByText('General')).toBeInTheDocument();
      expect(screen.getByText('TFWS')).toBeInTheDocument();
    });

    test('opens Add Fee Structure modal with Group selector and submits', async () => {
      mockCreateFeeStructure.mockReturnValue({
        unwrap: () => Promise.resolve({ _id: 'new_fs' }),
      });

      render(
        <MemoryRouter>
          <AdminFeePolicy />
        </MemoryRouter>
      );

      // Click Add Fee Structure button
      const addBtn = screen.getByRole('button', { name: /add fee structure/i });
      fireEvent.click(addBtn);

      // Modal should open
      expect(screen.getByRole('heading', { name: 'Add Fee Structure' })).toBeInTheDocument();
      expect(screen.getByLabelText(/Fee Group/i)).toBeInTheDocument();

      // Verify group options (General, TFWS, Management, etc.)
      const groupSelect = screen.getByLabelText(/Fee Group/i);
      expect(screen.getByText('TFWS Group')).toBeInTheDocument();
      expect(screen.getByText('Management Group')).toBeInTheDocument();

      // Fill in modal form
      fireEvent.change(screen.getByLabelText(/Department/i), { target: { value: 'dept_cse' } });
      fireEvent.change(groupSelect, { target: { value: 'tfws' } });
      fireEvent.change(screen.getByLabelText(/Total Amount/i), { target: { value: '20000' } });

      // Installment amount matches total
      const installmentAmountInput = screen.getByPlaceholderText(/Amount \(₹\)/i);
      fireEvent.change(installmentAmountInput, { target: { value: '20000' } });

      const dueDateInput = document.querySelector('input[type="date"]');
      if (dueDateInput) fireEvent.change(dueDateInput, { target: { value: '2026-05-01' } });

      // Submit modal
      const saveBtn = screen.getByRole('button', { name: /save fee structure/i });
      fireEvent.click(saveBtn);

      await waitFor(() => {
        expect(mockCreateFeeStructure).toHaveBeenCalledWith(
          expect.objectContaining({
            departmentId: 'dept_cse',
            studentGroup: 'tfws',
            feeGroup: 'tfws',
            totalAmount: 20000,
          })
        );
      });
    });

    test('renders Defaulters view with side-by-side group comparison and re-segments when group filter changes', () => {
      render(
        <MemoryRouter>
          <AdminFeePolicy />
        </MemoryRouter>
      );

      // Switch to Defaulters tab
      const defaultersTab = screen.getByRole('button', { name: /defaulters & group comparison/i });
      fireEvent.click(defaultersTab);

      // Verify side-by-side comparison counters
      // mockAllDefaulters has 2 General and 1 TFWS
      expect(screen.getByText('General: 2 defaulters')).toBeInTheDocument();
      expect(screen.getByText('TFWS: 1 defaulter')).toBeInTheDocument();

      // Both general and TFWS defaulters initially visible
      expect(screen.getByText('Bob Marley')).toBeInTheDocument();
      expect(screen.getByText('John Doe')).toBeInTheDocument();
      expect(screen.getByText('Alice Wonder')).toBeInTheDocument();

      // Click on TFWS group toggle button
      const tfwsToggle = screen.getByRole('button', { name: /TFWS \(1\)/i });
      fireEvent.click(tfwsToggle);

      // useGetDefaultersQuery called with { feeGroup: 'tfws' }
      expect(feesApi.useGetDefaultersQuery).toHaveBeenCalledWith({ feeGroup: 'tfws' });
    });
  });
});
