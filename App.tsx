import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Header from './components/Header';
import NavBar from './components/NavBar';
import Sidebar from './components/Sidebar';
import MainContent from './components/MainContent';
import { getPreviousQuarterEndDate, getSamePeriodLastYear } from './lib/helpers';
import { supabase } from './lib/supabaseClient';
import { buildTreeByPath, makeItemsFrom, toMonthStart, getNormalizedAccountPath } from './lib/dataProcessing';
import type { QuarterOption, TreeRow, DAccount, Fact, AnalType, IncomeChartData, MetricValues, PlMetricValues, CfMetricValues, SelectedIndicator, BalanceSheetChartDataPoint, FinancialAnalysisData, SelectedFAIndicator, UnitHierarchy } from './types';
import IncomeStatementChart from './components/IncomeStatementChart';
import MetricCard from './components/MetricCard';
import { WalletIcon, BuildingIcon, DocumentIcon, ShieldIcon } from './components/icons';
import BalanceSheetTable from './components/BalanceSheetTable';
import BalanceSheetChart from './components/BalanceSheetChart';
import FinancialAnalysisView from './components/FinancialAnalysisView';
import WaterfallChart from './components/WaterfallChart';
import type { Session } from '@supabase/supabase-js';

const reportMap: { [key: string]: 'BS' | 'P&L' | 'CF' | 'FA' } = {
  'Bảng cân đối kế toán': 'BS',
  'Báo cáo kết quả HĐKD': 'P&L',
  'Báo cáo lưu chuyển tiền tệ': 'CF',
  'Phân tích Tài chính': 'FA',
};
const reportNavItems = ['Bảng cân đối kế toán', 'Báo cáo kết quả HĐKD', 'Báo cáo lưu chuyển tiền tệ', 'Phân tích Tài chính'];

const availableQuarters: QuarterOption[] = [
    { label: 'Quý I', value: '03-01' },
    { label: 'Quý II', value: '06-01' },
    { label: 'Quý III', value: '09-01' },
    { label: 'Quý IV', value: '12-01' },
];

// Helper to get a period label like "Quý 1/2024" from a date string
const getPeriodLabel = (period: string | null): string => {
    if (!period) return '';
    const date = new Date(period);
    const year = date.getUTCFullYear();
    const month = date.getUTCMonth();
    const quarter = Math.floor(month / 3) + 1;
    return `Quý ${quarter}/${year}`;
};

const getHistoricalAnalCodeForQuarter = (quarterValue: string, scope: string): string | undefined => {
    const isQ1OrQ3 = quarterValue === '03-01' || quarterValue === '09-01'; // Pre-audit quarters
    if (scope === 'Hợp nhất') {
        // PVN-P01: Hợp nhất Trước Kiểm toán
        // PVN-P02: Hợp nhất Sau Kiểm toán
        return isQ1OrQ3 ? 'PVN-P01' : 'PVN-P02';
    } else { // Công ty Mẹ
        // PVN-P03: Công ty Mẹ Trước Kiểm toán
        // PVN-P04: Công ty Mẹ Sau Kiểm toán
        return isQ1OrQ3 ? 'PVN-P03' : 'PVN-P04';
    }
};


const fmtNumMillions = (n: number | null | undefined): string => (n == null ? "–" : Math.round(n).toLocaleString("vi-VN"));

const findRowByStt = (nodes: TreeRow[], stt: number): TreeRow | null => {
    for (const node of nodes) {
        if (node.stt === stt) return node;
        if (node.hasChildren) {
            const found = findRowByStt(node.children, stt);
            if (found) return found;
        }
    }
    return null;
};

// FIX: Moved indicatorMetadata from FinancialAnalysisView.tsx to App.tsx to resolve "Cannot find name 'indicatorMetadata'" error.
const indicatorMetadata: { [key: string]: { group: string; name: string; formula: string; unit: 'ratio' | 'percentage' | 'days' | 'currency' } } = {
    // Các hệ số về khả năng sinh lời
    'roa': { group: 'Các hệ số về khả năng sinh lời', name: 'Suất sinh lời của Tổng tài sản (ROA)', formula: 'Lợi nhuận sau thuế/Tổng tài sản bình quân', unit: 'percentage' },
    'roe': { group: 'Các hệ số về khả năng sinh lời', name: 'Suất sinh lời của Vốn CSH (ROE)', formula: 'Lợi nhuận sau thuế/ Vốn CSH bình quân', unit: 'percentage' },
    'pbtMargin': { group: 'Các hệ số về khả năng sinh lời', name: 'Lợi nhuận trước thuế/Doanh thu', formula: 'Lợi nhuận trước thuế/Doanh thu, thu nhập', unit: 'percentage' },

    // Các hệ số về cơ cấu vốn
    'capitalAdequacyRatio': { group: 'Các hệ số về cơ cấu vốn', name: 'Hệ số bảo toàn vốn', formula: 'Vốn CSH cuối kỳ/Vốn CSH đầu kỳ', unit: 'ratio' },
    'debtCoverageRatio': { group: 'Các hệ số về cơ cấu vốn', name: 'Hệ số bảo đảm nợ', formula: 'Vốn CSH/Nợ phải trả', unit: 'ratio' },
    'selfFinancingRatio': { group: 'Các hệ số về cơ cấu vốn', name: 'Hệ số tự tài trợ', formula: 'Vốn CSH/Tổng Tài sản', unit: 'ratio' },
    'debtToAssetRatio': { group: 'Các hệ số về cơ cấu vốn', name: 'Hệ số nợ tài sản', formula: 'Nợ phải trả/Tổng Tài sản', unit: 'ratio' },
    'currentAssetToTotalAssetRatio': { group: 'Các hệ số về cơ cấu vốn', name: 'Hệ số Tài sản ngắn hạn', formula: 'Tài sản ngắn hạn/Tổng Tài sản', unit: 'ratio' },
    'assetTurnover': { group: 'Các hệ số về cơ cấu vốn', name: 'Vòng quay Tổng tài sản', formula: '(Doanh thu – Các khoản giảm trừ Doanh thu)/Tổng Tài sản', unit: 'ratio' },
    'debtToEquityRatio': { group: 'Các hệ số về cơ cấu vốn', name: 'Hệ số nợ Vốn chủ', formula: 'Nợ phải trả/Vốn CSH', unit: 'ratio' },
    'loanToEquityRatio': { group: 'Các hệ số về cơ cấu vốn', name: 'Tỷ lệ vay so với Vốn CSH', formula: '(Nợ vay ngắn hạn + Nợ vay dài hạn)/Vốn CSH', unit: 'ratio' },
    'longTermAssetSelfFinancingRatio': { group: 'Các hệ số về cơ cấu vốn', name: 'Hệ số tự tài trợ Tài sản Dài hạn', formula: 'Vốn CSH/Tài sản dài hạn', unit: 'ratio' },
    'longTermDebtRatio': { group: 'Các hệ số về cơ cấu vốn', name: 'Tỷ lệ Nợ dài hạn', formula: 'Nợ dài hạn/Vốn CSH', unit: 'ratio' },
    'workingCapitalTurnover': { group: 'Các hệ số về cơ cấu vốn', name: 'Vòng quay vốn lưu động', formula: '(Doanh thu – Các khoản giảm trừ Doanh thu) / (Tài sản ngắn hạn – Nợ ngắn hạn)', unit: 'ratio' },
    'payablesTurnover': { group: 'Các hệ số về cơ cấu vốn', name: 'Vòng quay thanh toán công nợ', formula: '(Giá vốn hàng bán + Hàng tồn kho cuối kỳ - Hàng tồn kho đầu kỳ) / (Nợ Phải trả đầu năm + Nợ Phải trả cuối năm)/2', unit: 'ratio' },
    'receivablesTurnover': { group: 'Các hệ số về cơ cấu vốn', name: 'Vòng quay các khoản phải thu', formula: '(Doanh thu - các khoản giảm trừ doanh thu)/Các khoản phải thu', unit: 'ratio' },
    'daysSalesOutstanding': { group: 'Các hệ số về cơ cấu vốn', name: 'Số ngày thu hồi công nợ', formula: '360/ Vòng quay các khoản phải thu', unit: 'days' },

    // Các hệ số về khả năng thanh toán
    'solvencyRatio': { group: 'Các hệ số về khả năng thanh toán', name: 'Hệ số khả năng thanh toán tổng quát', formula: 'Tổng Tài sản/Nợ phải trả', unit: 'ratio' },
    'quickRatio': { group: 'Các hệ số về khả năng thanh toán', name: 'Hệ số khả năng thanh toán tức thời', formula: '(Tiền + Các khoản đầu tư Tài chính ngắn hạn) / Nợ phải trả ngắn hạn', unit: 'ratio' },
    'currentRatio': { group: 'Các hệ số về khả năng thanh toán', name: 'Hệ số khả năng thanh toán hiện thời', formula: 'Tài sản ngắn hạn/Nợ phải trả ngắn hạn', unit: 'ratio' },
    'cashRatio': { group: 'Các hệ số về khả năng thanh toán', name: 'Hệ số thanh toán bằng tiền', formula: 'Tiền/ Nợ phải trả ngắn hạn', unit: 'ratio' },

    // Phân tích Dupont
    'ebit': { group: 'Phân tích Dupont', name: 'Lợi nhuận trước thuế và lãi vay (EBIT)', formula: 'Lợi nhuận trước thuế + Chi phí lãi vay', unit: 'currency' },
    'taxBurdenRatio': { group: 'Phân tích Dupont', name: 'Hệ số gánh nặng thuế', formula: 'Lợi nhuận sau thuế/Lợi nhuận trước thuế', unit: 'ratio' },
    'interestBurdenRatio': { group: 'Phân tích Dupont', name: 'Hệ số gánh nặng lãi vay', formula: 'Lợi nhuận trước thuế/EBIT', unit: 'ratio' },
    'ebitMargin': { group: 'Phân tích Dupont', name: 'EBIT Margin', formula: 'EBIT/(Doanh thu - các khoản giảm trừ doanh thu)', unit: 'percentage' },
    'assetTurnover_dupont': { group: 'Phân tích Dupont', name: 'Vòng quay Tổng tài sản', formula: '(Doanh thu – Các khoản giảm trừ Doanh thu)/Tổng Tài sản', unit: 'ratio' },
    'financialLeverage': { group: 'Phân tích Dupont', name: 'Tổng tài sản/ Vốn CSH', formula: 'Tổng Tài sản/Vốn CSH', unit: 'ratio' },
    'roe_dupont': { group: 'Phân tích Dupont', name: 'Suất sinh lời của Vốn CSH (ROE)', formula: 'Lợi nhuận sau thuế/Vốn CSH', unit: 'percentage' },
};


const App: React.FC = () => {
  const [session, setSession] = useState<Session | null>(null);
  const [availableYears, setAvailableYears] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  
  // Filters for "current" period (used by all reports)
  const [reportScope, setReportScope] = useState<string>('Hợp nhất');
  const [selectedYear, setSelectedYear] = useState('');
  const [selectedQuarter, setSelectedQuarter] = useState('');
  const [selectedUnitIds, setSelectedUnitIds] = useState<string[]>([]);
  
  // Unified Report Version state for all reports
  const [selectedAnalTypeQ1, setSelectedAnalTypeQ1] = useState<AnalType | null>(null);
  const [selectedAnalTypeQ2, setSelectedAnalTypeQ2] = useState<AnalType | null>(null);
  const [selectedAnalTypeQ3, setSelectedAnalTypeQ3] = useState<AnalType | null>(null);
  const [selectedAnalTypeQ4, setSelectedAnalTypeQ4] = useState<AnalType | null>(null);

  // State for all analysis types from DB, and the filtered list for UI
  const [allAnalTypes, setAllAnalTypes] = useState<AnalType[]>([]);
  const [analTypes, setAnalTypes] = useState<AnalType[]>([]);
  
  // State for unit hierarchy, fetched once and passed to Sidebar
  const [unitHierarchy, setUnitHierarchy] = useState<Map<string, UnitHierarchy>>(new Map());

  const [reportingPeriod, setReportingPeriod] = useState('');
  const [activeReport, setActiveReport] = useState(reportNavItems[0]);

  const [treeData, setTreeData] = useState<TreeRow[]>([]);
  const [loading, setLoading] = useState(true);
  
  // P&L State
  const [plMetricValues, setPlMetricValues] = useState<PlMetricValues>({ profitBeforeTax: null, currentTaxExpense: null, deferredTaxExpense: null, profitAfterTax: null });
  const [dynamicPLChartData, setDynamicPLChartData] = useState<IncomeChartData[]>([]);
  const [selectedPLIndicator, setSelectedPLIndicator] = useState<SelectedIndicator | null>({ stt: 19, name: 'Lợi nhuận sau thuế' });
  const [fiveYearPLChartData, setFiveYearPLChartData] = useState<BalanceSheetChartDataPoint[]>([]);
  const [waterfallPLChartData, setWaterfallPLChartData] = useState<any[]>([]);
  const [waterfallPLComparisonMode, setWaterfallPLComparisonMode] = useState<'vsSamePeriodLastYear' | 'vsPreviousQuarter'>('vsSamePeriodLastYear');

  // CF State
  const [cfMetricValues, setCfMetricValues] = useState<CfMetricValues>({ netFromOperating: null, netFromInvesting: null, netFromFinancing: null });
  const [dynamicCFChartData, setDynamicCFChartData] = useState<IncomeChartData[]>([]);
  const [selectedCFIndicator, setSelectedCFIndicator] = useState<SelectedIndicator | null>({ stt: 50, name: 'Lưu chuyển tiền thuần trong kỳ (50 = 20+30+40)' });
  const [fiveYearCFChartData, setFiveYearCFChartData] = useState<BalanceSheetChartDataPoint[]>([]);
  const [waterfallCFChartData, setWaterfallCFChartData] = useState<any[]>([]);
  const [waterfallCFComparisonMode, setWaterfallCFComparisonMode] = useState<'vsSamePeriodLastYear' | 'vsPreviousQuarter'>('vsSamePeriodLastYear');

  // BS State
  const [metricValues, setMetricValues] = useState<MetricValues>({ shortTermAssets: null, longTermAssets: null, liabilities: null, equity: null });
  const [selectedBSIndicator, setSelectedBSIndicator] = useState<SelectedIndicator | null>({ stt: 21, name: 'TỔNG CỘNG TÀI SẢN (270 = 100 + 200)' });
  const [dynamicBSChartData, setDynamicBSChartData] = useState<IncomeChartData[]>([]);
  const [fiveYearBSChartData, setFiveYearBSChartData] = useState<BalanceSheetChartDataPoint[]>([]);
  const [waterfallChartData, setWaterfallChartData] = useState<any[]>([]);
  const [waterfallComparisonMode, setWaterfallComparisonMode] = useState<'vsPreviousQuarter' | 'vsSamePeriodLastYear' | 'vsBeginningOfYear'>('vsPreviousQuarter');
  const [bsTableComparisonSource, setBsTableComparisonSource] = useState<'previousQuarter' | 'samePeriodLastYear' | 'beginningOfYear'>('previousQuarter');

  
  // Financial Analysis State
  const [financialAnalysisData, setFinancialAnalysisData] = useState<FinancialAnalysisData | null>(null);
  const [financialAnalysisLoading, setFinancialAnalysisLoading] = useState(true);
  const [selectedFAIndicator, setSelectedFAIndicator] = useState<SelectedFAIndicator>({ key: 'roa', name: 'Suất sinh lời của Tổng tài sản (ROA)' });
  const [dynamicFAValueChartData, setDynamicFAValueChartData] = useState<BalanceSheetChartDataPoint[]>([]);
  const [dynamicFAChartData, setDynamicFAChartData] = useState<IncomeChartData[]>([]);
  
  // State for BS and P&L tables on the FA page
  const [faPageBsData, setFaPageBsData] = useState<TreeRow[]>([]);
  const [faPagePlData, setFaPagePlData] = useState<TreeRow[]>([]);
  const [faPageTablesLoading, setFaPageTablesLoading] = useState(true);
  const [faPageTablesError, setFaPageTablesError] = useState<string | null>(null);
  
  const handlePLIndicatorSelect = (indicator: SelectedIndicator) => {
    setSelectedPLIndicator(indicator);
  };
  
  const handleCFIndicatorSelect = (indicator: SelectedIndicator) => {
    setSelectedCFIndicator(indicator);
  };
  
  const handleBSIndicatorSelect = (indicator: SelectedIndicator) => {
    setSelectedBSIndicator(indicator);
  };
  
  const reportCode = reportMap[activeReport];
  
  const selectedUnitCodes = useMemo(() => {
    if (!unitHierarchy || selectedUnitIds.length === 0) return [];

    // For any selection (one, many, or all), aggregate the data
    // from the individual entities within the selected groups.
    return selectedUnitIds.flatMap(id => {
        const group = unitHierarchy.get(id);
        return group ? group.children.map(c => c.id) : [];
    });
  }, [selectedUnitIds, unitHierarchy]);

  const effectiveAnalTypeCode = useMemo(() => {
    const filteredTypes = reportScope === 'Hợp nhất'
        ? allAnalTypes.filter(t => ['PVN-P01', 'PVN-P02'].includes(t.code))
        : allAnalTypes.filter(t => ['PVN-P03', 'PVN-P04'].includes(t.code));
    
    const fallbackCode = filteredTypes[0]?.code;

    let selectedType: AnalType | null = null;
    switch (selectedQuarter) {
        case '03-01':
            selectedType = selectedAnalTypeQ1;
            break;
        case '06-01':
            selectedType = selectedAnalTypeQ2;
            break;
        case '09-01':
            selectedType = selectedAnalTypeQ3;
            break;
        case '12-01':
            selectedType = selectedAnalTypeQ4;
            break;
    }
    
    const isSelectionValid = selectedType && filteredTypes.some(t => t.code === selectedType.code);
    
    return isSelectionValid ? selectedType.code : fallbackCode;

  }, [selectedQuarter, reportScope, allAnalTypes, selectedAnalTypeQ1, selectedAnalTypeQ2, selectedAnalTypeQ3, selectedAnalTypeQ4]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const fetchInitialFilters = async () => {
        setLoading(true);
        setError(null);

        const fetchAvailableYears = async () => {
          const allYears = new Set<string>();
          const pageSize = 1000;
          let offset = 0;
          let keepFetching = true;

          while (keepFetching) {
            const { data, error: fetchError } = await supabase
              .from('d_date_tckt')
              .select('year')
              .range(offset, offset + pageSize - 1);

            if (fetchError) {
              const errorMessage = fetchError.message.includes("does not exist")
                  ? "Bảng 'd_date_tckt' không tồn tại."
                  : fetchError.message;
              throw new Error(`Không thể tải danh sách năm. ${errorMessage}`);
            }

            if (data && data.length > 0) {
              data.forEach((item: { year: string | number | null }) => {
                if (item.year) {
                  allYears.add(String(item.year));
                }
              });
              if (data.length < pageSize) {
                keepFetching = false;
              } else {
                offset += pageSize;
              }
            } else {
              keepFetching = false;
            }
          }
          const years = Array.from(allYears).sort((a, b) => parseInt(b) - parseInt(a));
          setAvailableYears(years);
          const defaultYear = '2025';
          const currentYear = years.includes(defaultYear) ? defaultYear : (years[0] || '');
          setSelectedYear(currentYear);
          setSelectedQuarter('06-01'); // Default to Q2
        };

        const fetchAnalTypes = async () => {
            const { data: analData, error: analError } = await supabase
                .from('d_p_anal').select('p_anal, filter_display').order('filter_display');
            if (analError) throw new Error(`Không thể tải loại báo cáo. ${analError.message}`);
            if (analData) {
                const fetchedTypes: AnalType[] = analData.map(item => ({ code: item.p_anal, name: item.filter_display }));
                setAllAnalTypes(fetchedTypes);
            }
        };

        const fetchUnitsAndSetDefault = async () => {
            const { data: unitData, error: unitError } = await supabase
                .from('d_donvi')
                .select('id_lv1_, id_lv2_, name_lv2_, id_lv3_entity, name_lv3_')
                .order('name_lv2_').order('name_lv3_');
            if (unitError) throw new Error(`Không thể tải danh sách đơn vị. ${unitError.message}`);
            if (unitData) {
                const hierarchy = new Map<string, UnitHierarchy>();
                unitData.forEach(item => {
                    if (!item.id_lv1_ || !item.id_lv2_ || !item.name_lv2_ || !item.id_lv3_entity || !item.name_lv3_) return;
                    if (!hierarchy.has(item.id_lv2_)) {
                        hierarchy.set(item.id_lv2_, { id: item.id_lv2_, name: item.name_lv2_, id_lv1_: item.id_lv1_, children: [] });
                    }
                    hierarchy.get(item.id_lv2_)!.children.push({ id: item.id_lv3_entity, name: item.name_lv3_ });
                });
                setUnitHierarchy(hierarchy);

                const pvfccoGroup = Array.from(hierarchy.values()).find(group => group.name === 'PVFCCo');

                if (pvfccoGroup) {
                    setSelectedUnitIds([pvfccoGroup.id]);
                } else if (hierarchy.size > 0) { // Fallback to first group if PVFCCo not found
                    const firstGroupId = Array.from(hierarchy.keys())[0];
                    if (firstGroupId) {
                        setSelectedUnitIds([firstGroupId]);
                    }
                }
            }
        };

        try {
            await Promise.all([fetchAvailableYears(), fetchAnalTypes(), fetchUnitsAndSetDefault()]);
        } catch(err: any) {
            setError(err.message);
        }
    };
    fetchInitialFilters();
  }, []);

  // This useEffect manages the UI state of the report version filters.
  // It ensures the dropdown options and selected values
  // are always synchronized with the application's logic (e.g., changing scope).
  useEffect(() => {
    if (allAnalTypes.length === 0) return;

    // 1. Filter the list of available versions based on scope
    const filteredTypes = reportScope === 'Hợp nhất'
        ? allAnalTypes.filter(t => ['PVN-P01', 'PVN-P02'].includes(t.code))
        : allAnalTypes.filter(t => ['PVN-P03', 'PVN-P04'].includes(t.code));
    setAnalTypes(filteredTypes);
    
    // Helper to find type by code from any list of types
    const findTypeByCode = (types: AnalType[], code: string) => types.find(t => t.code === code);

    // On initial load (when selections are null), set the specific defaults.
    if (!selectedAnalTypeQ1 && !selectedAnalTypeQ2 && !selectedAnalTypeQ3 && !selectedAnalTypeQ4 && reportScope === 'Hợp nhất') {
        // Find the default types from the complete list of types
        // PVN-P01: Hợp nhất Trước Kiểm toán
        // PVN-P02: Hợp nhất Sau Kiểm toán
        const hnPreAudit = findTypeByCode(allAnalTypes, 'PVN-P01');
        const hnPostAudit = findTypeByCode(allAnalTypes, 'PVN-P02');

        if (hnPreAudit) {
            setSelectedAnalTypeQ1(hnPreAudit);
            setSelectedAnalTypeQ3(hnPreAudit);
        }
        if (hnPostAudit) {
            setSelectedAnalTypeQ2(hnPreAudit);
            setSelectedAnalTypeQ4(hnPostAudit);
        }
        // Exit to prevent sync logic from overriding the defaults on this render pass.
        // The effect will re-run with the newly set state.
        return;
    }
    
    // 2. Define a helper that syncs selections when the scope changes
    const getTargetTypeForScope = (currentSelection: AnalType | null): AnalType | null => {
        // If the current selection is still valid within the new scope, keep it.
        if (currentSelection && filteredTypes.some(t => t.code === currentSelection.code)) {
            return currentSelection;
        }
        // Otherwise, fall back to the first available option in the new scope.
        return filteredTypes[0] || null;
    };

    // 3. Sync Q1, Q2, Q3, Q4 report version states
    const targetAnalTypeQ1 = getTargetTypeForScope(selectedAnalTypeQ1);
    if (selectedAnalTypeQ1?.code !== targetAnalTypeQ1?.code) {
        setSelectedAnalTypeQ1(targetAnalTypeQ1);
    }
    
    const targetAnalTypeQ2 = getTargetTypeForScope(selectedAnalTypeQ2);
    if (selectedAnalTypeQ2?.code !== targetAnalTypeQ2?.code) {
        setSelectedAnalTypeQ2(targetAnalTypeQ2);
    }

    const targetAnalTypeQ3 = getTargetTypeForScope(selectedAnalTypeQ3);
    if (selectedAnalTypeQ3?.code !== targetAnalTypeQ3?.code) {
        setSelectedAnalTypeQ3(targetAnalTypeQ3);
    }
    
    const targetAnalTypeQ4 = getTargetTypeForScope(selectedAnalTypeQ4);
    if (selectedAnalTypeQ4?.code !== targetAnalTypeQ4?.code) {
        setSelectedAnalTypeQ4(targetAnalTypeQ4);
    }
    
  }, [reportScope, allAnalTypes, selectedAnalTypeQ1, selectedAnalTypeQ2, selectedAnalTypeQ3, selectedAnalTypeQ4]);


  useEffect(() => {
    if (selectedYear && selectedQuarter) {
      setReportingPeriod(`${selectedYear}-${selectedQuarter}`);
    }
  }, [selectedYear, selectedQuarter]);
  
  const comparisonPeriod = useMemo(() => {
      if (!reportingPeriod) return '';
      return (reportCode === 'P&L' || reportCode === 'CF')
        ? getSamePeriodLastYear(reportingPeriod)
        : getPreviousQuarterEndDate(reportingPeriod);
  }, [reportingPeriod, reportCode]);

  const samePeriodLastYearForBS = useMemo(() => {
      if (!reportingPeriod) return '';
      return getSamePeriodLastYear(reportingPeriod);
  }, [reportingPeriod]);

  const previousQuarterPeriod = useMemo(() => {
      if (!reportingPeriod || (reportCode !== 'P&L' && reportCode !== 'CF') || selectedQuarter === '03-01') {
          return null;
      }
      return getPreviousQuarterEndDate(reportingPeriod);
  }, [reportingPeriod, reportCode, selectedQuarter]);
  
  const getAnalCodeForPeriod = useCallback((period: string): string | undefined => {
    if (!period || allAnalTypes.length === 0) return undefined;
    const date = new Date(period);
    const year = date.getUTCFullYear();
    const month = date.getUTCMonth(); // 0-11
    
    if (String(year) !== selectedYear) {
        // For historical years, use the fixed rule
        const quarterValue = availableQuarters[Math.floor(month / 3)].value;
        return getHistoricalAnalCodeForQuarter(quarterValue, reportScope);
    }

    // For the currently selected year, use the user's filter choices
    const quarterIndex = Math.floor(month / 3);
    if (quarterIndex < 0 || quarterIndex >= availableQuarters.length) return undefined;
    const quarterValue = availableQuarters[quarterIndex].value;

    let selectedType: AnalType | null = null;
    switch (quarterValue) {
        case '03-01': selectedType = selectedAnalTypeQ1; break;
        case '06-01': selectedType = selectedAnalTypeQ2; break;
        case '09-01': selectedType = selectedAnalTypeQ3; break;
        case '12-01': selectedType = selectedAnalTypeQ4; break;
    }

    const filteredTypes = reportScope === 'Hợp nhất'
        ? allAnalTypes.filter(t => ['PVN-P01', 'PVN-P02'].includes(t.code))
        : allAnalTypes.filter(t => ['PVN-P03', 'PVN-P04'].includes(t.code));
    
    if (selectedType && filteredTypes.some(t => t.code === selectedType.code)) {
        return selectedType.code;
    }
    
    return filteredTypes[0]?.code;
  }, [allAnalTypes, reportScope, selectedYear, selectedAnalTypeQ1, selectedAnalTypeQ2, selectedAnalTypeQ3, selectedAnalTypeQ4]);

  const getSttsForIndicator = useCallback(async (indicatorName: string, reportCode: 'BS' | 'P&L' | 'CF'): Promise<number[]> => {
    const normalizeName = (name: string | null): string => (name || '').trim().toUpperCase().replace(/\s\s+/g, ' ');
    const normalizedIndicatorName = normalizeName(indicatorName);

    // 1. Fetch all BS accounts once to work in memory.
    const { data: allBsAccounts, error: accError } = await supabase
        .from('d_account')
        .select('stt, chi_tieu_lv1, chi_tieu_lv2, chi_tieu_lv3, chi_tieu_lv4')
        .eq('ten_bao_cao', reportCode)
        .order('stt');

    if (accError || !allBsAccounts) {
        console.error(`Lỗi khi tìm nạp danh sách chỉ tiêu ${reportCode}:`, accError?.message);
        return [];
    }

    const typedAccounts = allBsAccounts as DAccount[];

    // 2. Sequentially scan through levels to find the first match.
    const levels: ('chi_tieu_lv1' | 'chi_tieu_lv2' | 'chi_tieu_lv3' | 'chi_tieu_lv4')[] = ['chi_tieu_lv1', 'chi_tieu_lv2', 'chi_tieu_lv3', 'chi_tieu_lv4'];

    for (const level of levels) {
        // Check if any account matches the name at the current level.
        const hasMatchAtThisLevel = typedAccounts.some(acc => normalizeName(acc[level]) === normalizedIndicatorName);

        if (hasMatchAtThisLevel) {
            // 3. If a match is found, collect all STTs from all rows that have this name at this level.
            const finalStts = typedAccounts
                .filter(acc => normalizeName(acc[level]) === normalizedIndicatorName)
                .map(acc => acc.stt)
                .filter((stt): stt is number => stt !== null && stt !== undefined);

            // 4. Return the unique list of STTs and stop scanning further levels.
            return [...new Set(finalStts)];
        }
    }

    // 5. If no match is found after checking all levels, return an empty array.
    console.warn(`Không tìm thấy chỉ tiêu nào khớp với tên: "${indicatorName}"`);
    return [];
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      if (!reportingPeriod || !comparisonPeriod || selectedUnitCodes.length === 0 || !reportCode || reportCode === 'FA') return;
      if (reportCode !== 'BS' && !effectiveAnalTypeCode) return;

      setLoading(true);
      setError(null);

      try {
        const { data: acc, error: e1 } = await supabase
          .from("d_account")
          .select("stt, ten_bao_cao, chi_tieu_lv1, chi_tieu_lv2, chi_tieu_lv3, chi_tieu_lv4")
          .eq("ten_bao_cao", reportCode)
          .order("stt");
        if (e1) throw new Error(e1.message);

        const startMonth = toMonthStart(comparisonPeriod);
        const endMonth   = toMonthStart(reportingPeriod);
        const prevQuarterMonth = previousQuarterPeriod ? toMonthStart(previousQuarterPeriod) : null;
        const samePeriodLastYearMonth = reportCode === 'BS' ? toMonthStart(samePeriodLastYearForBS) : null;
        const beginningOfYearMonth = (reportCode === 'BS' && selectedYear) ? toMonthStart(`${parseInt(selectedYear) - 1}-12-01`) : null;

        const queriesToRun: any[] = [];

        if (reportCode === 'BS') {
            const datesByAnalCode = new Map<string, string[]>();
            const periods = [
                { date: reportingPeriod, month: endMonth },
                { date: comparisonPeriod, month: startMonth },
                { date: samePeriodLastYearForBS, month: samePeriodLastYearMonth },
                { date: beginningOfYearMonth ? `${parseInt(selectedYear) - 1}-12-31` : null, month: beginningOfYearMonth }
            ];

            for (const p of periods) {
                if (p.date && p.month) {
                    const analCode = getAnalCodeForPeriod(p.date);
                    if (analCode) {
                        if (!datesByAnalCode.has(analCode)) {
                            datesByAnalCode.set(analCode, []);
                        }
                        datesByAnalCode.get(analCode)!.push(p.month);
                    }
                }
            }

            for (const [analCode, dates] of datesByAnalCode.entries()) {
                if (dates.length > 0) {
                    queriesToRun.push(
                        supabase.from('f_tckt_v2')
                            .select('id_tckt, date, value')
                            .in('date', [...new Set(dates)])
                            .in('entity', selectedUnitCodes)
                            .eq('p_anal', analCode)
                    );
                }
            }
        } else { // P&L or CF
            let prevQuarterAnalTypeCode: string | undefined = undefined;
            if (prevQuarterMonth) {
                let selectedTypeForPrevQuarter: AnalType | null = null;
                switch (selectedQuarter) {
                    case '06-01': selectedTypeForPrevQuarter = selectedAnalTypeQ1; break;
                    case '09-01': selectedTypeForPrevQuarter = selectedAnalTypeQ2; break;
                    case '12-01': selectedTypeForPrevQuarter = selectedAnalTypeQ3; break;
                }

                const filteredTypes = reportScope === 'Hợp nhất'
                    ? allAnalTypes.filter(t => ['PVN-P01', 'PVN-P02'].includes(t.code))
                    : allAnalTypes.filter(t => ['PVN-P03', 'PVN-P04'].includes(t.code));
                
                if (selectedTypeForPrevQuarter && filteredTypes.some(t => t.code === selectedTypeForPrevQuarter.code)) {
                    prevQuarterAnalTypeCode = selectedTypeForPrevQuarter.code;
                } else {
                    prevQuarterAnalTypeCode = filteredTypes[0]?.code;
                }
            }
            
            const mainDatesToFetch = [startMonth, endMonth].filter(Boolean);
            if (mainDatesToFetch.length > 0) {
                queriesToRun.push(
                    supabase.from('f_tckt_v2')
                        .select('id_tckt, date, value')
                        .in('date', mainDatesToFetch)
                        .in('entity', selectedUnitCodes)
                        .eq('p_anal', effectiveAnalTypeCode)
                );
            }
            if (prevQuarterMonth && prevQuarterAnalTypeCode) {
                queriesToRun.push(
                    supabase.from('f_tckt_v2')
                        .select('id_tckt, date, value')
                        .eq('date', prevQuarterMonth)
                        .in('entity', selectedUnitCodes)
                        .eq('p_anal', prevQuarterAnalTypeCode)
                );
            }
        }
        
        const rawFx: { id_tckt: number; date: string; value: number; }[] = [];
        const pageSize = 1000;

        for (const query of queriesToRun) {
            let offset = 0;
            let keepFetching = true;
            while(keepFetching) {
                const { data, error } = await query.range(offset, offset + pageSize - 1);
                if (error) throw new Error(error.message);

                if (data && data.length > 0) {
                    rawFx.push(...data);
                    if (data.length < pageSize) {
                        keepFetching = false;
                    } else {
                        offset += pageSize;
                    }
                } else {
                    keepFetching = false;
                }
            }
        }
        
        if (rawFx.length === 0 && queriesToRun.length > 0) {
             setTreeData([]);
             setLoading(false);
             return;
        }

        const aggregatedFactsMap = new Map<string, number>();
        for (const fact of rawFx) {
            const key = `${fact.id_tckt}|${fact.date}`;
            const currentValue = aggregatedFactsMap.get(key) || 0;
            aggregatedFactsMap.set(key, currentValue + fact.value);
        }

        const facts: Fact[] = Array.from(aggregatedFactsMap.entries()).map(([key, value]) => {
            const [id_tckt, date] = key.split('|');
            return { id_tckt: Number(id_tckt), date, value, entity: null, p_anal: null };
        });

        const accounts = (acc ?? []) as DAccount[];
        const items = makeItemsFrom(accounts, facts, startMonth, endMonth, prevQuarterMonth, samePeriodLastYearMonth, beginningOfYearMonth);
        const tree = buildTreeByPath(items, reportCode as 'BS' | 'P&L' | 'CF');
        setTreeData(tree);

      } catch (err: any) {
        setError(err.message || String(err));
        setTreeData([]);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [reportingPeriod, comparisonPeriod, previousQuarterPeriod, samePeriodLastYearForBS, JSON.stringify(selectedUnitCodes), reportCode, effectiveAnalTypeCode, allAnalTypes, reportScope, selectedQuarter, selectedAnalTypeQ1, selectedAnalTypeQ2, selectedAnalTypeQ3, selectedAnalTypeQ4, getAnalCodeForPeriod, selectedYear]);

  // Fetch data for BS and P&L tables on the FA page
  useEffect(() => {
    const fetchFaPageTables = async () => {
      if (reportCode !== 'FA' || !reportingPeriod || selectedUnitCodes.length === 0 || allAnalTypes.length === 0) {
        return;
      }

      setFaPageTablesLoading(true);
      setFaPageTablesError(null);

      try {
        // 1. Fetch accounts for both BS and P&L
        const { data: acc, error: e1 } = await supabase
          .from("d_account")
          .select("stt, ten_bao_cao, chi_tieu_lv1, chi_tieu_lv2, chi_tieu_lv3, chi_tieu_lv4")
          .in("ten_bao_cao", ['BS', 'P&L'])
          .order("stt");
        if (e1) throw new Error(e1.message);

        const bsAccounts = acc.filter(a => a.ten_bao_cao === 'BS');
        const plAccounts = acc.filter(a => a.ten_bao_cao === 'P&L');

        // 2. Determine all dates needed
        const bsComparisonPeriod = getPreviousQuarterEndDate(reportingPeriod);
        const plComparisonPeriod = getSamePeriodLastYear(reportingPeriod);
        const plPreviousQuarterPeriod = (selectedQuarter === '03-01') ? null : getPreviousQuarterEndDate(reportingPeriod);

        const endMonth = toMonthStart(reportingPeriod);
        const bsStartMonth = toMonthStart(bsComparisonPeriod);
        const plStartMonth = toMonthStart(plComparisonPeriod);
        const plPrevQuarterMonth = plPreviousQuarterPeriod ? toMonthStart(plPreviousQuarterPeriod) : null;
        const yearStartMonth = selectedYear ? toMonthStart(`${parseInt(selectedYear) - 1}-12-01`) : null;

        const allDates = [...new Set([endMonth, bsStartMonth, plStartMonth, plPrevQuarterMonth, yearStartMonth].filter(Boolean))] as string[];

        // 3. Determine all anal codes needed
        const endAnalCode = getAnalCodeForPeriod(reportingPeriod);
        const bsStartAnalCode = getAnalCodeForPeriod(bsComparisonPeriod);
        const plStartAnalCode = getAnalCodeForPeriod(plComparisonPeriod);
        const plPrevQuarterAnalCode = plPreviousQuarterPeriod ? getAnalCodeForPeriod(plPreviousQuarterPeriod) : undefined;
        const yearStartAnalCode = yearStartMonth ? getAnalCodeForPeriod(`${parseInt(selectedYear) - 1}-12-31`) : undefined;
        
        const allAnalCodes = [...new Set([endAnalCode, bsStartAnalCode, plStartAnalCode, plPrevQuarterAnalCode, yearStartAnalCode].filter(Boolean))] as string[];

        // 4. Fetch all facts with pagination
        const rawFx: any[] = [];
        const pageSize = 1000;
        let offset = 0;
        let keepFetching = true;

        const baseQuery = supabase.from('f_tckt_v2')
          .select('id_tckt, date, value, p_anal')
          .in('date', allDates)
          .in('entity', selectedUnitCodes)
          .in('p_anal', allAnalCodes);
        
        while (keepFetching) {
            const { data, error: factError } = await baseQuery.range(offset, offset + pageSize - 1);
            if (factError) throw factError;

            if (data && data.length > 0) {
                rawFx.push(...data);
                if (data.length < pageSize) {
                    keepFetching = false;
                } else {
                    offset += pageSize;
                }
            } else {
                keepFetching = false;
            }
        }
        
        // 5. Aggregate facts
        const aggregatedFactsMap = new Map<string, number>();
        for (const fact of rawFx) {
          const key = `${fact.id_tckt}|${fact.date}|${fact.p_anal}`;
          const currentValue = aggregatedFactsMap.get(key) || 0;
          aggregatedFactsMap.set(key, currentValue + (fact.value || 0));
        }

        // 6. Process BS Data
        const bsFactMap = new Map<string, number>();
        aggregatedFactsMap.forEach((value, key) => {
            const [id_tckt, date, p_anal] = key.split('|');
            if ((date === endMonth && p_anal === endAnalCode) || (date === bsStartMonth && p_anal === bsStartAnalCode) || (date === yearStartMonth && p_anal === yearStartAnalCode)) {
                 const newKey = `${id_tckt}|${date}`;
                 bsFactMap.set(newKey, (bsFactMap.get(newKey) || 0) + value);
            }
        });
        const bsFacts: Fact[] = Array.from(bsFactMap.entries()).map(([key, value]) => {
            const [id_tckt, date] = key.split('|');
            return { id_tckt: Number(id_tckt), date, value, entity: null, p_anal: null };
        });
        const bsItems = makeItemsFrom(bsAccounts, bsFacts, bsStartMonth, endMonth, null, null, yearStartMonth);
        const bsTree = buildTreeByPath(bsItems, 'BS');
        setFaPageBsData(bsTree);

        // 7. Process P&L Data
        const plFactMap = new Map<string, number>();
        aggregatedFactsMap.forEach((value, key) => {
            const [id_tckt, date, p_anal] = key.split('|');
             if ((date === endMonth && p_anal === endAnalCode) || (date === plStartMonth && p_anal === endAnalCode) || (date === plPrevQuarterMonth && p_anal === plPrevQuarterAnalCode)) {
                const newKey = `${id_tckt}|${date}`;
                plFactMap.set(newKey, (plFactMap.get(newKey) || 0) + value);
            }
        });
        const plFacts: Fact[] = Array.from(plFactMap.entries()).map(([key, value]) => {
            const [id_tckt, date] = key.split('|');
            return { id_tckt: Number(id_tckt), date, value, entity: null, p_anal: null };
        });
        const plItems = makeItemsFrom(plAccounts, plFacts, plStartMonth, endMonth, plPrevQuarterMonth, null, null);
        const plTree = buildTreeByPath(plItems, 'P&L');
        setFaPagePlData(plTree);

      } catch (err: any) {
        setFaPageTablesError(err.message || String(err));
        setFaPageBsData([]);
        setFaPagePlData([]);
      } finally {
        setFaPageTablesLoading(false);
      }
    };

    fetchFaPageTables();
  }, [reportCode, reportingPeriod, JSON.stringify(selectedUnitCodes), getAnalCodeForPeriod, selectedQuarter, selectedYear, allAnalTypes]);
  
  // Effect for BS Metric Cards
  useEffect(() => {
    if (reportCode !== 'BS' || !treeData || treeData.length === 0) {
        setMetricValues({ shortTermAssets: null, longTermAssets: null, liabilities: null, equity: null });
        return;
    }

    const getMetricValue = (tree: TreeRow[], parentRegex: RegExp, childRegex: RegExp): number | null => {
        const parentNode = tree.find(node => parentRegex.test(node.name));
        if (!parentNode || !parentNode.children) return null;
        const childNode = parentNode.children.find(node => childRegex.test(node.name));
        return childNode?.end ?? null;
    };

    const shortTermAssets = getMetricValue(treeData, /tài\s*sản/i, /tài\s*sản\s*ngắn\s*hạn/i);
    const longTermAssets = getMetricValue(treeData, /tài\s*sản/i, /tài\s*sản\s*dài\s*hạn/i);
    const liabilities = getMetricValue(treeData, /nguồn\s*vốn/i, /nợ\s*phải\s*trả/i);
    const equity = getMetricValue(treeData, /nguồn\s*vốn/i, /vốn\s*chủ\s*sở\s*hữu/i);
    
    setMetricValues({ shortTermAssets, longTermAssets, liabilities, equity });

  }, [treeData, reportCode]);

  // Effect for P&L and CF Metric Cards
  useEffect(() => {
      if (!treeData || treeData.length === 0) {
          setPlMetricValues({ profitBeforeTax: null, currentTaxExpense: null, deferredTaxExpense: null, profitAfterTax: null });
          setCfMetricValues({ netFromOperating: null, netFromInvesting: null, netFromFinancing: null });
          return;
      }

      if (reportCode === 'P&L') {
          const getMetricByStt = (stt: number): number | null => {
              const row = findRowByStt(treeData, stt);
              return row?.end ?? null;
          };
          setPlMetricValues({
              profitBeforeTax: getMetricByStt(16),
              currentTaxExpense: getMetricByStt(17),
              deferredTaxExpense: getMetricByStt(18),
              profitAfterTax: getMetricByStt(19),
          });
      } else if (reportCode === 'CF') {
          // Find rows by full name to ensure the correct summary rows are selected,
          // matching the values shown in the main "Cash Flow Statement" table.
          const findRowByName = (nodes: TreeRow[], nameRegex: RegExp): TreeRow | null => {
              for (const node of nodes) {
                  if (nameRegex.test(node.name)) {
                      return node;
                  }
                  if (node.hasChildren) {
                      const found = findRowByName(node.children, nameRegex);
                      if (found) return found;
                  }
              }
              return null;
          };

          const netFromOperatingRow = findRowByName(treeData, /^Lưu chuyển tiền thuần từ hoạt động kinh doanh$/i);
          const netFromInvestingRow = findRowByName(treeData, /^Lưu chuyển tiền thuần từ hoạt động đầu tư$/i);
          const netFromFinancingRow = findRowByName(treeData, /^Lưu chuyển tiền thuần từ hoạt động tài chính$/i);

          setCfMetricValues({
              netFromOperating: netFromOperatingRow?.end ?? null,
              netFromInvesting: netFromInvestingRow?.end ?? null,
              netFromFinancing: netFromFinancingRow?.end ?? null,
          });
      }
  }, [treeData, reportCode]);
  
  useEffect(() => {
    const fetchBSChartData = async () => {
        if (reportCode !== 'BS' || !selectedYear || selectedUnitCodes.length === 0 || !selectedBSIndicator || allAnalTypes.length === 0) {
            setDynamicBSChartData([]);
            return;
        }

        const sttsToFetch = await getSttsForIndicator(selectedBSIndicator.name, 'BS');
        if (sttsToFetch.length === 0) {
            setDynamicBSChartData([]);
            return;
        }
        
        const datesByAnalCode = new Map<string, string[]>();
        const yearsToFetch = [selectedYear, String(parseInt(selectedYear) - 1)];

        for (const year of yearsToFetch) {
            for (const q of availableQuarters) {
                const date = toMonthStart(`${year}-${q.value}`);
                const analCode = getAnalCodeForPeriod(date);
                if (analCode) {
                    if (!datesByAnalCode.has(analCode)) {
                        datesByAnalCode.set(analCode, []);
                    }
                    datesByAnalCode.get(analCode)!.push(date);
                }
            }
        }
        
        if (datesByAnalCode.size === 0) {
            setDynamicBSChartData([]);
            return;
        }

        const fetchPromises = Array.from(datesByAnalCode.entries()).map(([analCode, dates]) => {
            return supabase.from('f_tckt_v2')
                .select('date, value')
                .in('date', dates)
                .in('id_tckt', sttsToFetch)
                .in('entity', selectedUnitCodes)
                .eq('p_anal', analCode);
        });

        const results = await Promise.all(fetchPromises);
        const facts: { date: string, value: number }[] = [];
        for (const result of results) {
            if (result.error) {
                console.error("Error fetching BS chart facts:", result.error.message);
            }
            if (result.data) {
                facts.push(...result.data);
            }
        }

        const factsByDate = (facts ?? []).reduce((acc: Record<string, number>, curr) => {
            const { date, value } = curr;
            acc[date] = (acc[date] || 0) + value;
            return acc;
        }, {});
        
        const chartData = availableQuarters.map(q => {
            const currentPeriodDate = toMonthStart(`${selectedYear}-${q.value}`);
            const previousPeriodDate = toMonthStart(`${parseInt(selectedYear) - 1}-${q.value}`);
            
            return {
                name: q.label, // "Quý I", "Quý II", etc.
                currentPeriod: factsByDate[currentPeriodDate] ?? null,
                previousPeriod: factsByDate[previousPeriodDate] ?? null,
            };
        });
        
        setDynamicBSChartData(chartData);
    };
    fetchBSChartData();
  }, [selectedYear, JSON.stringify(selectedUnitCodes), reportCode, getAnalCodeForPeriod, selectedBSIndicator, allAnalTypes, getSttsForIndicator]);

  // 5-Year Comparison Chart Data
  useEffect(() => {
    const fetchFiveYearChartData = async () => {
      if (reportCode !== 'BS' || !selectedYear || !selectedQuarter || selectedUnitCodes.length === 0 || !selectedBSIndicator || allAnalTypes.length === 0) {
        setFiveYearBSChartData([]);
        return;
      }

      const sttsToFetch = await getSttsForIndicator(selectedBSIndicator.name, 'BS');
      const baseYear = parseInt(selectedYear);
      const years = Array.from({ length: 5 }, (_, i) => baseYear - i);
      
      const datesByAnalCode = new Map<string, string[]>();

      for (const year of years) {
          const date = toMonthStart(`${year}-${selectedQuarter}`);
          const analCode = getAnalCodeForPeriod(date);

          if (analCode) {
              if (!datesByAnalCode.has(analCode)) {
                  datesByAnalCode.set(analCode, []);
              }
              datesByAnalCode.get(analCode)!.push(date);
          }
      }

      if (datesByAnalCode.size === 0 || sttsToFetch.length === 0) {
          setFiveYearBSChartData([]);
          return;
      }

      const fetchPromises = Array.from(datesByAnalCode.entries()).map(([analCode, dates]) => {
          return supabase.from('f_tckt_v2')
              .select('date, value')
              .in('date', dates)
              .in('id_tckt', sttsToFetch)
              .in('entity', selectedUnitCodes)
              .eq('p_anal', analCode);
      });

      const results = await Promise.all(fetchPromises);
      const facts: { date: string, value: number }[] = [];
      for (const result of results) {
          if (result.error) {
              console.error("Error fetching 5-year BS chart facts:", result.error.message);
          }
          if (result.data) {
              facts.push(...result.data);
          }
      }
      
      const factsByDate = (facts ?? []).reduce((acc: Record<string, number>, curr) => {
        const { date, value } = curr;
        acc[date] = (acc[date] || 0) + value;
        return acc;
      }, {});

      const chartData = years.map(year => {
        const date = toMonthStart(`${year}-${selectedQuarter}`);
        return {
          name: String(year),
          value: factsByDate[date] ?? 0,
        };
      }).sort((a, b) => parseInt(a.name) - parseInt(a.name));

      setFiveYearBSChartData(chartData);
    };

    fetchFiveYearChartData();
  }, [selectedYear, selectedQuarter, JSON.stringify(selectedUnitCodes), reportCode, selectedBSIndicator, getAnalCodeForPeriod, reportScope, allAnalTypes, getSttsForIndicator]);

  useEffect(() => {
    if (reportCode !== 'BS') return;

    const findRowById = (nodes: TreeRow[], id: string): TreeRow | null => {
        for (const node of nodes) {
            if (node.id === id) return node;
            if (node.hasChildren) {
                const found = findRowById(node.children, id);
                if (found) return found;
            }
        }
        return null;
    };

    const findAllLeafDescendants = (node: TreeRow): TreeRow[] => {
        const leaves: TreeRow[] = [];
        const traverse = (currentNode: TreeRow) => {
            if (!currentNode.hasChildren) {
                leaves.push(currentNode);
                return;
            }
            for (const child of currentNode.children) {
                traverse(child);
            }
        };
        if (node.children) {
            for (const child of node.children) {
                traverse(child);
            }
        }
        return leaves;
    };

    if (!selectedBSIndicator?.id || !treeData || treeData.length === 0) {
        setWaterfallChartData([]);
        return;
    }

    const selectedRow = findRowById(treeData, selectedBSIndicator.id);

    if (!selectedRow || !selectedRow.hasChildren) {
        setWaterfallChartData([]);
        return;
    }
    
    const isVsSamePeriod = waterfallComparisonMode === 'vsSamePeriodLastYear';
    const isVsBeginningOfYear = waterfallComparisonMode === 'vsBeginningOfYear';
    
    const startValue = isVsSamePeriod 
        ? selectedRow.samePeriodLastYear 
        : isVsBeginningOfYear
            ? selectedRow.beginningOfYear
            : selectedRow.start;

    const endValue = selectedRow.end;
    const totalDiff = endValue != null && startValue != null ? endValue - startValue : 0;

    const waterfallSourceData: { name: string; value: number; type: 'total' | 'change' }[] = [];
    
    let startLabel = 'Đầu kỳ';
    if(isVsSamePeriod) startLabel = 'Cùng kỳ năm trước';
    if(isVsBeginningOfYear) startLabel = 'Đầu năm';

    waterfallSourceData.push({ name: startLabel, value: startValue ?? 0, type: 'total' });

    const leafNodes = findAllLeafDescendants(selectedRow);
    
    let leafDiffSum = 0;
    for (const leaf of leafNodes) {
        const leafStart = isVsSamePeriod 
            ? leaf.samePeriodLastYear 
            : isVsBeginningOfYear 
                ? leaf.beginningOfYear 
                : leaf.start;
        const leafEnd = leaf.end;
        const diff = (leafEnd ?? 0) - (leafStart ?? 0);
        
        if (Math.abs(diff) > 1) {
            waterfallSourceData.push({ name: leaf.name, value: diff, type: 'change' });
            leafDiffSum += diff;
        }
    }

    const otherDiff = totalDiff - leafDiffSum;
    if (Math.abs(otherDiff) > 1) {
        waterfallSourceData.push({ name: 'Khác', value: otherDiff, type: 'change' });
    }

    waterfallSourceData.push({ name: 'Cuối kỳ', value: endValue ?? 0, type: 'total' });

    setWaterfallChartData(waterfallSourceData);
  }, [selectedBSIndicator, treeData, reportCode, waterfallComparisonMode]);

  useEffect(() => {
    const fetchFlowChartData = async () => {
        if ((reportCode !== 'P&L' && reportCode !== 'CF') || !selectedYear || selectedUnitCodes.length === 0 || allAnalTypes.length === 0) {
            setDynamicPLChartData([]);
            setDynamicCFChartData([]);
            return;
        }

        const isPL = reportCode === 'P&L';
        const indicatorToFetch = isPL
            ? selectedPLIndicator ?? { stt: 19, name: 'Lợi nhuận sau thuế' }
            : selectedCFIndicator ?? { stt: 50, name: 'Lưu chuyển tiền thuần trong kỳ (50 = 20+30+40)' };

        const sttsToFetch = await getSttsForIndicator(indicatorToFetch.name, reportCode as 'P&L' | 'CF');
        if (sttsToFetch.length === 0) {
            if (isPL) setDynamicPLChartData([]); else setDynamicCFChartData([]);
            return;
        }
        
        const datesByAnalCode = new Map<string, string[]>();
        const yearsToFetch = [selectedYear, String(parseInt(selectedYear) - 1)];
        const datesToFetchSet = new Set<string>();
        for (const year of yearsToFetch) {
            for (const q of availableQuarters) {
                datesToFetchSet.add(toMonthStart(`${year}-${q.value}`));
            }
            datesToFetchSet.add(toMonthStart(`${parseInt(year) - 1}-12-01`));
        }

        const allDatesToFetch = Array.from(datesToFetchSet).filter(Boolean);
        for (const date of allDatesToFetch) {
            const analCode = getAnalCodeForPeriod(date);
            if (analCode) {
                if (!datesByAnalCode.has(analCode)) datesByAnalCode.set(analCode, []);
                datesByAnalCode.get(analCode)!.push(date);
            }
        }
        
        if (datesByAnalCode.size === 0) {
            if (isPL) setDynamicPLChartData([]); else setDynamicCFChartData([]);
            return;
        }

        try {
            const fetchPromises = Array.from(datesByAnalCode.entries()).map(([analCode, dates]) => {
                return supabase.from('f_tckt_v2')
                    .select('date, id_tckt, value')
                    .in('date', dates)
                    .in('id_tckt', sttsToFetch)
                    .in('entity', selectedUnitCodes)
                    .eq('p_anal', analCode);
            });

            const results = await Promise.all(fetchPromises);
            for (const result of results) {
                if (result.error) {
                    throw new Error(`Lỗi khi tìm nạp dữ liệu biểu đồ ${reportCode}: ${result.error.message}`);
                }
            }
            const facts = results.flatMap(result => result.data || []);
            
            const factsByDate: { [date: string]: number } = {};
            for(const fact of facts) {
                if (!factsByDate[fact.date]) factsByDate[fact.date] = 0;
                factsByDate[fact.date] += fact.value;
            }
            
            const subtract = (a?: number, b?: number): number | null => {
                const valA = a ?? null;
                const valB = b ?? null;
                if (valA !== null && valB !== null) return valA - valB;
                if (valA !== null && valB === null) return valA;
                return null;
            }

            const chartData = availableQuarters.map((q, index) => {
                const currentQuarterDate = toMonthStart(`${selectedYear}-${q.value}`);
                const lastYearCurrentQuarterDate = toMonthStart(`${parseInt(selectedYear) - 1}-${q.value}`);

                let currentPeriodValue: number | null;
                let previousPeriodValue: number | null;
                
                if (isPL) { // P&L report: show value generated within the period (quarterly)
                    const prevQuarterDate = index > 0 
                        ? toMonthStart(`${selectedYear}-${availableQuarters[index - 1].value}`)
                        : toMonthStart(`${parseInt(selectedYear) - 1}-12-01`);
                    const lastYearPrevQuarterDate = index > 0
                        ? toMonthStart(`${parseInt(selectedYear) - 1}-${availableQuarters[index - 1].value}`)
                        : toMonthStart(`${parseInt(selectedYear) - 2}-12-01`);
                    
                    currentPeriodValue = subtract(factsByDate[currentQuarterDate], factsByDate[prevQuarterDate]);
                    previousPeriodValue = subtract(factsByDate[lastYearCurrentQuarterDate], factsByDate[lastYearPrevQuarterDate]);

                } else { // CF report: show cumulative value at the end of the period
                    currentPeriodValue = factsByDate[currentQuarterDate] ?? null;
                    previousPeriodValue = factsByDate[lastYearCurrentQuarterDate] ?? null;
                }

                return {
                    name: q.label,
                    currentPeriod: currentPeriodValue,
                    previousPeriod: previousPeriodValue,
                };
            });

            if (isPL) {
                setDynamicPLChartData(chartData);
            } else {
                setDynamicCFChartData(chartData);
            }

        } catch (error: any) {
            console.error(error.message);
            setError(error.message);
        }
    };
    fetchFlowChartData();
  }, [selectedYear, JSON.stringify(selectedUnitCodes), reportCode, selectedPLIndicator, selectedCFIndicator, reportScope, allAnalTypes, getAnalCodeForPeriod, getSttsForIndicator]);
  
  // 5-Year P&L and CF Comparison Chart Data
  useEffect(() => {
    const fetchFiveYearChartData = async () => {
      if ((reportCode !== 'P&L' && reportCode !== 'CF') || !selectedYear || !selectedQuarter || selectedUnitCodes.length === 0 || allAnalTypes.length === 0) {
        if (reportCode === 'P&L') setFiveYearPLChartData([]);
        if (reportCode === 'CF') setFiveYearCFChartData([]);
        return;
      }
      
      const isPL = reportCode === 'P&L';
      const selectedIndicator = isPL ? selectedPLIndicator : selectedCFIndicator;
      
      if (!selectedIndicator) {
          if (isPL) setFiveYearPLChartData([]); else setFiveYearCFChartData([]);
          return;
      }

      const sttsToFetch = await getSttsForIndicator(selectedIndicator.name, reportCode as 'P&L' | 'CF');
      const baseYear = parseInt(selectedYear);
      const years = Array.from({ length: 5 }, (_, i) => baseYear - i);
      
      const datesByAnalCode = new Map<string, string[]>();

      for (const year of years) {
          const date = toMonthStart(`${year}-${selectedQuarter}`);
          const analCode = getAnalCodeForPeriod(date);

          if (analCode) {
              if (!datesByAnalCode.has(analCode)) {
                  datesByAnalCode.set(analCode, []);
              }
              datesByAnalCode.get(analCode)!.push(date);
          }
      }

      if (datesByAnalCode.size === 0 || sttsToFetch.length === 0) {
          if (isPL) setFiveYearPLChartData([]); else setFiveYearCFChartData([]);
          return;
      }

      const fetchPromises = Array.from(datesByAnalCode.entries()).map(([analCode, dates]) => {
          return supabase.from('f_tckt_v2')
              .select('date, value')
              .in('date', dates)
              .in('id_tckt', sttsToFetch)
              .in('entity', selectedUnitCodes)
              .eq('p_anal', analCode);
      });

      const results = await Promise.all(fetchPromises);
      const facts: { date: string, value: number }[] = [];
      for (const result of results) {
          if (result.error) {
              console.error(`Error fetching 5-year ${reportCode} chart facts:`, result.error.message);
          }
          if (result.data) {
              facts.push(...result.data);
          }
      }
      
      const factsByDate = (facts ?? []).reduce((acc: Record<string, number>, curr) => {
        const { date, value } = curr;
        acc[date] = (acc[date] || 0) + value;
        return acc;
      }, {});

      const chartData = years.map(year => {
        const date = toMonthStart(`${year}-${selectedQuarter}`);
        return {
          name: String(year),
          value: factsByDate[date] ?? 0,
        };
      }).sort((a, b) => parseInt(a.name) - parseInt(a.name));
      
      if (isPL) {
        setFiveYearPLChartData(chartData);
      } else {
        setFiveYearCFChartData(chartData);
      }
    };

    fetchFiveYearChartData();
  }, [selectedYear, selectedQuarter, JSON.stringify(selectedUnitCodes), reportCode, selectedPLIndicator, selectedCFIndicator, getAnalCodeForPeriod, reportScope, allAnalTypes, getSttsForIndicator]);

  // P&L and CF Waterfall Chart Data
  useEffect(() => {
    if (reportCode !== 'P&L' && reportCode !== 'CF') return;

    const findRowById = (nodes: TreeRow[], id: string): TreeRow | null => {
        for (const node of nodes) {
            if (node.id === id) return node;
            if (node.hasChildren) {
                const found = findRowById(node.children, id);
                if (found) return found;
            }
        }
        return null;
    };

    const findAllLeafDescendants = (node: TreeRow): TreeRow[] => {
        const leaves: TreeRow[] = [];
        const traverse = (currentNode: TreeRow) => {
            if (!currentNode.hasChildren) {
                leaves.push(currentNode);
                return;
            }
            for (const child of currentNode.children) {
                traverse(child);
            }
        };
        if (node.children) {
            for (const child of node.children) {
                traverse(child);
            }
        }
        return leaves;
    };
    
    const isPL = reportCode === 'P&L';
    const selectedIndicator = isPL ? selectedPLIndicator : selectedCFIndicator;
    const comparisonMode = isPL ? waterfallPLComparisonMode : waterfallCFComparisonMode;

    if (!selectedIndicator?.id || !treeData || treeData.length === 0) {
        if (isPL) setWaterfallPLChartData([]); else setWaterfallCFChartData([]);
        return;
    }

    const selectedRow = findRowById(treeData, selectedIndicator.id);

    if (!selectedRow || !selectedRow.hasChildren) {
        if (isPL) setWaterfallPLChartData([]); else setWaterfallCFChartData([]);
        return;
    }
    
    const isVsPrevQuarter = comparisonMode === 'vsPreviousQuarter';

    // Use cumulative end value vs cumulative start value (either last year's or last quarter's)
    const startValue = isVsPrevQuarter ? selectedRow.prevQuarter : selectedRow.start;
    const endValue = selectedRow.end;
    const totalDiff = endValue != null && startValue != null ? endValue - startValue : 0;

    const waterfallSourceData: { name: string; value: number; type: 'total' | 'change' }[] = [];

    waterfallSourceData.push({ name: isVsPrevQuarter ? 'Lũy kế quý trước' : 'Lũy kế cùng kỳ' , value: startValue ?? 0, type: 'total' });

    const leafNodes = findAllLeafDescendants(selectedRow);
    
    let leafDiffSum = 0;
    for (const leaf of leafNodes) {
        const leafStart = isVsPrevQuarter ? leaf.prevQuarter : leaf.start;
        const leafEnd = leaf.end;
        const diff = (leafEnd ?? 0) - (leafStart ?? 0);
        
        if (Math.abs(diff) > 1) {
            waterfallSourceData.push({ name: leaf.name, value: diff, type: 'change' });
            leafDiffSum += diff;
        }
    }

    const otherDiff = totalDiff - leafDiffSum;
    if (Math.abs(otherDiff) > 1) {
        waterfallSourceData.push({ name: 'Khác', value: otherDiff, type: 'change' });
    }

    waterfallSourceData.push({ name: 'Lũy kế kỳ này', value: endValue ?? 0, type: 'total' });

    if (isPL) {
      setWaterfallPLChartData(waterfallSourceData);
    } else {
      setWaterfallCFChartData(waterfallSourceData);
    }
  }, [selectedPLIndicator, selectedCFIndicator, treeData, reportCode, waterfallPLComparisonMode, waterfallCFComparisonMode]);


  useEffect(() => {
    const fetchAndProcessFAData = async () => {
        if (reportCode !== 'FA' || !reportingPeriod || selectedUnitCodes.length === 0 || !selectedYear || !selectedQuarter || allAnalTypes.length === 0) return;
        setFinancialAnalysisLoading(true);

        // --- Fetch all required STT lists using the standardized getSttsForIndicator function ---
        const sttsToFetchPromises = {
            shortTermAssetsComponents: getSttsForIndicator('A. TÀI SẢN NGẮN HẠN', 'BS'),
            cashAndEquivalentsComponents: getSttsForIndicator('I. Tiền và các khoản tương đương tiền', 'BS'),
            shortTermInvestmentsComponents: getSttsForIndicator('II. Các khoản đầu tư tài chính ngắn hạn', 'BS'),
            shortTermLiabilitiesComponents: getSttsForIndicator('I. Nợ ngắn hạn', 'BS'),
            totalAssetsComponents: getSttsForIndicator('TỔNG CỘNG TÀI SẢN (270 = 100 + 200)', 'BS'),
            equityComponents: getSttsForIndicator('D. VỐN CHỦ SỞ HỮU (400 = 410 + 430)', 'BS'),
            totalLiabilitiesComponents: getSttsForIndicator('C. NỢ PHẢI TRẢ (300 = 310 + 330)', 'BS'),
            longTermAssetsComponents: getSttsForIndicator('B. TÀI SẢN DÀI HẠN', 'BS'),
            longTermDebtComponents: getSttsForIndicator('II. Nợ dài hạn', 'BS'),
            inventory: getSttsForIndicator('IV. Hàng tồn kho', 'BS'),
            shortTermReceivablesComponents: getSttsForIndicator('III. Các khoản phải thu ngắn hạn', 'BS'),
            longTermReceivablesComponents: getSttsForIndicator('I. Các khoản phải thu dài hạn', 'BS'),
        };

        const sttsResults = await Promise.all(Object.values(sttsToFetchPromises));
        const sttsToFetch: { [key: string]: number[] } = Object.keys(sttsToFetchPromises).reduce((acc, key, index) => {
            acc[key] = sttsResults[index];
            return acc;
        }, {} as { [key: string]: number[] });

        // Add single-STT P&L items
        const singleStts = {
            profitAfterTax: [19], profitBeforeTax: [16], netRevenue: [3], costOfGoodsSold: [4], interestExpense: [8],
            contributedCapital: [100], shortTermLoans: [81], longTermLoans: [93], tradePayables: [73],
        };

        const allStts = [...new Set(Object.values(sttsToFetch).flat().concat(Object.values(singleStts).flat()))];

        // --- Date and Anal Code Preparation ---
        const year = parseInt(selectedYear);
        const allDatesNeeded: string[] = [];
        const uniqueDates = new Set<string>();

        // Get all quarters for the selected year and the previous 4 years
        for (let y = 0; y < 5; y++) {
            const currentYear = year - y;
            for (const q of availableQuarters) {
                uniqueDates.add(toMonthStart(`${currentYear}-${q.value}`));
            }
            // Add end of previous year for beginning-of-period calculations
            uniqueDates.add(toMonthStart(`${currentYear - 1}-12-01`));
        }
        allDatesNeeded.push(...Array.from(uniqueDates));
        
        const datesByAnalCode = new Map<string, string[]>();
        allDatesNeeded.forEach(date => {
            const code = getAnalCodeForPeriod(date);
            if (code) {
                if (!datesByAnalCode.has(code)) {
                    datesByAnalCode.set(code, []);
                }
                datesByAnalCode.get(code)!.push(date);
            }
        });

        if (datesByAnalCode.size === 0) {
            setFinancialAnalysisData(null);
            setFinancialAnalysisLoading(false);
            return;
        }

        // --- Data Fetching ---
        const factsData: { date: string; id_tckt: number; value: number; }[] = [];
        const pageSize = 1000;

        for (const [analCode, dates] of datesByAnalCode.entries()) {
            let offset = 0;
            let keepFetching = true;
            while (keepFetching) {
                const { data, error } = await supabase.from('f_tckt_v2')
                    .select('date, id_tckt, value')
                    .in('date', dates)
                    .in('id_tckt', allStts)
                    .in('entity', selectedUnitCodes)
                    .eq('p_anal', analCode)
                    .range(offset, offset + pageSize - 1);

                if (error) {
                    console.error("Error fetching Financial Analysis data:", error.message);
                    setFinancialAnalysisData(null);
                    setFinancialAnalysisLoading(false);
                    return; // Exit on error
                }

                if (data && data.length > 0) {
                    factsData.push(...data);
                    if (data.length < pageSize) {
                        keepFetching = false;
                    } else {
                        offset += pageSize;
                    }
                } else {
                    keepFetching = false;
                }
            }
        }
            
        // --- Data Processing and Aggregation ---
        const factsByDate: { [date: string]: { [key: string]: number } } = {};
        
        const sttsMap: { [key: string]: number[] } = { ...sttsToFetch, ...singleStts };

        (factsData ?? []).forEach(fact => {
            if (!factsByDate[fact.date]) factsByDate[fact.date] = {};
            
            for (const key in sttsMap) {
                if (sttsMap[key].includes(fact.id_tckt)) {
                    factsByDate[fact.date][key] = (factsByDate[fact.date][key] || 0) + (fact.value || 0);
                }
            }
        });
        
        // --- Ratio Calculation ---
        const allRatiosByQuarter: { [date: string]: { [key: string]: number | null } } = {};
        const datesForRatioCalc = allDatesNeeded.sort().filter(d => new Date(d) > new Date(allDatesNeeded.reduce((a, b) => a < b ? a : b)));
        
        const calculateAndStoreRatios = (currentPeriodDate: string) => {
            const jsDate = new Date(currentPeriodDate);
            // FIX: Add Math.floor to correctly calculate the quarter as an integer. This resolves a "Cannot read properties of undefined (reading 'value')" error.
            const quarter = Math.floor(jsDate.getUTCMonth() / 3); // 0 for Q1, 1 for Q2, etc.
            const year = jsDate.getUTCFullYear();

            // P&L items are cumulative. To get a single quarter's value, we subtract the previous quarter.
            const previousQuarterDate = (quarter > 0) ? toMonthStart(`${year}-${availableQuarters[quarter - 1].value}`) : toMonthStart(`${year - 1}-12-01`);
            const yearStartDate = toMonthStart(`${year - 1}-12-01`);

            const periodData = factsByDate[currentPeriodDate];
            const prevQuarterData = factsByDate[previousQuarterDate];
            const yearStartBSData = factsByDate[yearStartDate];
            
            if (!periodData) return;

            allRatiosByQuarter[currentPeriodDate] = {};

            const getCumulativePL = (key: string) => periodData[key];
            const getQuarterlyPL = (key: string) => (periodData[key] || 0) - (prevQuarterData?.[key] || 0);
            
            // This function calculates ratios for both quarterly and cumulative values.
            const calculate = (isCumulative: boolean) => {
                const netIncome = isCumulative ? getCumulativePL('profitAfterTax') : getQuarterlyPL('profitAfterTax');
                const pbt = isCumulative ? getCumulativePL('profitBeforeTax') : getQuarterlyPL('profitBeforeTax');
                const interestExpense = isCumulative ? getCumulativePL('interestExpense') : getQuarterlyPL('interestExpense');
                const costOfGoodsSold = isCumulative ? getCumulativePL('costOfGoodsSold') : getQuarterlyPL('costOfGoodsSold');
                const revenue = isCumulative ? getCumulativePL('netRevenue') : getQuarterlyPL('netRevenue');

                const assetsEnd = periodData.totalAssetsComponents;
                const assetsStart = isCumulative ? yearStartBSData?.totalAssetsComponents : factsByDate[previousQuarterDate]?.totalAssetsComponents;
                const avgAssets = (assetsStart != null && assetsEnd != null) ? (assetsStart + assetsEnd) / 2 : null;

                const equityEnd = periodData.equityComponents;
                const equityStart = isCumulative ? yearStartBSData?.equityComponents : factsByDate[previousQuarterDate]?.equityComponents;
                const avgEquity = (equityStart != null && equityEnd != null) ? (equityStart + equityEnd) / 2 : null;

                const currentAssetsEnd = periodData.shortTermAssetsComponents;
                const currentLiabilitiesEnd = periodData.shortTermLiabilitiesComponents;

                const workingCapitalEnd = (currentAssetsEnd || 0) - (currentLiabilitiesEnd || 0);
                const workingCapitalStartData = isCumulative ? yearStartBSData : factsByDate[previousQuarterDate];
                const workingCapitalStart = (workingCapitalStartData?.shortTermAssetsComponents != null && workingCapitalStartData?.shortTermLiabilitiesComponents != null)
                    ? (workingCapitalStartData.shortTermAssetsComponents - workingCapitalStartData.shortTermLiabilitiesComponents) : null;
                const avgWorkingCapital = (workingCapitalStart != null && workingCapitalEnd != null) ? (workingCapitalStart + workingCapitalEnd) / 2 : null;

                const inventoryEnd = periodData.inventory;
                const inventoryStart = isCumulative ? yearStartBSData?.inventory : factsByDate[previousQuarterDate]?.inventory;
                const purchases = (costOfGoodsSold != null && inventoryEnd != null && inventoryStart != null) ? costOfGoodsSold + inventoryEnd - inventoryStart : null;
                
                const totalLiabilitiesEnd = periodData.totalLiabilitiesComponents;
                const totalLiabilitiesStart = isCumulative ? yearStartBSData?.totalLiabilitiesComponents : factsByDate[previousQuarterDate]?.totalLiabilitiesComponents;
                const avgTotalLiabilities = (totalLiabilitiesStart != null && totalLiabilitiesEnd != null) ? (totalLiabilitiesStart + totalLiabilitiesEnd) / 2 : null;

                const shortTermReceivablesEnd = periodData.shortTermReceivablesComponents;
                const longTermReceivablesEnd = periodData.longTermReceivablesComponents;
                const totalReceivablesEndValue = (shortTermReceivablesEnd || 0) + (longTermReceivablesEnd || 0);
                
                const receivablesStartData = isCumulative ? yearStartBSData : factsByDate[previousQuarterDate];
                const totalReceivablesStartValue = (receivablesStartData?.shortTermReceivablesComponents != null && receivablesStartData?.longTermReceivablesComponents != null)
                    ? (receivablesStartData.shortTermReceivablesComponents + receivablesStartData.longTermReceivablesComponents) : null;
                const avgTotalReceivables = (totalReceivablesStartValue != null && totalReceivablesEndValue != null) ? (totalReceivablesStartValue + totalReceivablesEndValue) / 2 : null;
                
                const cashAndEquivalentsEnd = periodData.cashAndEquivalentsComponents;
                const shortTermInvestmentsEnd = periodData.shortTermInvestmentsComponents;

                const safeDiv = (num: number | null | undefined, den: number | null | undefined, multiplier = 1) => (num != null && den != null && den !== 0) ? (num / den) * multiplier : null;
                const ebit = (pbt != null && interestExpense != null) ? pbt + interestExpense : null;
                const receivablesTurnover = safeDiv(revenue, avgTotalReceivables);
                
                const quarterNumber = new Date(currentPeriodDate).getUTCMonth() / 3 + 1;
                const daysInPeriod = isCumulative ? quarterNumber * 91.25 : 91.25;

                return {
                    roa: safeDiv(netIncome, avgAssets), roe: safeDiv(netIncome, avgEquity), pbtMargin: safeDiv(pbt, revenue),
                    capitalAdequacyRatio: safeDiv(equityEnd, equityStart),
                    debtCoverageRatio: safeDiv(equityEnd, totalLiabilitiesEnd),
                    selfFinancingRatio: safeDiv(equityEnd, assetsEnd),
                    debtToAssetRatio: safeDiv(totalLiabilitiesEnd, assetsEnd),
                    currentAssetToTotalAssetRatio: safeDiv(currentAssetsEnd, assetsEnd), assetTurnover: safeDiv(revenue, avgAssets),
                    debtToEquityRatio: safeDiv(totalLiabilitiesEnd, equityEnd), loanToEquityRatio: safeDiv((periodData.shortTermLoans || 0) + (periodData.longTermLoans || 0), equityEnd),
                    longTermAssetSelfFinancingRatio: safeDiv(equityEnd, periodData.longTermAssetsComponents), longTermDebtRatio: safeDiv(periodData.longTermDebtComponents, equityEnd),
                    workingCapitalTurnover: safeDiv(revenue, avgWorkingCapital), payablesTurnover: safeDiv(purchases, avgTotalLiabilities),
                    receivablesTurnover: receivablesTurnover, daysSalesOutstanding: safeDiv(daysInPeriod, receivablesTurnover, 1),
                    solvencyRatio: safeDiv(assetsEnd, totalLiabilitiesEnd), quickRatio: safeDiv((cashAndEquivalentsEnd || 0) + (shortTermInvestmentsEnd || 0), currentLiabilitiesEnd),
                    currentRatio: safeDiv(currentAssetsEnd, currentLiabilitiesEnd), cashRatio: safeDiv(cashAndEquivalentsEnd, currentLiabilitiesEnd),
                    ebit, taxBurdenRatio: safeDiv(netIncome, pbt), interestBurdenRatio: safeDiv(pbt, ebit), ebitMargin: safeDiv(ebit, revenue),
                    financialLeverage: safeDiv(avgAssets, avgEquity),
                };
            };
            
            const quarterlyRatios = calculate(false);
            const cumulativeRatios = calculate(true);
            
            allRatiosByQuarter[currentPeriodDate] = cumulativeRatios; // For history and charts
            
            // Populate the table data for the selected reporting period
            if (currentPeriodDate === toMonthStart(reportingPeriod)) {
                const tableRows = Object.keys(indicatorMetadata).map(key => {
                    const typedKey = key as keyof typeof quarterlyRatios;
                    return {
                        key: key,
                        name: indicatorMetadata[key].name,
                        values: [quarterlyRatios[typedKey], cumulativeRatios[typedKey]]
                    }
                });

                setFinancialAnalysisData({
                    latestRatios: cumulativeRatios,
                    tableData: { 
                        headers: ['Giá trị kỳ này', 'Giá trị lũy kế đến kỳ này'],
                        rows: tableRows
                    },
                    fullRatioHistory: {} // will be populated after the loop
                });
            }
        };

        for (const currentPeriodDate of datesForRatioCalc) {
            calculateAndStoreRatios(currentPeriodDate);
        }

        setFinancialAnalysisData(prevData => ({
             ...(prevData || { latestRatios: {}, tableData: { headers: [], rows: [] } }),
             fullRatioHistory: allRatiosByQuarter
        }));

        setFinancialAnalysisLoading(false);
    };
    fetchAndProcessFAData();
  }, [reportCode, reportingPeriod, selectedYear, selectedQuarter, JSON.stringify(selectedUnitCodes), allAnalTypes, getAnalCodeForPeriod, getSttsForIndicator]);


  useEffect(() => {
    if (!financialAnalysisData || !selectedFAIndicator || !selectedYear || !selectedQuarter) {
        setDynamicFAValueChartData([]);
        return;
    }

    const { fullRatioHistory } = financialAnalysisData;
    const indicatorKey = selectedFAIndicator.key;

    const baseYear = parseInt(selectedYear);
    const years = Array.from({ length: 5 }, (_, i) => baseYear - 4 + i);

    const chartData: BalanceSheetChartDataPoint[] = years.map(year => {
        const dateStr = toMonthStart(`${year}-${selectedQuarter}`);
        
        const value = fullRatioHistory[dateStr]?.[indicatorKey] ?? null;

        return {
            name: String(year),
            value: value,
        };
    });

    setDynamicFAValueChartData(chartData);
  }, [financialAnalysisData, selectedFAIndicator, selectedYear, selectedQuarter]);

  useEffect(() => {
    if (!financialAnalysisData || !selectedFAIndicator || !selectedYear) {
        setDynamicFAChartData([]);
        return;
    }

    const { fullRatioHistory } = financialAnalysisData;
    const indicatorKey = selectedFAIndicator.key;
    const currentYear = parseInt(selectedYear);
    const previousYear = currentYear - 1;

    const chartData = availableQuarters.map(q => {
        const currentPeriodDate = toMonthStart(`${currentYear}-${q.value}`);
        const previousPeriodDate = toMonthStart(`${previousYear}-${q.value}`);

        const currentPeriodValue = fullRatioHistory[currentPeriodDate]?.[indicatorKey] ?? null;
        const previousPeriodValue = fullRatioHistory[previousPeriodDate]?.[indicatorKey] ?? null;
        
        return {
            name: q.label, // e.g., "Quý I"
            currentPeriod: currentPeriodValue,
            previousPeriod: previousPeriodValue,
        };
    });

    setDynamicFAChartData(chartData);
  }, [financialAnalysisData, selectedFAIndicator, selectedYear]);

  const reportingLabelText = getPeriodLabel(reportingPeriod);
  const comparisonLabel = getPeriodLabel(comparisonPeriod);
  const previousQuarterLabel = getPeriodLabel(previousQuarterPeriod);
  
  const bsComparisonPeriod = useMemo(() => getPreviousQuarterEndDate(reportingPeriod), [reportingPeriod]);
  const plComparisonPeriod = useMemo(() => getSamePeriodLastYear(reportingPeriod), [reportingPeriod]);
  
  const commonSidebar = (
    <Sidebar 
        selectedYear={selectedYear}
        setSelectedYear={setSelectedYear}
        availableYears={availableYears}
        selectedQuarter={selectedQuarter}
        setSelectedQuarter={setSelectedQuarter}
        availableQuarters={availableQuarters}
        selectedUnitIds={selectedUnitIds}
        setSelectedUnitIds={setSelectedUnitIds}
        reportScope={reportScope}
        setReportScope={setReportScope}
        analTypes={analTypes}
        selectedAnalTypeQ1={selectedAnalTypeQ1}
        setSelectedAnalTypeQ1={setSelectedAnalTypeQ1}
        selectedAnalTypeQ2={selectedAnalTypeQ2}
        setSelectedAnalTypeQ2={setSelectedAnalTypeQ2}
        selectedAnalTypeQ3={selectedAnalTypeQ3}
        setSelectedAnalTypeQ3={setSelectedAnalTypeQ3}
        selectedAnalTypeQ4={selectedAnalTypeQ4}
        setSelectedAnalTypeQ4={setSelectedAnalTypeQ4}
        activeReport={activeReport}
        unitHierarchy={unitHierarchy}
      />
  );

  const renderContent = () => {
    switch (reportCode) {
        case 'P&L':
            return (
                <div className="flex flex-col gap-4">
                    <aside className="w-full">{commonSidebar}</aside>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        <MetricCard
                            title="Lợi nhuận trước thuế (triệu đồng)"
                            value={loading ? '...' : fmtNumMillions(plMetricValues.profitBeforeTax)}
                            icon={<WalletIcon />}
                            color="green"
                        />
                        <MetricCard
                            title="Chi phí thuế TNDN hiện hành (triệu đồng)"
                            value={loading ? '...' : fmtNumMillions(plMetricValues.currentTaxExpense)}
                            icon={<DocumentIcon />}
                            color="orange"
                        />
                        <MetricCard
                            title="Chi phí thuế TNDN hoãn lại (triệu đồng)"
                            value={loading ? '...' : fmtNumMillions(plMetricValues.deferredTaxExpense)}
                            icon={<DocumentIcon />}
                            color="blue"
                        />
                        <MetricCard
                            title="Lợi nhuận sau thuế (triệu đồng)"
                            value={loading ? '...' : fmtNumMillions(plMetricValues.profitAfterTax)}
                            icon={<ShieldIcon />}
                            color="indigo"
                        />
                    </div>
                     <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        <div className="lg:col-span-1 bg-white p-4 rounded-lg shadow flex flex-col h-[320px]">
                            <h3 className="font-bold text-gray-700 mb-1">Biến động giá trị trong kỳ</h3>
                            <p className="text-sm text-gray-500 mb-2 truncate">{selectedPLIndicator?.name || '...'}</p>
                            <div className="flex-grow">
                                <IncomeStatementChart data={dynamicPLChartData} />
                            </div>
                        </div>
                        <div className="lg:col-span-1 bg-white p-4 rounded-lg shadow flex flex-col h-[320px]">
                            <h3 className="font-bold text-gray-700 mb-1">So sánh cùng kỳ 5 năm</h3>
                            <p className="text-sm text-gray-500 mb-2 truncate">{selectedPLIndicator?.name || '...'}</p>
                            <div className="flex-grow">
                                <BalanceSheetChart data={fiveYearPLChartData} chartType="bar" />
                            </div>
                        </div>
                    </div>
                    <MainContent
                        reportingPeriod={reportingPeriod}
                        comparisonPeriod={comparisonPeriod}
                        reportingLabelText={reportingLabelText}
                        comparisonLabel={comparisonLabel}
                        previousQuarterLabel={previousQuarterLabel}
                        reportLabel={activeReport}
                        treeData={treeData}
                        loading={loading}
                        error={error}
                        reportCode={'P&L'}
                        selectedIndicator={selectedPLIndicator}
                        onIndicatorSelect={handlePLIndicatorSelect}
                    />
                </div>
            );
        case 'CF':
             return (
                <div className="flex flex-col gap-4">
                  <aside className="w-full">{commonSidebar}</aside>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <MetricCard
                          title="LC tiền từ HĐ kinh doanh (triệu đồng)"
                          value={loading ? '...' : fmtNumMillions(cfMetricValues.netFromOperating)}
                          icon={<WalletIcon />}
                          color="green"
                      />
                      <MetricCard
                          title="LC tiền từ HĐ đầu tư (triệu đồng)"
                          value={loading ? '...' : fmtNumMillions(cfMetricValues.netFromInvesting)}
                          icon={<BuildingIcon />}
                          color="blue"
                      />
                      <MetricCard
                          title="LC tiền từ HĐ tài chính (triệu đồng)"
                          value={loading ? '...' : fmtNumMillions(cfMetricValues.netFromFinancing)}
                          icon={<ShieldIcon />}
                          color="indigo"
                      />
                  </div>
                   <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                        <div className="lg:col-span-1 bg-white p-4 rounded-lg shadow flex flex-col h-[320px]">
                          <h3 className="font-bold text-gray-700 mb-1">Giá trị lũy kế cuối kỳ</h3>
                          <p className="text-sm text-gray-500 mb-2 truncate">{selectedCFIndicator?.name || '...'}</p>
                          <div className="flex-grow">
                              <IncomeStatementChart data={dynamicCFChartData} />
                          </div>
                        </div>
                        <div className="lg:col-span-1 bg-white p-4 rounded-lg shadow flex flex-col h-[320px]">
                            <h3 className="font-bold text-gray-700 mb-1">So sánh cùng kỳ 5 năm</h3>
                            <p className="text-sm text-gray-500 mb-2 truncate">{selectedCFIndicator?.name || '...'}</p>
                            <div className="flex-grow">
                                <BalanceSheetChart data={fiveYearCFChartData} chartType="bar" />
                            </div>
                        </div>
                        <div className="lg:col-span-1 bg-white p-4 rounded-lg shadow flex flex-col h-[320px]">
                            <div className="flex justify-between items-center mb-1">
                                <h3 className="font-bold text-gray-700">Phân tích chênh lệch</h3>
                                <div className="flex items-center bg-gray-100 rounded-md p-0.5 text-xs">
                                    <button
                                        onClick={() => setWaterfallCFComparisonMode('vsPreviousQuarter')}
                                        className={`px-2 py-1 rounded-sm transition-colors ${waterfallCFComparisonMode === 'vsPreviousQuarter' ? 'bg-white shadow-sm text-gray-800 font-semibold' : 'text-gray-500 hover:bg-gray-200'}`}
                                    >
                                        vs Quý trước
                                    </button>
                                    <button
                                        onClick={() => setWaterfallCFComparisonMode('vsSamePeriodLastYear')}
                                        className={`px-2 py-1 rounded-sm transition-colors ${waterfallCFComparisonMode === 'vsSamePeriodLastYear' ? 'bg-white shadow-sm text-gray-800 font-semibold' : 'text-gray-500 hover:bg-gray-200'}`}
                                    >
                                        vs Cùng kỳ năm trước
                                    </button>
                                </div>
                            </div>
                            <p className="text-sm text-gray-500 mb-2 truncate">{selectedCFIndicator?.name || '...'}</p>
                            <div className="flex-grow">
                                <WaterfallChart data={waterfallCFChartData} />
                            </div>
                        </div>
                    </div>
                  <MainContent
                    reportingPeriod={reportingPeriod}
                    comparisonPeriod={comparisonPeriod}
                    reportingLabelText={reportingLabelText}
                    comparisonLabel={comparisonLabel}
                    previousQuarterLabel={previousQuarterLabel}
                    reportLabel={activeReport}
                    treeData={treeData}
                    loading={loading}
                    error={error}
                    reportCode={'CF'}
                    selectedIndicator={selectedCFIndicator}
                    onIndicatorSelect={handleCFIndicatorSelect}
                  />
                </div>
            );
        case 'BS':
            return (
                <div className="flex flex-col gap-4">
                  <aside className="w-full">{commonSidebar}</aside>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                      <MetricCard 
                          title="Tài sản Ngắn hạn (triệu đồng)" 
                          value={loading ? '...' : fmtNumMillions(metricValues.shortTermAssets)} 
                          icon={<WalletIcon />}
                          color="green"
                      />
                      <MetricCard 
                          title="Nợ phải trả (triệu đồng)" 
                          value={loading ? '...' : fmtNumMillions(metricValues.liabilities)} 
                          icon={<DocumentIcon />}
                          color="orange"
                      />
                      <MetricCard 
                          title="Tài sản Dài hạn (triệu đồng)" 
                          value={loading ? '...' : fmtNumMillions(metricValues.longTermAssets)} 
                          icon={<BuildingIcon />}
                          color="blue"
                      />
                      <MetricCard 
                          title="Vốn chủ sở hữu (triệu đồng)" 
                          value={loading ? '...' : fmtNumMillions(metricValues.equity)} 
                          icon={<ShieldIcon />}
                          color="indigo"
                      />
                  </div>
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                    <div className="lg:col-span-1 bg-white p-4 rounded-lg shadow flex flex-col h-[320px]">
                        <h3 className="font-bold text-gray-700 mb-1">Biến động cuối kỳ theo quý</h3>
                        <p className="text-sm text-gray-500 mb-2 truncate">{selectedBSIndicator?.name || '...'}</p>
                        <div className="flex-grow">
                            <IncomeStatementChart data={dynamicBSChartData} />
                        </div>
                    </div>
                    <div className="lg:col-span-1 bg-white p-4 rounded-lg shadow flex flex-col h-[320px]">
                        <h3 className="font-bold text-gray-700 mb-1">So sánh cùng kỳ 5 năm</h3>
                        <p className="text-sm text-gray-500 mb-2 truncate">{selectedBSIndicator?.name || '...'}</p>
                        <div className="flex-grow">
                            <BalanceSheetChart data={fiveYearBSChartData} chartType="bar" />
                        </div>
                    </div>
                     <div className="lg:col-span-1 bg-white p-4 rounded-lg shadow flex flex-col h-[320px]">
                        <div className="flex justify-between items-center mb-1">
                          <h3 className="font-bold text-gray-700">Phân tích chênh lệch</h3>
                          <div className="flex items-center bg-gray-100 rounded-md p-0.5 text-xs">
                              <button
                                  onClick={() => setWaterfallComparisonMode('vsPreviousQuarter')}
                                  className={`px-2 py-1 rounded-sm transition-colors ${waterfallComparisonMode === 'vsPreviousQuarter' ? 'bg-white shadow-sm text-gray-800 font-semibold' : 'text-gray-500 hover:bg-gray-200'}`}
                              >
                                  vs Đầu kỳ
                              </button>
                              <button
                                  onClick={() => setWaterfallComparisonMode('vsSamePeriodLastYear')}
                                  className={`px-2 py-1 rounded-sm transition-colors ${waterfallComparisonMode === 'vsSamePeriodLastYear' ? 'bg-white shadow-sm text-gray-800 font-semibold' : 'text-gray-500 hover:bg-gray-200'}`}
                              >
                                  vs Cùng kỳ
                              </button>
                              <button
                                  onClick={() => setWaterfallComparisonMode('vsBeginningOfYear')}
                                  className={`px-2 py-1 rounded-sm transition-colors ${waterfallComparisonMode === 'vsBeginningOfYear' ? 'bg-white shadow-sm text-gray-800 font-semibold' : 'text-gray-500 hover:bg-gray-200'}`}
                              >
                                  vs Đầu năm
                              </button>
                          </div>
                        </div>
                        <p className="text-sm text-gray-500 mb-2 truncate">{selectedBSIndicator?.name || '...'}</p>
                        <div className="flex-grow">
                            <WaterfallChart data={waterfallChartData} />
                        </div>
                    </div>
                  </div>
                  <div className="bg-white p-4 rounded-lg shadow flex-grow flex flex-col min-h-0">
                      <div className="flex justify-between items-center mb-4">
                        <div>
                            <h2 className="text-xl font-bold text-gray-800">{activeReport}</h2>
                        </div>
                      </div>
                      <BalanceSheetTable 
                          data={treeData}
                          loading={loading}
                          error={error}
                          selectedIndicator={selectedBSIndicator}
                          onSelectIndicator={handleBSIndicatorSelect}
                          bsTableComparisonSource={bsTableComparisonSource}
                          setBsTableComparisonSource={setBsTableComparisonSource}
                        />
                  </div>
                </div>
            );
        case 'FA':
            return (
                <div className="flex flex-col gap-4">
                  <aside className="w-full">{commonSidebar}</aside>
                  <FinancialAnalysisView 
                      loading={financialAnalysisLoading}
                      data={financialAnalysisData}
                      valueChartData={dynamicFAValueChartData}
                      dynamicFAChartData={dynamicFAChartData}
                      selectedIndicator={selectedFAIndicator}
                      onIndicatorSelect={(indicator) => setSelectedFAIndicator(indicator)}
                      bsData={faPageBsData}
                      bsLoading={faPageTablesLoading}
                      bsError={faPageTablesError}
                      plData={faPagePlData}
                      plLoading={faPageTablesLoading}
                      plError={faPageTablesError}
                      reportingPeriod={reportingPeriod}
                      comparisonPeriodBS={bsComparisonPeriod}
                      comparisonPeriodPL={plComparisonPeriod}
                      previousQuarterLabelPL={previousQuarterLabel}
                      reportingLabelText={reportingLabelText}
                      indicatorMetadata={indicatorMetadata}
                  />
                </div>
            );
        default:
            return null;
    }
  };


  return (
    <div className="min-h-screen font-sans text-base text-gray-800">
      <Header />
      <main className="p-4">
        <NavBar 
          navItems={reportNavItems}
          activeItem={activeReport}
          setActiveItem={setActiveReport}
        />
        <div className="mt-4">
          {renderContent()}
        </div>
      </main>
    </div>
  );
};

export default App;