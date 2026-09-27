import { useEffect, useRef, useState } from 'react';
import { ChatCircleDots, Microphone, PaperPlaneTilt, X } from '@phosphor-icons/react';
import type { AxiosInstance } from 'axios';
import { isAxiosError } from 'axios';
import { ErrorBoundary } from './ErrorBoundary';
import './AssistenteIa.css';
import avatarValeria from '../assets/valeria.png';

interface StatusIa {
  mensagem: string;
  textoDisponivel: boolean;
  vozDisponivel: boolean;
  vozNoPlano: boolean;
  creditosMensais: number | null;
  creditosRestantes: number | null;
  mensagensMensais: number | null;
  mensagensRestantes: number | null;
  vozSegundosRestantes: number | null;
  renovaEm?: string | null;
}

export function AssistenteIa(props: { api: AxiosInstance; caminho: string; avatarUrl?: string }) {
  return <ErrorBoundary fallback={<p role="alert">Não foi possível abrir a assistente. Recarregue a página para tentar novamente.</p>}>
    <PainelAssistente key={props.caminho} {...props} />
  </ErrorBoundary>;
}

function PainelAssistente({ api, caminho, avatarUrl = avatarValeria }: { api: AxiosInstance; caminho: string; avatarUrl?: string }) {
  const dialogo = useRef<HTMLDialogElement>(null);
  const botao = useRef<HTMLButtonElement>(null);
  const [aberto, setAberto] = useState(false);
  const [tentativa, setTentativa] = useState(0);
  const [status, setStatus] = useState<StatusIa | null>(null);
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(false);
  const [mensagem, setMensagem] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [erroEnvio, setErroEnvio] = useState('');
  const [historico, setHistorico] = useState<{ id: string; autor: string; texto: string }[]>([]);
  const [pendente, setPendente] = useState<{ chave: string; mensagem: string } | null>(null);
  const envioAtual = useRef<AbortController | null>(null);
  useEffect(() => () => envioAtual.current?.abort(), []);

  useEffect(() => {
    if (!aberto) return;
    const controller = new AbortController();
    setCarregando(true);
    setErro('');
    setStatus(null);
    api.get<StatusIa>(`${caminho}/status`, { signal: controller.signal })
      .then(res => { if (!controller.signal.aborted) setStatus(res.data); })
      .catch((e: Error) => { if (!controller.signal.aborted) setErro(e.message); })
      .finally(() => { if (!controller.signal.aborted) setCarregando(false); });
    return () => controller.abort();
  }, [aberto, api, caminho, tentativa]);

  function abrir() { dialogo.current?.showModal(); setAberto(true); }
  function fechar() { dialogo.current?.close(); }

  async function enviar(evento: React.FormEvent) {
    evento.preventDefault();
    if (enviando || (!pendente && (!status?.textoDisponivel || !mensagem.trim()))) return;
    const pedido = pendente ?? { chave: crypto.randomUUID(), mensagem: mensagem.trim() };
    const controller = new AbortController();
    envioAtual.current = controller;
    setEnviando(true);
    setErroEnvio('');
    setPendente(pedido);
    if (!pendente) setHistorico(atual => [...atual, { id: pedido.chave, autor: 'Você', texto: pedido.mensagem }]);
    try {
      const resposta = await api.post<{ estado: string; texto: string }>(`${caminho}/mensagens`, { mensagem: pedido.mensagem }, {
        headers: { 'Idempotency-Key': pedido.chave }, signal: controller.signal, timeout: 40_000,
      });
      if (controller.signal.aborted) return;
      setHistorico(atual => [...atual.filter(item => item.id !== `${pedido.chave}-resposta`),
        { id: `${pedido.chave}-resposta`, autor: 'Valéria', texto: resposta.data.texto }]);
      if (resposta.data.estado !== 'PENDENTE') { setPendente(null); setMensagem(''); }
      setTentativa(v => v + 1);
    } catch (e) {
      if (!controller.signal.aborted) {
        setErroEnvio(e instanceof Error ? e.message : 'Não foi possível enviar a mensagem.');
        if (isAxiosError(e) && [400, 403, 409, 429].includes(e.response?.status ?? 0)) {
          setPendente(null);
          setHistorico(atual => atual.filter(item => item.id !== pedido.chave));
          setTentativa(v => v + 1);
        }
      }
    } finally {
      if (!controller.signal.aborted) setEnviando(false);
    }
  }

  return <>
    <div className="ia-acesso">
      <button ref={botao} type="button" className="ia-balao" onClick={abrir} aria-haspopup="dialog" aria-label="Valéria, assistente de IA">
        {avatarUrl ? <img src={avatarUrl} className="ia-avatar" alt="" /> : <ChatCircleDots size={24} weight="regular" aria-hidden="true" />} Valéria
      </button>
    </div>
    <dialog ref={dialogo} className="ia-painel" aria-labelledby="ia-titulo"
      onClose={() => { setAberto(false); botao.current?.focus(); }}>
      <div className="ia-cabecalho">
        <div className="ia-identidade"><img src={avatarUrl} className="ia-avatar" alt="" /><div><h2 id="ia-titulo">Valéria</h2><p>Assistente de IA</p></div></div>
        <button type="button" onClick={fechar} aria-label="Fechar Valéria, assistente de IA"><X size={24} /></button>
      </div>
      <div className="ia-conteudo" aria-busy={carregando}>
        {carregando && <div role="status" aria-label="Carregando saldo da assistente">
          <div className="ia-skeleton" /><div className="ia-skeleton" /><div className="ia-skeleton" />
        </div>}
        {erro && <div role="alert"><p>{erro}</p><button type="button" onClick={() => setTentativa(v => v + 1)}>Tentar novamente</button></div>}
        {status && <>
          <section aria-label="Saldo de IA" className="ia-saldo">
            <p>Mensagens por mês: <span>{status.mensagensMensais ?? 'A definir'}</span></p>
            <p>Mensagens restantes: <span>{status.mensagensRestantes ?? 'Ainda não disponível'}</span></p>
            <p>Créditos disponíveis: <span>{status.creditosRestantes ?? 'Ainda não disponível'}</span></p>
            <p>Créditos por mês: <span>{status.creditosMensais ?? 'A definir'}</span></p>
            <p>{status.vozNoPlano ? `Voz: ${status.vozSegundosRestantes === null ? 'saldo ainda não disponível' : `${Math.floor(status.vozSegundosRestantes / 60)} min disponíveis`} (limite mensal de 30 min)` : 'Voz ao vivo exclusiva do plano Pro.'}</p>
            <p>O saldo é compartilhado por toda a barbearia.</p>
            <p>Renovação junto à mensalidade, sem acúmulo.</p>
            {status.renovaEm && <p>Fim do período: {new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short' }).format(new Date(status.renovaEm))}</p>}
          </section>
          <p role="status">{status.mensagem}</p>
          {historico.length === 0 && <p>{status.textoDisponivel ? 'Olá! Sou a Valéria, assistente de IA do Valen Barber. Como posso ajudar?' : 'A conversa aparecerá aqui quando a assistente estiver disponível.'}</p>}
        </>}
        <div aria-live="polite" aria-label="Conversa com Valéria, assistente de IA">
          {(historico ?? []).map(item => <div key={item.id} className="ia-mensagem"><strong>{item.autor}</strong><p>{item.texto}</p></div>)}
        </div>
      </div>
      <form className="ia-compositor" onSubmit={enviar}>
        <label htmlFor="ia-mensagem">Mensagem para Valéria</label>
        <textarea id="ia-mensagem" value={mensagem} onChange={e => setMensagem(e.target.value)} maxLength={4000}
          disabled={!status?.textoDisponivel || enviando || Boolean(pendente)} placeholder={status?.textoDisponivel ? 'Escreva sua mensagem' : 'Aguardando liberação da assistente'} rows={2} />
        {erroEnvio && <p role="alert">{erroEnvio}</p>}
        <div className="ia-acoes">
          <button type="button" disabled><Microphone size={20} /> Voz ao vivo</button>
          <button type="submit" disabled={enviando || (!pendente && (!status?.textoDisponivel || !mensagem.trim()))}>
            <PaperPlaneTilt size={20} /> {enviando ? 'Aguarde…' : pendente ? 'Consultar pedido' : 'Enviar'}
          </button>
        </div>
        {pendente && !enviando && <p>Consultar reutiliza o mesmo pedido, sem gerar outra resposta paga.</p>}
      </form>
    </dialog>
  </>;
}
