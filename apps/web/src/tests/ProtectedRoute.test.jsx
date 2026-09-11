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

describe('ProtectedRoute Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const renderWithRouter = (ui, initialRoute = '/') => {
    return render(
      <MemoryRouter initialEntries={[initialRoute]}>
        <Routes>
          <Route path="/login" element={<div data-testid="login-page">Login Page</div>} />
          <Route path="/unauthorized" element={<div data-testid="unauthorized-page">Unauthorized</div>} />
          <Route path="/" element={ui} />
        </Routes>
      </MemoryRouter>
    );
  };

  it('redirects to /login if user is not authenticated', () => {
    authHooks.useAuth.mockReturnValue({
      isAuthenticated: false,
      user: null
    });

    renderWithRouter(<ProtectedRoute />);
    expect(screen.getByTestId('login-page')).toBeInTheDocument();
  });

  it('redirects to /unauthorized if user lacks required role', () => {
    authHooks.useAuth.mockReturnValue({
      isAuthenticated: true,
      user: { roles: ['STUDENT'] }
    });

    renderWithRouter(<ProtectedRoute allowedRoles={['ADMIN']} />);
    expect(screen.getByTestId('unauthorized-page')).toBeInTheDocument();
  });

  it('renders children if user has required role', () => {
    authHooks.useAuth.mockReturnValue({
      isAuthenticated: true,
      user: { roles: ['ADMIN'] }
    });

    renderWithRouter(
      <ProtectedRoute allowedRoles={['ADMIN']}>
        <TestComponent />
      </ProtectedRoute>
    );
    expect(screen.getByTestId('protected-content')).toBeInTheDocument();
  });

  it('renders children if no specific roles required and user is authenticated', () => {
    authHooks.useAuth.mockReturnValue({
      isAuthenticated: true,
      user: { roles: ['STUDENT'] }
    });

    renderWithRouter(
      <ProtectedRoute>
        <TestComponent />
      </ProtectedRoute>
    );
    expect(screen.getByTestId('protected-content')).toBeInTheDocument();
  });
});
