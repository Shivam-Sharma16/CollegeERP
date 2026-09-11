import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import StudentAttendancePage from '../pages/StudentAttendancePage';
import * as authHooks from '../hooks/useAuth';

// ── Attendance API ──
vi.mock('../api/attendanceApi', () => ({
  useGetOwnAttendanceSummaryQuery: vi.fn(() => ({
    data: {
      data: {
        attendanceRate: 88.5,
        totalSessions: 24,
        presentCount: 21,
        absentCount: 3,
        minimumRequired: 75,
      }
    },
    isLoading: false,
  })),
  useListOwnRecordsQuery: vi.fn(() => ({
    data: { data: [] },
    isLoading: false,
    refetch: vi.fn(),
  })),
  useCheckInMutation: vi.fn(() => [vi.fn(), { isLoading: false }]),
}));

// ── Auth hook ──
vi.mock('../hooks/useAuth', () => ({
  useAuth: vi.fn(),
}));

// ── Toast context ──
vi.mock('../components/ui/ToastContext', () => ({
  useToast: vi.fn(() => ({ showToast: vi.fn() })),
}));

// ── framer-motion: pass-through wrappers ──
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }) => <div {...props}>{children}</div>,
    section: ({ children, ...props }) => <section {...props}>{children}</section>,
    button: ({ children, ...props }) => <button {...props}>{children}</button>,
  },
  AnimatePresence: ({ children }) => <>{children}</>,
}));

// ── Mock shell so we only render the page content ──
vi.mock('../components/DashboardShell', () => ({
  DashboardShell: ({ children }) => <div data-testid="dashboard-shell">{children}</div>,
}));

vi.mock('../components/ui/PageTransition', () => ({
  PageTransition: ({ children }) => <div>{children}</div>,
}));

// ── socket.io-client ──
vi.mock('socket.io-client', () => ({
  io: vi.fn(() => ({
    on: vi.fn(),
    off: vi.fn(),
    disconnect: vi.fn(),
    emit: vi.fn(),
  })),
}));

// ── Geolocation: auto-resolve immediately ──
const mockGetCurrentPosition = vi.fn((success) => {
  Promise.resolve().then(() =>
    success({ coords: { latitude: 12.9716, longitude: 77.5946, accuracy: 5 } })
  );
});

Object.defineProperty(global.navigator, 'geolocation', {
  value: { getCurrentPosition: mockGetCurrentPosition },
  writable: true,
  configurable: true,
});

// ──────────────────────────────────────────────────────────
describe('StudentAttendancePage — attendance check-in state machine (Phase 52)', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Re-wire geolocation mock for each test
    mockGetCurrentPosition.mockImplementation((success) => {
      Promise.resolve().then(() =>
        success({ coords: { latitude: 12.9716, longitude: 77.5946, accuracy: 5 } })
      );
    });

    authHooks.useAuth.mockReturnValue({
      user: { userId: 'stu1', name: 'Student One', roles: ['STUDENT'], _id: 'stu1' },
      token: 'fake-token',
    });
  });

  // Helper: click a simulator button and wait for error state with extended timeout
  const clickSimAndAwait = async (btnText, expectedText) => {
    const btn = await screen.findByText(btnText, {}, { timeout: 3000 });
    fireEvent.click(btn);
    // The component uses a 1200ms setTimeout internally — we need real time or a workaround
    await waitFor(
      () => { expect(screen.getByText(expectedText)).toBeInTheDocument(); },
      { timeout: 3500 }
    );
  };

  it('geofence failure: shows "Geofence Alert" after clicking Outside Geofence simulator', async () => {
    render(<StudentAttendancePage />);
    await clickSimAndAwait(/Outside Geofence/i, /Geofence Alert/i);
    expect(screen.getByText(/outside the classroom/i)).toBeInTheDocument();
  });

  it('duplicate check-in: shows "Duplicate Submission" after clicking Already Checked In simulator', async () => {
    render(<StudentAttendancePage />);
    await clickSimAndAwait(/Already Checked In/i, /Duplicate Submission/i);
    expect(screen.getByText(/already checked in to this session/i)).toBeInTheDocument();
  });

  it('expired QR: shows "Verification Denied" after clicking Expired QR simulator', async () => {
    render(<StudentAttendancePage />);
    await clickSimAndAwait(/Expired QR/i, /Verification Denied/i);
    expect(screen.getByText(/QR code has expired/i)).toBeInTheDocument();
  });
});
