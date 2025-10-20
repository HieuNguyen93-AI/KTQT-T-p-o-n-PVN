import type { DAccount, Fact, TreeRow } from '../types';

export const toMonthStart = (iso: string) => {
  if (!iso) return '';
  const d = new Date(iso);
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${yyyy}-${mm}-01`;
};

type FlatItem = {
  id: string;
  level: number;
  stt: number | null;
  name: string;
  start: number | null;
  end: number | null;
  prevQuarter: number | null;
  samePeriodLastYear: number | null;
  beginningOfYear: number | null;
  chi_tieu_lv1: string | null;
  chi_tieu_lv2: string | null;
  chi_tieu_lv3: string | null;
  chi_tieu_lv4: string | null;
};

// Helper function to normalize account names for consistent path matching.
const normalizeName = (name: string): string => {
    return name.trim().toUpperCase().replace(/\s\s+/g, ' ');
};

// Centralized helper to get a consistent, normalized hierarchical path for an account.
export const getNormalizedAccountPath = (account: { chi_tieu_lv1: string | null; chi_tieu_lv2: string | null; chi_tieu_lv3: string | null; chi_tieu_lv4: string | null; }): string[] => {
    const rawNames = [account.chi_tieu_lv1, account.chi_tieu_lv2, account.chi_tieu_lv3, account.chi_tieu_lv4].filter(Boolean) as string[];
    // Reduce to a clean path by removing consecutive duplicates.
    return rawNames.reduce((acc: string[], current: string) => {
        if (acc.length === 0 || normalizeName(acc[acc.length - 1]) !== normalizeName(current)) {
            acc.push(current);
        }
        return acc;
    }, []);
};


export function makeItemsFrom(accounts: DAccount[], facts: Fact[], startMonth: string, endMonth: string, prevQuarterMonth: string | null, samePeriodLastYearMonth: string | null, beginningOfYearMonth: string | null): FlatItem[] {
  const factMap = new Map<string, number>(); // `${id_tckt}|${date}` -> value
  for (const f of facts) {
    if (f?.id_tckt == null || !f.date) continue;
    factMap.set(`${f.id_tckt}|${f.date}`, Number(f.value) ?? 0);
  }

  return accounts.map((a, idx) => {
    const level = a.chi_tieu_lv4 ? 4 : a.chi_tieu_lv3 ? 3 : a.chi_tieu_lv2 ? 2 : 1;
    const label = a.chi_tieu_lv4 || a.chi_tieu_lv3 || a.chi_tieu_lv2 || a.chi_tieu_lv1 || "";
    const tckt = Number.isFinite(a.stt as any) ? Number(a.stt) : null;

    const start = tckt != null ? (factMap.get(`${tckt}|${startMonth}`) ?? null) : null;
    const end   = tckt != null ? (factMap.get(`${tckt}|${endMonth}`)   ?? null) : null;
    const prevQuarter = (tckt != null && prevQuarterMonth) ? (factMap.get(`${tckt}|${prevQuarterMonth}`) ?? null) : null;
    const samePeriodLastYear = (tckt != null && samePeriodLastYearMonth) ? (factMap.get(`${tckt}|${samePeriodLastYearMonth}`) ?? null) : null;
    const beginningOfYear = (tckt != null && beginningOfYearMonth) ? (factMap.get(`${tckt}|${beginningOfYearMonth}`) ?? null) : null;


    return {
      id: `row-${idx}`,
      level,
      stt: tckt,
      name: label,
      start,
      end,
      prevQuarter,
      samePeriodLastYear,
      beginningOfYear,
      chi_tieu_lv1: a.chi_tieu_lv1,
      chi_tieu_lv2: a.chi_tieu_lv2,
      chi_tieu_lv3: a.chi_tieu_lv3,
      chi_tieu_lv4: a.chi_tieu_lv4,
    };
  });
}

export function buildTreeByPath(items: FlatItem[], reportCode: 'BS' | 'P&L' | 'CF'): TreeRow[] {
  type Node = TreeRow & { _childMap: Map<string, Node> };
  const roots: Node[] = [];
  const rootMap = new Map<string, Node>();

  const pathToSttMap = new Map<string, { stt: number; pathLength: number }>();
  for (const it of items) {
      if (it.stt === null) continue;
      const cleanedNames = getNormalizedAccountPath(it);
      const rawPathLength = [it.chi_tieu_lv1, it.chi_tieu_lv2, it.chi_tieu_lv3, it.chi_tieu_lv4].filter(Boolean).length;

      if (cleanedNames.length > 0) {
          const pathKey = cleanedNames.map(normalizeName).join('|');
          const existing = pathToSttMap.get(pathKey);
          
          if (!existing || rawPathLength < existing.pathLength) {
              pathToSttMap.set(pathKey, { stt: it.stt, pathLength: rawPathLength });
          }
      }
  }

  const getOrCreate = (map: Map<string, Node>, name: string, level: number, parentPath: string[]): Node => {
    const normalized = normalizeName(name);
    let n = map.get(normalized);
    if (!n) {
      const currentPathKey = [...parentPath, normalized].join('|');
      const sttData = pathToSttMap.get(currentPathKey);
      const stt = sttData ? sttData.stt : null;

      n = {
        id: `lv${level}-${normalized}-${map.size}`,
        name: name.trim(),
        level,
        stt,
        isTotal: /tổng\s*cộng/i.test(name),
        start: null,
        end: null,
        prevQuarter: null,
        samePeriodLastYear: null,
        beginningOfYear: null,
        currentQuarterValue: null,
        diff: null,
        diffPct: null,
        diffVsSamePeriod: null,
        diffPctVsSamePeriod: null,
        diffVsBeginningOfYear: null,
        diffPctVsBeginningOfYear: null,
        pct: null,
        hasChildren: false,
        children: [],
        _childMap: new Map(),
      };
      map.set(normalized, n);
    }
    return n;
  };

  for (const it of items) {
    const names = getNormalizedAccountPath(it);

    if (names.length === 0) continue;

    let parent = getOrCreate(rootMap, names[0], 1, []);
    if (!roots.some(r => r.id === parent.id)) roots.push(parent);

    let parentPath = [normalizeName(names[0])];
    for (let i = 1; i < names.length; i++) {
      const child = getOrCreate(parent._childMap, names[i], i + 1, parentPath);
      if (!parent.children.some(c => c.id === child.id)) {
        parent.children.push(child);
        parent.hasChildren = true;
      }
      parent = child;
      parentPath.push(normalizeName(names[i]));
    }
    
    if (it.stt != null) {
      if (it.start != null) parent.start = (parent.start || 0) + it.start;
      if (it.end   != null) parent.end   = (parent.end || 0) + it.end;
      if (it.prevQuarter != null) parent.prevQuarter = (parent.prevQuarter || 0) + it.prevQuarter;
      if (it.samePeriodLastYear != null) parent.samePeriodLastYear = (parent.samePeriodLastYear || 0) + it.samePeriodLastYear;
      if (it.beginningOfYear != null) parent.beginningOfYear = (parent.beginningOfYear || 0) + it.beginningOfYear;
    }
  }

  const aggregate = (n: Node): { end: number | null; start: number | null; prevQuarter: number | null; samePeriodLastYear: number | null; beginningOfYear: number | null; } => {
    if (!n.hasChildren) return { end: n.end, start: n.start, prevQuarter: n.prevQuarter, samePeriodLastYear: n.samePeriodLastYear, beginningOfYear: n.beginningOfYear };
    
    let sumEnd = n.end || 0;
    let sumStart = n.start || 0;
    let sumPrevQuarter = n.prevQuarter || 0;
    let sumSamePeriodLastYear = n.samePeriodLastYear || 0;
    let sumBeginningOfYear = n.beginningOfYear || 0;

    let hasEnd = n.end != null;
    let hasStart = n.start != null;
    let hasPrevQuarter = n.prevQuarter != null;
    let hasSamePeriodLastYear = n.samePeriodLastYear != null;
    let hasBeginningOfYear = n.beginningOfYear != null;

    for (const c of n.children as Node[]) {
      const s = aggregate(c);
      if (s.end   != null) { sumEnd += s.end; hasEnd = true; }
      if (s.start != null) { sumStart += s.start; hasStart = true; }
      if (s.prevQuarter != null) { sumPrevQuarter += s.prevQuarter; hasPrevQuarter = true; }
      if (s.samePeriodLastYear != null) { sumSamePeriodLastYear += s.samePeriodLastYear; hasSamePeriodLastYear = true; }
      if (s.beginningOfYear != null) { sumBeginningOfYear += s.beginningOfYear; hasBeginningOfYear = true; }
    }

    if (hasEnd) n.end = sumEnd;
    if (hasStart) n.start = sumStart;
    if (hasPrevQuarter) n.prevQuarter = sumPrevQuarter;
    if (hasSamePeriodLastYear) n.samePeriodLastYear = sumSamePeriodLastYear;
    if (hasBeginningOfYear) n.beginningOfYear = sumBeginningOfYear;

    return { end: n.end, start: n.start, prevQuarter: n.prevQuarter, samePeriodLastYear: n.samePeriodLastYear, beginningOfYear: n.beginningOfYear };
  };
  roots.forEach(r => aggregate(r));

  // Assign a representative STT to parent nodes that don't have one.
  // This is crucial for the click-to-select functionality in the UI.
  const assignSttToParents = (n: Node) => {
    if (n.hasChildren) {
      // Recurse down first to ensure children have STTs if possible
      n.children.forEach(c => assignSttToParents(c as Node));
      
      // If the parent still lacks an STT, inherit it from the first child
      if (n.stt === null && n.children.length > 0 && n.children[0].stt !== null) {
        n.stt = n.children[0].stt;
      }
    }
  };
  roots.forEach(r => assignSttToParents(r));

  let totalBase = 0;
  if (reportCode === 'BS') {
      const assetsRoot = roots.find(n => /tài\s*sản/i.test(n.name)) || roots[0];
      totalBase = assetsRoot?.end ?? 0;
  } else { // P&L or CF
      const findNodeBySTT = (nodes: Node[], stt: number): Node | null => {
          for (const node of nodes) {
              if (node.stt === stt) return node;
              const found = findNodeBySTT(node.children as Node[], stt);
              if (found) return found;
          }
          return null;
      };
      // Base for percentage calculation is Net Revenue (Doanh thu thuần), which is STT 3.
      const netRevenueNode = findNodeBySTT(roots, 3);
      totalBase = netRevenueNode?.end ?? 0;
  }

  const finalize = (n: Node) => {
    // Diff vs Previous Quarter
    n.diff = n.end != null && n.start != null ? n.end - n.start : null;
    n.diffPct = n.start != null && n.start !== 0 && n.diff != null ? (n.diff / Math.abs(n.start)) * 100 : null;
    
    // Diff vs Same Period Last Year
    n.diffVsSamePeriod = n.end != null && n.samePeriodLastYear != null ? n.end - n.samePeriodLastYear : null;
    n.diffPctVsSamePeriod = n.samePeriodLastYear != null && n.samePeriodLastYear !== 0 && n.diffVsSamePeriod != null ? (n.diffVsSamePeriod / Math.abs(n.samePeriodLastYear)) * 100 : null;

    // Diff vs Beginning of Year
    n.diffVsBeginningOfYear = n.end != null && n.beginningOfYear != null ? n.end - n.beginningOfYear : null;
    n.diffPctVsBeginningOfYear = n.beginningOfYear != null && n.beginningOfYear !== 0 && n.diffVsBeginningOfYear != null ? (n.diffVsBeginningOfYear / Math.abs(n.beginningOfYear)) * 100 : null;
    
    n.pct = totalBase && n.end != null ? (n.end / totalBase) * 100 : null;
    
    // New logic for current quarter value
    if (n.end !== null) {
        if (n.prevQuarter !== null) {
            n.currentQuarterValue = n.end - n.prevQuarter;
        } else {
            n.currentQuarterValue = n.end;
        }
    } else {
        n.currentQuarterValue = null;
    }

    n.children.forEach(c => finalize(c as Node));
  };
  roots.forEach(r => finalize(r));

  const strip = (n: Node): TreeRow => ({
    id: n.id, name: n.name, level: n.level, stt: n.stt, isTotal: n.isTotal,
    start: n.start, end: n.end, diff: n.diff, diffPct: n.diffPct, pct: n.pct,
    prevQuarter: n.prevQuarter,
    samePeriodLastYear: n.samePeriodLastYear,
    beginningOfYear: n.beginningOfYear,
    currentQuarterValue: n.currentQuarterValue,
    diffVsSamePeriod: n.diffVsSamePeriod,
    diffPctVsSamePeriod: n.diffPctVsSamePeriod,
    diffVsBeginningOfYear: n.diffVsBeginningOfYear,
    diffPctVsBeginningOfYear: n.diffPctVsBeginningOfYear,
    hasChildren: n.hasChildren,
    children: n.children.map(c => strip(c as Node)),
  });

  return roots.map(r => strip(r));
}