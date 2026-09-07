import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export function MarksDistributionChart({ data }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border)" />
        <XAxis 
          dataKey="range" 
          axisLine={false} 
          tickLine={false} 
          tick={{ fill: 'var(--color-text-muted)', fontSize: 12 }} 
          dy={10}
        />
        <YAxis 
          axisLine={false} 
          tickLine={false} 
          tick={{ fill: 'var(--color-text-muted)', fontSize: 12 }} 
        />
        <Tooltip 
          cursor={{ fill: 'var(--color-surface-elevated)', opacity: 0.4 }}
          contentStyle={{ 
            backgroundColor: 'var(--color-surface)', 
            borderColor: 'var(--color-border)',
            borderRadius: 'var(--radius-sm)',
            color: 'var(--color-text)'
          }}
        />
        <Bar 
          dataKey="count" 
          fill="var(--color-secondary)" 
          radius={[4, 4, 0, 0]} 
          animationBegin={0}
          animationDuration={800}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
