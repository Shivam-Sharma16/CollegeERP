import { CreateUserModal } from './CreateUserModal';
import { useOnboardStudentMutation } from '../../api/usersApi';

export function CreateStudentModal({ isOpen, onClose }) {
  return (
    <CreateUserModal
      isOpen={isOpen}
      onClose={onClose}
      title="Onboard Student"
      roleLabel="Student"
      useMutationHook={useOnboardStudentMutation}
      disabledDepartmentText="Your Section"
    />
  );
}
