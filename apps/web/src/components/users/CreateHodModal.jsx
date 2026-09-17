import { CreateUserModal } from './CreateUserModal';
import { useCreateHodMutation } from '../../api/usersApi';
import { useListDepartmentsQuery } from '../../api/departmentsApi';

export function CreateHodModal({ isOpen, onClose }) {
  const { data } = useListDepartmentsQuery(undefined, {
    skip: !isOpen,
    refetchOnMountOrArgChange: true,
  });
  const departments = data?.data || [];

  return (
    <CreateUserModal
      isOpen={isOpen}
      onClose={onClose}
      title="Create Head of Department"
      roleLabel="HOD"
      useMutationHook={useCreateHodMutation}
      showDepartmentSelect={true}
      departments={departments}
    />
  );
}
