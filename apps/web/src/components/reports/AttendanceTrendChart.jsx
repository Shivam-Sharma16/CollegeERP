import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export function AttendanceTrendChart({ data }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border)" />
        <XAxis 
          dataKey="date" 
          axisLine={false} 
          tickLine={false} 
          tick={{ fill: 'var(--color-text-muted)', fontSize: 12 }} 
          dy={10}
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
            color: 'var(--color-text)'
          }}
          itemStyle={{ color: 'var(--color-text)' }}
        />
        <Line 
          type="monotone" 
          dataKey="percentage" 
          stroke="var(--color-primary)" 
          strokeWidth={3} 
          dot={{ r: 4, fill: 'var(--color-primary)', strokeWidth: 0 }}
          activeDot={{ r: 6 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
