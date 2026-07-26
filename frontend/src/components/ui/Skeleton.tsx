import React from 'react';

export interface SkeletonProps {
  className?: string;
  width?: string | number;
  height?: string | number;
  circle?: boolean;
  style?: React.CSSProperties;
}

export const Skeleton: React.FC<SkeletonProps> = ({
  className = '',
  width,
  height,
  circle = false,
  style,
}) => {
  return (
    <div
      className={`skeleton-base ${className}`.trim()}
      style={{
        width,
        height,
        borderRadius: circle ? '9999px' : undefined,
        ...style,
      }}
    />
  );
};

export const SkeletonText: React.FC<SkeletonProps & { lines?: number }> = ({
  className = '',
  lines = 1,
}) => {
  if (lines === 1) {
    return <Skeleton className={`h-4 w-full ${className}`} style={{ height: '1rem', width: '100%' }} />;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--espaco-2)' }} className={className}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          style={{
            height: '1rem',
            width: i === lines - 1 ? '66%' : '100%',
          }}
        />
      ))}
    </div>
  );
};

export const SkeletonCard: React.FC<SkeletonProps> = ({ className = '' }) => {
  return (
    <div className={`card-base ${className}`.trim()}>
      <Skeleton style={{ height: '1rem', width: '33%', marginBottom: 'var(--espaco-4)' }} />
      <Skeleton style={{ height: '2rem', width: '50%' }} />
    </div>
  );
};

export const SkeletonTable: React.FC<SkeletonProps & { rows?: number; cols?: number }> = ({
  className = '',
  rows = 5,
  cols = 4,
}) => {
  return (
    <div style={{ width: '100%', overflowX: 'auto' }} className={className}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            {Array.from({ length: cols }).map((_, i) => (
              <th key={i} style={{ padding: '0.75rem 1rem', background: 'var(--fundo-superficie-2)' }}>
                <Skeleton style={{ height: '1rem', width: '80px' }} />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }).map((_, r) => (
            <tr key={r} style={{ borderBottom: '1px solid var(--borda-sutil)' }}>
              {Array.from({ length: cols }).map((_, c) => (
                <td key={c} style={{ padding: '0.75rem 1rem' }}>
                  <Skeleton style={{ height: '1rem', width: '100%' }} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export const SkeletonList: React.FC<SkeletonProps & { items?: number }> = ({
  className = '',
  items = 3,
}) => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--espaco-4)' }} className={className}>
      {Array.from({ length: items }).map((_, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 'var(--espaco-4)' }}>
          <Skeleton circle style={{ height: '40px', width: '40px', flexShrink: 0 }} />
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 'var(--espaco-2)' }}>
            <Skeleton style={{ height: '1rem', width: '33%' }} />
            <Skeleton style={{ height: '0.75rem', width: '25%' }} />
          </div>
        </div>
      ))}
    </div>
  );
};

export const SkeletonPage: React.FC<SkeletonProps> = ({ className = '' }) => {
  return (
    <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 'var(--espaco-6)' }} className={className}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Skeleton style={{ height: '2rem', width: '25%' }} />
        <Skeleton style={{ height: '40px', width: '128px', borderRadius: 'var(--raio-md)' }} />
      </div>

      {/* Grid de Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 'var(--espaco-4)' }}>
        {Array.from({ length: 4 }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>

      {/* Bloco Principal */}
      <div className="card-base" style={{ minHeight: '256px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
        <div>
          <Skeleton style={{ height: '1.5rem', width: '25%', marginBottom: 'var(--espaco-4)' }} />
          <Skeleton style={{ height: '1rem', width: '100%', marginBottom: 'var(--espaco-2)' }} />
          <Skeleton style={{ height: '1rem', width: '100%', marginBottom: 'var(--espaco-2)' }} />
          <Skeleton style={{ height: '1rem', width: '75%', marginBottom: 'var(--espaco-2)' }} />
        </div>
        <div style={{ display: 'flex', gap: 'var(--espaco-4)', marginTop: 'var(--espaco-4)' }}>
          <Skeleton style={{ height: '40px', width: '96px', borderRadius: 'var(--raio-md)' }} />
          <Skeleton style={{ height: '40px', width: '96px', borderRadius: 'var(--raio-md)' }} />
        </div>
      </div>
    </div>
  );
};
