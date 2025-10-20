import React, { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine } from 'recharts';

const colors = {
    increase: '#22c55e', // green-500
    decrease: '#ef4444', // red-500
    total: '#3b82f6',    // blue-500
};

const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
        const item = payload[0].payload;
        return (
            <div className="bg-white p-2 border border-gray-300 rounded shadow-lg text-sm text-gray-800">
                <p className="font-bold">{item.name}</p>
                <p style={{ color: item.type === 'total' ? colors.total : item.value > 0 ? colors.increase : colors.decrease }}>
                    Giá trị: {Math.round(item.value).toLocaleString('vi-VN')}
                </p>
            </div>
        );
    }
    return null;
};

interface WaterfallChartProps {
    data: { name: string; value: number; type: 'total' | 'change' }[];
}

const WaterfallChart: React.FC<WaterfallChartProps> = ({ data }) => {
    if (!data || data.length === 0) {
        return (
            <div className="text-center text-xs text-gray-500 h-full flex items-center justify-center p-4">
                Chọn một chỉ tiêu tổng hợp từ bảng bên dưới để xem phân tích chênh lệch.
            </div>
        );
    }
    
    const processedData = useMemo(() => {
        let runningTotal = 0;
        return data.map(item => {
            const isTotal = item.type === 'total';
            const isPositive = item.value >= 0;

            let base = 0;
            let totalVal = 0;
            let increaseVal = 0;
            let decreaseVal = 0;

            if (isTotal) {
                totalVal = item.value;
            } else {
                if (isPositive) {
                    base = runningTotal;
                    increaseVal = item.value;
                } else {
                    base = runningTotal + item.value; // base is the bottom of the bar
                    decreaseVal = -item.value; // height of bar is positive
                }
                runningTotal += item.value;
            }
            return { ...item, base, totalVal, increaseVal, decreaseVal };
        });
    }, [data]);
    
    const axisAndGridColor = '#d1d5db';
    const textColor = '#6b7281';
    const yAxisFormatter = (value: number) => value.toLocaleString('vi-VN', { notation: 'compact' });

    return (
        <ResponsiveContainer width="100%" height="100%">
            <BarChart data={processedData} margin={{ top: 5, right: 10, left: 20, bottom: 40 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={axisAndGridColor} />
                <XAxis dataKey="name" stroke={textColor} tick={{ fontSize: 11, fill: textColor }} interval={0} angle={-45} textAnchor="end" height={60} />
                <YAxis 
                    stroke={textColor} 
                    tick={{ fontSize: 12, fill: textColor }} 
                    tickFormatter={yAxisFormatter} 
                    width={90}
                    label={{ value: '(triệu đồng)', angle: -90, position: 'insideLeft', fill: textColor, fontSize: 12 }}
                />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(206, 206, 206, 0.2)' }} />
                <ReferenceLine y={0} stroke={axisAndGridColor} />
                <Bar dataKey="base" stackId="a" fill="transparent" />
                <Bar dataKey="totalVal" stackId="a" fill={colors.total} name="Tổng" />
                <Bar dataKey="increaseVal" stackId="a" fill={colors.increase} name="Tăng" />
                <Bar dataKey="decreaseVal" stackId="a" fill={colors.decrease} name="Giảm" />
            </BarChart>
        </ResponsiveContainer>
    );
};

export default WaterfallChart;