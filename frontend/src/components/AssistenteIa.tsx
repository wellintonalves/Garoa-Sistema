import { useEffect, useRef, useState } from 'react';
import { ChatCircleDots, Microphone, PaperPlaneTilt, X } from '@phosphor-icons/react';
import type { AxiosInstance } from 'axios';
import { ErrorBoundary } from './ErrorBoundary';
import './AssistenteIa.css';

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
}

export function AssistenteIa(props: { api: AxiosInstance; caminho: string; avatarUrl?: string }) {
  return <ErrorBoundary fallback={<p role="alert">Não foi possível abrir a assistente. Recarregue a página para tentar novamente.</p>}>
    <PainelAssistente key={props.caminho} {...props} />
  </ErrorBoundary>;
}

function PainelAssistente({ api, caminho, avatarUrl }: { api: AxiosInstance; caminho: string; avatarUrl?: string }) {
  const dialogo = useRef<HTMLDialogElement>(null);
  const botao = useRef<HTMLButtonElement>(null);
  const [aberto, setAberto] = useState(false);
  const [tentativa, setTentativa] = useState(0);
  const [status, setStatus] = useState<StatusIa | null>(null);
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(false);

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

  return <>
    <div className="ia-acesso">
      <button ref={botao} type="button" className="ia-balao" onClick={abrir} aria-haspopup="dialog">
        {avatarUrl ? <img src={avatarUrl} className="ia-avatar" alt="" /> : <ChatCircleDots size={24} weight="regular" aria-hidden="true" />} Assistente IA
      </button>
    </div>
    <dialog ref={dialogo} className="ia-painel" aria-labelledby="ia-titulo"
      onClose={() => { setAberto(false); botao.current?.focus(); }}>
      <div className="ia-cabecalho">
        <h2 id="ia-titulo">Assistente IA</h2>
        <button type="button" onClick={fechar} aria-label="Fechar assistente"><X size={24} /></button>
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
          </section>
          <p role="status">{status.mensagem}</p>
          <p>A conversa aparecerá aqui quando a assistente estiver disponível.</p>
        </>}
      </div>
      <div className="ia-compositor">
        <label htmlFor="ia-mensagem">Mensagem para a assistente</label>
        <textarea id="ia-mensagem" disabled placeholder="Aguardando liberação da assistente" rows={2} />
        <div className="ia-acoes">
          <button type="button" disabled><Microphone size={20} /> Voz ao vivo</button>
          <button type="button" disabled><PaperPlaneTilt size={20} /> Enviar</button>
        </div>
      </div>
    </dialog>
  </>;
}
