import { useEffect, useState } from 'react';
import { Modal } from './Modal';

export function AvisoCobrancaFuturaModal() {
  const [aberto, setAberto] = useState(false);

  useEffect(() => {
    const jaViu = localStorage.getItem('@garoa:aviso-cobranca-v1');
    if (!jaViu) {
      setAberto(true);
    }
  }, []);

  const handleFechar = () => {
    localStorage.setItem('@garoa:aviso-cobranca-v1', '1');
    setAberto(false);
  };

  return (
    <Modal
      aberto={aberto}
      onFechar={handleFechar}
      titulo="O Valen Barber vai passar a ser pago"
    >
      <div className="flex flex-col gap-4">
        <p
          style={{
            fontFamily: 'var(--fonte-interface)',
            textTransform: 'none',
          }}
        >
          Estamos finalizando os planos de assinatura do sistema.
        </p>
        <p
          style={{
            fontFamily: 'var(--fonte-interface)',
            textTransform: 'none',
          }}
        >
          Voce continua com acesso normal por enquanto. Nada muda hoje.
        </p>
        <p
          style={{
            fontFamily: 'var(--fonte-interface)',
            textTransform: 'none',
          }}
        >
          Antes de qualquer cobranca voce sera avisado aqui no painel, com antecedencia e com
          os valores.
        </p>
        <button
          onClick={handleFechar}
          className="w-full flex items-center justify-center font-medium rounded transition-colors"
          style={{
            minHeight: '48px',
            background: 'var(--cor-primaria)',
            color: 'var(--texto-sobre-primaria)',
            fontFamily: 'var(--fonte-interface)',
            textTransform: 'none',
          }}
        >
          Entendi
        </button>
      </div>
    </Modal>
  );
}
