

import React from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid } from 'recharts';
import type { IncomeChartData } from '../types';

interface Props {
  data: IncomeChartData[];
  valueType?: 'currency' | 'percentage' | 'ratio' | 'days';
}

const CustomTooltip = ({ active, payload, label, valueType }: any) => {
    if (active && payload && payload.length) {
        const formatValue = (value: number) => {
            if (value === null || value === undefined) return 'N/A';
            switch (valueType) {
                case 'percentage': return `${(value * 100).toFixed(2)}%`;
                case 'ratio': return value.toFixed(2);
                case 'days': return `${Math.round(value)} ngày`;
                case 'currency':
                default:
                    return `${value.toLocaleString('vi-VN', { maximumFractionDigits: 0 })} (triệu đồng)`;
            }
        };

        return (
            <div className="bg-white p-2 border border-gray-300 rounded shadow-lg text-sm text-gray-800">
                <p className="font-bold">{label}</p>
                {payload.map((p: any) => (
                    <p key={p.dataKey} style={{ color: p.color }}>
                        {p.name}: {formatValue(p.value)}
                    </p>
                ))}
            </div>
        );
    }
    return null;
};

const IncomeStatementChart: React.FC<Props> = ({ data, valueType = 'currency' }) => {
  if (!data || data.length === 0) {
    return <div className="text-center text-xs text-gray-500 h-full flex items-center justify-center">Chọn một chỉ tiêu từ bảng bên dưới để xem biểu đồ.</div>;
  }
  
  const yAxisFormatter = (value: number) => {
    if (valueType === 'percentage') return `${(value * 100).toFixed(0)}%`;
    if (valueType === 'ratio' || valueType === 'days') return value.toFixed(1);
    // currency is default
    return value.toLocaleString('vi-VN', { maximumFractionDigits: 0 });
  };

  const axisAndGridColor = '#d1d5db';
  const textColor = '#6b7281';

  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={{ top: 5, right: 20, left: 20, bottom: 20 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={axisAndGridColor} />
        <XAxis dataKey="name" stroke={textColor} tick={{ fontSize: 12, fill: textColor }} />
        <YAxis 
          stroke={textColor} 
          tick={{ fontSize: 12, fill: textColor }} 
          tickFormatter={yAxisFormatter} 
          width={90}
          domain={['auto', 'auto']}
          label={valueType === 'currency' ? { value: '(triệu đồng)', angle: -90, position: 'insideLeft', fill: textColor, fontSize: 12 } : undefined}
        />
        <Tooltip content={<CustomTooltip valueType={valueType} />} />
        <Legend wrapperStyle={{ fontSize: "12px", color: textColor }} verticalAlign="bottom" />
        <Line 
            type="monotone" 
            dataKey="currentPeriod" 
            name="Kỳ này" 
            stroke="#4d7c0f" // dark green
            strokeWidth={2} 
            dot={{ r: 4, fill: '#4d7c0f' }} 
            activeDot={{ r: 6 }} 
        />
        <Line 
            type="monotone" 
            dataKey="previousPeriod" 
            name="Cùng kỳ năm trước" 
            stroke="#312e81" // dark indigo
            strokeWidth={2} 
            strokeDasharray="5 5" 
            dot={{ r: 4, fill: '#312e81' }} 
            activeDot={{ r: 6 }} 
        />
      </LineChart>
    </ResponsiveContainer>
  );
};

export default IncomeStatementChart;
