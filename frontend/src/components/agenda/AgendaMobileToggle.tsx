

interface AgendaMobileToggleProps {
  modo: 'grade' | 'lista';
  onChange: (modo: 'grade' | 'lista') => void;
}

export function AgendaMobileToggle({ modo, onChange }: AgendaMobileToggleProps) {
  return (
    <div 
      className="flex w-full p-1 rounded bg-[var(--superficie-2)]"
      style={{
        background: 'var(--bg-surface2)',
        border: '1px solid var(--border)',
        borderRadius: '8px'
      }}
    >
      <button
        onClick={() => onChange('grade')}
        className="flex-1 flex justify-center items-center rounded transition-colors"
        style={{
          minHeight: '36px',
          fontFamily: 'var(--fonte-interface)',
          fontSize: '14px',
          fontWeight: modo === 'grade' ? 600 : 500,
          background: modo === 'grade' ? 'var(--bg-surface)' : 'transparent',
          color: modo === 'grade' ? 'var(--text-primary)' : 'var(--texto-secundario)',
          boxShadow: modo === 'grade' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
        }}
      >
        Grade
      </button>
      <button
        onClick={() => onChange('lista')}
        className="flex-1 flex justify-center items-center rounded transition-colors"
        style={{
          minHeight: '36px',
          fontFamily: 'var(--fonte-interface)',
          fontSize: '14px',
          fontWeight: modo === 'lista' ? 600 : 500,
          background: modo === 'lista' ? 'var(--bg-surface)' : 'transparent',
          color: modo === 'lista' ? 'var(--text-primary)' : 'var(--texto-secundario)',
          boxShadow: modo === 'lista' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
        }}
      >
        Lista
      </button>
    </div>
  );
}
