import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import AdminHodManagement from '../pages/AdminHodManagement';

const mockHods = [
  {
    _id: 'hod1',
    name: 'Dr. Ada Lovelace',
    email: 'ada@college.edu',
    departmentId: { _id: 'dept1', name: 'Computer Science', code: 'CSE' },
    facultyCount: 15,
    role: 'HOD',
    createdAt: '2026-09-15T08:00:00.000Z',
  },
  {
    _id: 'hod2',
    name: 'Dr. Nikola Tesla',
    email: 'tesla@college.edu',
    departmentId: { _id: 'dept2', name: 'Electrical Engineering', code: 'EE' },
    facultyCount: 8,
    role: 'HOD',
    createdAt: null, // Test edge-case null date to ensure no "Invalid Date"
  },
];

vi.mock('../components/DashboardShell', () => ({
  DashboardShell: ({ title, subtitle, children }) => (
    <div>
      <h1>{title}</h1>
      <p>{subtitle}</p>
      {children}
    </div>
  ),
}));

vi.mock('../components/ui/PageTransition', () => ({
  PageTransition: ({ children }) => <div>{children}</div>,
}));

vi.mock('../components/ui/ToastContext', () => ({
  useToast: () => ({ showToast: vi.fn() }),
}));

vi.mock('../api/usersApi', () => ({
  useListHodsQuery: () => ({
    data: { success: true, data: mockHods },
    isLoading: false,
  }),
  useCreateHodMutation: () => [vi.fn().mockReturnValue({ unwrap: vi.fn() }), { isLoading: false }],
  useGetUserQuery: (id) => ({
    data: mockHods.find(h => h._id === id) || mockHods[0],
    isLoading: false,
  }),
  useUpdateUserMutation: () => [
    vi.fn().mockReturnValue({ unwrap: vi.fn().mockResolvedValue({ success: true }) }),
    { isLoading: false },
  ],
}));

vi.mock('../api/departmentsApi', () => ({
  useListDepartmentsQuery: () => ({
    data: {
      success: true,
      data: [
        { _id: 'dept1', name: 'Computer Science', code: 'CSE' },
        { _id: 'dept2', name: 'Electrical Engineering', code: 'EE' },
      ],
    },
    isLoading: false,
  }),
}));

describe('AdminHodManagement Page Tests', () => {
  test('Renders HOD table with valid formatted created date and never displays Invalid Date', () => {
    render(
      <MemoryRouter>
        <AdminHodManagement />
      </MemoryRouter>
    );

    expect(screen.getByText('HOD Management')).toBeInTheDocument();
    expect(screen.getByText('Dr. Ada Lovelace')).toBeInTheDocument();
    expect(screen.getByText('Dr. Nikola Tesla')).toBeInTheDocument();

    // Verify formatted date is present
    const formattedDate = new Date('2026-09-15T08:00:00.000Z').toLocaleDateString();
    expect(screen.getByText(formattedDate)).toBeInTheDocument();

    // Verify null date rendered fallback dash '—' instead of 'Invalid Date'
    expect(screen.queryByText(/invalid date/i)).not.toBeInTheDocument();
    expect(screen.getByText('—')).toBeInTheDocument();
  });

  test('Renders department name and faculty count', () => {
    render(
      <MemoryRouter>
        <AdminHodManagement />
      </MemoryRouter>
    );

    expect(screen.getByText('Computer Science')).toBeInTheDocument();
    expect(screen.getByText('Electrical Engineering')).toBeInTheDocument();
    expect(screen.getByText('15')).toBeInTheDocument();
    expect(screen.getByText('8')).toBeInTheDocument();
  });

  test('Filters HOD table when searching by name or department', () => {
    render(
      <MemoryRouter>
        <AdminHodManagement />
      </MemoryRouter>
    );

    const searchInput = screen.getByPlaceholderText('Search by name or department...');
    fireEvent.change(searchInput, { target: { value: 'Tesla' } });

    expect(screen.getByText('Dr. Nikola Tesla')).toBeInTheDocument();
    expect(screen.queryByText('Dr. Ada Lovelace')).not.toBeInTheDocument();
  });

  test('Opens Create HOD modal when clicking Create HOD button', () => {
    render(
      <MemoryRouter>
        <AdminHodManagement />
      </MemoryRouter>
    );

    const createBtn = screen.getByRole('button', { name: /create hod/i });
    fireEvent.click(createBtn);

    expect(screen.getByText('New HOD Account')).toBeInTheDocument();
  });

  test('Opens View HOD modal with profile information when clicking view button', () => {
    render(
      <MemoryRouter>
        <AdminHodManagement />
      </MemoryRouter>
    );

    const viewButtons = screen.getAllByTitle('View HOD Details');
    expect(viewButtons.length).toBeGreaterThan(0);
    fireEvent.click(viewButtons[0]);

    expect(screen.getByText('Head of Department Profile')).toBeInTheDocument();
    expect(screen.getByText('Academic Department')).toBeInTheDocument();
    expect(screen.getByText('Edit HOD Details')).toBeInTheDocument();
  });

  test('Opens Edit HOD modal when clicking edit button', () => {
    render(
      <MemoryRouter>
        <AdminHodManagement />
      </MemoryRouter>
    );

    const editButtons = screen.getAllByTitle('Edit HOD');
    expect(editButtons.length).toBeGreaterThan(0);
    fireEvent.click(editButtons[0]);

    expect(screen.getByText('Edit Head of Department')).toBeInTheDocument();
    expect(screen.getByLabelText(/full name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /save changes/i })).toBeInTheDocument();
  });
});
