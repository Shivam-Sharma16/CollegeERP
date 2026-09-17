import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CreateSubjectModal } from '../components/hod/CreateSubjectModal';
import { ManageBatchesModal } from '../components/hod/ManageBatchesModal';
import { TeachingAssignmentModal } from '../components/hod/TeachingAssignmentModal';
import { EscalatedDisputesTab } from '../components/hod/EscalatedDisputesTab';
import * as academicApi from '../api/academicApi';
import * as usersApi from '../api/usersApi';
import * as attendanceApi from '../api/attendanceApi';
import * as departmentsApi from '../api/departmentsApi';
import * as teachingApi from '../api/teachingApi';

vi.mock('../components/ui/ToastContext', () => ({
  useToast: () => ({
    showToast: vi.fn(),
  }),
}));

vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }) => <div {...props}>{children}</div>,
    section: ({ children, ...props }) => <section {...props}>{children}</section>,
    button: ({ children, ...props }) => <button {...props}>{children}</button>,
  },
  AnimatePresence: ({ children }) => <>{children}</>,
}));

vi.mock('../api/academicApi', () => ({
  useCreateSubjectMutation: vi.fn(),
  useListBatchesQuery: vi.fn(),
  useCreateBatchMutation: vi.fn(),
  useUpdateBatchMutation: vi.fn(),
  useDeleteBatchMutation: vi.fn(),
}));

vi.mock('../api/usersApi', () => ({
  useListSectionStudentsQuery: vi.fn(),
}));

vi.mock('../api/attendanceApi', () => ({
  useListEscalatedDisputesQuery: vi.fn(),
  useResolveEscalationMutation: vi.fn(),
}));

vi.mock('../api/departmentsApi', () => ({
  useResolveDeptTreeQuery: vi.fn(),
}));

vi.mock('../api/teachingApi', () => ({
  useCreateTeachingAssignmentMutation: vi.fn(),
}));

describe('PHASE 88 — HOD Frontend: Labs, Batches & Escalated Disputes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('1. CreateSubjectModal (Lecture/Lab Toggle & Batches Action)', () => {
    it('toggles between Lecture and Lab, revealing section batch management when Lab is selected', async () => {
      const mockCreateSubject = vi.fn().mockReturnValue({ unwrap: () => Promise.resolve({}) });
      academicApi.useCreateSubjectMutation.mockReturnValue([mockCreateSubject, { isLoading: false }]);

      const mockDepartment = {
        _id: 'dept-1',
        years: [
          {
            year: 1,
            semesters: [
              {
                _id: 'sem-1',
                semester: 1,
                sections: [
                  { _id: 'sec-a', name: 'A', capacity: 60 },
                  { _id: 'sec-b', name: 'B', capacity: 60 },
                ],
              },
            ],
          },
        ],
      };

      render(
        <CreateSubjectModal
          isOpen={true}
          onClose={vi.fn()}
          departmentId="dept-1"
          department={mockDepartment}
        />
      );

      // Initially in Lecture mode
      const lectureRadio = screen.getByRole('radio', { name: /Lecture/i });
      const labRadio = screen.getByRole('radio', { name: /Lab/i });
      expect(lectureRadio).toHaveAttribute('aria-checked', 'true');
      expect(labRadio).toHaveAttribute('aria-checked', 'false');
      expect(screen.queryByText(/Section Batches Required/i)).not.toBeInTheDocument();

      // Click Lab toggle
      fireEvent.click(labRadio);
      expect(labRadio).toHaveAttribute('aria-checked', 'true');

      // Select semester
      const semesterSelect = screen.getByLabelText(/Assign to Semester/i);
      fireEvent.change(semesterSelect, { target: { value: 'sem-1' } });

      // Lab section batch setup should now be visible with Section A and Section B
      expect(screen.getByText(/Lab Subject: Section Batches Required/i)).toBeInTheDocument();
      expect(screen.getByText(/Section A \(Cap: 60\)/i)).toBeInTheDocument();
      expect(screen.getByText(/Section B \(Cap: 60\)/i)).toBeInTheDocument();
      expect(screen.getAllByRole('button', { name: /Manage Batches/i }).length).toBe(2);

      // Fill in subject fields and submit
      fireEvent.change(screen.getByLabelText(/Subject Code/i), { target: { value: 'CS102L' } });
      fireEvent.change(screen.getByLabelText(/Subject Name/i), { target: { value: 'Data Structures Lab' } });

      const submitBtn = screen.getByRole('button', { name: /Add Subject/i });
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(mockCreateSubject).toHaveBeenCalledWith(
          expect.objectContaining({
            departmentId: 'dept-1',
            semesterId: 'sem-1',
            code: 'CS102L',
            name: 'Data Structures Lab',
            type: 'lab',
          })
        );
      });
    });
  });

  describe('2. ManageBatchesModal (Mutually Exclusive Student Membership)', () => {
    it('prevents assigning a student who is already in a different batch of the same section', async () => {
      const mockBatches = [
        {
          _id: 'batch-1',
          name: 'Batch 1',
          studentIds: ['stu-alice', 'stu-bob'],
        },
        {
          _id: 'batch-2',
          name: 'Batch 2',
          studentIds: ['stu-charlie'],
        },
      ];

      const mockStudents = [
        { _id: 'stu-alice', name: 'Alice Smith', rollNumber: 'CS01', email: 'alice@test.edu' },
        { _id: 'stu-bob', name: 'Bob Jones', rollNumber: 'CS02', email: 'bob@test.edu' },
        { _id: 'stu-charlie', name: 'Charlie Brown', rollNumber: 'CS03', email: 'charlie@test.edu' },
        { _id: 'stu-david', name: 'David Lee', rollNumber: 'CS04', email: 'david@test.edu' },
      ];

      academicApi.useListBatchesQuery.mockReturnValue({ data: mockBatches, isLoading: false });
      usersApi.useListSectionStudentsQuery.mockReturnValue({ data: mockStudents, isLoading: false });
      const mockCreateBatch = vi.fn().mockReturnValue({ unwrap: () => Promise.resolve({ data: { batch: {} } }) });
      academicApi.useCreateBatchMutation.mockReturnValue([mockCreateBatch, { isLoading: false }]);
      academicApi.useUpdateBatchMutation.mockReturnValue([vi.fn(), { isLoading: false }]);
      academicApi.useDeleteBatchMutation.mockReturnValue([vi.fn(), { isLoading: false }]);

      const mockSection = { _id: 'sec-a', name: 'A', capacity: 60 };

      render(
        <ManageBatchesModal
          isOpen={true}
          onClose={vi.fn()}
          section={mockSection}
          departmentId="dept-1"
        />
      );

      // We are creating a new batch ("Batch 3" auto-suggested)
      expect(screen.getByDisplayValue(/Batch 3/i)).toBeInTheDocument();

      // Alice & Bob are in Batch 1 -> Checkboxes MUST BE DISABLED
      const aliceCheck = screen.getByLabelText(/Select student Alice Smith/i);
      const bobCheck = screen.getByLabelText(/Select student Bob Jones/i);
      expect(aliceCheck).toBeDisabled();
      expect(bobCheck).toBeDisabled();
      expect(screen.getAllByText(/In: Batch 1/i).length).toBe(2);

      // Charlie is in Batch 2 -> Checkbox MUST BE DISABLED
      const charlieCheck = screen.getByLabelText(/Select student Charlie Brown/i);
      expect(charlieCheck).toBeDisabled();
      expect(screen.getByText(/In: Batch 2/i)).toBeInTheDocument();

      // David is Unassigned -> Checkbox MUST BE ENABLED
      const davidCheck = screen.getByLabelText(/Select student David Lee/i);
      expect(davidCheck).not.toBeDisabled();
      expect(davidCheck).not.toBeChecked();

      // Select David
      fireEvent.click(davidCheck);
      expect(davidCheck).toBeChecked();

      // Attempting to click disabled Alice should do nothing
      fireEvent.click(aliceCheck);
      expect(aliceCheck).not.toBeChecked();

      // Save new Batch 3 with only David
      const saveBtn = screen.getByRole('button', { name: /Create Batch/i });
      fireEvent.click(saveBtn);

      await waitFor(() => {
        expect(mockCreateBatch).toHaveBeenCalledWith({
          sectionId: 'sec-a',
          name: 'Batch 3',
          studentIds: ['stu-david'],
        });
      });
    });
  });

  describe('3. TeachingAssignmentModal (Batch-Aware Assignment for Labs)', () => {
    it('requires selecting a batch when a lab subject is picked, and passes batchId to mutation', async () => {
      const mockAssignSubject = vi.fn().mockReturnValue({ unwrap: () => Promise.resolve({}) });
      teachingApi.useCreateTeachingAssignmentMutation.mockReturnValue([mockAssignSubject, { isLoading: false }]);

      departmentsApi.useResolveDeptTreeQuery.mockReturnValue({
        data: {
          data: {
            departments: [
              {
                _id: 'dept-1',
                years: [
                  {
                    year: 2,
                    semesters: [
                      {
                        _id: 'sem-3',
                        semester: 3,
                        subjects: [
                          { _id: 'sub-theory', name: 'Database Systems', code: 'CS301', type: 'lecture' },
                          { _id: 'sub-lab', name: 'Database Systems Lab', code: 'CS301L', type: 'lab' },
                        ],
                        sections: [{ _id: 'sec-a', name: 'A', capacity: 60 }],
                      },
                    ],
                  },
                ],
              },
            ],
          },
        },
        isLoading: false,
      });

      academicApi.useListBatchesQuery.mockImplementation((secId) => {
        if (secId === 'sec-a') {
          return {
            data: [
              { _id: 'batch-b1', name: 'Batch 1', studentIds: ['s1', 's2'] },
              { _id: 'batch-b2', name: 'Batch 2', studentIds: ['s3', 's4'] },
            ],
            isLoading: false,
          };
        }
        return { data: [], isLoading: false };
      });

      const mockFaculty = { _id: 'fac-1', name: 'Dr. Alan Turing' };

      render(
        <TeachingAssignmentModal
          isOpen={true}
          onClose={vi.fn()}
          faculty={mockFaculty}
        />
      );

      // Select Theory Subject first -> Lab Batch selector is NOT present
      const subjectSelect = screen.getByLabelText(/^Subject$/i);
      fireEvent.change(subjectSelect, { target: { value: 'sub-theory' } });
      expect(screen.queryByLabelText(/Lab Batch/i)).not.toBeInTheDocument();

      // Now switch to Lab Subject -> Lab Batch selector is required
      fireEvent.change(subjectSelect, { target: { value: 'sub-lab' } });
      expect(screen.getByText(/Type: Lab Subject \(Batch-Level Assignment\)/i)).toBeInTheDocument();

      // Select Section A
      const sectionSelect = screen.getByLabelText(/Section/i);
      fireEvent.change(sectionSelect, { target: { value: 'sec-a' } });

      // Lab Batch dropdown appears
      const batchSelect = await screen.findByLabelText(/Lab Batch/i);
      expect(batchSelect).toBeInTheDocument();

      // Select Batch 2
      fireEvent.change(batchSelect, { target: { value: 'batch-b2' } });

      // Confirm assignment
      const submitBtn = screen.getByRole('button', { name: /Confirm Assignment/i });
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(mockAssignSubject).toHaveBeenCalledWith(
          expect.objectContaining({
            facultyId: 'fac-1',
            subjectId: 'sub-lab',
            sectionId: 'sec-a',
            batchId: 'batch-b2',
          })
        );
      });
    });
  });

  describe('4. EscalatedDisputesTab (Department-Wide & Explicit Labels)', () => {
    it('renders department-wide escalated disputes with section and CC labels, and resolves them', async () => {
      const mockDisputes = [
        {
          _id: 'rec-1',
          student: { name: 'Emma Watson', rollNumber: 'CS45' },
          sectionName: 'Section A',
          subjectCode: 'CS201',
          subjectName: 'Operating Systems',
          reason: 'Biometric reader did not recognize thumbprint',
          escalation: {
            escalatedByName: 'Prof. Minerva McGonagall',
            reason: 'Student showed gate entry pass timestamp matching session time.',
            status: 'pending',
          },
          lectureSessionId: {
            topic: 'Process Synchronization',
            date: '2026-09-15T10:00:00.000Z',
          },
        },
      ];

      attendanceApi.useListEscalatedDisputesQuery.mockReturnValue({
        data: mockDisputes,
        isLoading: false,
      });

      const mockResolveEscalation = vi.fn().mockReturnValue({ unwrap: () => Promise.resolve({}) });
      attendanceApi.useResolveEscalationMutation.mockReturnValue([
        mockResolveEscalation,
        { isLoading: false },
      ]);

      render(<EscalatedDisputesTab />);

      // Verify Student Name & Roll
      expect(screen.getByText('Emma Watson')).toBeInTheDocument();
      expect(screen.getByText('CS45')).toBeInTheDocument();

      // Verify Explicit Section Name
      expect(screen.getByText(/Section Section A/i)).toBeInTheDocument();

      // Verify Explicit Escalating CC
      expect(screen.getByText(/Escalated by CC: Prof. Minerva McGonagall/i)).toBeInTheDocument();

      // Verify Student Claim & Escalation Reason
      expect(screen.getByText(/Biometric reader did not recognize thumbprint/i)).toBeInTheDocument();
      expect(screen.getByText(/Student showed gate entry pass timestamp/i)).toBeInTheDocument();

      // Click Approve
      const approveBtn = screen.getByRole('button', { name: /Approve/i });
      fireEvent.click(approveBtn);

      await waitFor(() => {
        expect(mockResolveEscalation).toHaveBeenCalledWith({
          disputeId: 'rec-1',
          newStatus: 'present',
          resolution: expect.stringContaining('confirmed and approved'),
        });
      });
    });
  });
});
