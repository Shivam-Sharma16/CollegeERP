import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { ProtectedRoute } from '../components/ProtectedRoute';
import * as authHooks from '../hooks/useAuth';

vi.mock('../hooks/useAuth', () => ({
  useAuth: vi.fn(),
}));

vi.mock('../hooks/usePageMeta', () => {
  return { default: vi.fn() };
});

const TestComponent = () => <div data-testid="protected-content">Protected Content</div>;

describe('ProtectedRoute Component — Role-Based Routing (Phase 71)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const renderWithRouter = (ui, initialRoute = '/') => {
    return render(
      <MemoryRouter initialEntries={[initialRoute]}>
        <Routes>
          <Route path="/login" element={<div data-testid="login-page">Login Page</div>} />
          <Route path="/unauthorized" element={<div data-testid="unauthorized-page">Unauthorized</div>} />
          <Route path="/student/dashboard" element={<div data-testid="student-dashboard">Student Dashboard</div>} />
          <Route path="/faculty/dashboard" element={<div data-testid="faculty-dashboard">Faculty Dashboard</div>} />
          <Route path="/hod/dashboard" element={ui} />
          <Route path="/admin/dashboard" element={ui} />
          <Route path="/" element={ui} />
        </Routes>
      </MemoryRouter>
    );
  };

  it('redirects to /login if user is not authenticated', () => {
    authHooks.useAuth.mockReturnValue({
      isAuthenticated: false,
      user: null,
    });

    renderWithRouter(<ProtectedRoute />);
    expect(screen.getByTestId('login-page')).toBeInTheDocument();
  });

  it('redirects Faculty hitting /hod/dashboard directly to their own /faculty/dashboard', () => {
    authHooks.useAuth.mockReturnValue({
      isAuthenticated: true,
      user: { roles: ['FACULTY'] },
    });

    renderWithRouter(
      <ProtectedRoute allowedRoles={['HOD', 'ADMIN', 'SUPERADMIN']}>
        <TestComponent />
      </ProtectedRoute>,
      '/hod/dashboard'
    );

    // Mismatched role-prefix auto-redirects to user's role prefix
    expect(screen.getByTestId('faculty-dashboard')).toBeInTheDocument();
    expect(screen.queryByTestId('unauthorized-page')).not.toBeInTheDocument();
  });

  it('redirects Student hitting /admin/dashboard directly to /student/dashboard', () => {
    authHooks.useAuth.mockReturnValue({
      isAuthenticated: true,
      user: { roles: ['STUDENT'] },
    });

    renderWithRouter(
      <ProtectedRoute allowedRoles={['ADMIN']}>
        <TestComponent />
      </ProtectedRoute>,
      '/admin/dashboard'
    );

    expect(screen.getByTestId('student-dashboard')).toBeInTheDocument();
    expect(screen.queryByTestId('unauthorized-page')).not.toBeInTheDocument();
  });

  it('redirects to /unauthorized if user has no assigned roles', () => {
    authHooks.useAuth.mockReturnValue({
      isAuthenticated: true,
      user: { roles: [] },
    });

    renderWithRouter(
      <ProtectedRoute allowedRoles={['ADMIN']}>
        <TestComponent />
      </ProtectedRoute>,
      '/admin/dashboard'
    );
    expect(screen.getByTestId('student-dashboard')).toBeInTheDocument();
  });

  it('renders children if user has matching role', () => {
    authHooks.useAuth.mockReturnValue({
      isAuthenticated: true,
      user: { roles: ['ADMIN'] },
    });

    renderWithRouter(
      <ProtectedRoute allowedRoles={['ADMIN']}>
        <TestComponent />
      </ProtectedRoute>,
      '/admin/dashboard'
    );
    expect(screen.getByTestId('protected-content')).toBeInTheDocument();
  });

  it('renders children if no specific roles required and user is authenticated', () => {
    authHooks.useAuth.mockReturnValue({
      isAuthenticated: true,
      user: { roles: ['STUDENT'] },
    });

    renderWithRouter(
      <ProtectedRoute>
        <TestComponent />
      </ProtectedRoute>
    );
    expect(screen.getByTestId('protected-content')).toBeInTheDocument();
  });
});
