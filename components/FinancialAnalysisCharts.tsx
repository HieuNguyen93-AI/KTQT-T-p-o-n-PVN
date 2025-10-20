import React, { useMemo } from 'react';
import { 
    BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, 
    ReferenceLine, CartesianGrid, LabelList, PieChart, Pie, Cell 
} from 'recharts';

const ChartWrapper: React.FC<{ title: string; children: React.ReactNode; }> = ({ title, children }) => (
    <div className="bg-white p-4 rounded-lg shadow h-[320px] flex flex-col">
        <h3 className="text-sm font-bold text-gray-700 text-center mb-4 uppercase">{title}</h3>
        <div className="flex-grow text-xs">
            {children}
        </div>
    </div>
);

const StructureChart: React.FC<{ data: any[]; onChartClick?: (rowName: string) => void }> = ({ data, onChartClick }) => {
    const textColor = '#6b7281';

    const customTooltipFormatter = (value: number, name: string, props: any) => {
        const { payload } = props;
        
        const totalAssets = payload.totalAssets;
        const percentage = totalAssets > 0 ? (Math.abs(value) / totalAssets) * 100 : 0;
        
        const formattedValue = (Number(value)).toLocaleString('vi-VN', { maximumFractionDigits: 0 });
        
        return [`${formattedValue} (${percentage.toFixed(2)}%)`, name];
    };

    const handleBarClick = (payload: any, dataKey: string) => {
        if (!onChartClick || !data || data.length === 0) return;

        const latestPeriodName = data[data.length - 1]?.name;
        // Check if the clicked bar belongs to the latest period
        if (payload.name === latestPeriodName) {
            const keyToRowNameMap: { [key: string]: string } = {
              shortTermAssets: 'TÀI SẢN NGẮN HẠN',
              longTermAssets: 'TÀI SẢN DÀI HẠN',
              liabilities: 'NỢ PHẢI TRẢ',
              equity: 'VỐN CHỦ SỞ HỮU',
            };
            const rowName = keyToRowNameMap[dataKey];
            if (rowName) {
              onChartClick(rowName);
            }
        }
    };
    
    const TooltipContent = ({ active, payload, label }: any) => {
        if (active && payload && payload.length) {
            return (
                <div className="bg-white p-2 border border-gray-300 rounded shadow-lg text-sm text-gray-800">
                    <p className="font-bold">{label}</p>
                    {payload.map((p: any) => (
                        <p key={p.dataKey} style={{ color: p.fill }}>
                           {p.name}: {Number(p.value).toLocaleString('vi-VN', { maximumFractionDigits: 0 })} (triệu đồng)
                        </p>
                    ))}
                </div>
            );
        }
        return null;
    };

    return (
        <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} layout="vertical" stackOffset="expand" margin={{ top: 0, right: 30, left: 10, bottom: 20 }}>
                <XAxis type="number" hide domain={[0, 100]} />
                <YAxis type="category" dataKey="name" width={80} tick={{ fontSize: 12, fill: textColor }} />
                <Tooltip content={<TooltipContent />} />
                <Legend iconSize={10} wrapperStyle={{ fontSize: "12px", bottom: 0, color: textColor }} />
                <Bar dataKey="shortTermAssets" fill="#a7d397" stackId="a" name="TS ngắn hạn" cursor="pointer" onClick={(payload) => handleBarClick(payload, 'shortTermAssets')} />
                <Bar dataKey="longTermAssets" fill="#558b2f" stackId="a" name="TS dài hạn" cursor="pointer" onClick={(payload) => handleBarClick(payload, 'longTermAssets')} />
                <Bar dataKey="liabilities" fill="#f39c12" stackId="a" name="Nợ phải trả" cursor="pointer" onClick={(payload) => handleBarClick(payload, 'liabilities')} />
                <Bar dataKey="equity" fill="#e67e22" stackId="a" name="Vốn chủ sở hữu" cursor="pointer" onClick={(payload) => handleBarClick(payload, 'equity')} />
            </BarChart>
        </ResponsiveContainer>
    );
};

const CapitalStructureChart: React.FC<{ data: any[] }> = ({ data }) => {
    const textColor = '#6b7281';

    const COLORS = ['#0088FE', '#FFBB28']; // Blue for Debt, Orange for Equity

    const RADIAN = Math.PI / 180;
    const renderCustomizedLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }: any) => {
        const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
        const x = cx + radius * Math.cos(-midAngle * RADIAN);
        const y = cy + radius * Math.sin(-midAngle * RADIAN);

        return (
            <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" className="font-semibold text-xs">
                {`${(percent * 100).toFixed(1)}%`}
            </text>
        );
    };

    const TooltipContent = ({ active, payload }: any) => {
        if (active && payload && payload.length) {
            return (
                <div className="bg-white p-2 border border-gray-300 rounded shadow-lg text-sm text-gray-800">
                     {payload.map((p: any) => (
                        <p key={p.dataKey} style={{ color: p.payload.fill }}>
                           {p.name}: {Number(p.value).toLocaleString('vi-VN', { maximumFractionDigits: 0 })} (triệu đồng)
                        </p>
                    ))}
                </div>
            );
        }
        return null;
    };

    return (
        <ResponsiveContainer width="100%" height="100%">
            <PieChart>
                <Pie
                    data={data}
                    cx="50%"
                    cy="45%"
                    labelLine={false}
                    label={renderCustomizedLabel}
                    outerRadius={90}
                    fill="#8884d8"
                    dataKey="value"
                    nameKey="name"
                >
                    {data.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                </Pie>
                <Tooltip content={<TooltipContent />} />
                <Legend iconSize={10} wrapperStyle={{ fontSize: "12px", bottom: 0, color: textColor }} />
            </PieChart>
        </ResponsiveContainer>
    );
};


const DebtChart: React.FC<{ data: any[] }> = ({ data }) => {
    const textColor = '#6b7281';
    const gridColor = '#d1d5db';

    const labelFormatter = (value: number) => {
        if (value === null || value === undefined || value === 0) return '';
        return Math.round(Math.abs(value)).toLocaleString('vi-VN');
    };

    const TooltipContent = ({ active, payload, label }: any) => {
        if (active && payload && payload.length) {
            return (
                <div className="bg-white p-2 border border-gray-300 rounded shadow-lg text-sm text-gray-800">
                    <p className="font-bold">{label}</p>
                    {payload.map((p: any) => (
                        <p key={p.dataKey} style={{ color: p.fill }}>
                           {p.name}: {Math.abs(p.value).toLocaleString('vi-VN', { maximumFractionDigits: 0 })} (triệu đồng)
                        </p>
                    ))}
                </div>
            );
        }
        return null;
    };

    return (
        <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} layout="vertical" margin={{ top: 0, right: 60, left: 30, bottom: 20 }}>
                 <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={gridColor} />
                <XAxis type="number" hide domain={['dataMin', 'dataMax']} />
                <YAxis type="category" dataKey="name" width={80} tick={{ fontSize: 12, fill: textColor }} axisLine={false} tickLine={false} />
                <Tooltip content={<TooltipContent />} />
                <Legend iconSize={10} wrapperStyle={{ fontSize: "12px", bottom: 0, color: textColor }} />
                <ReferenceLine x={0} stroke={gridColor} />
                <Bar dataKey="shortTermDebt" fill="#bdc3c7" name="Nợ ngắn hạn">
                    <LabelList dataKey="shortTermDebt" position="left" formatter={labelFormatter} style={{ fontSize: 12, fill: '#374151' }} />
                </Bar>
                <Bar dataKey="totalAssets" fill="#f39c12" name="Tổng cộng tài sản">
                    <LabelList dataKey="totalAssets" position="right" formatter={labelFormatter} style={{ fontSize: 12, fill: '#374151' }} />
                </Bar>
            </BarChart>
        </ResponsiveContainer>
    );
};

interface Props {
    data: any[];
    loading: boolean;
    onChartClick?: (rowName: string) => void;
}

const FinancialAnalysisCharts: React.FC<Props> = ({ data, loading, onChartClick }) => {
    if (loading) {
        return (
            <div className="text-center p-8 bg-white rounded-lg shadow">
                Đang tải dữ liệu phân tích...
            </div>
        );
    }

    if (!data || data.length === 0) {
        return (
            <div className="text-center p-8 bg-white rounded-lg shadow">
                Không có đủ dữ liệu lịch sử để phân tích.
            </div>
        );
    }

    const structureChartData = useMemo(() => {
        return data.map(d => ({
            ...d,
            liabilities: Math.abs(d.liabilities),
            equity: Math.abs(d.equity),
        }));
    }, [data]);

    const capitalStructureData = useMemo(() => {
        if (!data || data.length === 0) return [];
        const latestPeriod = data[data.length - 1];
        if (!latestPeriod) return [];
        return [
            { name: 'Tổng Nợ', value: Math.abs(latestPeriod.liabilities) },
            { name: 'VCSH', value: Math.abs(latestPeriod.equity) }
        ];
    }, [data]);

    const debtChartData = useMemo(() => {
        return data.map(d => ({
            ...d,
            shortTermDebt: -Math.abs(d.shortTermDebt),
        }));
    }, [data]);

    return (
        <div className="grid grid-cols-1 gap-4">
            <ChartWrapper title="Cấu trúc bảng cân đối kế toán">
                <StructureChart data={structureChartData} onChartClick={onChartClick} />
            </ChartWrapper>
            <ChartWrapper title="CẤU TRÚC NGUỒN VỐN">
                <CapitalStructureChart data={capitalStructureData} />
            </ChartWrapper>
            <ChartWrapper title="Nợ ngắn hạn so với tổng tài sản (triệu đồng)">
                <DebtChart data={debtChartData} />
            </ChartWrapper>
        </div>
    );
};

export default FinancialAnalysisCharts;