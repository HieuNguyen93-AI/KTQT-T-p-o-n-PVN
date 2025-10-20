import React from 'react';
import { SparklesIcon, ChatBubbleIcon, WarningIcon, LightbulbIcon } from './icons';

interface AnalysisResult {
    comments: string[];
    risks: string[];
    suggestions: string[];
}

interface Props {
    isOpen: boolean;
    onClose: () => void;
    isLoading: boolean;
    data: AnalysisResult | null;
    error: string | null;
}

const AnalysisSection: React.FC<{ title: string; items: string[]; icon: React.ReactNode; color: string; }> = ({ title, items, icon, color }) => (
    <div>
        <h3 className={`text-md font-semibold flex items-center gap-2 mb-2 ${color}`}>
            {icon}
            {title}
        </h3>
        {items && items.length > 0 ? (
            <ul className="list-disc list-inside space-y-1 text-gray-700 pl-2">
                {items.map((item, index) => <li key={index} dangerouslySetInnerHTML={{ __html: item }}></li>)}
            </ul>
        ) : <p className="text-sm text-gray-500 italic">Không có thông tin.</p>}
    </div>
);

const AIAnalysisModal: React.FC<Props> = ({ isOpen, onClose, isLoading, data, error }) => {
    if (!isOpen) return null;

    return (
        <div 
            className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center"
            onClick={onClose}
        >
            <div 
                className="bg-white rounded-lg shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col"
                onClick={e => e.stopPropagation()}
            >
                <div className="flex justify-between items-center p-4 border-b">
                    <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                        <SparklesIcon className="h-5 w-5 text-violet-600" />
                        Phân tích từ AI
                    </h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">&times;</button>
                </div>
                
                <div className="p-6 overflow-y-auto space-y-6">
                    {isLoading && (
                        <div className="flex flex-col items-center justify-center text-center p-8">
                            <svg className="animate-spin h-8 w-8 text-violet-600 mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            <p className="font-semibold text-gray-700">AI đang phân tích dữ liệu...</p>
                            <p className="text-sm text-gray-500">Quá trình này có thể mất vài giây.</p>
                        </div>
                    )}

                    {error && (
                        <div className="bg-red-50 text-red-700 p-4 rounded-md">
                            <h3 className="font-bold">Đã xảy ra lỗi</h3>
                            <p className="text-sm">{error}</p>
                        </div>
                    )}

                    {data && !isLoading && (
                        <>
                            <AnalysisSection title="Nhận xét chung" items={data.comments} icon={<ChatBubbleIcon />} color="text-sky-700" />
                            <AnalysisSection title="Cảnh báo rủi ro" items={data.risks} icon={<WarningIcon />} color="text-amber-700" />
                            <AnalysisSection title="Gợi ý hành động" items={data.suggestions} icon={<LightbulbIcon />} color="text-emerald-700" />
                        </>
                    )}
                </div>
                
                <div className="p-4 border-t text-right">
                    <button 
                        onClick={onClose} 
                        className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 text-sm font-semibold"
                    >
                        Đóng
                    </button>
                </div>
            </div>
        </div>
    );
};

export default AIAnalysisModal;