import { useEffect, useRef, useState } from 'react';
import { ChatCircleDots, CircleNotch, Waveform, PaperPlaneTilt, X } from '@phosphor-icons/react';
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

export function AssistenteIa(props: { api: AxiosInstance; caminho: string; avatarUrl?: string; posicao?: 'padrao' | 'navegacao' | 'cliente' | 'agendamento' | 'chat' }) {
  return <ErrorBoundary fallback={<p role="alert">Não foi possível abrir a assistente. Recarregue a página para tentar novamente.</p>}>
    <PainelAssistente key={props.caminho} {...props} />
  </ErrorBoundary>;
}

function PainelAssistente({ api, caminho, avatarUrl = avatarValeria, posicao = 'padrao' }: { api: AxiosInstance; caminho: string; avatarUrl?: string; posicao?: 'padrao' | 'navegacao' | 'cliente' | 'agendamento' | 'chat' }) {
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
  const envioEmCurso = useRef(false);
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
    if (envioEmCurso.current || enviando || (!pendente && (!status?.textoDisponivel || !mensagem.trim()))) return;
    envioEmCurso.current = true;
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
      envioEmCurso.current = false;
      if (!controller.signal.aborted) setEnviando(false);
    }
  }

  return <>
    <div className={`ia-acesso ia-acesso--${posicao}`}>
      <button ref={botao} type="button" className="ia-balao" onClick={abrir} aria-haspopup="dialog" aria-label="Valéria, assistente de IA">
        {avatarUrl ? <img src={avatarUrl} className="ia-avatar" alt="" /> : <ChatCircleDots size={24} weight="regular" aria-hidden="true" />}
      </button>
    </div>
    <dialog ref={dialogo} className="ia-painel" aria-labelledby="ia-titulo"
      onClose={() => { setAberto(false); botao.current?.focus(); }}>
      <div className="ia-cabecalho">
        <div className="ia-identidade"><img src={avatarUrl} className="ia-avatar" alt="" /><div><h2 id="ia-titulo">Valéria</h2></div></div>
        <button type="button" onClick={fechar} aria-label="Fechar Valéria, assistente de IA"><X size={24} /></button>
      </div>
      <div className="ia-conteudo" aria-busy={carregando}>
        {carregando && <div role="status" aria-label="Carregando saldo da assistente">
          <div className="ia-skeleton" /><div className="ia-skeleton" /><div className="ia-skeleton" />
        </div>}
        {erro && <div role="alert"><p>{erro}</p><button type="button" onClick={() => setTentativa(v => v + 1)}>Tentar novamente</button></div>}
        {status && <>
          {!status.textoDisponivel && <p role="status">{status.mensagem}</p>}
          {historico.length === 0 && <p>{status.textoDisponivel ? 'Olá! Como posso ajudar?' : 'A conversa aparecerá aqui quando a assistente estiver disponível.'}</p>}
        </>}
        <div aria-live="polite" aria-label="Conversa com Valéria, assistente de IA">
          {(historico ?? []).map(item => <div key={item.id} className={`ia-mensagem ia-mensagem--${item.autor === 'Você' ? 'usuario' : 'valeria'}`} aria-label={item.autor}><p>{item.texto}</p></div>)}
        </div>
      </div>
      <form className="ia-compositor" onSubmit={enviar}>
        <label className="ia-label-acessivel" htmlFor="ia-mensagem">Mensagem para Valéria</label>
        <div className="ia-campo-envio">
        <textarea id="ia-mensagem" value={mensagem} onChange={e => setMensagem(e.target.value)} maxLength={4000}
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing && e.keyCode !== 229) {
              e.preventDefault();
              e.currentTarget.form?.requestSubmit();
            }
          }}
          disabled={!status?.textoDisponivel || enviando || Boolean(pendente)} placeholder={status?.textoDisponivel ? 'Escreva sua mensagem' : 'Aguardando liberação da assistente'} rows={Math.min(4, mensagem.split('\n').length)} />
        <div className="ia-controles-envio">
        <button className="ia-voz" type="button" disabled={!status?.vozDisponivel || !status.vozNoPlano || (status.vozSegundosRestantes ?? 0) <= 0 || enviando}
          aria-label="Conversa por voz indisponível"
          title={!status?.vozNoPlano ? 'Conversa por voz exclusiva do plano Pro' : 'Conversa por voz ainda indisponível'}>
          <Waveform size={24} weight="regular" aria-hidden="true" />
        </button>
        <button className="ia-enviar" type="submit" aria-label={enviando ? 'Enviando mensagem' : pendente ? 'Consultar pedido' : 'Enviar mensagem'}
          disabled={enviando || (!pendente && (!status?.textoDisponivel || !mensagem.trim()))}>
          {enviando ? <CircleNotch className="ia-enviando" size={24} aria-hidden="true" /> : <PaperPlaneTilt size={24} aria-hidden="true" />}
        </button>
        </div>
        </div>
        {erroEnvio && <p role="alert">{erroEnvio}</p>}
        {pendente && !enviando && <p>Consultar reutiliza o mesmo pedido, sem gerar outra resposta paga.</p>}
      </form>
    </dialog>
  </>;
}
