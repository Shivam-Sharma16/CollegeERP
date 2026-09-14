import React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

export function StudentFacultyCountChart({ data }) {
  // data can be array of department objects or { overall, departments }
  const chartData = React.useMemo(() => {
    if (!data) return [];
    if (Array.isArray(data)) return data;
    if (data.departments && Array.isArray(data.departments)) {
      return data.departments.map(d => ({
        name: d.code || d.name || 'Dept',
        fullName: d.name,
        students: d.totalStudents || 0,
        faculty: d.totalFaculty || 0,
      }));
    }
    return [];
  }, [data]);

  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={chartData} margin={{ top: 15, right: 15, left: -10, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border)" />
        <XAxis
          dataKey="name"
          axisLine={false}
          tickLine={false}
          tick={{ fill: 'var(--color-text-muted)', fontSize: 12 }}
        />
        <YAxis
          axisLine={false}
          tickLine={false}
          tick={{ fill: 'var(--color-text-muted)', fontSize: 12 }}
          allowDecimals={false}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: 'var(--color-surface)',
            borderColor: 'var(--color-border)',
            borderRadius: 'var(--radius-sm)',
            color: 'var(--color-text)',
          }}
          formatter={(value, name) => [value, name === 'students' ? 'Students' : 'Faculty']}
          labelFormatter={(_, items) => items?.[0]?.payload?.fullName || ''}
        />
        <Legend
          verticalAlign="top"
          align="right"
          wrapperStyle={{ paddingBottom: '8px', fontSize: '12px' }}
          formatter={(val) => <span style={{ color: 'var(--color-text)' }}>{val === 'students' ? 'Students' : 'Faculty'}</span>}
        />
        <Bar dataKey="students" fill="var(--color-primary)" radius={[4, 4, 0, 0]} maxBarSize={32} />
        <Bar dataKey="faculty" fill="var(--color-secondary)" radius={[4, 4, 0, 0]} maxBarSize={32} />
      </BarChart>
    </ResponsiveContainer>
  );
}
