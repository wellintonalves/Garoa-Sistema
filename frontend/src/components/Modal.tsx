// Modal reutilizável — design system industrial
import { useEffect, type ReactNode } from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  aberto: boolean;
  onFechar: () => void;
  titulo: string;
  children: ReactNode;
  largura?: string;
}

export function Modal({ aberto, onFechar, titulo, children, largura = 'max-w-lg' }: ModalProps) {
  // Fecha com ESC
  useEffect(() => {
    function handleEsc(e: KeyboardEvent) {
      if (e.key === 'Escape') onFechar();
    }
    if (aberto) document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [aberto, onFechar]);

  if (!aberto) return null;

  return (
    <div className="modal-overlay">
      {/* Backdrop */}
      <div className="modal-backdrop" onClick={onFechar} />

      {/* Conteúdo */}
      <div className={`modal-content ${largura}`}>
        {/* Header */}
        <div className="modal-header">
          <h2>{titulo}</h2>
          <button
            onClick={onFechar}
            className="flex items-center justify-center transition-colors"
            style={{
              width: '32px',
              height: '32px',
              background: 'transparent',
              border: '1px solid var(--border)',
              borderRadius: 0,
              color: 'var(--text-muted)',
              cursor: 'pointer',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text-primary)'; e.currentTarget.style.borderColor = 'var(--border-hover)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.borderColor = 'var(--border)'; }}
          >
            <X size={14} strokeWidth={1.5} />
          </button>
        </div>

        {/* Body */}
        <div className="modal-body">
          {children}
        </div>
      </div>
    </div>
  );
}
