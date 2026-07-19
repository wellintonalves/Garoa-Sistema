import { useState, useEffect, useRef, useCallback, FormEvent } from 'react';
import { useOutletContext, useParams, useNavigate } from 'react-router-dom';
import { Send, Volume2, VolumeX, Check, CheckCheck, ChevronLeft } from 'lucide-react';
import clienteApi from '../../../api/clienteApi';
import { useChatSounds } from '../../../hooks/useChatSounds';

interface Mensagem {
  id: string;
  texto: string;
  remetente: 'CLIENTE' | 'ADMIN';
  lida: boolean;
  createdAt: string;
}

interface ChatResponse {
  mensagens: Mensagem[];
  outroDigitando: boolean;
}

interface BarbeariaCtx {
  barbearia: { id: string; nome: string; logo: string | null } | null;
}

export function ClienteBarbeariaChat() {
  const { barbearia } = useOutletContext<BarbeariaCtx>();
  const { barbeariaId } = useParams<{ barbeariaId: string }>();
  const navigate = useNavigate();
  
  const [mensagens, setMensagens] = useState<Mensagem[]>([]);
  const [adminDigitando, setAdminDigitando] = useState(false);
  const [texto, setTexto] = useState('');
  const [enviando, setEnviando] = useState(false);
  
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const { isMuted, toggleMute, playSent, playReceived, initAudio } = useChatSounds();
  
  // Utiliza um Set para rastrear IDs conhecidos de mensagens e evitar tocar som duplicado
  const msgIdsConhecidos = useRef<Set<string>>(new Set());
  const lastTypingTime = useRef<number>(0);

  const fetchMensagens = useCallback(async () => {
    if (!barbeariaId) return;
    try {
      const res = await clienteApi.get<ChatResponse>(`/cliente/barbearia/${barbeariaId}/chat`);
      
      setAdminDigitando(res.data.outroDigitando);
      const novasMensagens = res.data.mensagens;

      let temNovaDoAdmin = false;
      novasMensagens.forEach(msg => {
        if (!msgIdsConhecidos.current.has(msg.id)) {
          msgIdsConhecidos.current.add(msg.id);
          if (msg.remetente === 'ADMIN') {
            temNovaDoAdmin = true;
          }
        }
      });

      if (temNovaDoAdmin) {
        playReceived();
      }
      
      setMensagens(novasMensagens);
    } catch {
      // silencioso
    }
  }, [barbeariaId, playReceived]);

  useEffect(() => {
    fetchMensagens();
    const interval = setInterval(fetchMensagens, 3000);
    return () => clearInterval(interval);
  }, [fetchMensagens]);

  const scrollToBottom = () => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [mensagens, adminDigitando]);

  const handleTyping = (val: string) => {
    setTexto(val);
    if (!barbeariaId) return;
    
    const now = Date.now();
    if (now - lastTypingTime.current > 2000) {
      lastTypingTime.current = now;
      clienteApi.post(`/cliente/barbearia/${barbeariaId}/chat/digitando`).catch(() => {});
    }
  };

  async function enviar(e?: FormEvent) {
    if (e) e.preventDefault();
    initAudio();
    
    const textoEnviar = texto.trim();
    if (!textoEnviar || enviando || !barbeariaId) return;
    
    setEnviando(true);
    setTexto('');
    
    try {
      const res = await clienteApi.post<Mensagem>(`/cliente/barbearia/${barbeariaId}/chat`, { texto: textoEnviar });
      
      const nova = res.data;
      msgIdsConhecidos.current.add(nova.id);
      
      setMensagens(prev => [...prev, nova]);
      playSent();
      
      setTimeout(scrollToBottom, 50);
    } catch {
      setTexto(textoEnviar);
    } finally {
      setEnviando(false);
      inputRef.current?.focus();
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      enviar();
    }
  }

  function formatarDataSeparador(iso: string) {
    const d = new Date(iso);
    const hoje = new Date();
    if (d.toDateString() === hoje.toDateString()) return 'Hoje';
    const ontem = new Date();
    ontem.setDate(ontem.getDate() - 1);
    if (d.toDateString() === ontem.toDateString()) return 'Ontem';
    return d.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long' });
  }

  const grupos: { data: string; itens: Mensagem[] }[] = [];
  for (const m of mensagens) {
    const label = formatarDataSeparador(m.createdAt);
    const ultimo = grupos[grupos.length - 1];
    if (ultimo && ultimo.data === label) {
      ultimo.itens.push(m);
    } else {
      grupos.push({ data: label, itens: [m] });
    }
  }

  const iniciais = (nome?: string) =>
    (nome || 'B').split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

  return (
    <div className="absolute inset-0 z-[60] flex flex-col bg-[var(--fundo-pagina)]">
      <style>{`
        @media (prefers-reduced-motion: no-preference) {
          .msg-enter-sent { animation: popSent 180ms ease-out forwards; }
          .msg-enter-received { animation: popReceived 200ms ease-out forwards; }
          @keyframes popSent {
            0% { opacity: 0; transform: translateY(8px) scale(0.98); }
            100% { opacity: 1; transform: translateY(0) scale(1); }
          }
          @keyframes popReceived {
            0% { opacity: 0; transform: translateX(-8px); }
            100% { opacity: 1; transform: translateX(0); }
          }
        }
        .chat-btn:active:not(:disabled) {
          transform: scale(0.92);
          transition: transform 0.1s ease-out;
        }
        textarea::-webkit-scrollbar { width: 6px; }
        textarea::-webkit-scrollbar-track { background: transparent; }
        textarea::-webkit-scrollbar-thumb { background: var(--borda); border-radius: 4px; }
      `}</style>

      {/* Header */}
      <div className="flex items-center justify-between px-3 md:px-5 py-3 md:py-4 border-b flex-shrink-0" style={{ borderColor: 'var(--borda)', background: 'var(--fundo-card)' }}>
        <div className="flex items-center gap-2 md:gap-3">
          <button
            className="md:hidden p-2 -ml-2 rounded-full transition-colors chat-btn"
            onClick={(e) => {
              e.preventDefault();
              navigate(-1);
            }}
            style={{ color: 'var(--texto-secundario)' }}
            aria-label="Voltar"
          >
            <ChevronLeft size={24} />
          </button>
          
          <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 font-sans text-[13px] font-semibold"
            style={{ background: 'rgba(var(--cor-primaria-rgb), 0.15)', color: 'var(--cor-primaria)' }}>
            {barbearia?.logo ? (
              <img src={barbearia.logo} alt="Logo" className="w-full h-full object-cover rounded-full" />
            ) : (
              iniciais(barbearia?.nome)
            )}
          </div>
          <div className="flex flex-col justify-center max-w-[180px] md:max-w-none">
            <p className="font-sans text-[14px] md:text-[15px] font-medium leading-tight truncate" style={{ color: 'var(--texto-principal)' }}>
              {barbearia?.nome || 'Barbearia'}
            </p>
            <p className="font-sans text-[11px] mt-0.5" style={{ color: adminDigitando ? 'var(--cor-primaria)' : 'var(--texto-secundario)' }}>
              {adminDigitando ? <span className="italic">digitando...</span> : 'Atendimento'}
            </p>
          </div>
        </div>
        
        <button 
          onClick={toggleMute}
          className="p-2 rounded-full transition-colors hover:bg-black/5 dark:hover:bg-white/5 chat-btn"
          style={{ color: 'var(--texto-secundario)' }}
          title={isMuted ? "Ativar som" : "Desativar som"}
        >
          {isMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
        </button>
      </div>

      {/* Mensagens */}
      <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-6 flex flex-col gap-1 pb-[env(safe-area-inset-bottom)]">
        {mensagens.length === 0 && !enviando && (
          <div className="flex flex-col items-center justify-center flex-1 gap-3 text-center opacity-60">
            <div className="w-16 h-16 rounded-full flex items-center justify-center mb-2" style={{ background: 'rgba(var(--texto-secundario-rgb), 0.1)' }}>
              <div className="w-8 h-8 rounded-full flex items-center justify-center font-sans font-semibold" style={{ background: 'var(--cor-primaria)', color: '#111827' }}>
                {iniciais(barbearia?.nome)}
              </div>
            </div>
            <p className="font-sans text-[13px]" style={{ color: 'var(--texto-secundario)' }}>
              Envie uma mensagem para falar conosco.
            </p>
          </div>
        )}

        {grupos.map((grupo) => (
          <div key={grupo.data}>
            <div className="flex items-center gap-3 my-6">
              <div className="flex-1 h-px" style={{ background: 'var(--borda)' }} />
              <span className="font-sans text-[11px] font-medium uppercase tracking-wider px-3 py-1 rounded-full bg-[var(--fundo-card)] border" style={{ color: 'var(--texto-secundario)', borderColor: 'var(--borda)' }}>
                {grupo.data}
              </span>
              <div className="flex-1 h-px" style={{ background: 'var(--borda)' }} />
            </div>

            {grupo.itens.map((m, index) => {
              const isCliente = m.remetente === 'CLIENTE';
              const nextMsg = grupo.itens[index + 1];
              const isLastInGroup = !nextMsg || nextMsg.remetente !== m.remetente;
              const marginBottom = isLastInGroup ? 'mb-4' : 'mb-1';
              const borderRadius = isCliente 
                  ? (isLastInGroup ? 'rounded-2xl rounded-tr-sm' : 'rounded-2xl')
                  : (isLastInGroup ? 'rounded-2xl rounded-tl-sm' : 'rounded-2xl');

              return (
                <div
                  key={m.id}
                  className={`flex ${marginBottom} ${isCliente ? 'justify-end' : 'justify-start'} ${isCliente ? 'msg-enter-sent' : 'msg-enter-received'}`}
                >
                  <div
                    className={`max-w-[75%] md:max-w-[65%] px-3.5 py-2.5 ${borderRadius} shadow-sm relative`}
                    style={
                      isCliente
                        ? { background: 'var(--cor-primaria)', color: '#111827' }
                        : { background: 'var(--fundo-card)', border: '1px solid var(--borda)', color: 'var(--texto-principal)' }
                    }
                  >
                    <p className="font-sans text-[14px] leading-relaxed whitespace-pre-wrap break-words pr-1">
                      {m.texto}
                    </p>
                    <div className="flex items-center justify-end gap-1 mt-1 font-['JetBrains_Mono'] text-[10px]">
                      <span style={{ color: isCliente ? 'rgba(0,0,0,0.6)' : 'var(--texto-secundario)' }}>
                        {new Date(m.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      {isCliente && (
                        <span className="flex items-center">
                          {m.lida ? (
                            <CheckCheck size={14} className="text-blue-600" />
                          ) : (
                            <Check size={14} style={{ color: 'rgba(0,0,0,0.5)' }} />
                          )}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ))}
        <div ref={bottomRef} className="h-2" />
      </div>

      {/* Input */}
      <form
        onSubmit={enviar}
        className="flex items-end gap-2 md:gap-3 px-3 md:px-4 py-3 md:py-4 border-t flex-shrink-0 pb-[calc(env(safe-area-inset-bottom)+12px)] md:pb-4"
        style={{ borderColor: 'var(--borda)', background: 'var(--fundo-card)' }}
      >
        <textarea
          ref={inputRef}
          value={texto}
          onChange={e => handleTyping(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Mensagem"
          disabled={enviando}
          rows={1}
          className="flex-1 rounded-2xl px-4 py-3 outline-none resize-none overflow-y-auto"
          style={{
            background: 'var(--fundo-pagina)',
            border: '1px solid var(--borda)',
            color: 'var(--texto-principal)',
            fontFamily: 'var(--fonte-interface)',
            fontSize: '15px',
            minHeight: '48px',
            maxHeight: '120px',
            lineHeight: '1.4'
          }}
          onInput={(e) => {
            const target = e.target as HTMLTextAreaElement;
            target.style.height = 'auto';
            target.style.height = Math.min(target.scrollHeight, 120) + 'px';
          }}
        />
        <button
          type="submit"
          disabled={!texto.trim() || enviando}
          className="w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 transition-all chat-btn disabled:opacity-50 disabled:scale-100"
          style={{
            background: 'var(--cor-primaria)',
            color: '#111827',
            cursor: (!texto.trim() || enviando) ? 'not-allowed' : 'pointer',
            border: 'none',
          }}
          aria-label="Enviar mensagem"
        >
          {enviando ? (
            <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          ) : (
            <Send size={20} strokeWidth={2} style={{ marginLeft: '2px' }} />
          )}
        </button>
      </form>
    </div>
  );
}
