import React, { useState, useEffect, useMemo, useRef } from 'react';
import { FilterIcon, ChevronDownIcon } from './icons';
import type { QuarterOption, AnalType, UnitHierarchy } from '../types';

const cx = (...c: Array<string | false | null | undefined>) => c.filter(Boolean).join(" ");

interface ReportTypeSelectorProps {
    label: string;
    analTypes: AnalType[];
    selectedAnalType: AnalType | null;
    setSelectedAnalType: (value: AnalType | null) => void;
    disabled: boolean;
}

const ReportTypeSelector: React.FC<ReportTypeSelectorProps> = ({
    label,
    analTypes,
    selectedAnalType,
    setSelectedAnalType,
    disabled
}) => {
    const handleAnalTypeChange = (selectedCode: string) => {
        const typeObject = analTypes.find(t => t.code === selectedCode);
        setSelectedAnalType(typeObject || null);
    };

    return (
        <div>
            <label className="text-sm font-semibold text-gray-500 block mb-1">
                {label}
            </label>
            <div className="relative">
                <select
                    value={selectedAnalType?.code || ''}
                    onChange={(e) => handleAnalTypeChange(e.target.value)}
                    disabled={disabled}
                    className="w-full p-2 border border-gray-300 rounded-md appearance-none bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-500 disabled:bg-gray-200 disabled:cursor-not-allowed"
                >
                    {analTypes.map(t => <option key={t.code} value={t.code}>{t.name}</option>)}
                </select>
                <ChevronDownIcon className="h-5 w-5 text-gray-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
        </div>
    );
}

interface MultiSelectDropdownProps {
    options: { id: string; name: string; }[];
    selectedIds: string[];
    onChange: (selectedIds: string[]) => void;
    placeholder?: string;
}

const MultiSelectDropdown: React.FC<MultiSelectDropdownProps> = ({ options, selectedIds, onChange, placeholder = "Chọn đơn vị" }) => {
    const [isOpen, setIsOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    // Close on click outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (ref.current && !ref.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [ref]);

    const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.checked) {
            onChange(options.map(opt => opt.id));
        } else {
            onChange([]);
        }
    };

    const handleOptionClick = (id: string) => {
        const newSelectedIds = selectedIds.includes(id)
            ? selectedIds.filter(selectedId => selectedId !== id)
            : [...selectedIds, id];
        onChange(newSelectedIds);
    };

    const getButtonLabel = () => {
        if (selectedIds.length === 0) return placeholder;
        if (selectedIds.length === options.length) return "Số liệu hợp nhất toàn Tập đoàn";
        if (selectedIds.length === 1) {
            return options.find(opt => opt.id === selectedIds[0])?.name || placeholder;
        }
        return `${selectedIds.length} đơn vị được chọn`;
    };

    const isAllSelected = options.length > 0 && selectedIds.length === options.length;

    return (
        <div className="relative" ref={ref}>
            <button
                type="button"
                className="w-full p-2 border border-gray-300 rounded-md bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-500 flex justify-between items-center text-left"
                onClick={() => setIsOpen(!isOpen)}
                aria-haspopup="listbox"
                aria-expanded={isOpen}
            >
                <span className="truncate">{getButtonLabel()}</span>
                <ChevronDownIcon className={`h-5 w-5 text-gray-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {isOpen && (
                <div className="absolute z-20 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto" role="listbox">
                    <ul>
                        <li className="p-2 border-b border-gray-200 sticky top-0 bg-white">
                            <label className="flex items-center space-x-2 cursor-pointer font-semibold text-gray-800">
                                <input
                                    type="checkbox"
                                    checked={isAllSelected}
                                    onChange={handleSelectAll}
                                    className="h-4 w-4 rounded border-gray-300 text-green-600 focus:ring-green-500"
                                />
                                <span>Chọn tất cả</span>
                            </label>
                        </li>
                        {options.map(option => (
                            <li key={option.id} className="p-2 hover:bg-gray-100" role="option" aria-selected={selectedIds.includes(option.id)}>
                                <label className="flex items-center space-x-2 cursor-pointer text-gray-700">
                                    <input
                                        type="checkbox"
                                        checked={selectedIds.includes(option.id)}
                                        onChange={() => handleOptionClick(option.id)}
                                        className="h-4 w-4 rounded border-gray-300 text-green-600 focus:ring-green-500"
                                    />
                                    <span>{option.name}</span>
                                </label>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
};


interface SidebarProps {
    selectedYear: string;
    setSelectedYear: (value: string) => void;
    availableYears: string[];
    selectedQuarter: string;
    setSelectedQuarter: (value: string) => void;
    availableQuarters: QuarterOption[];
    selectedUnitIds: string[];
    setSelectedUnitIds: (ids: string[]) => void;
    reportScope: string;
    setReportScope: (value: string) => void;
    analTypes: AnalType[];
    selectedAnalTypeQ1: AnalType | null;
    setSelectedAnalTypeQ1: (value: AnalType | null) => void;
    selectedAnalTypeQ2: AnalType | null;
    setSelectedAnalTypeQ2: (value: AnalType | null) => void;
    selectedAnalTypeQ3: AnalType | null;
    setSelectedAnalTypeQ3: (value: AnalType | null) => void;
    selectedAnalTypeQ4: AnalType | null;
    setSelectedAnalTypeQ4: (value: AnalType | null) => void;
    activeReport: string;
    unitHierarchy: Map<string, UnitHierarchy>;
}

const Sidebar: React.FC<SidebarProps> = (props) => {
    const {
        selectedUnitIds,
        setSelectedUnitIds,
        reportScope,
        setReportScope,
        unitHierarchy,
    } = props;
    
    const level2Units = useMemo(() => {
        return Array.from(unitHierarchy.values()).map((g: UnitHierarchy) => ({ id: g.id, name: g.name }));
    }, [unitHierarchy]);
    
    return (
        <div className="bg-green-50 p-4 rounded-lg shadow flex flex-col">
            <h2 className="text-lg font-bold text-[#006934] flex items-center border-b border-green-200 pb-2 mb-4 shrink-0">
                <FilterIcon />
                BỘ LỌC
            </h2>
            <div>
                 {/* Top Area: Main Filters */}
                 <div className="flex flex-wrap gap-x-6 gap-y-4">
                    <div className="flex-1 min-w-[200px]">
                        <label className="text-sm font-semibold text-gray-500 block mb-1">Loại báo cáo</label>
                        <div className="relative">
                            <select
                                value={reportScope}
                                onChange={(e) => setReportScope(e.target.value)}
                                className="w-full p-2 border border-gray-300 rounded-md appearance-none bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-500"
                            >
                                <option value="Hợp nhất">Hợp nhất</option>
                                <option value="Công ty Mẹ">Công ty Mẹ</option>
                            </select>
                            <ChevronDownIcon className="h-5 w-5 text-gray-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                        </div>
                    </div>

                    <div className="flex-1 min-w-[200px]">
                        <label className="text-sm font-semibold text-gray-500 block mb-1">Đơn vị</label>
                        <MultiSelectDropdown
                            options={level2Units}
                            selectedIds={selectedUnitIds}
                            onChange={setSelectedUnitIds}
                            placeholder="Chọn đơn vị"
                        />
                    </div>
                    
                     <div className="flex-1 min-w-[200px]">
                        <label className="text-sm font-semibold text-gray-500 block mb-1">Năm</label>
                        <div className="relative">
                            <select
                                value={props.selectedYear}
                                onChange={(e) => props.setSelectedYear(e.target.value)}
                                className="w-full p-2 border border-gray-300 rounded-md appearance-none bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-500"
                            >
                                {props.availableYears.map(year => <option key={year} value={year}>{year}</option>)}
                            </select>
                            <ChevronDownIcon className="h-5 w-5 text-gray-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                        </div>
                    </div>

                     <div className="flex-1 min-w-[200px]">
                        <label className="text-sm font-semibold text-gray-500 block mb-1">Kỳ báo cáo</label>
                        <div className="relative">
                            <select
                                value={props.selectedQuarter}
                                onChange={(e) => props.setSelectedQuarter(e.target.value)}
                                className="w-full p-2 border border-gray-300 rounded-md appearance-none bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-500"
                            >
                                {props.availableQuarters.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
                            </select>
                            <ChevronDownIcon className="h-5 w-5 text-gray-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                        </div>
                    </div>
                </div>

                {/* Bottom Area: Report Version Filters */}
                <div className="flex flex-wrap gap-x-6 gap-y-4 mt-4 pt-4 border-t border-green-200">
                    <div className="flex-1 min-w-[200px]">
                        <ReportTypeSelector
                            label="Phiên bản báo cáo Quý 1"
                            analTypes={props.analTypes}
                            selectedAnalType={props.selectedAnalTypeQ1}
                            setSelectedAnalType={props.setSelectedAnalTypeQ1}
                            disabled={false}
                        />
                    </div>
                     <div className="flex-1 min-w-[200px]">
                        <ReportTypeSelector
                            label="Phiên bản báo cáo Quý 2"
                            analTypes={props.analTypes}
                            selectedAnalType={props.selectedAnalTypeQ2}
                            setSelectedAnalType={props.setSelectedAnalTypeQ2}
                            disabled={false}
                        />
                    </div>
                     <div className="flex-1 min-w-[200px]">
                        <ReportTypeSelector
                            label="Phiên bản báo cáo Quý 3"
                            analTypes={props.analTypes}
                            selectedAnalType={props.selectedAnalTypeQ3}
                            setSelectedAnalType={props.setSelectedAnalTypeQ3}
                            disabled={false}
                        />
                    </div>
                    <div className="flex-1 min-w-[200px]">
                        <ReportTypeSelector
                            label="Phiên bản báo cáo Quý 4"
                            analTypes={props.analTypes}
                            selectedAnalType={props.selectedAnalTypeQ4}
                            setSelectedAnalType={props.setSelectedAnalTypeQ4}
                            disabled={false}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Sidebar;