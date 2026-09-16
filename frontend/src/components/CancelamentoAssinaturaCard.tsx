import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CheckCircle,
  ClockCounterClockwise,
  EnvelopeSimple,
  DownloadSimple,
  WarningCircle,
} from '@phosphor-icons/react';
import api from '../api/client';
import { Modal } from './Modal';

interface SolicitacaoCancelamento {
  id: string;
  status: 'PROCESSAMENTO_PENDENTE' | 'RENOVACAO_CANCELADA' | 'REJEITADA';
  recebidoEm: string;
  cancelamentoConfirmadoEm: string | null;
  fimAcessoEm: string | null;
}

interface RespostaCancelamento {
  solicitacao: SolicitacaoCancelamento | null;
  integracao: {
    estado: 'NAO_CONFIGURADO' | 'PENDENTE' | 'CONFIRMADO' | 'FALHA';
    mensagem: string;
  };
}

const EMAIL_SUPORTE =
  import.meta.env.VITE_SUPORTE_CANCELAMENTO_EMAIL ||
  'wellintonalves1910@gmail.com';

function formatarDataHora(valor: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'long',
    timeStyle: 'short',
    timeZone: 'America/Sao_Paulo',
  }).format(new Date(valor));
}

function novaChaveIdempotencia(): string {
  return crypto.randomUUID();
}

export function CancelamentoAssinaturaCard({
  nomeBarbearia,
}: {
  nomeBarbearia: string;
}) {
  const [dados, setDados] = useState<RespostaCancelamento | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [modalAberto, setModalAberto] = useState(false);
  const [confirmacaoNome, setConfirmacaoNome] = useState('');
  const [motivo, setMotivo] = useState('');
  const [chaveIdempotencia, setChaveIdempotencia] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [exportando, setExportando] = useState(false);

  const carregar = useCallback(async (signal?: AbortSignal) => {
    setCarregando(true);
    setErro(null);
    try {
      const resposta = await api.get<RespostaCancelamento>(
        '/assinatura/cancelamento',
        { signal },
      );
      setDados(resposta.data);
    } catch (error) {
      if (signal?.aborted) return;
      setErro(
        error instanceof Error
          ? error.message
          : 'Não foi possível consultar a solicitação de cancelamento.',
      );
    } finally {
      if (!signal?.aborted) setCarregando(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void carregar(controller.signal);
    return () => controller.abort();
  }, [carregar]);

  const linkEmail = useMemo(() => {
    const assunto = encodeURIComponent(
      `Cancelamento da assinatura — ${nomeBarbearia || 'Valen Barber'}`,
    );
    const corpo = encodeURIComponent(
      `Olá, solicito o cancelamento da renovação da assinatura da barbearia ${nomeBarbearia || ''}. Enviarei esta mensagem usando o e-mail do administrador cadastrado.`,
    );
    return `mailto:${EMAIL_SUPORTE}?subject=${assunto}&body=${corpo}`;
  }, [nomeBarbearia]);

  function abrirConfirmacao() {
    setConfirmacaoNome('');
    setMotivo('');
    setChaveIdempotencia(novaChaveIdempotencia());
    setErro(null);
    setModalAberto(true);
  }

  async function solicitarCancelamento() {
    if (!chaveIdempotencia || confirmacaoNome.trim() !== nomeBarbearia.trim()) {
      return;
    }

    setEnviando(true);
    setErro(null);
    try {
      const resposta = await api.post<RespostaCancelamento & { nova: boolean }>(
        '/assinatura/cancelamento',
        { confirmacaoNome, motivo: motivo.trim() || undefined },
        { headers: { 'Idempotency-Key': chaveIdempotencia } },
      );
      setDados({
        solicitacao: resposta.data.solicitacao,
        integracao: resposta.data.integracao,
      });
      setModalAberto(false);
    } catch (error) {
      setErro(
        error instanceof Error
          ? error.message
          : 'Não foi possível registrar a solicitação.',
      );
    } finally {
      setEnviando(false);
    }
  }

  async function baixarExportacao() {
    setExportando(true);
    setErro(null);
    try {
      const resposta = await api.get('/assinatura/exportacao', { responseType: 'blob' });
      const url = URL.createObjectURL(resposta.data);
      const link = document.createElement('a');
      link.href = url;
      link.download = `valen-exportacao-${new Date().toISOString().slice(0, 10)}.zip`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      setErro(error instanceof Error ? error.message : 'Não foi possível gerar a exportação.');
    } finally {
      setExportando(false);
    }
  }

  if (carregando) {
    return (
      <div className="col-span-1 lg:col-span-2 bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl p-6" aria-busy="true">
        <div className="h-6 w-56 max-w-full rounded bg-[var(--superficie-2)] animate-pulse" />
        <div className="h-4 w-full mt-4 rounded bg-[var(--superficie-2)] animate-pulse" />
        <div className="h-12 w-48 max-w-full mt-6 rounded bg-[var(--superficie-2)] animate-pulse" />
      </div>
    );
  }

  const solicitacao = dados?.solicitacao;
  const renovacaoCancelada =
    solicitacao?.status === 'RENOVACAO_CANCELADA';

  return (
    <>
      <section className="col-span-1 lg:col-span-2 bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl p-4 sm:p-6 min-w-0">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-[10px] bg-[var(--superficie-2)] flex items-center justify-center shrink-0 text-[var(--cor-primaria)]">
            {renovacaoCancelada ? (
              <CheckCircle size={22} weight="regular" />
            ) : (
              <ClockCounterClockwise size={22} weight="regular" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-xl font-bold text-[var(--texto-principal)]">
              Cancelamento da assinatura
            </h2>
            <p className="text-sm text-[var(--texto-secundario)] mt-1 max-w-3xl">
              Registre o pedido pelo painel ou use o e-mail de suporte. A renovação
              só estará cancelada quando houver confirmação do provedor de cobrança.
            </p>
          </div>
        </div>

        {erro && (
          <div className="mt-5 p-4 rounded-lg bg-[var(--erro-fundo)] text-[var(--error-text)] flex flex-col sm:flex-row sm:items-center gap-3" role="alert">
            <span className="flex items-start gap-2 min-w-0 flex-1 text-sm">
              <WarningCircle size={20} className="shrink-0" />
              {erro}
            </span>
            <button type="button" onClick={() => void carregar()} className="btn-secondary min-h-12 md:min-h-10 shrink-0">
              Tentar novamente
            </button>
          </div>
        )}

        {solicitacao ? (
          <div className="mt-6 p-4 sm:p-5 rounded-lg bg-[var(--superficie-2)] border border-[var(--border)] min-w-0">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
              <div className="min-w-0">
                <p className="text-base font-semibold text-[var(--texto-principal)]">
                  {renovacaoCancelada
                    ? 'Renovação cancelada'
                    : 'Solicitação recebida — processamento pendente'}
                </p>
                <p className="text-[13px] text-[var(--texto-secundario)] mt-1">
                  Recebida em {formatarDataHora(solicitacao.recebidoEm)}.
                </p>
              </div>
              <span className="self-start inline-flex items-center min-h-8 px-3 rounded-full bg-[var(--superficie-3)] text-[var(--texto-principal)] text-[13px] font-semibold">
                {renovacaoCancelada ? 'Confirmado' : 'Pendente'}
              </span>
            </div>
            {!renovacaoCancelada && (
              <p className="text-sm text-[var(--texto-secundario)] mt-4">
                Nenhuma cobrança foi cancelada automaticamente e nenhuma data de fim
                de acesso foi definida. O pedido não apaga dados nem interrompe o
                acesso imediatamente.
              </p>
            )}
          </div>
        ) : (
          <div className="mt-6">
            <p className="text-sm text-[var(--texto-secundario)] max-w-3xl">
              Ao registrar o pedido, salvaremos a data e o administrador responsável.
              Enquanto a integração de cobrança não estiver ativa, o processamento é
              manual e não altera sua assinatura por conta própria.
            </p>
            <button
              type="button"
              onClick={abrirConfirmacao}
              className="mt-5 min-h-12 md:min-h-10 px-5 rounded-lg font-semibold text-sm bg-[var(--erro)] text-[var(--texto-sobre-erro)] w-full sm:w-auto"
            >
              Solicitar cancelamento
            </button>
          </div>
        )}

        <div className="mt-6 pt-5 border-t border-[var(--border)] flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-[var(--texto-principal)]">Exportar dados</p>
              <p className="text-[13px] text-[var(--texto-secundario)]">Baixe um ZIP com CSVs e manifesto dos dados desta barbearia.</p>
            </div>
            <button type="button" onClick={() => void baixarExportacao()} disabled={exportando} className="btn-secondary min-h-12 md:min-h-10 shrink-0 w-full sm:w-auto">
              <DownloadSimple size={18} weight="regular" />
              {exportando ? 'Gerando...' : 'Baixar exportação'}
            </button>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-[var(--texto-principal)]">
              Atendimento por e-mail
            </p>
            <p className="text-[13px] text-[var(--texto-secundario)] break-all">
              Envie usando o e-mail do administrador cadastrado: {EMAIL_SUPORTE}
            </p>
          </div>
          <a href={linkEmail} className="btn-secondary min-h-12 md:min-h-10 shrink-0 w-full sm:w-auto">
            <EnvelopeSimple size={18} weight="regular" />
            Abrir e-mail para suporte
          </a>
          </div>
        </div>
      </section>

      <Modal
        aberto={modalAberto}
        onFechar={() => !enviando && setModalAberto(false)}
        titulo="Confirmar solicitação de cancelamento"
      >
        <div className="space-y-5">
          <div className="p-4 rounded-lg bg-[var(--aviso-fundo)] text-[var(--texto-principal)] text-sm">
            Este passo registra o pedido. Ele não confirma o cancelamento da
            renovação nem encerra o acesso imediatamente.
          </div>

          <div>
            <label htmlFor="confirmacao-cancelamento" className="block text-sm font-medium text-[var(--texto-principal)] mb-2">
              Digite o nome da barbearia para confirmar
            </label>
            <p className="text-[13px] text-[var(--texto-secundario)] mb-2 break-words">
              {nomeBarbearia}
            </p>
            <input
              id="confirmacao-cancelamento"
              className="ds-input"
              value={confirmacaoNome}
              onChange={(event) => setConfirmacaoNome(event.target.value)}
              autoComplete="off"
              disabled={enviando}
            />
          </div>

          <div>
            <label htmlFor="motivo-cancelamento" className="block text-sm font-medium text-[var(--texto-principal)] mb-2">
              Motivo (opcional)
            </label>
            <textarea
              id="motivo-cancelamento"
              className="ds-textarea min-h-24"
              value={motivo}
              maxLength={500}
              onChange={(event) => setMotivo(event.target.value)}
              disabled={enviando}
            />
          </div>

          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3">
            <button type="button" onClick={() => setModalAberto(false)} disabled={enviando} className="btn-secondary min-h-12 md:min-h-10">
              Voltar
            </button>
            <button
              type="button"
              onClick={() => void solicitarCancelamento()}
              disabled={enviando || confirmacaoNome.trim() !== nomeBarbearia.trim()}
              className="min-h-12 md:min-h-10 px-5 rounded-lg border-0 font-semibold text-sm bg-[var(--erro)] text-[var(--texto-inverso)] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {enviando ? 'Registrando...' : 'Registrar solicitação'}
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}
