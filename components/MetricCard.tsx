import React from 'react';

interface MetricCardProps {
  title: string;
  value: string;
  icon: React.ReactNode;
  color: 'green' | 'blue' | 'orange' | 'indigo';
}

const MetricCard: React.FC<MetricCardProps> = ({ title, value, icon, color }) => {
  const colorClasses = {
    green: 'bg-gradient-to-br from-emerald-100 to-green-200 text-emerald-900',
    blue: 'bg-gradient-to-br from-sky-100 to-blue-200 text-sky-900',
    orange: 'bg-gradient-to-br from-amber-100 to-orange-200 text-amber-900',
    indigo: 'bg-gradient-to-br from-indigo-100 to-purple-200 text-indigo-900',
  };

  return (
    <div className={`p-4 rounded-lg shadow-sm flex items-center gap-4 ${colorClasses[color]}`}>
      <div className="text-3xl opacity-70">
        {icon}
      </div>
      <div>
        <p className="text-2xl font-bold">{value}</p>
        <p className="text-sm font-medium uppercase tracking-wider">{title}</p>
      </div>
    </div>
  );
};

export default MetricCard;