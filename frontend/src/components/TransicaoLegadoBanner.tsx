import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { VerPlanosButton } from './VerPlanosButton';
import api from '../api/client';
import { FaixaCobrancaFutura } from './FaixaCobrancaFutura';
import { AvisoCobrancaFuturaModal } from './AvisoCobrancaFuturaModal';

export interface TransicaoLegado {
  legada: boolean;
  status: 'NAO_APLICAVEL' | 'AGUARDANDO_DISPONIBILIDADE' | 'AGUARDANDO_AVISO' | 'PRAZO_MIGRACAO' | 'CONSULTA_EXPORTACAO' | 'ENCERRADA' | 'MIGRADA';
  avisoEm: string | null;
  prazoAte: string | null;
  consultaExportacaoAte: string | null;
  diasRestantes: number | null;
  elegivelTeste: boolean;
}

function data(valor: string | null) {
  return valor ? new Intl.DateTimeFormat('pt-BR', { dateStyle: 'long', timeZone: 'America/Sao_Paulo' }).format(new Date(valor)) : 'a data informada na assinatura';
}

export function TransicaoLegadoBanner() {
  const { pathname } = useLocation();
  const [transicao, setTransicao] = useState<TransicaoLegado | null>(null);
  const [assinatura, setAssinatura] = useState<{ status: string; testeFim: string | null } | null>(null);
  const [consultado, setConsultado] = useState(false);
  const [erro, setErro] = useState(false);
  const [tentativa, setTentativa] = useState(0);
  const registrando = useRef(false);
  useEffect(() => {
    const controller = new AbortController();
    setErro(false);
    void api.get('/assinatura', { signal: controller.signal }).then(res => {
      if (controller.signal.aborted) return;
      setTransicao(res.data.transicaoLegado ?? null);
      setAssinatura(res.data.assinatura ?? null);
      setConsultado(true);
    }).catch(() => {
      if (!controller.signal.aborted) setErro(true);
    });
    return () => controller.abort();
  }, [pathname, tentativa]);

  useEffect(() => {
    // Só registra depois de renderizar o aviso. Backend mantém idempotência.
    if (erro || transicao?.status !== 'AGUARDANDO_AVISO' || registrando.current) return;
    registrando.current = true;
    void api.post('/assinatura/transicao-legado/aviso').then(res => {
      setTransicao(res.data.transicaoLegado);
    }).catch(() => {
      registrando.current = false;
      setErro(true);
    });
  }, [transicao, tentativa, erro]);

  if (erro) return <div role="alert" className="mb-5 rounded-xl bg-[var(--aviso-fundo)] p-4 text-sm text-[var(--texto-principal)] flex flex-col sm:flex-row gap-3 sm:items-center justify-between"><span>Não foi possível consultar os avisos da assinatura.</span><button type="button" onClick={() => setTentativa(valor => valor + 1)} className="btn-secondary !min-h-12 shrink-0">Tentar novamente</button></div>;
  if (consultado && !transicao?.legada && (!assinatura || ['PRE_CADASTRO', 'TESTE'].includes(assinatura.status))) return <section aria-label="Aviso de assinatura" className="mb-5 rounded-xl bg-[var(--aviso-fundo)] p-4 text-sm text-[var(--texto-principal)] flex flex-col sm:flex-row sm:items-center gap-3">
    <p className="min-w-0 flex-1">{assinatura?.status === 'TESTE' ? `Seu período de teste termina em ${data(assinatura.testeFim)}. Consulte seu plano e as opções de assinatura.` : assinatura?.status === 'PRE_CADASTRO' ? 'Conclua a contratação para ativar sua assinatura.' : 'Escolha uma assinatura para sua barbearia. Compare os planos e as opções mensal e anual.'}</p>
    <VerPlanosButton />
  </section>;
  if (!transicao?.legada || ['NAO_APLICAVEL', 'MIGRADA'].includes(transicao.status)) return null;
  if (transicao.status === 'AGUARDANDO_DISPONIBILIDADE') return <><FaixaCobrancaFutura /><AvisoCobrancaFuturaModal /></>;
  return <section className="mb-5 rounded-xl bg-[var(--aviso-fundo)] p-4 sm:p-5 text-sm text-[var(--texto-principal)] flex flex-col lg:flex-row lg:items-center gap-4" aria-label="Transição para assinatura">
    <div className="min-w-0 flex-1 space-y-2">
      <h2 className="font-semibold text-base">Escolha um plano para continuar com sua barbearia</h2>
      {transicao.status === 'AGUARDANDO_AVISO' ? <p>Você terá cinco dias corridos a partir deste aviso para contratar um plano. A data limite será confirmada ao registrar o aviso.</p> :
        transicao.status === 'PRAZO_MIGRACAO' ? <p>Contrate até {data(transicao.prazoAte)} para manter o acesso completo. Depois, ficam disponíveis apenas consulta e exportação por trinta dias.</p> :
        transicao.status === 'CONSULTA_EXPORTACAO' ? <p>O prazo de transição terminou. Você pode consultar e exportar seus dados até {data(transicao.consultaExportacaoAte)}.</p> :
        <p>O período de consulta e exportação terminou. Entre em contato com o suporte para verificar sua conta.</p>}
      {!transicao.elegivelTeste && <p>Contas existentes não recebem um novo teste de sete dias. A cobrança começa na contratação.</p>}
    </div>
    <VerPlanosButton />
  </section>;
}
