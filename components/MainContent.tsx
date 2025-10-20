import React from 'react';
import IncomeStatementTable from './IncomeStatementTable';
import type { TreeRow, SelectedIndicator } from '../types';


interface MainContentProps {
    reportingPeriod: string;
    comparisonPeriod: string;
    reportingLabelText: string;
    comparisonLabel: string;
    previousQuarterLabel: string;
    reportLabel: string;
    treeData: TreeRow[];
    loading: boolean;
    error: string | null;
    reportCode: 'P&L' | 'CF';
    selectedIndicator: SelectedIndicator | null;
    onIndicatorSelect: (indicator: SelectedIndicator) => void;
}

const MainContent: React.FC<MainContentProps> = ({ 
    reportingPeriod, 
    comparisonPeriod, 
    reportingLabelText,
    comparisonLabel,
    previousQuarterLabel,
    reportLabel, 
    treeData, 
    loading, 
    error,
    reportCode,
    selectedIndicator,
    onIndicatorSelect,
}) => {
  const comparisonTitle = 'So sánh cùng kỳ năm trước';

  return (
    <section className="w-full flex flex-col gap-4 flex-grow">
        <div className="bg-white p-4 rounded-lg shadow flex-grow flex flex-col">
          <div className="flex justify-between items-center mb-4">
            <div>
                <h2 className="text-xl font-bold text-gray-800">{reportLabel}</h2>
                <p className="text-sm text-gray-500">{comparisonTitle}: {reportingLabelText || ''} và {comparisonLabel}</p>
            </div>
          </div>
          
          <IncomeStatementTable
            data={treeData}
            loading={loading}
            error={error}
            startPeriod={comparisonPeriod} 
            endPeriod={reportingPeriod}
            selectedIndicator={selectedIndicator}
            onSelectIndicator={onIndicatorSelect}
            reportingLabelText={reportingLabelText}
            previousQuarterLabel={previousQuarterLabel}
            reportCode={reportCode}
          />
        </div>
    </section>
  );
};

export default MainContent;