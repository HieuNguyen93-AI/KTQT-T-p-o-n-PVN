

import React, { useMemo } from 'react';
import { ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid, LabelList } from 'recharts';
import type { RevenueAndProfitChartDataPoint } from '../types';

interface Props {
  data: RevenueAndProfitChartDataPoint[];
}

const formatValueForLabel = (value: number | null) => {
    if (value === null) return '';
    return value.toLocaleString('vi-VN', { maximumFractionDigits: 0 });
};

const yAxisTickFormatter = (value: any) => {
    if (typeof value !== 'number') return value;
    return value.toLocaleString('vi-VN', { maximumFractionDigits: 0 });
}

const CustomLabel = (props: any) => {
    const { x, y, width, height, value, dataKey } = props;

    if (value === null || value === undefined) return null;

    let labelY = y - 5; // Default position above the bar/point
    let color = '#333';
    
    if (height < 0 && y > 0) { // For negative values, position below the bar
      labelY = y + Math.abs(height) + 15;
    }

    return (
        <text x={x + width / 2} y={labelY} fill={color} textAnchor="middle" fontSize={11} fontWeight="600">
            {formatValueForLabel(value)}
        </text>
    );
};

const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
        return (
            <div className="bg-white p-2 border border-gray-300 rounded shadow-lg text-sm text-gray-800">
                <p className="font-bold">{label}</p>
                {payload.map((p: any) => (
                    <p key={p.dataKey} style={{ color: p.color }}>
                        {p.name}: {Number(p.value).toLocaleString('vi-VN')} (triệu đồng)
                    </p>
                ))}
            </div>
        );
    }
    return null;
};

const RevenueAndProfitChart: React.FC<Props> = ({ data }) => {
  if (!data || data.length === 0) {
    return <div className="text-center text-xs text-gray-500 h-full flex items-center justify-center">Đang tải dữ liệu biểu đồ...</div>;
  }
  
  const processedData = useMemo(() => data.map(item => ({
      ...item,
      netRevenue: item.netRevenue !== null ? Math.abs(item.netRevenue) : null,
      grossProfit: item.grossProfit !== null ? Math.abs(item.grossProfit) : null,
      netProfit: item.netProfit !== null ? Math.abs(item.netProfit) : null,
  })), [data]);

  const axisAndGridColor = '#d1d5db';
  const textColor = '#6b7281';

  return (
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart data={processedData} margin={{ top: 20, right: 20, left: 10, bottom: 20 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={axisAndGridColor} />
        <XAxis dataKey="name" tick={{ fontSize: 12, fill: textColor }} />
        <YAxis yAxisId="left" orientation="left" stroke="#8884d8" tickFormatter={yAxisTickFormatter} tick={{ fontSize: 10, fill: textColor }} label={{ value: '(triệu đồng)', angle: -90, position: 'insideLeft', offset: 0, style: {fontSize: '12px', fill: textColor}}} />
        <YAxis yAxisId="right" orientation="right" stroke="#82ca9d" tickFormatter={yAxisTickFormatter} tick={{ fontSize: 10, fill: textColor }} />
        <Tooltip content={<CustomTooltip />} />
        <Legend wrapperStyle={{ fontSize: "12px", paddingTop: '20px', color: textColor }} verticalAlign="bottom" align="center" />
        <Bar dataKey="grossProfit" yAxisId="left" name="Lợi nhuận gộp" fill="#c8102e">
           <LabelList dataKey="grossProfit" content={<CustomLabel />} />
        </Bar>
        <Bar dataKey="netProfit" yAxisId="left" name="Lợi nhuận sau thuế" fill="#a1a1aa">
           <LabelList dataKey="netProfit" content={<CustomLabel />} />
        </Bar>
        <Line type="monotone" dataKey="netRevenue" yAxisId="right" name="Doanh thu thuần" stroke="#0077c8" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }}>
           <LabelList dataKey="netRevenue" content={<CustomLabel />} />
        </Line>
      </ComposedChart>
    </ResponsiveContainer>
  );
};

export default RevenueAndProfitChart;