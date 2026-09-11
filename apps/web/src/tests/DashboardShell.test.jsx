import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { DashboardShell } from '../components/DashboardShell';
import * as authHooks from '../hooks/useAuth';
import * as reactRedux from 'react-redux';

// ── Mock react-redux fully to avoid store context errors ──
vi.mock('react-redux', () => ({
  useSelector: vi.fn(),
  useDispatch: vi.fn(),
  useStore: vi.fn(),
  Provider: ({ children }) => <>{children}</>,
}));

// ── Mock context / hooks ──
vi.mock('../components/ui/ToastContext', () => ({
  useToast: vi.fn(() => ({ showToast: vi.fn() })),
}));

vi.mock('../hooks/useAuth', () => ({
  useAuth: vi.fn(),
}));

// ── Mock API slices (so RTK hooks never touch a real store) ──
vi.mock('../api/authApi', () => ({
  useLogoutMutation: vi.fn(() => [vi.fn(), { isLoading: false }]),
}));

vi.mock('../api/notificationApi', () => ({
  useGetUnreadCountQuery: vi.fn(() => ({ data: { count: 0 }, isLoading: false })),
  useListNotificationsQuery: vi.fn(() => ({ data: { notifications: [] }, isLoading: false })),
  useMarkReadMutation: vi.fn(() => [vi.fn(), {}]),
  useMarkAllReadMutation: vi.fn(() => [vi.fn(), {}]),
}));

// ── Mock child components that have their own heavy deps ──
vi.mock('../components/ui/NotificationDropdown', () => ({
  NotificationDropdown: () => <div data-testid="notification-dropdown" />,
}));

vi.mock('../components/student/AiAgentPanel', () => ({
  AiAgentPanel: () => <div data-testid="ai-agent-panel" />,
}));

// ──────────────────────────────────────────────────────────
// NAV_ITEMS from src/config/navigation.js (correct labels):
//   student: "Attendance", "Results", "Fees", "Notices", "Profile", "Dashboard"
//   admin:   "HODs", "Reports", "Fee Policy", "Institution Notices", "Profile", "Dashboard"
//   superadmin: "Management", "Institution Settings", "Profile", "Dashboard"
// ──────────────────────────────────────────────────────────
describe('DashboardShell — sidebar role-filtering (Phase 27)', () => {
  const mockDispatch = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    reactRedux.useDispatch.mockReturnValue(mockDispatch);
    // Sidebar is expanded, no collapsed state
    reactRedux.useSelector.mockReturnValue(false);
  });

  const renderShell = (roles) => {
    authHooks.useAuth.mockReturnValue({
      user: { userId: 'u1', name: 'Test User', email: 'u@test.com', roles },
    });
    return render(
      <MemoryRouter>
        <DashboardShell />
      </MemoryRouter>
    );
  };

  it('STUDENT role: shows student nav items, hides admin-only items', () => {
    renderShell(['STUDENT']);

    // Student nav items (from navigation.js)
    expect(screen.getByText('Attendance')).toBeInTheDocument();
    expect(screen.getByText('Results')).toBeInTheDocument();
    expect(screen.getByText('Fees')).toBeInTheDocument();

    // Admin-only items must not be present for students
    expect(screen.queryByText('HODs')).not.toBeInTheDocument();
    expect(screen.queryByText('Fee Policy')).not.toBeInTheDocument();
    expect(screen.queryByText('Management')).not.toBeInTheDocument();
    expect(screen.queryByText('Institution Settings')).not.toBeInTheDocument();
  });

  it('ADMIN role: shows admin nav items, hides student-only items', () => {
    renderShell(['ADMIN']);

    // Admin nav items (from navigation.js)
    expect(screen.getByText('HODs')).toBeInTheDocument();
    expect(screen.getByText('Fee Policy')).toBeInTheDocument();

    // Student-only items must not be present for admin
    expect(screen.queryByText('Attendance')).not.toBeInTheDocument();
    expect(screen.queryByText('Results')).not.toBeInTheDocument();
    expect(screen.queryByText('Fees')).not.toBeInTheDocument();
    // Superadmin-only items
    expect(screen.queryByText('Management')).not.toBeInTheDocument();
    expect(screen.queryByText('Institution Settings')).not.toBeInTheDocument();
  });
});
