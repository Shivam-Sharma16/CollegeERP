import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import LoginPage from '../pages/LoginPage';
import * as authApi from '../api/authApi';
import * as storeHooks from '../store';
import * as tenantContext from '../context/TenantContext';

vi.mock('../hooks/usePageMeta', () => ({
  default: vi.fn(),
}));

vi.mock('../api/authApi', () => ({
  useLoginMutation: vi.fn(),
}));

vi.mock('../store', () => ({
  useAppSelector: vi.fn(),
  useAppDispatch: vi.fn(),
}));

vi.mock('../context/TenantContext', () => ({
  useTenant: vi.fn(),
}));

describe('PHASE 87 — Dedicated HOD Login Route', () => {
  const mockDispatch = vi.fn();
  const mockLogin = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    storeHooks.useAppDispatch.mockReturnValue(mockDispatch);
    storeHooks.useAppSelector.mockReturnValue(null);
    tenantContext.useTenant.mockReturnValue({
      tenant: null,
      isTenantPortal: false,
      isLoading: false,
      error: null,
    });
    authApi.useLoginMutation.mockReturnValue([
      mockLogin,
      { isLoading: false, error: null },
    ]);
  });

  const renderHodLogin = (initialRoute = '/hod/login', isHodMode = true) => {
    return render(
      <MemoryRouter initialEntries={[initialRoute]}>
        <Routes>
          <Route path="/hod/login" element={<LoginPage isHodMode={isHodMode} />} />
          <Route path="/login" element={<LoginPage isHodMode={false} />} />
          <Route path="/faculty/dashboard" element={<div data-testid="faculty-dashboard">Faculty Dashboard</div>} />
          <Route path="/hod/dashboard" element={<div data-testid="hod-dashboard">HOD Dashboard</div>} />
          <Route path="/admin/dashboard" element={<div data-testid="admin-dashboard">Admin Dashboard</div>} />
          <Route path="/student/dashboard" element={<div data-testid="student-dashboard">Student Dashboard</div>} />
          <Route path="/inst/:slug/faculty/dashboard" element={<div data-testid="tenant-faculty-dashboard">Tenant Faculty Dashboard</div>} />
          <Route path="/inst/:slug/hod/dashboard" element={<div data-testid="tenant-hod-dashboard">Tenant HOD Dashboard</div>} />
        </Routes>
      </MemoryRouter>
    );
  };

  it('renders dedicated HOD portal branding when accessing /hod/login', () => {
    renderHodLogin('/hod/login', true);

    expect(screen.getByText('Department Leadership Portal')).toBeInTheDocument();
    expect(screen.getByText('Academic Leadership')).toBeInTheDocument();
    expect(screen.getByText('Head of Department (HOD) Portal Login')).toBeInTheDocument();
    expect(screen.getByText('HOD Department Portal')).toBeInTheDocument();
  });

  it('authenticates a Faculty account and redirects to /faculty/dashboard, confirming route is cosmetic and not a security barrier', async () => {
    mockLogin.mockReturnValue({
      unwrap: () =>
        Promise.resolve({
          data: {
            token: 'valid-faculty-jwt',
            user: {
              id: 'fac-101',
              name: 'Prof. Davis',
              email: 'davis@apex.edu',
              roles: ['FACULTY'],
            },
          },
        }),
    });

    renderHodLogin('/hod/login', true);

    fireEvent.change(screen.getByLabelText('Email address'), {
      target: { value: 'davis@apex.edu' },
    });
    fireEvent.change(screen.getByLabelText('Password'), {
      target: { value: 'Password123!' },
    });

    const submitBtn = screen.getByRole('button', { name: /Sign in/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByTestId('faculty-dashboard')).toBeInTheDocument();
    });
  });

  it('authenticates an HOD account and redirects to /hod/dashboard', async () => {
    mockLogin.mockReturnValue({
      unwrap: () =>
        Promise.resolve({
          data: {
            token: 'valid-hod-jwt',
            user: {
              id: 'hod-202',
              name: 'Dr. Sarah Connor',
              email: 'sarah.hod@apex.edu',
              roles: ['HOD'],
            },
          },
        }),
    });

    renderHodLogin('/hod/login', true);

    fireEvent.change(screen.getByLabelText('Email address'), {
      target: { value: 'sarah.hod@apex.edu' },
    });
    fireEvent.change(screen.getByLabelText('Password'), {
      target: { value: 'Secret123!' },
    });

    const submitBtn = screen.getByRole('button', { name: /Sign in/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByTestId('hod-dashboard')).toBeInTheDocument();
    });
  });

  it('authenticates an Admin account and redirects to /admin/dashboard', async () => {
    mockLogin.mockReturnValue({
      unwrap: () =>
        Promise.resolve({
          data: {
            token: 'valid-admin-jwt',
            user: {
              id: 'admin-303',
              name: 'Admin User',
              email: 'admin@apex.edu',
              roles: ['ADMIN'],
            },
          },
        }),
    });

    renderHodLogin('/hod/login', true);

    fireEvent.change(screen.getByLabelText('Email address'), {
      target: { value: 'admin@apex.edu' },
    });
    fireEvent.change(screen.getByLabelText('Password'), {
      target: { value: 'AdminPass123!' },
    });

    const submitBtn = screen.getByRole('button', { name: /Sign in/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByTestId('admin-dashboard')).toBeInTheDocument();
    });
  });

  it('authenticates a Faculty account in tenant portal and redirects to /inst/:slug/faculty/dashboard', async () => {
    tenantContext.useTenant.mockReturnValue({
      tenant: { name: 'Apex Tech', code: 'APEX' },
      isTenantPortal: true,
      isLoading: false,
      error: null,
    });

    mockLogin.mockReturnValue({
      unwrap: () =>
        Promise.resolve({
          data: {
            token: 'valid-tenant-faculty-jwt',
            user: {
              id: 'fac-tenant-1',
              name: 'Prof. Miller',
              email: 'miller@apex.edu',
              roles: ['FACULTY'],
            },
          },
        }),
    });

    render(
      <MemoryRouter initialEntries={['/inst/apex-tech/hod/login']}>
        <Routes>
          <Route path="/inst/:slug/hod/login" element={<LoginPage isHodMode={true} />} />
          <Route path="/inst/:slug/faculty/dashboard" element={<div data-testid="tenant-faculty-dashboard">Tenant Faculty Dashboard</div>} />
          <Route path="/inst/:slug/hod/dashboard" element={<div data-testid="tenant-hod-dashboard">Tenant HOD Dashboard</div>} />
        </Routes>
      </MemoryRouter>
    );

    fireEvent.change(screen.getByLabelText('Email address'), {
      target: { value: 'miller@apex.edu' },
    });
    fireEvent.change(screen.getByLabelText('Password'), {
      target: { value: 'FacultyPass123!' },
    });

    const submitBtn = screen.getByRole('button', { name: /Sign in/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByTestId('tenant-faculty-dashboard')).toBeInTheDocument();
    });
  });

  it('authenticates an HOD account in tenant portal and redirects to /inst/:slug/hod/dashboard', async () => {
    tenantContext.useTenant.mockReturnValue({
      tenant: { name: 'Apex Tech', code: 'APEX' },
      isTenantPortal: true,
      isLoading: false,
      error: null,
    });

    mockLogin.mockReturnValue({
      unwrap: () =>
        Promise.resolve({
          data: {
            token: 'valid-tenant-hod-jwt',
            user: {
              id: 'hod-tenant-1',
              name: 'Dr. John Connor',
              email: 'connor@apex.edu',
              roles: ['HOD'],
            },
          },
        }),
    });

    render(
      <MemoryRouter initialEntries={['/inst/apex-tech/hod/login']}>
        <Routes>
          <Route path="/inst/:slug/hod/login" element={<LoginPage isHodMode={true} />} />
          <Route path="/inst/:slug/faculty/dashboard" element={<div data-testid="tenant-faculty-dashboard">Tenant Faculty Dashboard</div>} />
          <Route path="/inst/:slug/hod/dashboard" element={<div data-testid="tenant-hod-dashboard">Tenant HOD Dashboard</div>} />
        </Routes>
      </MemoryRouter>
    );

    fireEvent.change(screen.getByLabelText('Email address'), {
      target: { value: 'connor@apex.edu' },
    });
    fireEvent.change(screen.getByLabelText('Password'), {
      target: { value: 'HodPass123!' },
    });

    const submitBtn = screen.getByRole('button', { name: /Sign in/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByTestId('tenant-hod-dashboard')).toBeInTheDocument();
    });
  });
});

