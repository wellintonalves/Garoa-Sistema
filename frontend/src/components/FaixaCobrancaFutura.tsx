import { Warning } from '@phosphor-icons/react';

export function FaixaCobrancaFutura() {
  return (
    <div
      role="status"
      className="flex items-start md:items-center gap-3 w-full rounded p-4 mb-4 md:mb-6"
      style={{
        background: 'var(--aviso-fundo)',
        color: 'var(--texto-principal)',
      }}
    >
      <Warning size={20} className="shrink-0 mt-0.5 md:mt-0" />
      <span
        style={{
          fontFamily: 'var(--fonte-interface)',
          textTransform: 'none',
        }}
      >
        Em breve o Valen Barber passará a ser um serviço pago. Você será avisado com
        antecedência antes de qualquer cobrança.
      </span>
    </div>
  );
}
