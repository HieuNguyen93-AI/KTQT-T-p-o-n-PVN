import React, { useState, useEffect, useMemo } from "react";
import type { TreeRow, AnalysisResult, SelectedIndicator } from "../types";
import { toMonthStart } from "../lib/dataProcessing";
import { supabase, supabaseUrl, supabaseAnonKey } from "../lib/supabaseClient";
import AIAnalysisModal from "./AIAnalysisModal";
import { SparklesIcon, ChevronDownIcon } from "./icons";

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

type ComparisonSource = 'previousQuarter' | 'samePeriodLastYear' | 'beginningOfYear';

const findMaxAbsDiff = (rows: TreeRow[], comparisonSource: ComparisonSource): number => {
    let max = 0;
    function traverse(nodes: TreeRow[]) {
      for (const node of nodes) {
        let diff: number | null = null;
        switch (comparisonSource) {
            case 'samePeriodLastYear':
              diff = node.diffVsSamePeriod;
              break;
            case 'beginningOfYear':
              diff = node.diffVsBeginningOfYear;
              break;
            case 'previousQuarter':
            default:
              diff = node.diff;
              break;
        }

        if (diff !== null) {
          const absDiff = Math.abs(diff);
          if (absDiff > max) {
            max = absDiff;
          }
        }
        if (node.hasChildren) {
          traverse(node.children);
        }
      }
    }
    traverse(rows);
    return max;
};

const VarianceBar = ({ value, maxAbsDiff }: { value: number | null; maxAbsDiff: number }) => {
    if (value === null || value === undefined) {
      return <div className="text-center font-mono w-full h-5 flex items-center justify-center">{"–"}</div>;
    }

    const max = Math.max(1, maxAbsDiff);
    const percentage = (Math.abs(value) / max) * 100;
    const isPositive = value >= 0;

    const barColor = isPositive ? "bg-green-500" : "bg-red-500";
    
    return (
      <div className="flex items-center w-full min-w-[150px] font-mono text-sm h-5">
        <div className="w-1/2 flex justify-end items-center pr-1">
          {!isPositive && (
            <div className={`${barColor} h-4 rounded-l-sm`} style={{ width: `${percentage}%` }} />
          )}
        </div>
        <div className="w-px h-5 bg-slate-300 flex-shrink-0" />
        <div className="w-1/2 flex justify-start items-center pl-1">
          {isPositive && (
            <div className={`${barColor} h-4 rounded-r-sm`} style={{ width: `${percentage}%` }} />
          )}
        </div>
      </div>
    );
};


/* ===== UI: Row Component (Recursive) ===== */
interface RowViewProps {
  row: TreeRow;
  depth: number;
  maxAbsDiff: number;
  expandAll: boolean;
  selectedIndicator: SelectedIndicator | null;
  onSelectIndicator: (indicator: SelectedIndicator) => void;
  bsTableComparisonSource: ComparisonSource;
}

const RowView: React.FC<RowViewProps> = ({ row, depth, maxAbsDiff, expandAll, selectedIndicator, onSelectIndicator, bsTableComparisonSource }) => {
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
    "border-b border-gray-200",
    bg,
    depth === 0 && "border-t-2 border-green-200",
    isSelected && "bg-blue-100 hover:bg-blue-200"
  );
  
  const comparisonSourceValue = bsTableComparisonSource === 'samePeriodLastYear' ? row.samePeriodLastYear : bsTableComparisonSource === 'beginningOfYear' ? row.beginningOfYear : row.start;
  const diffValue = bsTableComparisonSource === 'samePeriodLastYear' ? row.diffVsSamePeriod : bsTableComparisonSource === 'beginningOfYear' ? row.diffVsBeginningOfYear : row.diff;
  const diffPctValue = bsTableComparisonSource === 'samePeriodLastYear' ? row.diffPctVsSamePeriod : bsTableComparisonSource === 'beginningOfYear' ? row.diffPctVsBeginningOfYear : row.diffPct;

  const diffPctSign = diffPctValue ?? 0;
  
  const handleSelectIndicator = () => {
    if (row.stt && row.name) {
        onSelectIndicator({ id: row.id, stt: row.stt, name: row.name });
    }
  };

  const handleToggleExpand = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (row.hasChildren) {
      setOpen(v => !v);
    }
  };


  return (
    <>
      <tr className={trCls}>
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
            <span className={cx(nameCls, "cursor-pointer hover:underline")} onClick={handleSelectIndicator}>{row.name}</span>
          </div>
        </td>
        <td className="px-2 py-2.5 text-right font-mono">{fmtNum(row.end)}</td>
        <td className="px-2 py-2.5 text-right font-mono">{fmtPct(row.pct)}</td>
        <td className="px-2 py-2.5 text-right font-mono">{fmtNum(comparisonSourceValue)}</td>
        <td className="px-1 py-1.5 align-middle">
          <VarianceBar value={diffValue} maxAbsDiff={maxAbsDiff} />
        </td>
        <td className={cx("px-2 py-2.5 text-right font-mono font-semibold",
          diffPctSign > 0 ? "text-green-500" : diffPctSign < 0 ? "text-red-500" : ""
        )}>
          {fmtPct(diffPctValue)}
        </td>
      </tr>

       {open && row.children.map(c => (
        <RowView
          key={c.id}
          row={c}
          depth={depth + 1}
          maxAbsDiff={maxAbsDiff}
          expandAll={expandAll}
          selectedIndicator={selectedIndicator}
          onSelectIndicator={onSelectIndicator}
          bsTableComparisonSource={bsTableComparisonSource}
        />
      ))}
    </>
  );
};


/* ===== Container ===== */
interface Props {
  data: TreeRow[];
  loading: boolean;
  error: string | null;
  selectedIndicator: SelectedIndicator | null;
  onSelectIndicator: (indicator: SelectedIndicator) => void;
  bsTableComparisonSource: ComparisonSource;
  setBsTableComparisonSource: (source: ComparisonSource) => void;
}

const comparisonHeaders: { [key in ComparisonSource]: { label: string; diffLabel: string; pctLabel: string } } = {
    previousQuarter: {
        label: "Đầu kỳ (Quý trước)",
        diffLabel: "CK vs ĐK (biến động)",
        pctLabel: "% CK vs ĐK"
    },
    samePeriodLastYear: {
        label: "Cùng kỳ năm trước",
        diffLabel: "CK vs CKN (biến động)",
        pctLabel: "% CK vs CKN"
    },
    beginningOfYear: {
        label: "Đầu năm",
        diffLabel: "CK vs ĐN (biến động)",
        pctLabel: "% CK vs ĐN"
    }
};

const BalanceSheetTable: React.FC<Props> = ({ data, loading, error, selectedIndicator, onSelectIndicator, bsTableComparisonSource, setBsTableComparisonSource }) => {
  const [expandAll, setExpandAll] = useState(true);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  const maxAbsDiff = useMemo(() => findMaxAbsDiff(data, bsTableComparisonSource), [data, bsTableComparisonSource]);
  const currentHeaders = comparisonHeaders[bsTableComparisonSource];

  const handleAnalyze = async () => {
    setIsAnalyzing(true);
    setAnalysisError(null);
    setAnalysisResult(null);
    setIsModalOpen(true);

    const simplify = (row: TreeRow): any => ({
        name: row.name,
        endPeriod: row.end,
        startPeriod: row.start, // This remains previous quarter for context
        children: row.children.map(simplify)
    });
    const simplifiedData = data.map(simplify);
    
    try {
        const functionUrl = `${supabaseUrl}/functions/v1/analyze-balance-sheet`;
        
        const response = await fetch(functionUrl, {
            method: 'POST',
            headers: {
                'apikey': supabaseAnonKey,
                'Authorization': `Bearer ${supabaseAnonKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                reportData: simplifiedData,
                // Note: The AI analysis prompt still uses the default start/end periods for simplicity.
                // The dynamic comparison is a UI-only feature for now.
                startPeriod: toMonthStart(new Date(new Date().setMonth(new Date().getMonth() - 3)).toISOString()), // Placeholder
                endPeriod: toMonthStart(new Date().toISOString()), // Placeholder
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
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
            <label htmlFor="comparison-source" className="text-sm font-semibold text-gray-600">So sánh với:</label>
            <div className="relative">
                <select 
                    id="comparison-source"
                    value={bsTableComparisonSource}
                    onChange={(e) => setBsTableComparisonSource(e.target.value as ComparisonSource)}
                    className="text-sm px-3 py-1.5 pl-3 pr-8 rounded-md border border-gray-300 appearance-none bg-white text-gray-800 focus:outline-none focus:ring-2 focus:ring-green-500"
                >
                    <option value="previousQuarter">Đầu kỳ (Quý trước)</option>
                    <option value="samePeriodLastYear">Cùng kỳ năm trước</option>
                    <option value="beginningOfYear">Đầu năm</option>
                </select>
                <ChevronDownIcon className="h-4 w-4 text-gray-500 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
        </div>

        <div className="flex items-center gap-2">
            <button 
              type="button" 
              className="hidden text-sm px-3 py-1.5 rounded-md border flex items-center gap-1.5 bg-violet-50 text-violet-700 border-violet-200 hover:bg-violet-100 disabled:opacity-50 disabled:cursor-wait font-semibold"
              onClick={handleAnalyze}
              disabled={isAnalyzing}
            >
              <SparklesIcon />
              {isAnalyzing ? 'Đang phân tích...' : 'AI Phân tích'}
            </button>
            <button type="button" className="text-sm px-2 py-1 rounded border border-gray-300 hover:bg-gray-50" onClick={() => setExpandAll(true)}>Mở rộng</button>
            <button type="button" className="text-sm px-2 py-1 rounded border border-gray-300 hover:bg-gray-50" onClick={() => setExpandAll(false)}>Thu gọn</button>
        </div>
      </div>
      <div className="bg-white rounded-lg overflow-hidden flex-grow flex flex-col">
        <div className="overflow-auto flex-grow">
          <table className="min-w-full bg-white text-sm">
            <thead className="bg-[#006934] text-white sticky top-0 z-10">
              <tr>
                <th className="text-left font-semibold px-2 py-3 w-2/5">Chỉ tiêu</th>
                <th className="text-right font-semibold px-2 py-3">Cuối kỳ (triệu đồng)</th>
                <th className="text-right font-semibold px-2 py-3">Tỷ trọng</th>
                <th className="text-right font-semibold px-2 py-3">{currentHeaders.label} (triệu đồng)</th>
                <th className="text-center font-semibold px-2 py-3">{currentHeaders.diffLabel}</th>
                <th className="text-right font-semibold px-2 py-3">{currentHeaders.pctLabel}</th>
              </tr>
            </thead>
            <tbody className="text-slate-800">
              {data.map(r => (
                <RowView
                  key={r.id}
                  row={r}
                  depth={0}
                  maxAbsDiff={maxAbsDiff}
                  expandAll={expandAll}
                  selectedIndicator={selectedIndicator}
                  onSelectIndicator={onSelectIndicator}
                  bsTableComparisonSource={bsTableComparisonSource}
                />
              ))}
            </tbody>
          </table>
        </div>
      </div>
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

export default BalanceSheetTable;