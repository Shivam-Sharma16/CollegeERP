import React from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export function FeeCollectionChart({ data }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
        <defs>
          <linearGradient id="colorAmount" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="var(--color-success)" stopOpacity={0.3}/>
            <stop offset="95%" stopColor="var(--color-success)" stopOpacity={0}/>
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border)" />
        <XAxis 
          dataKey="month" 
          axisLine={false} 
          tickLine={false} 
          tick={{ fill: 'var(--color-text-muted)', fontSize: 12 }} 
          dy={10}
        />
        <YAxis 
          axisLine={false} 
          tickLine={false} 
          tick={{ fill: 'var(--color-text-muted)', fontSize: 12 }} 
          tickFormatter={(value) => `$${value}`}
        />
        <Tooltip 
          contentStyle={{ 
            backgroundColor: 'var(--color-surface)', 
            borderColor: 'var(--color-border)',
            borderRadius: 'var(--radius-sm)',
            color: 'var(--color-text)'
          }}
          itemStyle={{ color: 'var(--color-text)' }}
          formatter={(value) => [`$${value}`, 'Collected']}
        />
        <Area 
          type="monotone" 
          dataKey="amount" 
          stroke="var(--color-success)" 
          strokeWidth={3}
          fillOpacity={1} 
          fill="url(#colorAmount)" 
          animationBegin={0}
          animationDuration={800}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
