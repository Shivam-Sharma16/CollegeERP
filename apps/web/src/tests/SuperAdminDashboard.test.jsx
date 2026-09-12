import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import SuperAdminDashboard from '../pages/SuperAdminDashboard';
import * as institutionsApi from '../api/institutionsApi';
import * as reportsApi from '../api/reportsApi';

// ── Mock DashboardShell ──
vi.mock('../components/DashboardShell', () => ({
  DashboardShell: ({ title, subtitle, children }) => (
    <div data-testid="dashboard-shell">
      <h1>{title}</h1>
      <p>{subtitle}</p>
      {children}
    </div>
  ),
}));

// ── Mock UI Animation & Card Components ──
vi.mock('../components/ui/StatCard', () => ({
  StatCard: ({ title, value }) => (
    <div data-testid={`stat-${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`}>
      <span data-testid="stat-title">{title}</span>
      <span data-testid="stat-value">{value}</span>
    </div>
  ),
}));

vi.mock('../components/ui/StaggerList', () => ({
  StaggerList: ({ children, className }) => <div className={className}>{children}</div>,
  StaggerItem: ({ children }) => <div>{children}</div>,
}));

vi.mock('../components/ui/PageTransition', () => ({
  PageTransition: ({ children }) => <>{children}</>,
}));

vi.mock('../components/institutions/CreateInstitutionModal', () => ({
  CreateInstitutionModal: ({ isOpen, onClose }) =>
    isOpen ? (
      <div data-testid="create-institution-modal">
        <h2>Create New Institution</h2>
        <label htmlFor="inst-name">Institution Name</label>
        <input id="inst-name" />
        <button onClick={onClose}>Close</button>
      </div>
    ) : null,
}));

// ── Mock ToastContext ──
const mockShowToast = vi.fn();
vi.mock('../components/ui/ToastContext', () => ({
  useToast: vi.fn(() => ({ showToast: mockShowToast, addToast: vi.fn() })),
}));

// ── Mock APIs ──
vi.mock('../api/institutionsApi', () => ({
  useListInstitutionsQuery: vi.fn(),
  useUpdateInstitutionMutation: vi.fn(),
  useCreateInstitutionMutation: vi.fn(() => [vi.fn(), { isLoading: false }]),
  useLazyCheckSubdomainAvailabilityQuery: vi.fn(() => [
    vi.fn().mockReturnValue({
      unwrap: () => Promise.resolve({ success: true, data: { available: true } }),
    }),
    { isFetching: false },
  ]),
}));

vi.mock('../api/reportsApi', () => ({
  useGetDashboardStatsQuery: vi.fn(),
}));

describe('SuperAdminDashboard (Phase 72)', () => {
  const mockUpdateInstitution = vi.fn();

  const mockInstitutions = [
    {
      _id: 'inst-1',
      name: 'Apex Institute of Technology',
      code: 'AIT',
      subdomain: 'apex-tech',
      slug: 'apex-tech',
      isActive: true,
      status: 'ACTIVE',
      studentCount: 1420,
      facultyCount: 85,
      departmentCount: 6,
      createdAt: new Date().toISOString(), // Created this month
      adminUserId: {
        _id: 'u-admin-1',
        name: 'Dr. Jane Smith',
        email: 'admin@apex.edu',
      },
      branding: {
        primaryColor: '#4f46e5',
      },
    },
    {
      _id: 'inst-2',
      name: 'Beacon College of Engineering',
      code: 'BCE',
      subdomain: 'beacon-eng',
      slug: 'beacon-eng',
      isActive: false,
      status: 'SUSPENDED',
      studentCount: 640,
      facultyCount: 42,
      departmentCount: 4,
      createdAt: '2024-01-15T00:00:00.000Z', // Past date
      adminUserId: {
        _id: 'u-admin-2',
        name: 'Prof. Alan Turing',
        email: 'admin@beacon.edu',
      },
      branding: {
        primaryColor: '#0ea5e9',
      },
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();

    institutionsApi.useListInstitutionsQuery.mockReturnValue({
      data: mockInstitutions,
      isLoading: false,
    });

    institutionsApi.useUpdateInstitutionMutation.mockReturnValue([
      mockUpdateInstitution.mockReturnValue({
        unwrap: () => Promise.resolve({ success: true }),
      }),
      { isLoading: false },
    ]);

    reportsApi.useGetDashboardStatsQuery.mockReturnValue({
      data: {
        data: {
          totalStudents: 2060,
          totalFaculty: 127,
          totalDepartments: 10,
        },
      },
      isLoading: false,
    });
  });

  const renderDashboard = () => {
    return render(
      <MemoryRouter>
        <SuperAdminDashboard />
      </MemoryRouter>
    );
  };

  it('renders all 4 top platform metric stat cards', () => {
    renderDashboard();

    // 1. Total Institutions
    const instCard = screen.getByTestId('stat-total-institutions');
    expect(instCard).toHaveTextContent('Total Institutions');
    expect(instCard).toHaveTextContent('2');

    // 2. Total Students platform-wide
    const studentsCard = screen.getByTestId('stat-total-students-platform-wide');
    expect(studentsCard).toHaveTextContent('Total Students platform-wide');
    expect(studentsCard).toHaveTextContent('2060');

    // 3. Total Admins
    const adminsCard = screen.getByTestId('stat-total-admins');
    expect(adminsCard).toHaveTextContent('Total Admins');
    expect(adminsCard).toHaveTextContent('2');

    // 4. Institutions Created This Month
    const createdCard = screen.getByTestId('stat-institutions-created-this-month');
    expect(createdCard).toHaveTextContent('Institutions Created This Month');
    expect(createdCard).toHaveTextContent('1'); // only inst-1 has createdAt in this month
  });

  it('renders responsive institution cards with logo, name, subdomain link, and counts', () => {
    renderDashboard();

    // Institution Names
    expect(screen.getByText('Apex Institute of Technology')).toBeInTheDocument();
    expect(screen.getByText('Beacon College of Engineering')).toBeInTheDocument();

    // Campus Code badges
    expect(screen.getByText('AIT')).toBeInTheDocument();
    expect(screen.getByText('BCE')).toBeInTheDocument();

    // Subdomain links
    const apexLink = screen.getByRole('link', { name: /\/inst\/apex-tech\/login/i });
    expect(apexLink).toHaveAttribute('href', '/inst/apex-tech/login');

    const beaconLink = screen.getByRole('link', { name: /\/inst\/beacon-eng\/login/i });
    expect(beaconLink).toHaveAttribute('href', '/inst/beacon-eng/login');

    // Counts
    expect(screen.getByText('1420')).toBeInTheDocument(); // Apex students
    expect(screen.getByText('85')).toBeInTheDocument(); // Apex faculty
    expect(screen.getByText('6')).toBeInTheDocument(); // Apex depts
  });

  it('toggles institution active/inactive status via updateInstitution mutation', async () => {
    renderDashboard();

    // inst-1 is currently Active
    const activeToggle = screen.getByTitle('Click to suspend this institution');
    expect(activeToggle).toHaveTextContent('Active');

    fireEvent.click(activeToggle);

    expect(mockUpdateInstitution).toHaveBeenCalledWith({
      id: 'inst-1',
      isActive: false,
      status: 'SUSPENDED',
    });

    await waitFor(() => {
      expect(mockShowToast).toHaveBeenCalledWith(
        'Institution "Apex Institute of Technology" suspended successfully.',
        'success'
      );
    });
  });

  it('filters institution cards via live search input', () => {
    renderDashboard();

    const searchInput = screen.getByPlaceholderText(/search campuses, subdomains, admins/i);

    // Filter for "Beacon"
    fireEvent.change(searchInput, { target: { value: 'Beacon' } });

    expect(screen.getByText('Beacon College of Engineering')).toBeInTheDocument();
    expect(screen.queryByText('Apex Institute of Technology')).not.toBeInTheDocument();

    // Filter by subdomain "apex"
    fireEvent.change(searchInput, { target: { value: 'apex-tech' } });

    expect(screen.getByText('Apex Institute of Technology')).toBeInTheDocument();
    expect(screen.queryByText('Beacon College of Engineering')).not.toBeInTheDocument();
  });

  it('opens CreateInstitutionModal when "+ Create Institution" is clicked', () => {
    renderDashboard();

    const createButtons = screen.getAllByRole('button', { name: /create institution/i });
    fireEvent.click(createButtons[0]);

    // Modal title appears
    expect(screen.getByText('Create New Institution')).toBeInTheDocument();
    expect(screen.getByLabelText(/institution name/i)).toBeInTheDocument();
  });
});
