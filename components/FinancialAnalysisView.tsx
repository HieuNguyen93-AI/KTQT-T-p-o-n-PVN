
import React, { useState } from 'react';
import type { FinancialAnalysisData, SelectedFAIndicator, IncomeChartData, BalanceSheetChartDataPoint, TreeRow, SelectedIndicator } from '../types';
import MetricCard from './MetricCard';
import { BuildingIcon, ShieldIcon, WalletIcon, ChevronDownIcon } from './icons';
import BalanceSheetChart from './BalanceSheetChart';
import IncomeStatementChart from './IncomeStatementChart';
import BalanceSheetTable from './BalanceSheetTable';
import IncomeStatementTable from './IncomeStatementTable';


const cx = (...c: Array<string | false | null | undefined>) => c.filter(Boolean).join(" ");

const formatValue = (value: number | null, unit: 'ratio' | 'percentage' | 'days' | 'currency') => {
    if (value === null || isNaN(value)) return '–';
    switch (unit) {
        case 'percentage': return `${(value * 100).toFixed(2)}%`;
        case 'ratio': return value.toFixed(2);
        case 'days': return Math.round(value).toLocaleString('vi-VN');
        case 'currency': return Math.round(value).toLocaleString('vi-VN');
        default: return value.toLocaleString('vi-VN');
    }
};

interface FinancialAnalysisTableProps {
    data: FinancialAnalysisData['tableData'];
    selectedIndicator: SelectedFAIndicator;
    onSelectIndicator: (indicator: SelectedFAIndicator) => void;
    // FIX: Add indicatorMetadata to props to receive it from FinancialAnalysisView.
    indicatorMetadata: { [key: string]: { group: string; name: string; formula: string; unit: 'ratio' | 'percentage' | 'days' | 'currency' } };
}

const FinancialAnalysisTable: React.FC<FinancialAnalysisTableProps> = ({ data, selectedIndicator, onSelectIndicator, indicatorMetadata }) => {

    const groupedRows = React.useMemo(() => {
        const groups: { [key: string]: FinancialAnalysisData['tableData']['rows'] } = {};
        for (const row of data.rows) {
            const groupName = indicatorMetadata[row.key]?.group || 'Khác';
            if (!groups[groupName]) {
                groups[groupName] = [];
            }
            groups[groupName].push(row);
        }
        
        const groupOrder = [
            'Các hệ số về khả năng sinh lời',
            'Các hệ số về cơ cấu vốn',
            'Các hệ số về khả năng thanh toán',
            'Phân tích Dupont',
            'Chỉ tiêu bổ sung'
        ];

        return groupOrder
            .map(groupName => ({ type: groupName, rows: groups[groupName] || [] }))
            .filter(group => group.rows.length > 0);

    }, [data.rows, indicatorMetadata]);

    return (
        <div className="overflow-x-auto">
            <table className="min-w-full bg-white text-sm table-fixed">
                <thead className="bg-gray-50">
                    <tr>
                        <th className="text-left font-semibold px-3 py-2 text-gray-600 w-[15%]">Loại chỉ tiêu</th>
                        <th className="text-left font-semibold px-3 py-2 text-gray-600 w-[30%]">Chỉ tiêu</th>
                        <th className="text-left font-semibold px-3 py-2 text-gray-600 w-[20%]">Công thức</th>
                        {data.headers.map(header => (
                            <th key={header} className="text-right font-semibold px-3 py-2 text-gray-600 w-[17.5%]">{header}</th>
                        ))}
                    </tr>
                </thead>
                <tbody className="text-slate-800">
                    {groupedRows.map(group => (
                        <React.Fragment key={group.type}>
                            {group.rows.map((row, rowIndex) => {
                                const isSelected = selectedIndicator.key === row.key;
                                const meta = indicatorMetadata[row.key];
                                if (!meta) return null;

                                return (
                                    <tr
                                        key={row.key}
                                        className={cx(
                                            "border-b border-gray-200 hover:bg-yellow-100/50 transition-colors cursor-pointer",
                                            rowIndex === 0 && "border-t-2 border-gray-300",
                                            isSelected && "bg-blue-100 hover:bg-blue-200"
                                        )}
                                        onClick={() => onSelectIndicator({ key: row.key, name: meta.name })}
                                    >
                                        {rowIndex === 0 && (
                                            <td
                                                className="px-3 py-2.5 align-top font-bold text-gray-600 bg-gray-50/70"
                                                rowSpan={group.rows.length}
                                            >
                                                {group.type}
                                            </td>
                                        )}
                                        <td className={`px-3 py-2.5 font-semibold ${isSelected ? 'text-blue-800' : 'text-gray-700'} truncate`}>{meta.name}</td>
                                        <td className="px-3 py-2.5 text-left text-gray-600 italic font-mono text-xs">{meta.formula}</td>
                                        {row.values.map((value, index) => (
                                            <td key={index} className="px-3 py-2.5 text-right font-mono">
                                                {formatValue(value, meta.unit)}
                                            </td>
                                        ))}
                                    </tr>
                                );
                            })}
                        </React.Fragment>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

const ToggleButton: React.FC<{ label: string; isOpen: boolean; onClick: () => void; }> = ({ label, isOpen, onClick }) => (
    <button
        onClick={onClick}
        className="w-full flex justify-between items-center px-4 py-3 text-left font-semibold text-base text-gray-800 bg-gray-100 hover:bg-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all duration-200"
        aria-expanded={isOpen}
    >
        <span>{label}</span>
        <ChevronDownIcon className={`h-5 w-5 transform transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
    </button>
);


interface Props {
    loading: boolean;
    data: FinancialAnalysisData | null;
    valueChartData: BalanceSheetChartDataPoint[];
    dynamicFAChartData: IncomeChartData[];
    selectedIndicator: SelectedFAIndicator;
    onIndicatorSelect: (indicator: SelectedFAIndicator) => void;
    bsData: TreeRow[];
    bsLoading: boolean;
    bsError: string | null;
    plData: TreeRow[];
    plLoading: boolean;
    plError: string | null;
    reportingPeriod: string;
    comparisonPeriodBS: string;
    comparisonPeriodPL: string;
    previousQuarterLabelPL: string;
    reportingLabelText: string;
    // FIX: Add indicatorMetadata to props to receive it from App.tsx.
    indicatorMetadata: { [key: string]: { group: string; name: string; formula: string; unit: 'ratio' | 'percentage' | 'days' | 'currency' } };
}

const FinancialAnalysisView: React.FC<Props> = (props) => {
    const { 
        loading, data, valueChartData, dynamicFAChartData, selectedIndicator, onIndicatorSelect,
        bsData, bsLoading, bsError, plData, plLoading, plError,
        reportingPeriod, comparisonPeriodBS, comparisonPeriodPL,
        previousQuarterLabelPL, reportingLabelText, indicatorMetadata
    } = props;
    
    const [showBsTable, setShowBsTable] = useState(false);
    const [showPlTable, setShowPlTable] = useState(false);
    const [selectedBsIndicator, setSelectedBsIndicator] = useState<SelectedIndicator | null>(null);
    const [selectedPlIndicator, setSelectedPlIndicator] = useState<SelectedIndicator | null>(null);
    // FIX: Add state for the comparison source for the BalanceSheetTable
    const [bsTableComparisonSource, setBsTableComparisonSource] = useState<'previousQuarter' | 'samePeriodLastYear' | 'beginningOfYear'>('previousQuarter');

    if (loading) {
        return (
            <div className="flex items-center justify-center h-96 bg-white rounded-lg shadow">
                <p>Đang tải dữ liệu phân tích...</p>
            </div>
        );
    }

    if (!data) {
        return (
            <div className="flex items-center justify-center h-96 bg-white rounded-lg shadow">
                <p>Không có dữ liệu cho các tiêu chí đã chọn.</p>
            </div>
        );
    }
    
    const { latestRatios, tableData } = data;
    const fmtPct = (n: number | null) => n === null ? '–' : `${(n * 100).toFixed(2)}%`;

    const meta = indicatorMetadata[selectedIndicator.key];
    const chartValueType = meta ? meta.unit : 'ratio';

    return (
        <div className="flex flex-col gap-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <MetricCard
                    title={`ROA (Lũy kế đến ${reportingLabelText})`}
                    value={fmtPct(latestRatios.roa)}
                    icon={<WalletIcon />}
                    color="green"
                />
                <MetricCard
                    title={`ROE (Lũy kế đến ${reportingLabelText})`}
                    value={fmtPct(latestRatios.roe)}
                    icon={<ShieldIcon />}
                    color="indigo"
                />
                <MetricCard
                    title={`LNTT/Doanh thu, thu nhập (Lũy kế đến ${reportingLabelText})`}
                    value={fmtPct(latestRatios.pbtMargin)}
                    icon={<BuildingIcon />}
                    color="blue"
                />
            </div>
            
            <div className="space-y-4">
                <div>
                    <ToggleButton
                        label="Bảng cân đối kế toán"
                        isOpen={showBsTable}
                        onClick={() => setShowBsTable(!showBsTable)}
                    />
                    {showBsTable && (
                        <div className="mt-2 p-4 border rounded-b-lg shadow-inner bg-gray-50/50">
                             <BalanceSheetTable 
                                data={bsData}
                                loading={bsLoading}
                                error={bsError}
                                selectedIndicator={selectedBsIndicator}
                                onSelectIndicator={setSelectedBsIndicator}
                                // FIX: Remove invalid props and add required props for comparison source.
                                bsTableComparisonSource={bsTableComparisonSource}
                                setBsTableComparisonSource={setBsTableComparisonSource}
                            />
                        </div>
                    )}
                </div>

                <div>
                     <ToggleButton
                        label="Báo cáo kết quả HĐKD"
                        isOpen={showPlTable}
                        onClick={() => setShowPlTable(!showPlTable)}
                    />
                     {showPlTable && (
                        <div className="mt-2 p-4 border rounded-b-lg shadow-inner bg-gray-50/50">
                            <IncomeStatementTable
                                data={plData}
                                loading={plLoading}
                                error={plError}
                                startPeriod={comparisonPeriodPL} 
                                endPeriod={reportingPeriod}
                                selectedIndicator={selectedPlIndicator}
                                onSelectIndicator={setSelectedPlIndicator}
                                reportingLabelText={reportingLabelText}
                                previousQuarterLabel={previousQuarterLabelPL}
                                reportCode="P&L"
                            />
                        </div>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="lg:col-span-1 bg-white p-4 rounded-lg shadow flex flex-col h-[320px]">
                    <h3 className="font-bold text-gray-700 mb-1">Biến động giá trị trong kỳ</h3>
                    <p className="text-sm text-gray-500 mb-2 truncate">{selectedIndicator.name}</p>
                    <div className="flex-grow">
                        <IncomeStatementChart data={dynamicFAChartData} valueType={chartValueType} />
                    </div>
                </div>
                <div className="lg:col-span-1 bg-white p-4 rounded-lg shadow flex flex-col h-[320px]">
                    <h3 className="font-bold text-gray-700 mb-1">So sánh giá trị lũy kế 5 năm</h3>
                    <p className="text-sm text-gray-500 mb-2 truncate">{selectedIndicator.name}</p>
                    <div className="flex-grow">
                       <BalanceSheetChart data={valueChartData} chartType="bar" valueType={chartValueType} />
                    </div>
                </div>
            </div>
            
            <div className="bg-white p-4 rounded-lg shadow">
                <h3 className="font-bold text-gray-700 mb-4">Bảng chỉ số tài chính</h3>
                 <FinancialAnalysisTable
                    data={tableData}
                    selectedIndicator={selectedIndicator}
                    onSelectIndicator={onIndicatorSelect}
                    indicatorMetadata={indicatorMetadata}
                />
            </div>
        </div>
    );
};

export default FinancialAnalysisView;
