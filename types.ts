export interface QuarterOption {
  label: string;
  value: string;
}

export interface DAccount {
  stt: number | null;
  ten_bao_cao: string | null;
  chi_tieu_lv1: string | null;
  chi_tieu_lv2: string | null;
  chi_tieu_lv3: string | null;
  chi_tieu_lv4: string | null;
}

export interface Fact {
  id_tckt: number;
  date: string;
  value: number;
  entity: string | null;
  p_anal: string | null;
}

export interface TreeRow {
  id: string;
  name: string;
  level: number;
  stt: number | null;
  isTotal: boolean;
  start: number | null; // Previous Quarter
  end: number | null;
  prevQuarter: number | null;
  samePeriodLastYear: number | null;
  beginningOfYear: number | null;
  currentQuarterValue: number | null;
  diff: number | null; // Diff vs Previous Quarter
  diffPct: number | null; // Pct Diff vs Previous Quarter
  diffVsSamePeriod: number | null;
  diffPctVsSamePeriod: number | null;
  diffVsBeginningOfYear: number | null;
  diffPctVsBeginningOfYear: number | null;
  pct: number | null;
  hasChildren: boolean;
  children: TreeRow[];
}

export interface AnalType {
  code: string;
  name: string;
}

export interface IncomeChartData {
  name: string;
  currentPeriod: number | null;
  previousPeriod: number | null;
}

export interface MetricValues {
  shortTermAssets: number | null;
  longTermAssets: number | null;
  liabilities: number | null;
  equity: number | null;
}

export interface PlMetricValues {
  profitBeforeTax: number | null;
  currentTaxExpense: number | null;
  deferredTaxExpense: number | null;
  profitAfterTax: number | null;
}

export interface CfMetricValues {
  netFromOperating: number | null;
  netFromInvesting: number | null;
  netFromFinancing: number | null;
}


export interface SelectedUnit {
  id: string;
  codes: string[];
  name: string;
}

export interface UnitData {
    id: string;
    name: string;
}

export interface UnitHierarchy extends UnitData {
    id_lv1_?: string;
    children: UnitData[];
}

export interface SelectedIndicator {
  id?: string; // Unique row ID for highlighting
  stt: number;
  name: string;
}

export interface SelectedFAIndicator {
  key: string;
  name: string;
}


export interface BalanceSheetChartDataPoint {
  name: string;
  value: number | null;
}

// FIX: Add missing chart data point types to resolve import errors.
export interface RevenueAndProfitChartDataPoint {
  name: string;
  netRevenue: number | null;
  grossProfit: number | null;
  netProfit: number | null;
}

export interface OperatingExpensesChartDataPoint {
  name: string;
  gaExpenses: number | null;
  sellingExpenses: number | null;
}

export interface FinancialAnalysisData {
  latestRatios: {
    [key: string]: number | null;
  };
  tableData: {
    headers: string[];
    rows: {
      key: string;
      name: string;
      values: (number | null)[];
    }[];
  };
  fullRatioHistory: {
    [date: string]: {
      [key:string]: number | null;
    };
  };
}

// from lib/helpers
export interface Account {
    id: number;
    account_code: string;
    stt: number;
    chi_tieu_lv1: string | null;
    chi_tieu_lv2: string | null;
    chi_tieu_lv3: string | null;
    chi_tieu_lv4: string | null;
    parent_code: string | null;
    level: number;
    is_total: boolean;
}

export interface BalanceSheetItem {
    id: string;
    stt: number;
    name: string;
    parent_code: string | null;
    level: number;
    endPeriod: number | null;
    startPeriod: number | null;
    isTotal: boolean;
}

export interface FinancialFact {
    id_tckt: number;
    date: string;
    value: number;
}

export interface AnalysisResult {
    comments: string[];
    risks: string[];
    suggestions: string[];
}