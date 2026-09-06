import { CreateUserModal } from './CreateUserModal';
import { useCreateFacultyMutation } from '../../api/usersApi';

export function CreateFacultyModal({ isOpen, onClose }) {
  return (
    <CreateUserModal
      isOpen={isOpen}
      onClose={onClose}
      title="Create Faculty"
      roleLabel="Faculty"
      useMutationHook={useCreateFacultyMutation}
      disabledDepartmentText="Your Department"
    />
  );
}
