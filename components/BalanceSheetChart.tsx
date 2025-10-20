import React from 'react';
// FIX: Remove `defs`, `linearGradient`, and `stop` from the `recharts` import as they are standard SVG elements represented in JSX and not exported by the library.
import { BarChart, Bar, AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend, Line } from 'recharts';
import type { BalanceSheetChartDataPoint, IncomeChartData } from '../types';

const CustomTooltip = ({ active, payload, label, valueType }: any) => {
    if (active && payload && payload.length) {
        const formatValue = (value: number | null): string => {
            if (value === null || value === undefined) return 'N/A';
            if (valueType === 'percentage') {
                return `${(value * 100).toFixed(2)}%`;
            } else if (valueType === 'ratio') {
                return value.toFixed(2);
            } else if (valueType === 'days') {
                return `${Math.round(value)} ngày`;
            } else { // default to currency
                return `${value.toLocaleString('vi-VN', { maximumFractionDigits: 0 })} (triệu đồng)`;
            }
        };

        return (
            <div className="bg-white p-2 border border-gray-300 rounded shadow-lg text-sm text-gray-800">
                <p className="font-bold">{label}</p>
                {payload.map((entry: any) => (
                    <p key={entry.dataKey} style={{ color: entry.stroke || entry.fill }}>
                       {entry.name}: {formatValue(entry.value)}
                    </p>
                ))}
            </div>
        );
    }
    return null;
};

interface Props {
  data: BalanceSheetChartDataPoint[] | IncomeChartData[];
  chartType?: 'bar' | 'area';
  valueType?: 'currency' | 'percentage' | 'ratio' | 'days';
}

const BalanceSheetChart: React.FC<Props> = ({ data, chartType = 'bar', valueType = 'currency' }) => {
  if (!data || data.length === 0) {
    return <div className="text-center text-xs text-gray-500 h-full flex items-center justify-center">Chọn một chỉ tiêu từ bảng để xem biểu đồ.</div>;
  }
  
  const axisAndGridColor = '#d1d5db';
  const textColor = '#6b7281';

  const yAxisFormatter = (value: number) => {
    if (valueType === 'percentage') return `${(value * 100).toFixed(0)}%`;
    if (valueType === 'ratio' || valueType === 'days') return value.toFixed(1);
    return value.toLocaleString('vi-VN', { maximumFractionDigits: 0 });
  };
  
  const yAxisLabel = {
      value: valueType === 'currency' ? '(triệu đồng)' : '',
      angle: -90,
      position: 'insideLeft',
      fill: textColor,
      fontSize: 12,
  };

  if (chartType === 'area') {
    return (
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data as IncomeChartData[]} margin={{ top: 5, right: 20, left: 20, bottom: 20 }}>
          <defs>
            <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#006934" stopOpacity={0.8}/>
              <stop offset="95%" stopColor="#006934" stopOpacity={0}/>
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={axisAndGridColor} />
          <XAxis dataKey="name" stroke={textColor} tick={{ fontSize: 12, fill: textColor }} />
          <YAxis 
            domain={['auto', 'auto']} 
            stroke={textColor} 
            tick={{ fontSize: 12, fill: textColor }} 
            tickFormatter={yAxisFormatter}
            width={90}
            label={yAxisLabel}
          />
          <Tooltip content={<CustomTooltip valueType={valueType} />} />
          <Legend wrapperStyle={{ fontSize: "12px", color: textColor }} verticalAlign="bottom" />
          <Area type="monotone" dataKey="currentPeriod" name="Kỳ này" stroke="#006934" fillOpacity={1} fill="url(#colorValue)" strokeWidth={2} />
          <Line type="monotone" dataKey="previousPeriod" name="Cùng kỳ năm trước" stroke="#312e81" strokeWidth={2} strokeDasharray="5 5" dot={false} activeDot={{ r: 6 }} />
        </AreaChart>
      </ResponsiveContainer>
    );
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data as BalanceSheetChartDataPoint[]} margin={{ top: 5, right: 20, left: 20, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={axisAndGridColor} />
        <XAxis dataKey="name" stroke={textColor} tick={{ fontSize: 12, fill: textColor }} />
        <YAxis 
          domain={['auto', 'auto']} 
          stroke={textColor} 
          tick={{ fontSize: 12, fill: textColor }} 
          tickFormatter={yAxisFormatter}
          width={90}
          label={yAxisLabel}
        />
        <Tooltip content={<CustomTooltip valueType={valueType} />} cursor={{ fill: 'rgba(206, 206, 206, 0.2)' }} />
        <Bar 
          dataKey="value" 
          name="Giá trị"
          fill="#006934" 
        />
      </BarChart>
    </ResponsiveContainer>
  );
};

export default BalanceSheetChart;