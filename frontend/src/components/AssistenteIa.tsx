import { useEffect, useRef, useState } from 'react';
import { ChatCircleDots, Waveform, PaperPlaneTilt, X } from '@phosphor-icons/react';
import type { AxiosInstance } from 'axios';
import { isAxiosError } from 'axios';
import { ErrorBoundary } from './ErrorBoundary';
import './AssistenteIa.css';
import avatarValeria from '../assets/valeria.png';
import { useVozValeria } from './useVozValeria';
import { LancamentoValeria } from './LancamentoValeria';

const horaMensagem = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' });

interface StatusIa {
  mensagem: string;
  textoDisponivel: boolean;
  vozDisponivel: boolean;
  vozOcupada?: boolean;
  vozIndisponivelMotivo?: string;
  vozNoPlano: boolean;
  creditosMensais: number | null;
  creditosRestantes: number | null;
  mensagensMensais: number | null;
  mensagensRestantes: number | null;
  vozSegundosRestantes: number | null;
  renovaEm?: string | null;
  vozTeste?: { segundos: number; reservaUsd: number };
  vozLimiteSegundos?: number;
}

export function AssistenteIa(props: { api: AxiosInstance; caminho: string; identidade?: string; avatarUrl?: string; posicao?: 'padrao' | 'navegacao' | 'cliente' | 'agendamento' | 'chat' }) {
  return <ErrorBoundary fallback={<p role="alert">Não foi possível abrir a assistente. Recarregue a página para tentar novamente.</p>}>
    <PainelAssistente key={props.caminho} {...props} />
  </ErrorBoundary>;
}

function PainelAssistente({ api, caminho, identidade, avatarUrl = avatarValeria, posicao = 'padrao' }: { api: AxiosInstance; caminho: string; identidade?: string; avatarUrl?: string; posicao?: 'padrao' | 'navegacao' | 'cliente' | 'agendamento' | 'chat' }) {
  const dialogo = useRef<HTMLDialogElement>(null);
  const botao = useRef<HTMLButtonElement>(null);
  const conteudo = useRef<HTMLDivElement>(null);
  const [aberto, setAberto] = useState(false);
  const [tentativa, setTentativa] = useState(0);
  const [status, setStatus] = useState<StatusIa | null>(null);
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(false);
  const [mensagem, setMensagem] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [animarIndicador, setAnimarIndicador] = useState(true);
  const [erroEnvio, setErroEnvio] = useState('');
  const [historico, setHistorico] = useState<{ id: string; autor: string; texto: string; enviadaEm?: string }[]>([]);
  const [conversaId] = useState(() => crypto.randomUUID());
  const [mostrarVoz, setMostrarVoz] = useState(false);
  const voz = useVozValeria(api, caminho, conversaId, texto => {
    setHistorico(h => [...h, { id: crypto.randomUUID(), autor: 'Valéria', texto, enviadaEm: new Date(Date.now()).toISOString() }]);
  }, () => setTentativa(v => v + 1));
  const [pendente, setPendente] = useState<{ chave: string; mensagem: string; enviadaEm: string } | null>(null);
  const envioEmCurso = useRef(false);
  const envioAtual = useRef<AbortController | null>(null);
  useEffect(() => () => envioAtual.current?.abort(), []);
  useEffect(() => {
    if (aberto && conteudo.current) conteudo.current.scrollTop = conteudo.current.scrollHeight;
  }, [aberto, historico, enviando]);

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

  useEffect(() => {
    if (!aberto || voz.ativa || !status?.vozOcupada) return;
    const timer = window.setTimeout(() => setTentativa(v => v + 1), 1500);
    return () => window.clearTimeout(timer);
  }, [aberto, voz.ativa, status]);

  function abrir() { dialogo.current?.showModal(); setAberto(true); }
  function fechar() { dialogo.current?.close(); }

  async function enviar(evento: React.FormEvent) {
    evento.preventDefault();
    if (voz.ativa || envioEmCurso.current || enviando || (!pendente && (!status?.textoDisponivel || !mensagem.trim()))) return;
    envioEmCurso.current = true;
    const pedido = pendente ?? { chave: crypto.randomUUID(), mensagem: mensagem.trim(), enviadaEm: new Date(Date.now()).toISOString() };
    const controller = new AbortController();
    envioAtual.current = controller;
    setEnviando(true);
    setErroEnvio('');
    setPendente(pedido);
    if (!pendente) setHistorico(atual => [...atual, { id: pedido.chave, autor: 'Você', texto: pedido.mensagem, enviadaEm: pedido.enviadaEm }]);
    try {
      const resposta = await api.post<{ estado: string; texto: string }>(`${caminho}/mensagens`, { mensagem: pedido.mensagem, conversaId }, {
        headers: { 'Idempotency-Key': pedido.chave }, signal: controller.signal, timeout: 40_000,
      });
      if (controller.signal.aborted) return;
      const recebidaEm = new Date(Date.now()).toISOString();
      setHistorico(atual => {
        const anterior = atual.find(item => item.id === `${pedido.chave}-resposta`);
        return [...atual.filter(item => item.id !== `${pedido.chave}-resposta`),
          { id: `${pedido.chave}-resposta`, autor: 'Valéria', texto: resposta.data.texto,
            enviadaEm: anterior?.texto === resposta.data.texto ? anterior.enviadaEm : recebidaEm }];
      });
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
      if (envioAtual.current === controller) {
        envioEmCurso.current = false;
        envioAtual.current = null;
        if (!controller.signal.aborted) setEnviando(false);
      }
    }
  }

  return <>
    <div className={`ia-acesso ia-acesso--${posicao}`}>
      <button ref={botao} type="button" className="ia-balao" onClick={abrir} aria-haspopup="dialog" aria-label="Valéria, assistente de IA">
        {avatarUrl ? <img src={avatarUrl} className="ia-avatar" alt="" /> : <ChatCircleDots size={24} weight="regular" aria-hidden="true" />}
      </button>
      {identidade && <LancamentoValeria api={api} caminho={caminho} identidade={identidade} botao={botao} chatAberto={aberto} abrirChat={abrir} />}
    </div>
    <dialog ref={dialogo} className="ia-painel" aria-labelledby="ia-titulo"
      onClose={() => {
        voz.parar(); setMostrarVoz(false);
        envioAtual.current?.abort(); envioAtual.current = null; envioEmCurso.current = false;
        setEnviando(false); setAberto(false); botao.current?.focus();
      }}>
      <div className="ia-cabecalho">
        <div className="ia-identidade"><img src={avatarUrl} className="ia-avatar" alt="" /><div><h2 id="ia-titulo">Valéria</h2></div></div>
        <button type="button" onClick={fechar} aria-label="Fechar Valéria, assistente de IA"><X size={24} /></button>
      </div>
      {mostrarVoz && <div className={`ia-voz-flutuante${voz.ativa ? ' ia-voz-flutuante--ativa' : ''}`}>
        <div className="ia-nuvem" aria-hidden="true"><span /><span /><span /></div>
        <p role="status" aria-live="polite">{voz.estado || (voz.erro ? 'Não foi possível iniciar a conversa' : 'Conversa encerrada')}</p>
        {voz.erro && <p role="alert">{voz.erro}</p>}
        {!voz.ativa && voz.erro && <button type="button" disabled={!status?.vozDisponivel} onClick={() => void voz.iniciar()}>Tentar novamente</button>}
        <button type="button" onClick={() => { voz.parar(); setMostrarVoz(false); }}> {voz.ativa ? 'Encerrar conversa' : 'Voltar à conversa'} </button>
        <p className="ia-aviso">{status?.vozTeste ? `Teste de até ${status.vozTeste.segundos} segundos, com reserva máxima de US$ 0,09.` : `Chamada de até ${status?.vozLimiteSegundos ?? 90} segundos, conforme saldo e franquia disponíveis.`}</p>
        <p className="ia-aviso">Valéria é uma IA e pode cometer erros.</p>
      </div>}
      <div ref={conteudo} className="ia-conteudo" hidden={mostrarVoz} aria-busy={carregando}>
        {carregando && <div role="status" aria-label="Carregando saldo da assistente">
          <div className="ia-skeleton" /><div className="ia-skeleton" /><div className="ia-skeleton" />
        </div>}
        {erro && <div role="alert"><p>{erro}</p><button type="button" onClick={() => setTentativa(v => v + 1)}>Tentar novamente</button></div>}
        {status && <>
          {!status.textoDisponivel && <p role="status">{status.mensagem}</p>}
          {!status.vozDisponivel && status.vozIndisponivelMotivo && <p role="status">{status.vozIndisponivelMotivo}</p>}
          {historico.length === 0 && <p>{status.textoDisponivel ? 'Olá! Como posso ajudar?' : 'A conversa aparecerá aqui quando a assistente estiver disponível.'}</p>}
        </>}
        <div aria-live="polite" aria-label="Conversa com Valéria, assistente de IA">
          {(historico ?? []).map(item => <div key={item.id} className={`ia-mensagem ia-mensagem--${item.autor === 'Você' ? 'usuario' : 'valeria'}`} aria-label={item.autor}>
            <p>{item.texto}</p>
            {item.enviadaEm && <time className="ia-hora" dateTime={item.enviadaEm}>{horaMensagem.format(new Date(item.enviadaEm))}</time>}
          </div>)}
        </div>
        {enviando && <div className={`ia-mensagem ia-mensagem--valeria ia-digitando${animarIndicador ? '' : ' ia-digitando--pausada'}`}>
          <span className="ia-label-acessivel" role="status" aria-atomic="true">Valéria está respondendo</span>
          <span className="ia-bolinhas" aria-hidden="true"><span /><span /><span /></span>
          <button className="ia-digitando-controle" type="button" onClick={() => setAnimarIndicador(v => !v)}
            aria-label={animarIndicador ? 'Pausar animação de resposta' : 'Animar indicador de resposta'}
            title={animarIndicador ? 'Pausar animação' : 'Animar indicador'} />
        </div>}
      </div>
      <form className="ia-compositor" onSubmit={enviar} hidden={mostrarVoz}>
        <label className="ia-label-acessivel" htmlFor="ia-mensagem">Mensagem para Valéria</label>
        <div className="ia-campo-envio">
        <textarea id="ia-mensagem" value={mensagem} onChange={e => setMensagem(e.target.value)} maxLength={4000}
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing && e.keyCode !== 229) {
              e.preventDefault();
              e.currentTarget.form?.requestSubmit();
            }
          }}
          disabled={voz.ativa || !status?.textoDisponivel || enviando || Boolean(pendente)}
          placeholder={carregando ? 'Consultando disponibilidade…' : erro ? 'Falha na conexão. Tente novamente.' : status?.textoDisponivel ? 'Escreva sua mensagem' : 'Assistente indisponível. Confira o aviso acima.'}
          rows={Math.min(4, mensagem.split('\n').length)} />
        <div className="ia-controles-envio">
        <button className="ia-voz" type="button" disabled={voz.ativa || !status?.vozDisponivel || !status.vozNoPlano || (status.vozSegundosRestantes ?? 0) <= 0 || enviando || Boolean(pendente)}
          onClick={() => { setMostrarVoz(true); void voz.iniciar(); }}
          aria-label={status?.vozDisponivel ? 'Conversar por voz com Valéria' : 'Conversa por voz indisponível'}
          title={!status?.vozNoPlano ? 'Conversa por voz exclusiva do plano Pro' : status.vozDisponivel ? 'Conversar por voz' : status.vozIndisponivelMotivo ?? 'Conversa por voz indisponível. Confira o saldo e a franquia.'}>
          <Waveform size={24} weight="regular" aria-hidden="true" />
        </button>
        <button className="ia-enviar" type="submit" aria-label={enviando ? 'Enviando mensagem' : pendente ? 'Consultar pedido' : 'Enviar mensagem'}
          disabled={voz.ativa || enviando || (!pendente && (!status?.textoDisponivel || !mensagem.trim()))}>
          <PaperPlaneTilt size={24} aria-hidden="true" />
        </button>
        </div>
        </div>
        <p className="ia-aviso">Valéria é uma IA e pode cometer erros.</p>
        {erroEnvio && <p role="alert">{erroEnvio}</p>}
        {pendente && !enviando && <p>Consultar reutiliza o mesmo pedido, sem gerar outra resposta paga.</p>}
      </form>
    </dialog>
  </>;
}
