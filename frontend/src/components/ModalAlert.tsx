import { useEffect, useRef, useState } from 'react';
import { X, CheckCircle, Warning, Info } from '@phosphor-icons/react';

interface ModalAlertProps {
  aberto: boolean;
  onFechar: () => void;
  onConfirmar?: () => void;
  titulo: string;
  mensagem: string;
  tipo?: 'sucesso' | 'erro' | 'aviso' | 'info';
  textoBotao?: string;
  textoCancelar?: string;
  isConfirm?: boolean;
}

export function ModalAlert({
  aberto,
  onFechar,
  onConfirmar,
  titulo,
  mensagem,
  tipo = 'info',
  textoBotao = 'Entendi',
  textoCancelar = 'Cancelar',
  isConfirm = false
}: ModalAlertProps) {
  const [visivel, setVisivel] = useState(aberto);
  const [fechando, setFechando] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);
  const btnFechamentoRef = useRef<HTMLButtonElement>(null);
  const elementoAnteriorRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (aberto) {
      elementoAnteriorRef.current = document.activeElement as HTMLElement;
      setVisivel(true);
      setFechando(false);
      // Travar o scroll
      document.body.style.overflow = 'hidden';
      // Focar no modal após um breve delay para garantir renderização
      setTimeout(() => btnFechamentoRef.current?.focus(), 50);
    } else if (visivel) {
      setFechando(true);
      document.body.style.overflow = '';
      elementoAnteriorRef.current?.focus();
      
      const timer = setTimeout(() => {
        setVisivel(false);
        setFechando(false);
      }, 250);
      return () => clearTimeout(timer);
    }
  }, [aberto, visivel]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (!aberto) return;
      if (e.key === 'Escape' && !fechando) {
        onFechar();
      }
      if (e.key === 'Tab' && modalRef.current) {
        const focusableElements = modalRef.current.querySelectorAll(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        const firstElement = focusableElements[0] as HTMLElement;
        const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

        if (e.shiftKey) {
          if (document.activeElement === firstElement) {
            lastElement.focus();
            e.preventDefault();
          }
        } else {
          if (document.activeElement === lastElement) {
            firstElement.focus();
            e.preventDefault();
          }
        }
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [aberto, onFechar, fechando]);

  if (!visivel) return null;

  const configTipo = {
    sucesso: { icon: CheckCircle, cor: 'var(--sucesso)', bgCor: 'var(--sucesso-fundo)' },
    erro: { icon: Warning, cor: 'var(--erro)', bgCor: 'var(--erro-fundo)' },
    aviso: { icon: Warning, cor: 'var(--amber)', bgCor: 'var(--amber-fundo)' },
    info: { icon: Info, cor: 'var(--amber)', bgCor: 'var(--amber-fundo)' },
  };

  const Icon = configTipo[tipo].icon;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6"
      style={{ zIndex: 9999 }}
    >
      <div 
        className={`absolute inset-0 transition-opacity duration-200 ${fechando ? 'opacity-0' : 'opacity-100'}`}
        style={{ backgroundColor: 'rgba(0, 0, 0, 0.6)' }}
        onClick={() => !fechando && onFechar()}
      />
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-titulo"
        aria-describedby="modal-mensagem"
        className={`relative w-full max-w-sm rounded-xl flex flex-col overflow-hidden transition-all duration-200 ${
          fechando ? 'opacity-0 scale-95' : 'opacity-100 scale-100'
        }`}
        style={{
          background: 'var(--fundo-sidebar)',
          border: '1px solid var(--borda-forte)',
          boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.3)',
        }}
        onTransitionEnd={() => {
          if (fechando) {
            setVisivel(false);
            setFechando(false);
          }
        }}
      >
        <button
          ref={btnFechamentoRef}
          onClick={() => !fechando && onFechar()}
          className="absolute top-4 right-4 flex items-center justify-center rounded-full hover:bg-[var(--fundo-input)] transition-colors p-1"
          style={{ color: 'var(--texto-secundario)' }}
          aria-label="Fechar"
        >
          <X size={20} />
        </button>

        <div className="p-6 flex flex-col items-center text-center">
          <div 
            className="w-12 h-12 flex items-center justify-center rounded-full mb-4"
            style={{ backgroundColor: configTipo[tipo].bgCor, color: configTipo[tipo].cor }}
          >
            <Icon size={28} weight="regular" />
          </div>
          
          <h2 
            id="modal-titulo"
            className="text-lg font-bold mb-2 w-full"
            style={{ fontFamily: 'var(--fonte-interface)', color: 'var(--text-primary)' }}
          >
            {titulo}
          </h2>
          
          <p 
            id="modal-mensagem"
            className="text-sm mb-6 w-full"
            style={{ fontFamily: 'var(--fonte-interface)', color: 'var(--texto-secundario)' }}
          >
            {mensagem}
          </p>

          <div className="flex gap-3 w-full mt-2">
            {isConfirm && (
              <button
                onClick={() => !fechando && onFechar()}
                className="flex-1 rounded-lg border font-semibold transition-colors flex items-center justify-center"
                style={{ 
                  minHeight: '48px',
                  fontFamily: 'var(--fonte-interface)',
                  borderColor: 'var(--borda-forte)',
                  background: 'transparent',
                  color: 'var(--text-primary)'
                }}
              >
                {textoCancelar}
              </button>
            )}
            <button
              onClick={() => {
                if (fechando) return;
                if (isConfirm && onConfirmar) onConfirmar();
                onFechar();
              }}
              className="flex-1 rounded-lg font-semibold transition-colors flex items-center justify-center btn-primary"
              style={{ 
                minHeight: '48px',
                fontFamily: 'var(--fonte-interface)',
                border: 'none'
              }}
            >
              {textoBotao}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
