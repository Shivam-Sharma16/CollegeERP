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

export function FacultyWorkloadChart({ data }) {
  const chartData = React.useMemo(() => {
    if (!data) return [];
    const list = Array.isArray(data) ? data : data.facultyWorkload || [];
    return list.slice(0, 10).map(item => ({
      name: (item.name || 'Faculty').split(' ')[0],
      fullName: item.name || 'Faculty',
      subjects: item.totalSubjects || 0,
      sections: item.totalSections || 0,
      isOverloaded: Boolean(item.isOverloaded),
    }));
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
          formatter={(val, name, entry) => [
            `${val}${entry?.payload?.isOverloaded ? ' (Overloaded)' : ''}`,
            name === 'subjects' ? 'Subjects' : 'Sections',
          ]}
          labelFormatter={(_, items) => items?.[0]?.payload?.fullName || ''}
        />
        <Legend
          verticalAlign="top"
          align="right"
          wrapperStyle={{ paddingBottom: '8px', fontSize: '12px' }}
          formatter={(val) => <span style={{ color: 'var(--color-text)' }}>{val === 'subjects' ? 'Subjects' : 'Sections'}</span>}
        />
        <Bar dataKey="subjects" fill="#8b5cf6" radius={[4, 4, 0, 0]} maxBarSize={28} />
        <Bar dataKey="sections" fill="#f59e0b" radius={[4, 4, 0, 0]} maxBarSize={28} />
      </BarChart>
    </ResponsiveContainer>
  );
}
