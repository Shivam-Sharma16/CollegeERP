import { CreateUserModal } from './CreateUserModal';
import { useCreateAdminMutation } from '../../api/usersApi';

export function CreateAdminModal({ isOpen, onClose }) {
  return (
    <CreateUserModal
      isOpen={isOpen}
      onClose={onClose}
      title="Create Administrator"
      roleLabel="Admin"
      useMutationHook={useCreateAdminMutation}
    />
  );
}
