import React from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid } from 'recharts';
import type { OperatingExpensesChartDataPoint } from '../types';

interface Props {
  data: OperatingExpensesChartDataPoint[];
}

const yAxisFormatter = (value: number) => {  
  return value.toLocaleString('vi-VN', { maximumFractionDigits: 0 });
};

const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
        return (
            <div className="bg-white p-2 border border-gray-300 rounded shadow-lg text-sm text-gray-800">
                <p className="font-bold">{label}</p>
                {payload.map((p: any) => (
                    <p key={p.dataKey} style={{ color: p.color }}>
                        {p.name}: {yAxisFormatter(p.value)} (triệu đồng)
                    </p>
                ))}
            </div>
        );
    }
    return null;
};

const OperatingExpensesChart: React.FC<Props> = ({ data }) => {
  if (!data || data.length === 0) {
    return <div className="text-center text-xs text-gray-500 h-full flex items-center justify-center">Đang tải dữ liệu biểu đồ...</div>;
  }
  
  const axisAndGridColor = '#d1d5db';
  const textColor = '#6b7281';

  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={{ top: 5, right: 10, left: 20, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={axisAndGridColor} />
        <XAxis dataKey="name" stroke={textColor} tick={{ fontSize: 12, fill: textColor }} />
        <YAxis 
          stroke={textColor} 
          tick={{ fontSize: 12, fill: textColor }} 
          tickFormatter={yAxisFormatter} 
          width={90}
          label={{ value: '(triệu đồng)', angle: -90, position: 'insideLeft', fill: textColor, fontSize: 12 }}
        />
        <Tooltip content={<CustomTooltip />} />
        <Legend wrapperStyle={{ fontSize: "12px", paddingTop: '10px', color: textColor }} verticalAlign="bottom" />
        <Line type="monotone" dataKey="gaExpenses" stroke="#f97316" strokeWidth={2} name="Chi phí QLDN" dot={{ r: 4 }} activeDot={{ r: 6 }} />
        <Line type="monotone" dataKey="sellingExpenses" stroke="#ef4444" strokeWidth={2} name="Chi phí bán hàng" dot={{ r: 4 }} activeDot={{ r: 6 }} />
      </LineChart>
    </ResponsiveContainer>
  );
};

export default OperatingExpensesChart;