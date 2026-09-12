import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CreateInstitutionModal } from '../components/institutions/CreateInstitutionModal';
import * as institutionsApi from '../api/institutionsApi';

// ── Mock Toast ──
const mockShowToast = vi.fn();
vi.mock('../components/ui/ToastContext', () => ({
  useToast: vi.fn(() => ({ showToast: mockShowToast, addToast: vi.fn() })),
}));

// ── Mock institutionsApi ──
vi.mock('../api/institutionsApi', () => ({
  useCreateInstitutionMutation: vi.fn(),
  useLazyCheckSubdomainAvailabilityQuery: vi.fn(),
}));

describe('CreateInstitutionModal (Phase 72)', () => {
  const mockCreateInstitution = vi.fn();
  const mockTriggerCheck = vi.fn();
  const mockOnClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();

    institutionsApi.useCreateInstitutionMutation.mockReturnValue([
      mockCreateInstitution.mockReturnValue({
        unwrap: () =>
          Promise.resolve({
            data: { institution: { name: 'Apex Tech', slug: 'apex-tech' } },
          }),
      }),
      { isLoading: false },
    ]);

    institutionsApi.useLazyCheckSubdomainAvailabilityQuery.mockReturnValue([
      mockTriggerCheck.mockReturnValue({
        unwrap: () =>
          Promise.resolve({
            available: true,
            subdomain: 'apex-tech',
            message: 'Subdomain is available',
          }),
      }),
      { isFetching: false },
    ]);
  });

  const renderModal = (isOpen = true) => {
    return render(<CreateInstitutionModal isOpen={isOpen} onClose={mockOnClose} />);
  };

  it('renders modal when open with all initial fields', () => {
    renderModal(true);

    expect(screen.getByText('Create New Institution')).toBeInTheDocument();
    expect(screen.getByLabelText(/institution name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/campus code/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/subdomain url/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/admin full name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/admin email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/initial password/i)).toBeInTheDocument();
  });

  it('auto-generates subdomain slug and campus code from institution name', () => {
    renderModal(true);

    const nameInput = screen.getByLabelText(/institution name/i);
    const codeInput = screen.getByLabelText(/campus code/i);
    const subdomainInput = screen.getByLabelText(/subdomain url/i);

    fireEvent.change(nameInput, { target: { value: 'Horizon State University' } });

    expect(subdomainInput).toHaveValue('horizon-state-university');
    expect(codeInput).toHaveValue('HSU');
  });

  it('debounces live subdomain check and displays "Available" badge on success', async () => {
    mockTriggerCheck.mockReturnValue({
      unwrap: () =>
        Promise.resolve({
          available: true,
          subdomain: 'horizon-tech',
          message: '"horizon-tech" is available!',
        }),
    });

    renderModal(true);

    const subdomainInput = screen.getByLabelText(/subdomain url/i);
    fireEvent.change(subdomainInput, { target: { value: 'horizon-tech' } });

    await waitFor(
      () => {
        expect(mockTriggerCheck).toHaveBeenCalledWith('horizon-tech');
        expect(screen.getAllByText(/available/i)[0]).toBeInTheDocument();
      },
      { timeout: 1500 }
    );
  });

  it('displays "Taken" badge and disables submit when subdomain is already taken', async () => {
    mockTriggerCheck.mockReturnValue({
      unwrap: () =>
        Promise.resolve({
          available: false,
          subdomain: 'taken-slug',
          reason: 'Subdomain is already taken',
        }),
    });

    renderModal(true);

    const subdomainInput = screen.getByLabelText(/subdomain url/i);
    fireEvent.change(subdomainInput, { target: { value: 'taken-slug' } });

    await waitFor(
      () => {
        expect(mockTriggerCheck).toHaveBeenCalledWith('taken-slug');
        expect(screen.getAllByText(/taken/i)[0]).toBeInTheDocument();
        expect(screen.getByText(/subdomain is already taken/i)).toBeInTheDocument();
      },
      { timeout: 1500 }
    );

    const submitBtn = screen.getByRole('button', { name: /launch institution/i });
    expect(submitBtn).toBeDisabled();
  });

  it('submits form with valid data and calls createInstitution mutation', async () => {
    mockTriggerCheck.mockReturnValue({
      unwrap: () =>
        Promise.resolve({
          available: true,
          subdomain: 'apex-institute-of-technology',
          message: 'Available',
        }),
    });

    renderModal(true);

    // Fill form
    fireEvent.change(screen.getByLabelText(/institution name/i), {
      target: { value: 'Apex Institute of Technology' },
    });
    fireEvent.change(screen.getByLabelText(/admin full name/i), {
      target: { value: 'Dr. Jane Smith' },
    });
    fireEvent.change(screen.getByLabelText(/admin email/i), {
      target: { value: 'admin@apex.edu' },
    });
    fireEvent.change(screen.getByLabelText(/initial password/i), {
      target: { value: 'Secret123!' },
    });

    await waitFor(
      () => {
        expect(screen.getAllByText(/available/i)[0]).toBeInTheDocument();
      },
      { timeout: 1500 }
    );

    const submitBtn = screen.getByRole('button', { name: /launch institution/i });
    expect(submitBtn).not.toBeDisabled();

    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(mockCreateInstitution).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Apex Institute of Technology',
          subdomain: 'apex-institute-of-technology',
          admin: {
            name: 'Dr. Jane Smith',
            email: 'admin@apex.edu',
            password: 'Secret123!',
          },
        })
      );
      expect(mockOnClose).toHaveBeenCalled();
    });
  });
});
