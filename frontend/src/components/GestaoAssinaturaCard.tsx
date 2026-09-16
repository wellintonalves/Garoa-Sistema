import { useCallback, useEffect, useRef, useState } from 'react';
import { VerPlanosButton } from './VerPlanosButton';
import { RegularizacaoAssinatura } from './RegularizacaoAssinatura';
import { CreditCard, WarningCircle, CheckCircle, ArrowSquareOut } from '@phosphor-icons/react';
import api from '../api/client';
import { PlanosAssinatura, PeriodicidadeAssinatura, precoPlano } from './PlanosAssinatura';
import type { TransicaoLegado } from './TransicaoLegadoBanner';

type Plano = 'BASICO' | 'PRO';
type Periodicidade = 'MENSAL' | 'ANUAL';

interface AssinaturaResumo {
  id: string;
  plano: Plano;
  periodicidade: Periodicidade;
  status: 'PRE_CADASTRO' | 'TESTE' | 'ATIVA' | 'PAGAMENTO_PENDENTE' | 'CONSULTA_EXPORTACAO' | 'ENCERRADA';
  precoCicloCentavos: number;
  testeFim: string | null;
  cicloFim: string | null;
  renovacaoAutomatica: boolean;
  toleranciaAte: string | null;
  consultaExportacaoAte: string | null;
  checkoutUrl: string | null;
  integracao: { ambiente: 'DESATIVADO' | 'LOCAL_FAKE' | 'SANDBOX' | 'PRODUCTION'; configurado: boolean; mensagem: string | null };
}

interface ResumoResposta {
  revisaoFinanceira?: { tipo: string; mensagem: string } | null;
  assinatura: AssinaturaResumo | null;
  proDisponivel: boolean;
  integracao?: AssinaturaResumo['integracao'];
  transicaoLegado?: TransicaoLegado;
}

const TERMOS_VERSAO = '2026-09-15';
const OFERTA_VERSAO = '2026-09-15';

function novaChave(): string {
  return crypto.randomUUID();
}

function dinheiro(centavos: number): string {
  return (centavos / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function data(valor: string | null): string | null {
  if (!valor) return null;
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'long',
    timeZone: 'America/Sao_Paulo',
  }).format(new Date(valor));
}

function abrirCheckoutSeguro(urlTexto: string): void {
  const url = new URL(urlTexto);
  const sandbox = url.protocol === 'https:' && url.hostname === 'sandbox.asaas.com';
  const producao = url.protocol === 'https:' && ['www.asaas.com', 'asaas.com'].includes(url.hostname);
  const local = import.meta.env.DEV && ['127.0.0.1', 'localhost'].includes(url.hostname);
  if (url.username || url.password || (!sandbox && !local && !producao)) throw new Error('O endereço de pagamento recebido não é permitido.');
  window.location.assign(url.toString());
}

const ROTULOS_STATUS: Record<AssinaturaResumo['status'], string> = {
  PRE_CADASTRO: 'Aguardando forma de pagamento',
  TESTE: 'Período de teste',
  ATIVA: 'Ativa',
  PAGAMENTO_PENDENTE: 'Pagamento pendente',
  CONSULTA_EXPORTACAO: 'Somente consulta e exportação',
  ENCERRADA: 'Encerrada',
};

export function GestaoAssinaturaCard({ modo = 'resumo' }: { modo?: 'resumo' | 'planos' }) {
  const [resumo, setResumo] = useState<ResumoResposta | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [periodicidade, setPeriodicidade] = useState<Periodicidade>('MENSAL');
  const [plano, setPlano] = useState<Plano>('BASICO');
  const [aceite, setAceite] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [confirmando, setConfirmando] = useState(false);
  const tituloConfirmacao = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (confirmando) tituloConfirmacao.current?.focus();
  }, [confirmando]);

  const carregar = useCallback(async (signal?: AbortSignal, mostrarCarregamento = true) => {
    if (mostrarCarregamento) setCarregando(true);
    setErro(null);
    try {
      const resposta = await api.get<ResumoResposta>('/assinatura', { signal });
      if (signal?.aborted) return;
      setResumo(resposta.data);
      if (resposta.data.assinatura) {
        setPlano(resposta.data.assinatura.plano);
        setPeriodicidade(resposta.data.assinatura.periodicidade);
      }
    } catch (error) {
      if (!signal?.aborted) setErro(error instanceof Error ? error.message : 'Não foi possível consultar a assinatura.');
    } finally {
      if (!signal?.aborted) setCarregando(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void carregar(controller.signal);
    const atualizarResumo = () => { if (modo === 'resumo') void carregar(controller.signal, false); };
    window.addEventListener('assinatura-atualizada', atualizarResumo);
    return () => {
      controller.abort();
      window.removeEventListener('assinatura-atualizada', atualizarResumo);
    };
  }, [carregar, modo]);


  async function contratar() {
    setEnviando(true);
    setErro(null);
    try {
      const formasPagamento = ['CREDIT_CARD'];
      const resposta = await api.post('/assinatura/contratacao', {
        plano,
        periodicidade,
        formasPagamento,
        termosVersao: TERMOS_VERSAO,
        ofertaVersao: OFERTA_VERSAO,
        aceite,
      }, { headers: { 'Idempotency-Key': novaChave() } });
      const checkoutUrl = resposta.data?.checkout?.checkoutUrl || resposta.data?.assinatura?.checkoutUrl;
      await carregar();
      window.dispatchEvent(new Event('assinatura-atualizada'));
      if (checkoutUrl) abrirCheckoutSeguro(checkoutUrl);
    } catch (error) {
      setErro(error instanceof Error ? error.message : 'Não foi possível iniciar a contratação.');
    } finally {
      setEnviando(false);
    }
  }

  async function mudar(dados: { planoDestino?: Plano; periodicidadeDestino?: Periodicidade }) {
    setEnviando(true);
    setErro(null);
    try {
      const resposta = await api.post('/assinatura/mudancas', {
        ...dados,
        formasPagamento: ['PIX', 'CREDIT_CARD'],
        ofertaVersao: OFERTA_VERSAO,
        aceite,
      }, { headers: { 'Idempotency-Key': novaChave() } });
      const checkoutUrl = resposta.data?.checkout?.checkoutUrl || resposta.data?.mudanca?.checkoutUrl;
      await carregar();
      window.dispatchEvent(new Event('assinatura-atualizada'));
      if (checkoutUrl) abrirCheckoutSeguro(checkoutUrl);
    } catch (error) {
      setErro(error instanceof Error ? error.message : 'Não foi possível solicitar a mudança.');
    } finally {
      setEnviando(false);
    }
  }

  if (carregando) {
    return (
      <section className="col-span-1 lg:col-span-2 bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl p-4 sm:p-6" aria-busy="true">
        <div className="h-6 w-48 rounded bg-[var(--superficie-2)] animate-pulse" />
        <div className="h-20 w-full mt-4 rounded bg-[var(--superficie-2)] animate-pulse" />
      </section>
    );
  }

  const assinatura = resumo?.assinatura;
  const integracao = assinatura?.integracao || resumo?.integracao;
  const transicao = resumo?.transicaoLegado;
  const elegivelTeste = transicao?.elegivelTeste !== false;
  const mostrarDetalhes = modo === 'resumo' || confirmando;
  const comparacao = (
    <div className="pt-2">
      <PeriodicidadeAssinatura valor={periodicidade} onChange={valor => { setPeriodicidade(valor); setAceite(false); }} />
      <PlanosAssinatura plano={plano} periodicidade={periodicidade} proDisponivel={resumo?.proDisponivel === true || assinatura?.plano === 'PRO'} onChange={(novoPlano) => { setPlano(novoPlano); setAceite(false); }} onEscolher={() => setConfirmando(true)} />
    </div>
  );

  return (
    <section className={modo === 'resumo' ? 'col-span-1 lg:col-span-2 bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl p-4 sm:p-6 min-w-0' : 'min-w-0 px-1 sm:px-2'}>
      {modo === 'resumo' && <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-[10px] bg-[var(--superficie-2)] flex items-center justify-center shrink-0 text-[var(--cor-primaria)]">
          <CreditCard size={22} weight="regular" />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-xl font-bold text-[var(--texto-principal)]">Sua assinatura</h2>
          <p className="text-sm text-[var(--texto-secundario)] mt-1">Acompanhe seu plano e os próximos pagamentos.</p>
        </div>
      </div>}

      {erro && (
        <div className="mt-5 p-4 rounded-lg bg-[var(--erro-fundo)] text-[var(--error-text)] flex flex-col sm:flex-row sm:items-center gap-3" role="alert">
          <span className="flex items-start gap-2 min-w-0 flex-1 text-sm"><WarningCircle size={20} className="shrink-0" />{erro}</span>
          <button type="button" onClick={() => void carregar()} className="btn-secondary !min-h-12">Tentar novamente</button>
        </div>
      )}


      {modo === 'planos' && resumo && !confirmando && comparacao}
      {modo === 'planos' && confirmando && <div className="mb-6">
        <button type="button" onClick={() => { setConfirmando(false); setAceite(false); }} className="min-h-12 text-sm text-[var(--texto-secundario)]">← Voltar aos planos</button>
        <h3 ref={tituloConfirmacao} tabIndex={-1} className="text-xl font-semibold text-[var(--texto-principal)] mt-2">{plano === 'BASICO' ? 'Básico' : 'Pró'} · {periodicidade === 'MENSAL' ? 'Mensal' : 'Anual'}</h3>
        <p className="font-mono tabular-nums text-2xl text-[var(--texto-principal)] mt-3">{dinheiro(precoPlano(plano, periodicidade))}<span className="font-sans text-sm">/{periodicidade === 'MENSAL' ? 'mês' : 'ano'}</span></p>
      </div>}
      {resumo && mostrarDetalhes && (assinatura ? (
        <div className="mt-6 space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="rounded-lg bg-[var(--superficie-2)] p-4 min-w-0">
              <p className="text-[13px] text-[var(--texto-secundario)]">Plano</p>
              <p className="text-base font-semibold text-[var(--texto-principal)] mt-1">{assinatura.plano === 'BASICO' ? 'Básico' : 'Pró'}</p>
            </div>
            <div className="rounded-lg bg-[var(--superficie-2)] p-4 min-w-0">
              <p className="text-[13px] text-[var(--texto-secundario)]">Ciclo</p>
              <p className="text-base font-semibold text-[var(--texto-principal)] mt-1">{assinatura.periodicidade === 'MENSAL' ? 'Mensal' : 'Anual'}</p>
            </div>
            <div className="rounded-lg bg-[var(--superficie-2)] p-4 min-w-0">
              <p className="text-[13px] text-[var(--texto-secundario)]">Estado</p>
              <p className="text-base font-semibold text-[var(--texto-principal)] mt-1">{resumo?.revisaoFinanceira ? 'Pagamento em revisão' : ROTULOS_STATUS[assinatura.status]}</p>
            </div>
          </div>

          <p className="text-sm text-[var(--texto-secundario)]">Valor do ciclo atual: <strong className="font-mono tabular-nums whitespace-nowrap text-[var(--texto-principal)]">{dinheiro(assinatura.precoCicloCentavos)}</strong>{assinatura.cicloFim ? ` · Fim do ciclo: ${data(assinatura.cicloFim)}.` : ''}</p>

          <RegularizacaoAssinatura status={assinatura.status} ambiente={assinatura.integracao.ambiente} renovacaoAutomatica={assinatura.renovacaoAutomatica} revisao={resumo?.revisaoFinanceira} />
          {assinatura.status === 'PAGAMENTO_PENDENTE' && !resumo?.revisaoFinanceira && (
            <p className="rounded-lg bg-[var(--aviso-fundo)] p-4 text-sm text-[var(--texto-principal)]">{assinatura.toleranciaAte ? `Regularize o pagamento até ${data(assinatura.toleranciaAte)}.` : 'Você terá sete dias para regularizar após o registro do aviso exibido no painel.'} Depois desse prazo, a renovação será encerrada e começará o período de consulta e exportação.</p>
          )}
          {assinatura.status === 'TESTE' && (
            <p className="rounded-lg bg-[var(--superficie-2)] p-4 text-sm text-[var(--texto-principal)]">Teste gratuito até {data(assinatura.testeFim)}. A primeira cobrança só vence ao final desse período.</p>
          )}
          {assinatura.status === 'CONSULTA_EXPORTACAO' && (
            <p className="rounded-lg bg-[var(--aviso-fundo)] p-4 text-sm text-[var(--texto-principal)]">Alterações estão bloqueadas. Consulta e exportação permanecem disponíveis até {data(assinatura.consultaExportacaoAte)}.</p>
          )}

          {assinatura.checkoutUrl && (
            <button type="button" onClick={() => abrirCheckoutSeguro(assinatura.checkoutUrl!)} className="btn-primary !min-h-12 w-full sm:w-auto">
              <ArrowSquareOut size={18} weight="regular" />Continuar forma de pagamento
            </button>
          )}

          {modo === 'planos' && ['TESTE', 'ATIVA', 'PAGAMENTO_PENDENTE'].includes(assinatura.status) && (
            <div className="pt-5 border-t border-[var(--border)]">
              <p className="text-sm text-[var(--texto-secundario)] mb-4">A mudança de ciclo e a redução para o Básico valem na próxima renovação. O upgrade mantém o vencimento e depende do pagamento da diferença proporcional. Altere plano e periodicidade em solicitações separadas.</p>
              <label className="flex items-start gap-3 !min-h-12 text-sm text-[var(--texto-principal)] cursor-pointer">
                <input type="checkbox" checked={aceite} onChange={(event) => setAceite(event.target.checked)} className="mt-1" />
                <span>Confirmo que li a oferta e que a mudança ocorrerá somente nas condições indicadas.</span>
              </label>
              <div className="flex flex-col sm:flex-row gap-3 mt-3">
                {periodicidade !== assinatura.periodicidade && plano === assinatura.plano && <button type="button" disabled={!aceite || enviando || !integracao?.configurado} onClick={() => void mudar({ periodicidadeDestino: periodicidade })} className="btn-secondary !min-h-12 w-full sm:w-auto">
                  {enviando ? 'Processando...' : `Mudar para ciclo ${periodicidade === 'ANUAL' ? 'anual' : 'mensal'} na renovação`}
                </button>
                }
                {assinatura.plano === 'BASICO' && plano === 'PRO' && periodicidade === assinatura.periodicidade && resumo?.proDisponivel && (
                  <button type="button" disabled={!aceite || enviando || !integracao?.configurado} onClick={() => void mudar({ planoDestino: 'PRO' })} className="btn-primary !min-h-12 w-full sm:w-auto">{enviando ? 'Processando...' : 'Solicitar upgrade para o Pró'}</button>
                )}
                {assinatura.plano === 'PRO' && plano === 'BASICO' && periodicidade === assinatura.periodicidade && (
                  <button type="button" disabled={!aceite || enviando || !integracao?.configurado} onClick={() => void mudar({ planoDestino: 'BASICO' })} className="btn-secondary !min-h-12 w-full sm:w-auto">{enviando ? 'Processando...' : 'Solicitar Básico na renovação'}</button>
                )}
              </div>
              {plano === assinatura.plano && periodicidade === assinatura.periodicidade && <p className="mt-3 text-sm text-[var(--texto-secundario)]">Este é o seu plano e ciclo atuais. Selecione outra opção para solicitar uma mudança.</p>}
              {plano !== assinatura.plano && periodicidade !== assinatura.periodicidade && <p className="mt-3 text-sm text-[var(--texto-secundario)]">Para mudar o plano, mantenha o ciclo atual. Para mudar o ciclo, mantenha o plano atual.</p>}
              {!integracao?.configurado && <p className="mt-3 text-sm text-[var(--texto-secundario)]">As mudanças de assinatura estão indisponíveis neste ambiente.</p>}
            </div>
          )}
        </div>
      ) : modo === 'resumo' ? (
        <p className="mt-6 text-sm text-[var(--texto-secundario)]">Sua barbearia ainda não tem uma assinatura. Veja os planos disponíveis para escolher a melhor opção.</p>
      ) : (
        <div className="mt-6">
          {elegivelTeste && <p className="text-sm text-[var(--texto-secundario)]">Sete dias grátis para novas barbearias.</p>}
          <p className="mt-4 text-sm text-[var(--texto-principal)]">Pagamento por cartão de crédito, com renovação automática. Os dados do cartão são preenchidos no checkout seguro.</p>
          <div className="rounded-lg bg-[var(--superficie-2)] p-4 mt-5 text-sm text-[var(--texto-principal)] space-y-2">
            <p><strong>{elegivelTeste ? 'Depois do teste: ' : 'Valor da assinatura: '}{dinheiro(precoPlano(plano, periodicidade))}{periodicidade === 'MENSAL' ? ' por mês' : ' por ano, pagos de uma vez'}.</strong> A forma de pagamento é cadastrada no início. A assinatura renova automaticamente a cada {periodicidade === 'MENSAL' ? 'mês' : 'ano'}.</p>
            <p>{elegivelTeste && 'Cancele durante os sete dias gratuitos para evitar a primeira cobrança. '}O cancelamento interrompe a próxima renovação e preserva o acesso até o fim do período pago, respeitados os direitos legais.</p>
          </div>
          <label className="flex items-start gap-3 !min-h-12 mt-4 text-sm text-[var(--texto-principal)] cursor-pointer"><input type="checkbox" checked={aceite} onChange={(event) => setAceite(event.target.checked)} className="mt-1" /><span>Li a oferta, aceito os <a href="/termos-de-uso" target="_blank" rel="noreferrer" className="underline">Termos de Uso</a> e estou ciente da renovação automática. Consulte também a <a href="/politica-de-privacidade" target="_blank" rel="noreferrer" className="underline">Política de Privacidade</a>.</span></label>
          <button type="button" disabled={!aceite || enviando || !integracao?.configurado || (plano === 'PRO' && !resumo?.proDisponivel)} onClick={() => void contratar()} className="btn-primary !min-h-12 w-full sm:w-auto mt-4">{enviando ? 'Preparando...' : `Começar com o ${plano === 'BASICO' ? 'Básico' : 'Pró'}`}</button>
          {!integracao?.configurado && <p className="text-[13px] text-[var(--texto-secundario)] mt-3">A contratação está desativada neste ambiente. Nenhuma cobrança pode ser criada.</p>}
        </div>
      ))}

      {modo === 'resumo' && resumo && <div className="mt-5"><VerPlanosButton /></div>}

      {mostrarDetalhes && integracao?.ambiente === 'LOCAL_FAKE' && (
        <div className="mt-5 flex items-start gap-2 text-[13px] text-[var(--texto-secundario)]"><CheckCircle size={18} className="shrink-0" />Simulador local ativo. Ele não cria clientes, assinaturas ou cobranças externas.</div>
      )}
    </section>
  );
}
