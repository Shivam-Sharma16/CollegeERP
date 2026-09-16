import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import AdminDepartments from '../pages/AdminDepartments';

const { mockDepartments, mockDeleteDepartment } = vi.hoisted(() => {
  return {
    mockDeleteDepartment: vi.fn().mockReturnValue({ unwrap: vi.fn().mockResolvedValue({}) }),
    mockDepartments: [
      {
        _id: 'dept1',
        name: 'Computer Science & Engineering',
        code: 'CSE',
        description: 'Core computing and software engineering',
        isActive: true,
        facultyCount: 12,
        studentCount: 240,
        hod: { _id: 'hod1', name: 'Dr. Alan Turing', email: 'alan@college.edu' },
      },
      {
        _id: 'dept2',
        name: 'Mechanical Engineering',
        code: 'ME',
        description: 'Thermal and mechanics',
        isActive: false,
        facultyCount: 8,
        studentCount: 150,
        hod: null,
      },
    ]
  };
});

// Mock Auth
vi.mock('../hooks/useAuth', () => ({
  useAuth: () => ({
    user: { userId: 'admin1', roles: ['ADMIN'], institutionId: 'inst1' },
    token: 'token123',
    isAuthenticated: true,
  }),
}));

// Mock DashboardShell
vi.mock('../components/DashboardShell', () => ({
  DashboardShell: ({ title, subtitle, children }) => (
    <div data-testid="dashboard-shell">
      <h1>{title}</h1>
      <p>{subtitle}</p>
      {children}
    </div>
  ),
}));

// Mock PageTransition
vi.mock('../components/ui/PageTransition', () => ({
  PageTransition: ({ children }) => <div>{children}</div>,
}));

// Mock ToastContext
const mockShowToast = vi.fn();
vi.mock('../components/ui/ToastContext', () => ({
  useToast: () => ({ showToast: mockShowToast }),
}));

vi.mock('../api/departmentsApi', () => ({
  useListDepartmentsQuery: () => ({
    data: { success: true, data: mockDepartments },
    isLoading: false,
    refetch: vi.fn(),
  }),
  useGetDepartmentQuery: vi.fn().mockReturnValue({
    data: { success: true, data: mockDepartments[0] },
    isLoading: false,
  }),
  useCreateDepartmentMutation: () => [vi.fn().mockReturnValue({ unwrap: vi.fn().mockResolvedValue({}) }), { isLoading: false }],
  useUpdateDepartmentMutation: () => [vi.fn().mockReturnValue({ unwrap: vi.fn().mockResolvedValue({}) }), { isLoading: false }],
  useDeleteDepartmentMutation: () => [mockDeleteDepartment, { isLoading: false }],
}));

vi.mock('../api/usersApi', () => ({
  useListHodsQuery: () => ({
    data: { success: true, data: [] },
    isLoading: false,
  }),
  useListFacultyQuery: () => ({
    data: { success: true, data: [] },
    isLoading: false,
  }),
  useGetOwnProfileQuery: () => ({
    data: { avatarUrl: null },
  }),
}));

describe('AdminDepartments Page Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('Renders department page with title, subtitle, and KPI summary statistics', () => {
    render(
      <MemoryRouter>
        <AdminDepartments />
      </MemoryRouter>
    );

    expect(screen.getByText('Department Management')).toBeInTheDocument();
    expect(screen.getByText('Total Departments')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument(); // total departments count
    expect(screen.getByText('Active Departments')).toBeInTheDocument();
    expect(screen.getAllByText('1')).toHaveLength(2); // 1 active dept, 1 unassigned HOD
    expect(screen.getByText('Total Faculty Members')).toBeInTheDocument();
    expect(screen.getByText('20')).toBeInTheDocument(); // 12 + 8
    expect(screen.getByText('Enrolled Students')).toBeInTheDocument();
    expect(screen.getByText('390')).toBeInTheDocument(); // 240 + 150
  });

  test('Renders department table rows with name, code, status, and HOD', () => {
    render(
      <MemoryRouter>
        <AdminDepartments />
      </MemoryRouter>
    );

    expect(screen.getByText('Computer Science & Engineering')).toBeInTheDocument();
    expect(screen.getByText('Code: CSE')).toBeInTheDocument();
    expect(screen.getByText('Dr. Alan Turing')).toBeInTheDocument();
    expect(screen.getByText('Mechanical Engineering')).toBeInTheDocument();
    expect(screen.getByText('Code: ME')).toBeInTheDocument();
    expect(screen.getByText('Unassigned')).toBeInTheDocument();
  });

  test('Filters departments when searching by name or code', () => {
    render(
      <MemoryRouter>
        <AdminDepartments />
      </MemoryRouter>
    );

    const searchInput = screen.getByPlaceholderText('Search by name or code...');
    fireEvent.change(searchInput, { target: { value: 'CSE' } });

    expect(screen.getByText('Computer Science & Engineering')).toBeInTheDocument();
    expect(screen.queryByText('Mechanical Engineering')).not.toBeInTheDocument();
  });

  test('Filters departments by status', () => {
    render(
      <MemoryRouter>
        <AdminDepartments />
      </MemoryRouter>
    );

    const select = screen.getByDisplayValue('All Statuses');
    fireEvent.change(select, { target: { value: 'active' } });

    expect(screen.getByText('Computer Science & Engineering')).toBeInTheDocument();
    expect(screen.queryByText('Mechanical Engineering')).not.toBeInTheDocument();
  });

  test('Opens Create Department modal when clicking Create Department button', () => {
    render(
      <MemoryRouter>
        <AdminDepartments />
      </MemoryRouter>
    );

    const createBtn = screen.getByRole('button', { name: /create department/i });
    fireEvent.click(createBtn);

    expect(screen.getByText('Define an academic faculty branch to organize courses, professors, and students.')).toBeInTheDocument();
  });

  test('Toggles to grid/card view when clicking card view button', () => {
    render(
      <MemoryRouter>
        <AdminDepartments />
      </MemoryRouter>
    );

    const cardViewBtn = screen.getByTitle('Card View');
    fireEvent.click(cardViewBtn);

    expect(screen.getByText('Core computing and software engineering')).toBeInTheDocument();
  });
});
