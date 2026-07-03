import React from 'react';

interface SkeletonProps {
  className?: string;
  style?: React.CSSProperties;
}

const SkeletonBase: React.FC<SkeletonProps> = ({ className = '', style }) => {
  return (
    <div
      className={`skeleton rounded-md ${className}`}
      style={{ backgroundColor: 'var(--bg-surface2)', ...style }}
    />
  );
};

export const SkeletonText: React.FC<SkeletonProps & { lines?: number }> = ({ className = '', lines = 1 }) => {
  if (lines === 1) {
    return <SkeletonBase className={`h-4 w-full ${className}`} />;
  }

  return (
    <div className={`space-y-2 ${className}`}>
      {Array.from({ length: lines }).map((_, i) => (
        <SkeletonBase key={i} className={`h-4 ${i === lines - 1 ? 'w-2/3' : 'w-full'}`} />
      ))}
    </div>
  );
};

export const SkeletonCard: React.FC<SkeletonProps> = ({ className = '' }) => {
  return (
    <div className={`metric-card ${className}`}>
      <SkeletonBase className="h-4 w-1/3 mb-4" />
      <SkeletonBase className="h-8 w-1/2" />
    </div>
  );
};

export const SkeletonTable: React.FC<SkeletonProps & { rows?: number; cols?: number }> = ({ 
  className = '', 
  rows = 5, 
  cols = 4 
}) => {
  return (
    <div className={`table-wrapper ${className}`}>
      <table className="ds-table">
        <thead>
          <tr>
            {Array.from({ length: cols }).map((_, i) => (
              <th key={i}>
                <SkeletonBase className="h-4 w-20" />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }).map((_, r) => (
            <tr key={r}>
              {Array.from({ length: cols }).map((_, c) => (
                <td key={c}>
                  <SkeletonBase className="h-4 w-full" />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export const SkeletonList: React.FC<SkeletonProps & { items?: number }> = ({ className = '', items = 3 }) => {
  return (
    <div className={`space-y-4 ${className}`}>
      {Array.from({ length: items }).map((_, i) => (
        <div key={i} className="flex items-center gap-4">
          <SkeletonBase className="h-10 w-10 rounded-full flex-shrink-0" />
          <div className="flex-1 space-y-2">
            <SkeletonBase className="h-4 w-1/3" />
            <SkeletonBase className="h-3 w-1/4" />
          </div>
        </div>
      ))}
    </div>
  );
};

export const SkeletonPage: React.FC<SkeletonProps> = ({ className = '' }) => {
  return (
    <div className={`animate-fade-in ${className}`}>
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <SkeletonBase className="h-8 w-1/4" />
        <SkeletonBase className="h-10 w-32" />
      </div>

      {/* Grid de Cards */}
      <div className="dashboard-grid mb-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>

      {/* Bloco Principal */}
      <div className="card h-64 flex flex-col justify-between">
        <SkeletonBase className="h-6 w-1/4 mb-4" />
        <SkeletonBase className="h-4 w-full mb-2" />
        <SkeletonBase className="h-4 w-full mb-2" />
        <SkeletonBase className="h-4 w-3/4 mb-2" />
        <div className="mt-auto pt-4 flex gap-4">
          <SkeletonBase className="h-8 w-24" />
          <SkeletonBase className="h-8 w-24" />
        </div>
      </div>
    </div>
  );
};
