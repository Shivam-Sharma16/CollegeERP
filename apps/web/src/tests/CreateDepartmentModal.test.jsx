import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CreateDepartmentModal } from '../components/departments/CreateDepartmentModal';

const mockCreateDepartment = vi.fn();
const mockShowToast = vi.fn();

vi.mock('../components/ui/ToastContext', () => ({
  useToast: () => ({ showToast: mockShowToast }),
}));

vi.mock('../api/departmentsApi', () => ({
  useCreateDepartmentMutation: () => [
    mockCreateDepartment,
    { isLoading: false },
  ],
}));

vi.mock('../api/usersApi', () => ({
  useListHodsQuery: () => ({ data: { success: true, data: [] }, isLoading: false }),
  useListFacultyQuery: () => ({ data: { success: true, data: [] }, isLoading: false }),
}));

describe('CreateDepartmentModal Validation Tests', () => {
  const onClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateDepartment.mockReturnValue({
      unwrap: vi.fn().mockResolvedValue({ success: true }),
    });
  });

  test('Renders all input fields including restricted phone field', () => {
    render(<CreateDepartmentModal isOpen={true} onClose={onClose} />);

    expect(screen.getByLabelText(/department name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/department code/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/contact email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/contact phone/i)).toBeInTheDocument();

    const phoneInput = screen.getByLabelText(/contact phone/i);
    expect(phoneInput).toHaveAttribute('maxLength', '10');
    expect(phoneInput).toHaveAttribute('inputMode', 'numeric');
  });

  test('Restricts phone number to at most 10 digits and strips non-numeric characters', () => {
    render(<CreateDepartmentModal isOpen={true} onClose={onClose} />);

    const phoneInput = screen.getByLabelText(/contact phone/i);

    // Attempt to type more than 10 digits and non-numeric letters
    fireEvent.change(phoneInput, { target: { value: '9876543210999extra' } });

    // Should only contain first 10 digits
    expect(phoneInput.value).toBe('9876543210');
  });

  test('Shows validation error when phone number has fewer than 10 digits on submit', async () => {
    render(<CreateDepartmentModal isOpen={true} onClose={onClose} />);

    fireEvent.change(screen.getByLabelText(/department name/i), {
      target: { value: 'Computer Science' },
    });
    fireEvent.change(screen.getByLabelText(/department code/i), {
      target: { value: 'CSE' },
    });
    fireEvent.change(screen.getByLabelText(/contact phone/i), {
      target: { value: '12345' },
    });

    const submitBtn = screen.getByRole('button', { name: /create department/i });
    fireEvent.click(submitBtn);

    expect(
      screen.getByText('Contact phone number must be exactly 10 digits.')
    ).toBeInTheDocument();
    expect(mockCreateDepartment).not.toHaveBeenCalled();
  });

  test('Shows validation error when department name is empty or whitespace', async () => {
    render(<CreateDepartmentModal isOpen={true} onClose={onClose} />);

    fireEvent.change(screen.getByLabelText(/department name/i), {
      target: { value: '   ' },
    });
    fireEvent.change(screen.getByLabelText(/department code/i), {
      target: { value: 'CSE' },
    });

    const submitBtn = screen.getByRole('button', { name: /create department/i });
    fireEvent.click(submitBtn);

    expect(screen.getByText('Department name is required.')).toBeInTheDocument();
    expect(mockCreateDepartment).not.toHaveBeenCalled();
  });

  test('Shows validation error when department code has invalid characters or is too short', async () => {
    render(<CreateDepartmentModal isOpen={true} onClose={onClose} />);

    fireEvent.change(screen.getByLabelText(/department name/i), {
      target: { value: 'Electrical Engineering' },
    });
    fireEvent.change(screen.getByLabelText(/department code/i), {
      target: { value: 'E' },
    });

    const submitBtn = screen.getByRole('button', { name: /create department/i });
    fireEvent.click(submitBtn);

    expect(
      screen.getByText('Department code must be 2 to 10 characters.')
    ).toBeInTheDocument();
    expect(mockCreateDepartment).not.toHaveBeenCalled();
  });

  test('Shows validation error when contact email is invalid', async () => {
    render(<CreateDepartmentModal isOpen={true} onClose={onClose} />);

    fireEvent.change(screen.getByLabelText(/department name/i), {
      target: { value: 'Mechanical Engineering' },
    });
    fireEvent.change(screen.getByLabelText(/department code/i), {
      target: { value: 'ME' },
    });
    fireEvent.change(screen.getByLabelText(/contact email/i), {
      target: { value: 'invalid-email-address' },
    });

    const submitBtn = screen.getByRole('button', { name: /create department/i });
    fireEvent.click(submitBtn);

    expect(
      screen.getByText('Please enter a valid email address (e.g. dept@college.edu).')
    ).toBeInTheDocument();
    expect(mockCreateDepartment).not.toHaveBeenCalled();
  });

  test('Submits successfully when all fields and 10-digit phone number are valid', async () => {
    render(<CreateDepartmentModal isOpen={true} onClose={onClose} />);

    fireEvent.change(screen.getByLabelText(/department name/i), {
      target: { value: 'Civil Engineering' },
    });
    fireEvent.change(screen.getByLabelText(/department code/i), {
      target: { value: 'CIVIL' },
    });
    fireEvent.change(screen.getByLabelText(/contact email/i), {
      target: { value: 'civil@college.edu' },
    });
    fireEvent.change(screen.getByLabelText(/contact phone/i), {
      target: { value: '9876543210' },
    });

    const submitBtn = screen.getByRole('button', { name: /create department/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(mockCreateDepartment).toHaveBeenCalledWith({
        name: 'Civil Engineering',
        code: 'CIVIL',
        description: '',
        contactEmail: 'civil@college.edu',
        contactPhone: '9876543210',
        hodId: undefined,
      });
      expect(mockShowToast).toHaveBeenCalledWith(
        'Department created successfully',
        'success'
      );
      expect(onClose).toHaveBeenCalled();
    });
  });
});
