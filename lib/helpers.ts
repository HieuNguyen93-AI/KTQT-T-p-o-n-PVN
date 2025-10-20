

import type { Account, BalanceSheetItem, FinancialFact } from '../types';

export const getPreviousQuarterEndDate = (period: string): string => {
    if (!period) return '';
    const date = new Date(period);
    // Subtract 3 months to get to the previous quarter's end month
    date.setMonth(date.getMonth() - 3);
    return date.toISOString().split('T')[0];
};

export const getSamePeriodLastYear = (period: string): string => {
    if (!period) return '';
    const date = new Date(period);
    date.setFullYear(date.getFullYear() - 1);
    return date.toISOString().split('T')[0];
};


export const transformSupabaseData = (
    accounts: Account[],
    facts: FinancialFact[],
    startPeriodDate: string,
    endPeriodDate: string
): BalanceSheetItem[] => {
    const factsMap = new Map<number, { start: number | null, end: number | null }>();
    facts.forEach(fact => {
        if (!factsMap.has(fact.id_tckt)) {
            factsMap.set(fact.id_tckt, { start: null, end: null });
        }
        const entry = factsMap.get(fact.id_tckt)!;
        if (fact.date === startPeriodDate) {
            entry.start = fact.value;
        } else if (fact.date === endPeriodDate) {
            entry.end = fact.value;
        }
    });

    const allItems: BalanceSheetItem[] = accounts.map(acc => {
        const factData = factsMap.get(acc.id) || { start: null, end: null };
        
        // Only level 4 accounts have direct values. Others will be summed up.
        const isLeafNode = acc.level === 4;

        return {
            id: acc.account_code,
            stt: acc.stt,
            name: acc.chi_tieu_lv4 || acc.chi_tieu_lv3 || acc.chi_tieu_lv2 || acc.chi_tieu_lv1 || '',
            parent_code: acc.parent_code,
            level: acc.level,
            endPeriod: isLeafNode ? factData.end : null,
            startPeriod: isLeafNode ? factData.start : null,
            isTotal: acc.is_total,
        };
    });

    return allItems;
};