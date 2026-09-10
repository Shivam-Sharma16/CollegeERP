import { Table } from '../ui/Table';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';

import { memo } from 'react';

export const UsersTable = memo(function UsersTable({ title, data = [], columns = [], isLoading, onCreate, createLabel }) {
  return (
    <Card>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--spacing-4)' }}>
        <h3 style={{ fontSize: 'var(--text-lg)', fontWeight: 600 }}>{title}</h3>
        {onCreate && createLabel && (
          <Button onClick={onCreate} variant="primary">
            {createLabel}
          </Button>
        )}
      </div>
      <Table columns={columns} data={data} isLoading={isLoading} emptyMessage="No users found." />
    </Card>
  );
});
