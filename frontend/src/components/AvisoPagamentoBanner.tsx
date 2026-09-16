import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import api from '../api/client';

interface Aviso { id: string; status: string; avisoPagamentoEm: string | null; toleranciaAte: string | null }

export function AvisoPagamentoBanner() {
  const { pathname } = useLocation();
  const [assinatura, setAssinatura] = useState<Aviso | null>(null);
  const [erro, setErro] = useState(false);
  const [tentativa, setTentativa] = useState(0);
  const registrando = useRef(false);
  useEffect(() => {
    const controller = new AbortController();
    setErro(false);
    void api.get('/assinatura', { signal: controller.signal }).then(res => {
      if (!controller.signal.aborted) setAssinatura(res.data.assinatura ?? null);
    }).catch(() => { if (!controller.signal.aborted) setErro(true); });
    return () => controller.abort();
  }, [pathname, tentativa]);
  useEffect(() => {
    // O prazo começa depois de o aviso entrar na tela, nunca na mera consulta da API.
    if (erro || assinatura?.status !== 'PAGAMENTO_PENDENTE' || assinatura.avisoPagamentoEm || registrando.current) return;
    registrando.current = true;
    void api.post('/assinatura/aviso-pagamento').then(() => api.get('/assinatura')).then(res => {
      setAssinatura(res.data.assinatura ?? null);
    }).catch(() => setErro(true)).finally(() => { registrando.current = false; });
  }, [assinatura, erro, tentativa]);
  if (erro) return <div role="alert" className="mb-5 rounded-xl bg-[var(--aviso-fundo)] p-4 text-sm text-[var(--texto-principal)] flex flex-col sm:flex-row gap-3 justify-between sm:items-center"><span>Não foi possível confirmar os avisos de pagamento.</span><button type="button" className="btn-secondary !min-h-12" onClick={() => setTentativa(v => v + 1)}>Tentar novamente</button></div>;
  if (assinatura?.status !== 'PAGAMENTO_PENDENTE') return null;
  const prazo = assinatura.toleranciaAte ? new Intl.DateTimeFormat('pt-BR', { dateStyle: 'long', timeZone: 'America/Sao_Paulo' }).format(new Date(assinatura.toleranciaAte)) : null;
  return <section aria-label="Aviso de pagamento pendente" className="mb-5 rounded-xl bg-[var(--aviso-fundo)] p-4 sm:p-5 text-sm text-[var(--texto-principal)] flex flex-col lg:flex-row gap-4 lg:items-center">
    <div className="min-w-0 flex-1 space-y-2"><h2 className="font-semibold text-base">Precisamos regularizar sua assinatura</h2><p>{prazo ? `O pagamento não foi confirmado. Regularize até ${prazo} para manter o acesso completo.` : 'O pagamento não foi confirmado. Você terá sete dias corridos a partir deste aviso para regularizar; estamos registrando a data limite.'}</p><p>Após o prazo, a renovação será encerrada e começará o período de trinta dias para consulta e exportação.</p></div>
    <Link to="/admin/configuracoes?secao=assinatura" className="btn-primary !min-h-12 shrink-0">Ver assinatura</Link>
  </section>;
}
