import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from '@phosphor-icons/react';
import { useSearchParams } from 'react-router-dom';
import { ErrorBoundary } from './ErrorBoundary';
import { GestaoAssinaturaCard } from './GestaoAssinaturaCard';

export function PlanosAssinaturaModal() {
  const [params, setParams] = useSearchParams();
  const aberto = params.get('planos') === 'aberto';
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    if (!aberto || !dialog.current) return;
    const elemento = dialog.current;
    const focoAnterior = document.activeElement;
    const overflowAnterior = document.body.style.overflow;
    elemento.showModal();
    document.body.style.overflow = 'hidden';
    return () => {
      elemento.close();
      document.body.style.overflow = overflowAnterior;
      if (focoAnterior instanceof HTMLElement) focoAnterior.focus();
    };
  }, [aberto]);

  function fechar() {
    setParams(atuais => {
      const proximos = new URLSearchParams(atuais);
      proximos.delete('planos');
      return proximos;
    }, { replace: true });
  }

  if (!aberto) return null;
  return createPortal(<dialog ref={dialog} aria-labelledby="titulo-planos" onCancel={evento => { evento.preventDefault(); fechar(); }} className="m-auto w-[calc(100%_-_2rem)] max-w-5xl max-h-[90dvh] p-0 rounded-2xl border-0 bg-[var(--bg-surface)] text-[var(--texto-principal)] backdrop:bg-[var(--fundo-overlay)]">
    <div className="sticky top-0 z-10 px-14 pt-7 pb-6 sm:pt-9 sm:pb-7 bg-[var(--bg-surface)]">
      <h2 id="titulo-planos" className="font-editorial text-2xl sm:text-3xl min-w-0 text-center">Escolha seu plano</h2>
      <button type="button" onClick={fechar} aria-label="Fechar planos" className="absolute right-2 top-3 min-h-12 min-w-12 inline-flex items-center justify-center rounded-lg text-[var(--texto-principal)]"><X size={24} /></button>
    </div>
    <div className="min-w-0 px-3 pb-4 sm:px-5 sm:pb-5"><ErrorBoundary><GestaoAssinaturaCard modo="planos" /></ErrorBoundary></div>
  </dialog>, document.body);
}
