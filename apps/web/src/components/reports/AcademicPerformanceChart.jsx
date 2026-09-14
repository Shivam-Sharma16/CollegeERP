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

export function AcademicPerformanceChart({ data }) {
  const chartData = React.useMemo(() => {
    if (!data) return [];
    const list = Array.isArray(data) ? data : data.trend || [];
    return list.map(item => ({
      exam: item.examType || item.exam || item.name || 'Exam',
      average: Number(item.averagePercentage ?? item.averageMarks ?? item.average ?? 0),
      passRate: Number(item.passingRate ?? item.passRate ?? 0),
    }));
  }, [data]);

  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={chartData} margin={{ top: 15, right: 15, left: -10, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border)" />
        <XAxis
          dataKey="exam"
          axisLine={false}
          tickLine={false}
          tick={{ fill: 'var(--color-text-muted)', fontSize: 12 }}
        />
        <YAxis
          axisLine={false}
          tickLine={false}
          tick={{ fill: 'var(--color-text-muted)', fontSize: 12 }}
          domain={[0, 100]}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: 'var(--color-surface)',
            borderColor: 'var(--color-border)',
            borderRadius: 'var(--radius-sm)',
            color: 'var(--color-text)',
          }}
          formatter={(val, name) => [`${val}%`, name === 'average' ? 'Avg Percentage' : 'Passing Rate']}
        />
        <Legend
          verticalAlign="top"
          align="right"
          wrapperStyle={{ paddingBottom: '8px', fontSize: '12px' }}
          formatter={(val) => <span style={{ color: 'var(--color-text)' }}>{val === 'average' ? 'Avg Percentage' : 'Passing Rate'}</span>}
        />
        <Bar dataKey="average" fill="#3b82f6" radius={[4, 4, 0, 0]} maxBarSize={32} />
        <Bar dataKey="passRate" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={32} />
      </BarChart>
    </ResponsiveContainer>
  );
}
