import React, { useState, useEffect } from "react";
import type { TreeRow, AnalysisResult, SelectedIndicator } from "../types";
import { toMonthStart } from "../lib/dataProcessing";
import { supabaseUrl, supabaseAnonKey } from "../lib/supabaseClient";
import AIAnalysisModal from "./AIAnalysisModal";
import { SparklesIcon } from "./icons";


/* ===== Utils ===== */
const cx = (...c: Array<string | false | null | undefined>) => c.filter(Boolean).join(" ");
const fmtNum = (n: number | null | undefined) => (n == null ? "–" : Math.round(n).toLocaleString("vi-VN"));
const fmtPct = (n: number | null | undefined) => (n == null || Number.isNaN(n) ? "–" : `${Number(n).toFixed(1)}%`);

const Chevron = ({ open }: { open: boolean }) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
       stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
       className="text-gray-600"
       style={{ transform: open ? "rotate(90deg)" : "rotate(0deg)", transition: "transform .15s" }}>
    <polyline points="9 18 15 12 9 6" />
  </svg>
);


/* ===== UI: Row Component (Recursive) ===== */
interface RowViewProps {
  row: TreeRow;
  depth: number;
  expandAll: boolean;
  selectedIndicator: SelectedIndicator | null;
  onSelectIndicator: (indicator: SelectedIndicator) => void;
  reportCode: 'P&L' | 'CF';
}

const RowView: React.FC<RowViewProps> = ({ row, depth, expandAll, selectedIndicator, onSelectIndicator, reportCode }) => {
  const [open, setOpen] = useState(expandAll);

  useEffect(() => {
    setOpen(expandAll);
  }, [expandAll]);

  const isSelected = selectedIndicator?.id === row.id;

  const bg = row.isTotal
    ? "bg-green-100" // Grand totals
    : depth === 0
    ? "bg-green-50" // Main sections
    : depth === 1
    ? "bg-gray-100" // Sub-sections
    : "bg-white";   // Detail rows

  const nameCls = row.isTotal
    ? "font-bold text-green-800"
    : depth === 0
    ? "font-bold text-[#006934]"
    : depth === 1
    ? "font-semibold text-gray-800"
    : "font-normal text-gray-700";

  const trCls = cx(
    "border-b border-gray-200 hover:bg-yellow-100/50 transition-colors cursor-pointer",
    bg,
    isSelected && "bg-blue-100 hover:bg-blue-200"
  );
  
  const diffSign = row.diff ?? 0;
  const diffPctSign = row.diffPct ?? 0;

  const handleSelectIndicator = () => {
    if (row.stt && row.name) {
        onSelectIndicator({ id: row.id, stt: row.stt, name: row.name });
    }
  };
  
  const handleToggleExpand = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent row click
    if (row.hasChildren) {
      setOpen(v => !v);
    }
  };


  return (
    <>
      <tr className={trCls} onClick={handleSelectIndicator}>
        <td className="px-2 py-2.5">
           <div className="flex items-center" style={{ paddingLeft: `${depth * 24}px` }}>
            <div className="w-7 h-6 flex-shrink-0 flex items-center justify-start">
              {row.hasChildren && (
                  <button
                      type="button"
                      onClick={handleToggleExpand}
                      className="p-1 rounded-full hover:bg-gray-400/20 focus:outline-none focus:ring-1 focus:ring-gray-400"
                      aria-label={open ? `Thu gọn ${row.name}` : `Mở rộng ${row.name}`}
                  >
                      <Chevron open={open} />
                  </button>
              )}
            </div>
            <span className={nameCls}>{row.name}</span>
          </div>
        </td>
        {reportCode === 'P&L' && (
            <td className="px-2 py-2.5 text-right font-mono">{fmtNum(row.currentQuarterValue)}</td>
        )}
        <td className="px-2 py-2.5 text-right font-mono">{fmtNum(row.end)}</td>
        <td className="px-2 py-2.5 text-right font-mono">{fmtNum(row.prevQuarter)}</td>
        <td className="px-2 py-2.5 text-right font-mono">{fmtNum(row.start)}</td>
        <td className={cx("px-2 py-2.5 text-right font-mono font-semibold",
          diffSign > 0 ? "text-green-500" : diffSign < 0 ? "text-red-500" : ""
        )}>
          {fmtNum(row.diff)}
        </td>
        <td className={cx("px-2 py-2.5 text-right font-mono font-semibold",
          diffPctSign > 0 ? "text-green-500" : diffPctSign < 0 ? "text-red-500" : ""
        )}>
          {fmtPct(row.diffPct)}
        </td>
      </tr>

      {open && row.children.map(c => (
        <RowView
          key={c.id}
          row={c}
          depth={depth + 1}
          expandAll={expandAll}
          selectedIndicator={selectedIndicator}
          onSelectIndicator={onSelectIndicator}
          reportCode={reportCode}
        />
      ))}
    </>
  );
};

/* ===== UI: Table Component ===== */
const TableView = ({ data, expandAll, selectedIndicator, onSelectIndicator, reportingLabelText, previousQuarterLabel, reportCode }: {
  data: TreeRow[],
  expandAll: boolean,
  selectedIndicator: SelectedIndicator | null,
  onSelectIndicator: (indicator: SelectedIndicator) => void,
  reportingLabelText: string;
  previousQuarterLabel: string;
  reportCode: 'P&L' | 'CF';
}) => (
  <div className="bg-white rounded-lg overflow-hidden flex-grow flex flex-col">
    <div className="overflow-auto flex-grow">
      <table className="min-w-full bg-white text-sm">
        <thead className="bg-[#006934] text-white sticky top-0 z-10">
          <tr>
            <th className="text-left font-semibold px-2 py-3 w-2/5 border-r border-green-500">Chỉ tiêu</th>
            {reportCode === 'P&L' && (
              <th className="text-right font-semibold px-2 py-3">Phát sinh trong kỳ {reportingLabelText} (triệu đồng)</th>
            )}
            <th className="text-right font-semibold px-2 py-3">Lũy kế đến Kỳ {reportingLabelText} (triệu đồng)</th>
            <th className="text-right font-semibold px-2 py-3">{previousQuarterLabel ? `Lũy kế đến Kỳ ${previousQuarterLabel} (triệu đồng)` : 'Lũy kế đến Kỳ trước (triệu đồng)'}</th>
            <th className="text-right font-semibold px-2 py-3">Lũy kế đến cùng kỳ năm trước (triệu đồng)</th>
            <th className="text-right font-semibold px-2 py-3">Lũy kế chênh lệch cùng kỳ năm nay/năm trước (triệu đồng)</th>
            <th className="text-right font-semibold px-2 py-3">% Lũy kế chênh lệch cùng kỳ năm nay/năm trước</th>
          </tr>
        </thead>
        <tbody className="text-slate-800">
          {data.map(r => (
            <RowView
              key={r.id}
              row={r}
              depth={0}
              expandAll={expandAll}
              selectedIndicator={selectedIndicator}
              onSelectIndicator={onSelectIndicator}
              reportCode={reportCode}
            />
          ))}
        </tbody>
      </table>
    </div>
  </div>
);

/* ===== Container ===== */
interface Props {
  data: TreeRow[];
  loading: boolean;
  error: string | null;
  startPeriod: string;
  endPeriod: string;
  selectedIndicator: SelectedIndicator | null;
  onSelectIndicator: (indicator: SelectedIndicator) => void;
  reportingLabelText: string;
  previousQuarterLabel: string;
  reportCode: 'P&L' | 'CF';
}

const IncomeStatementTable: React.FC<Props> = ({ data, loading, error, startPeriod, endPeriod, selectedIndicator, onSelectIndicator, reportingLabelText, previousQuarterLabel, reportCode }) => {
  const [expandAll, setExpandAll] = useState(true);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleAnalyze = async () => {
    setIsAnalyzing(true);
    setAnalysisError(null);
    setAnalysisResult(null);
    setIsModalOpen(true);

    // AI Analysis will still receive the full hierarchical data for a better analysis
    const simplify = (row: TreeRow): any => ({
        name: row.name,
        currentPeriod: row.end,
        previousPeriod: row.start, // 'start' maps to previous period in P&L
        children: row.children.map(simplify)
    });
    const simplifiedData = data.map(simplify);
    
    try {
        const functionUrl = `${supabaseUrl}/functions/v1/analyze-income-statement`;
        
        const response = await fetch(functionUrl, {
            method: 'POST',
            headers: {
                'apikey': supabaseAnonKey,
                'Authorization': `Bearer ${supabaseAnonKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                reportData: simplifiedData,
                currentPeriod: toMonthStart(endPeriod),
                previousPeriod: toMonthStart(startPeriod),
            })
        });

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.error || `Yêu cầu thất bại với mã trạng thái ${response.status}`);
        }
        
        setAnalysisResult(result);

    } catch (err: any) {
        setAnalysisError(err.message || 'Đã xảy ra lỗi không xác định trong quá trình phân tích.');
    } finally {
        setIsAnalyzing(false);
    }
  };


  if (loading) return <div className="text-center p-8">Đang tải dữ liệu...</div>;
  if (error) return <div className="text-center p-8 text-red-600">Lỗi: {error}</div>;
  if (!data || data.length === 0) return <div className="text-center p-8">Không có dữ liệu cho các tiêu chí đã chọn.</div>;


  return (
    <div className="space-y-2 flex flex-col flex-grow">
      <div className="flex items-center justify-end gap-2">
        <button 
          type="button" 
          className="hidden text-sm px-3 py-1.5 rounded-md border flex items-center gap-1.5 bg-violet-50 text-violet-700 border-violet-200 hover:bg-violet-100 disabled:opacity-50 disabled:cursor-wait font-semibold"
          onClick={handleAnalyze}
          disabled={isAnalyzing}
        >
          <SparklesIcon />
          {isAnalyzing ? 'Đang phân tích...' : 'AI Phân tích'}
        </button>
        <button type="button" className="text-sm px-2 py-1 rounded border border-gray-300 hover:bg-gray-50" onClick={() => setExpandAll(true)}>Mở rộng tất cả</button>
        <button type="button" className="text-sm px-2 py-1 rounded border border-gray-300 hover:bg-gray-50" onClick={() => setExpandAll(false)}>Thu gọn tất cả</button>
      </div>
      <TableView
        data={data}
        expandAll={expandAll}
        selectedIndicator={selectedIndicator}
        onSelectIndicator={onSelectIndicator}
        reportingLabelText={reportingLabelText}
        previousQuarterLabel={previousQuarterLabel}
        reportCode={reportCode}
      />
      <AIAnalysisModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        isLoading={isAnalyzing}
        data={analysisResult}
        error={analysisError}
       />
    </div>
  );
};

export default IncomeStatementTable;