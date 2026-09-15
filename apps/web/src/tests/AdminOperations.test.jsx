import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import * as reactRedux from 'react-redux';
import AdminOperations from '../pages/AdminOperations';

// ── Mock react-redux ──────────────────────────────────────────────────────────
vi.mock('react-redux', () => ({
  useSelector: vi.fn(),
  useDispatch: vi.fn(),
  useStore: vi.fn(),
  Provider: ({ children }) => <>{children}</>,
}));

// ── Mock DashboardShell ───────────────────────────────────────────────────
vi.mock('../components/DashboardShell', () => ({
  DashboardShell: ({ title, subtitle, children }) => (
    <div data-testid="dashboard-shell">
      <h1>{title}</h1>
      <p>{subtitle}</p>
      {children}
    </div>
  ),
}));

// ── Mock ToastContext ─────────────────────────────────────────────────────────
const mockShowToast = vi.fn();
vi.mock('../components/ui/ToastContext', () => ({
  useToast: () => ({ showToast: mockShowToast }),
}));

// ── Mock APIs ─────────────────────────────────────────────────────────────────
const mockBulkImport = vi.fn();
const mockRollover = vi.fn();
const mockIssueCertificate = vi.fn();
const mockResolveGrievance = vi.fn();

vi.mock('../api/usersApi', () => ({
  useBulkImportMutation: () => [mockBulkImport, { isLoading: false }],
  useSearchUsersQuery: vi.fn(),
}));

vi.mock('../api/departmentsApi', () => ({
  useListDepartmentsQuery: vi.fn(),
}));

vi.mock('../api/academicApi', () => ({
  useListYearsQuery: vi.fn(),
  useRolloverMutation: () => [mockRollover, { isLoading: false }],
}));

vi.mock('../api/certificatesApi', () => ({
  useIssueCertificateMutation: () => [mockIssueCertificate, { isLoading: false }],
}));

vi.mock('../api/grievanceApi', () => ({
  useListQuery: vi.fn(),
  useResolveMutation: () => [mockResolveGrievance, { isLoading: false }],
}));

import * as usersApi from '../api/usersApi';
import * as departmentsApi from '../api/departmentsApi';
import * as academicApi from '../api/academicApi';
import * as grievanceApi from '../api/grievanceApi';

describe('Phase 82: Admin Frontend — People, Certificates & Grievances', () => {
  const mockDepartments = [
    { _id: 'dept_cs', name: 'Computer Science', code: 'CS' },
    { _id: 'dept_ee', name: 'Electrical Engineering', code: 'EE' },
  ];

  const mockYears = [
    { _id: 'year_2026', academicYear: '2026-2027', name: '2026-2027' },
  ];

  const mockGrievances = [
    {
      _id: 'grv_1',
      title: 'Discrepancy in Mid-Sem Evaluation',
      category: 'Academics',
      student: { name: 'Aarav Sharma' },
      status: 'PENDING',
      createdAt: '2026-09-01T10:00:00Z',
    },
    {
      _id: 'grv_2',
      title: 'Lab equipment malfunction in CS Lab 3',
      category: 'Infrastructure',
      student: { name: 'Rohan Gupta' },
      status: 'RESOLVED',
      createdAt: '2026-08-25T14:00:00Z',
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    reactRedux.useDispatch.mockReturnValue(vi.fn());
    reactRedux.useSelector.mockReturnValue(false);

    departmentsApi.useListDepartmentsQuery.mockReturnValue({
      data: { data: mockDepartments },
      isLoading: false,
    });

    academicApi.useListYearsQuery.mockReturnValue({
      data: { data: mockYears },
      isLoading: false,
    });

    usersApi.useSearchUsersQuery.mockReturnValue({
      data: [
        { _id: 'std_101', name: 'Priya Patel', email: 'priya@college.edu', rollNumber: 'CS2024-042' },
      ],
      isFetching: false,
    });

    grievanceApi.useListQuery.mockReturnValue({
      data: { data: mockGrievances },
      isLoading: false,
    });

    // Mock URL.createObjectURL and revokeObjectURL
    window.URL.createObjectURL = vi.fn(() => 'blob:mock-url');
    window.URL.revokeObjectURL = vi.fn();
  });

  // ════════════════════════════════════════════════════════════════════════════
  // 1. BULK IMPORT: PER-ROW SUCCESS AND FAILURE REASONS
  // ════════════════════════════════════════════════════════════════════════════
  describe('1. Bulk Import & Per-Row Failure Reasons', () => {
    it('renders bulk import tab and drag-and-drop dropzone', () => {
      render(
        <MemoryRouter>
          <AdminOperations />
        </MemoryRouter>
      );

      expect(screen.getByRole('heading', { name: /Bulk User Import/i })).toBeInTheDocument();
      expect(screen.getByText(/Drag and drop your CSV file here/i)).toBeInTheDocument();
    });

    it('uploads CSV and displays post-upload results with distinct per-row success and specific failure reasons', async () => {
      const mockImportResponse = {
        totalRows: 3,
        importedCount: 1,
        failedCount: 2,
        successful: [
          { row: 1, email: 'student1@college.edu', name: 'John Doe', role: 'student' },
        ],
        failed: [
          { row: 2, email: 'duplicate@college.edu', error: 'Email already registered in system' },
          { row: 3, email: 'badrole@college.edu', error: 'Invalid role "Dean" specified in schema' },
        ],
      };

      mockBulkImport.mockReturnValue({
        unwrap: () => Promise.resolve(mockImportResponse),
      });

      render(
        <MemoryRouter>
          <AdminOperations />
        </MemoryRouter>
      );

      // Create and trigger file input change
      const file = new File(
        ['name,email,role\nJohn Doe,student1@college.edu,student\n'],
        'users.csv',
        { type: 'text/csv' }
      );

      // Mock FileReader
      const readAsTextMock = vi.fn().mockImplementation(function () {
        this.onload({ target: { result: 'name,email,role\nJohn Doe,student1@college.edu,student\n' } });
      });
      vi.spyOn(window, 'FileReader').mockImplementation(() => ({
        readAsText: readAsTextMock,
        onload: null,
      }));

      const input = document.getElementById('csv-file-input');
      fireEvent.change(input, { target: { files: [file] } });

      // Click Process Bulk Import
      await waitFor(() => {
        expect(screen.getByText(/Process Bulk Import/i)).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText(/Process Bulk Import/i));

      // Check mutation was executed
      await waitFor(() => {
        expect(mockBulkImport).toHaveBeenCalled();
      });

      // Verify Summary Cards
      expect(screen.getByText('Total Rows')).toBeInTheDocument();
      expect(screen.getByText('Successfully Imported')).toBeInTheDocument();
      expect(screen.getByText('Failed Rows')).toBeInTheDocument();

      // CRITICAL ACCEPTANCE CRITERIA:
      // The results table clearly distinguishes successful rows from failed ones
      // with the specific failure reason per row, not a single aggregate error count!
      expect(screen.getByText('student1@college.edu')).toBeInTheDocument();
      expect(screen.getByText('duplicate@college.edu')).toBeInTheDocument();
      expect(screen.getByText('badrole@college.edu')).toBeInTheDocument();

      // Per-row specific failure reasons
      expect(screen.getByText('Email already registered in system')).toBeInTheDocument();
      expect(screen.getByText('Invalid role "Dean" specified in schema')).toBeInTheDocument();
      expect(screen.getByText('Imported successfully')).toBeInTheDocument();

      // Status badges
      const successBadges = screen.getAllByText('SUCCESS');
      const failedBadges = screen.getAllByText('FAILED');
      expect(successBadges.length).toBeGreaterThan(0);
      expect(failedBadges.length).toBe(2);
    });
  });

  // ════════════════════════════════════════════════════════════════════════════
  // 2. ACADEMIC ROLLOVER ACTION WITH CONFIRM DIALOG
  // ════════════════════════════════════════════════════════════════════════════
  describe('2. Academic Rollover Action', () => {
    it('switches to Rollover tab, previews exact impact, and executes on confirmation', async () => {
      mockRollover.mockReturnValue({
        unwrap: () => Promise.resolve({ success: true, message: 'Rollover completed' }),
      });

      render(
        <MemoryRouter>
          <AdminOperations />
        </MemoryRouter>
      );

      // Switch tab
      fireEvent.click(screen.getByRole('button', { name: /Academic Rollover/i }));

      expect(screen.getByRole('heading', { name: /Academic Rollover/i })).toBeInTheDocument();

      // Select Department
      const deptSelect = screen.getByLabelText(/Department/i);
      fireEvent.change(deptSelect, { target: { value: 'dept_cs' } });

      // Select Semester
      const semSelect = screen.getByLabelText(/Current Semester/i);
      fireEvent.change(semSelect, { target: { value: '3' } });

      // Student count input
      const countInput = screen.getByLabelText(/Enrolled Students/i);
      fireEvent.change(countInput, { target: { value: '247' } });

      // Verify exact projected wording
      const expectedText = '247 students in Computer Science will move from Sem 3 to Sem 4';
      expect(screen.getByText(expectedText)).toBeInTheDocument();

      // Click Execute Rollover Action
      fireEvent.click(screen.getByRole('button', { name: /Execute Rollover Action/i }));

      // Confirm Dialog must explicitly name what will change
      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /Confirm Academic Rollover/i })).toBeInTheDocument();
      });

      const confirmMatches = screen.getAllByText(new RegExp(expectedText, 'i'));
      expect(confirmMatches.length).toBeGreaterThanOrEqual(2);

      // Confirm in dialog
      const executeBtn = screen.getByRole('button', { name: 'Execute Rollover' });
      fireEvent.click(executeBtn);

      await waitFor(() => {
        expect(mockRollover).toHaveBeenCalledWith(
          expect.objectContaining({
            departmentId: 'dept_cs',
            currentSemesterNumber: 3,
          })
        );
      });

      expect(mockShowToast).toHaveBeenCalledWith(
        expect.stringContaining('Rollover completed: 247 students in Computer Science will move from Sem 3 to Sem 4'),
        'success'
      );
    });
  });

  // ════════════════════════════════════════════════════════════════════════════
  // 3. CERTIFICATE ISSUANCE & DOWNLOAD
  // ════════════════════════════════════════════════════════════════════════════
  describe('3. Certificate Issue Form', () => {
    it('searches student, chooses certificate type, and generates download', async () => {
      const mockBlob = new Blob(['mock-pdf-binary'], { type: 'application/pdf' });
      mockIssueCertificate.mockReturnValue({
        unwrap: () => Promise.resolve(mockBlob),
      });

      render(
        <MemoryRouter>
          <AdminOperations />
        </MemoryRouter>
      );

      // Switch to Issue Certificates
      fireEvent.click(screen.getByRole('button', { name: /Issue Certificates/i }));

      expect(screen.getByRole('heading', { name: /Issue Student Certificate/i })).toBeInTheDocument();

      // Search student
      const searchInput = screen.getByPlaceholderText(/Type name, email, or roll number/i);
      fireEvent.change(searchInput, { target: { value: 'Priya' } });

      // Select student from search results
      await waitFor(() => {
        expect(screen.getByText('Priya Patel')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByText('Priya Patel'));

      // Selected card appears
      expect(screen.getByText('priya@college.edu • CS2024-042')).toBeInTheDocument();

      // Select certificate type
      const certSelect = screen.getByLabelText(/Certificate Type/i);
      fireEvent.change(certSelect, { target: { value: 'bonafide' } });

      // Fill purpose
      const purposeInput = screen.getByLabelText(/Purpose of Issuance/i);
      fireEvent.change(purposeInput, { target: { value: 'Higher Education Visa' } });

      // Submit form
      const submitBtn = screen.getByRole('button', { name: /Generate & Download Certificate/i });
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(mockIssueCertificate).toHaveBeenCalledWith({
          type: 'bonafide',
          studentId: 'std_101',
          purpose: 'Higher Education Visa',
          reason: '',
        });
      });

      expect(window.URL.createObjectURL).toHaveBeenCalled();
      expect(mockShowToast).toHaveBeenCalledWith(
        expect.stringContaining('Bonafide certificate downloaded successfully!'),
        'success'
      );
    });
  });

  // ════════════════════════════════════════════════════════════════════════════
  // 4. GRIEVANCE INBOX: FILTER & RESOLVE
  // ════════════════════════════════════════════════════════════════════════════
  describe('4. Grievance Inbox & Resolution', () => {
    it('lists grievances, filters status, and resolves with notes', async () => {
      mockResolveGrievance.mockReturnValue({
        unwrap: () => Promise.resolve({ success: true }),
      });

      render(
        <MemoryRouter>
          <AdminOperations />
        </MemoryRouter>
      );

      // Switch tab
      fireEvent.click(screen.getByRole('button', { name: /Grievance Inbox/i }));

      expect(screen.getByRole('heading', { name: /Grievance Inbox/i })).toBeInTheDocument();

      // Verify list content
      expect(screen.getByText('Discrepancy in Mid-Sem Evaluation')).toBeInTheDocument();
      expect(screen.getByText('Aarav Sharma')).toBeInTheDocument();
      expect(screen.getAllByText('PENDING').length).toBeGreaterThanOrEqual(2);
      expect(screen.getByText('Lab equipment malfunction in CS Lab 3')).toBeInTheDocument();

      // Click "Resolve" on the pending grievance
      const resolveBtns = screen.getAllByRole('button', { name: 'Resolve' });
      fireEvent.click(resolveBtns[0]);

      // Resolution Modal opens
      await waitFor(() => {
        expect(screen.getByRole('heading', { name: 'Resolve Grievance' })).toBeInTheDocument();
      });

      const notesInput = screen.getByLabelText(/Resolution Notes & Action Taken/i);
      fireEvent.change(notesInput, {
        target: { value: 'Reviewed answer sheets with subject teacher; awarded 2 corrected marks.' },
      });

      // Confirm Resolution
      fireEvent.click(screen.getByRole('button', { name: 'Confirm Resolution' }));

      await waitFor(() => {
        expect(mockResolveGrievance).toHaveBeenCalledWith({
          id: 'grv_1',
          resolutionNotes: 'Reviewed answer sheets with subject teacher; awarded 2 corrected marks.',
        });
      });

      expect(mockShowToast).toHaveBeenCalledWith('Grievance resolved successfully', 'success');
    });

    it('changes filter pill when clicked', () => {
      render(
        <MemoryRouter>
          <AdminOperations />
        </MemoryRouter>
      );

      fireEvent.click(screen.getByRole('button', { name: /Grievance Inbox/i }));

      const pendingPill = screen.getByRole('button', { name: 'PENDING' });
      fireEvent.click(pendingPill);

      expect(grievanceApi.useListQuery).toHaveBeenCalledWith({ status: 'PENDING' });
    });
  });
});
