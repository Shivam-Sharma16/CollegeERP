import { CreateUserModal } from './CreateUserModal';
import { useCreateCcMutation } from '../../api/usersApi';

export function CreateCcModal({ isOpen, onClose }) {
  return (
    <CreateUserModal
      isOpen={isOpen}
      onClose={onClose}
      title="Create Class Coordinator"
      roleLabel="CC"
      useMutationHook={useCreateCcMutation}
      disabledDepartmentText="Your Department"
    />
  );
}
