import { useState, useEffect, useRef, useCallback, FormEvent } from 'react';
import { MessageCircle, Send, Search, Volume2, VolumeX } from 'lucide-react';
import api from '../../api/client';
import { useChatSounds } from '../../hooks/useChatSounds';

interface Conversa {
  clienteId: string;
  clienteNome: string;
  clienteEmail: string;
  ultimaMensagem: string;
  ultimaAt: string;
  ultimoRemetente: 'CLIENTE' | 'ADMIN';
  naoLidas: number;
}

interface Mensagem {
  id: string;
  texto: string;
  remetente: 'CLIENTE' | 'ADMIN';
  lida: boolean;
  createdAt: string;
}

export function AdminChat() {
  const [conversas, setConversas] = useState<Conversa[]>([]);
  const [clienteSelecionado, setClienteSelecionado] = useState<{ id: string; nome: string } | null>(null);
  const [mensagens, setMensagens] = useState<Mensagem[]>([]);
  const [texto, setTexto] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [busca, setBusca] = useState('');
  
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const { isMuted, toggleMute, playSent, playReceived, initAudio } = useChatSounds();
  const mensagensRef = useRef<Mensagem[]>([]); // Para checar mensagens novas e tocar som

  // Busca lista de conversas
  const fetchConversas = useCallback(async () => {
    try {
      const res = await api.get<Conversa[]>('/chat/conversas');
      setConversas(res.data);
    } catch {
      // silencioso
    }
  }, []);

  // Busca mensagens do cliente selecionado
  const fetchMensagens = useCallback(async (clienteId?: string) => {
    const targetId = clienteId || clienteSelecionado?.id;
    if (!targetId) return;
    try {
      const res = await api.get<Mensagem[]>(`/chat/conversas/${targetId}`);
      
      // Checa se há mensagens novas recebidas para tocar o som
      if (mensagensRef.current.length > 0 && res.data.length > mensagensRef.current.length) {
        const ultimaNova = res.data[res.data.length - 1];
        if (ultimaNova.remetente === 'CLIENTE') {
          playReceived();
        }
      }
      
      setMensagens(res.data);
      mensagensRef.current = res.data;

      // Atualiza contagem de não lidas na lista
      setConversas(prev =>
        prev.map(c => c.clienteId === targetId ? { ...c, naoLidas: 0 } : c)
      );
    } catch {
      // silencioso
    }
  }, [clienteSelecionado, playReceived]);

  // Polling conversas (a cada 5s)
  useEffect(() => {
    fetchConversas();
    const interval = setInterval(fetchConversas, 5000);
    return () => clearInterval(interval);
  }, [fetchConversas]);

  // Polling mensagens do cliente selecionado (a cada 3s)
  useEffect(() => {
    if (!clienteSelecionado) {
      mensagensRef.current = [];
      return;
    }
    fetchMensagens();
    const interval = setInterval(fetchMensagens, 3000);
    return () => clearInterval(interval);
  }, [fetchMensagens, clienteSelecionado]);

  // Scroll para o fim
  const scrollToBottom = () => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [mensagens]);

  async function enviar(e?: FormEvent) {
    if (e) e.preventDefault();
    initAudio(); // Garante inicialização no clique/enter
    
    const textoEnviar = texto.trim();
    if (!textoEnviar || enviando || !clienteSelecionado) return;
    
    setEnviando(true);
    setTexto('');
    
    try {
      const res = await api.post<Mensagem>(`/chat/conversas/${clienteSelecionado.id}`, { texto: textoEnviar });
      
      setMensagens(prev => {
        const nova = [...prev, res.data];
        mensagensRef.current = nova;
        return nova;
      });
      playSent(); // Som de envio
      
      setConversas(prev =>
        prev.map(c =>
          c.clienteId === clienteSelecionado.id
            ? { ...c, ultimaMensagem: textoEnviar, ultimaAt: new Date().toISOString(), ultimoRemetente: 'ADMIN' }
            : c
        )
      );
      
      // Pequeno delay para garantir render e smooth scroll total
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

  function formatarHora(iso: string) {
    const d = new Date(iso);
    const hoje = new Date();
    if (d.toDateString() === hoje.toDateString()) {
      return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    }
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
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

  // Agrupa mensagens por data
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

  const conversasFiltradas = conversas.filter(c =>
    c.clienteNome.toLowerCase().includes(busca.toLowerCase()) ||
    c.clienteEmail.toLowerCase().includes(busca.toLowerCase())
  );

  const iniciais = (nome: string) =>
    nome.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

  return (
    <div className="w-full h-full flex flex-col md:grid md:grid-cols-[340px_1fr] overflow-hidden bg-[var(--fundo-pagina)]">
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
        
        /* Ajuste do textarea */
        textarea::-webkit-scrollbar { width: 6px; }
        textarea::-webkit-scrollbar-track { background: transparent; }
        textarea::-webkit-scrollbar-thumb { background: var(--borda); border-radius: 4px; }
      `}</style>

      {/* ── Coluna esquerda: lista de conversas ── */}
      <div
        className={`flex-col border-r h-full overflow-hidden flex-shrink-0 bg-[var(--fundo-card)] ${clienteSelecionado ? 'hidden md:flex' : 'flex'}`}
        style={{ borderColor: 'var(--borda)' }}
      >
        {/* Header inbox */}
        <div className="px-4 py-4 border-b flex-shrink-0" style={{ borderColor: 'var(--borda)' }}>
          <h1 className="font-['Inter'] text-base font-semibold" style={{ color: 'var(--texto-principal)' }}>
            Chat
          </h1>
          <p className="font-['Inter'] text-[11px] mt-0.5" style={{ color: 'var(--texto-secundario)' }}>
            {conversas.reduce((s, c) => s + c.naoLidas, 0) > 0
              ? `${conversas.reduce((s, c) => s + c.naoLidas, 0)} não lidas`
              : 'Todas as conversas'}
          </p>
        </div>

        {/* Busca */}
        <div className="px-3 py-3 border-b flex-shrink-0" style={{ borderColor: 'var(--borda)' }}>
          <div className="flex items-center gap-2 rounded-md px-3 py-2 border transition-colors focus-within:border-[var(--cor-primaria)]" 
               style={{ background: 'var(--fundo-pagina)', borderColor: 'var(--borda)' }}>
            <Search size={14} style={{ color: 'var(--texto-secundario)', flexShrink: 0 }} />
            <input
              value={busca}
              onChange={e => setBusca(e.target.value)}
              placeholder="Buscar cliente..."
              className="flex-1 bg-transparent outline-none font-['Inter'] text-xs"
              style={{ color: 'var(--texto-principal)' }}
            />
          </div>
        </div>

        {/* Lista */}
        <div className="flex-1 overflow-y-auto">
          {conversasFiltradas.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 gap-3" style={{ color: 'var(--texto-secundario)' }}>
              <MessageCircle size={32} strokeWidth={1} />
              <p className="font-['Inter'] text-[13px]">
                {busca ? 'Nenhum resultado' : 'Nenhuma conversa ainda'}
              </p>
            </div>
          )}
          
          {conversasFiltradas.map(c => {
            const isAtivo = clienteSelecionado?.id === c.clienteId;
            return (
              <button
                key={c.clienteId}
                onClick={(e) => {
                  e.preventDefault();
                  initAudio();
                  setClienteSelecionado({ id: c.clienteId, nome: c.clienteNome });
                  fetchMensagens(c.clienteId); // Dispara fetch imediatamente
                }}
                className="w-full flex items-center gap-3 px-4 py-3 text-left transition-colors relative"
                style={{
                  background: isAtivo ? 'rgba(var(--cor-primaria-rgb), 0.08)' : 'transparent',
                }}
              >
                {/* Barra indicadora lateral */}
                {isAtivo && (
                  <div className="absolute left-0 top-0 bottom-0 w-[3px]" style={{ background: 'var(--cor-primaria)' }} />
                )}
                
                {/* Avatar */}
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 font-['Inter'] text-[13px] font-semibold"
                  style={{ background: 'rgba(var(--cor-primaria-rgb), 0.15)', color: 'var(--cor-primaria)' }}
                >
                  {iniciais(c.clienteNome)}
                </div>
                
                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className="truncate font-['Inter'] text-[13px] font-semibold" style={{ color: 'var(--texto-principal)' }}>
                      {c.clienteNome}
                    </p>
                    <span className="font-['JetBrains_Mono'] text-[10px] ml-2 flex-shrink-0" style={{ color: 'var(--texto-secundario)' }}>
                      {formatarHora(c.ultimaAt)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between mt-0.5">
                    <p className="truncate font-['Inter'] text-[11px]" style={{ color: 'var(--texto-secundario)' }}>
                      {c.ultimoRemetente === 'ADMIN' ? 'Você: ' : ''}{c.ultimaMensagem}
                    </p>
                    {c.naoLidas > 0 && (
                      <span className="flex-shrink-0 ml-2 w-5 h-5 rounded-full flex items-center justify-center text-white font-['JetBrains_Mono'] text-[10px] font-bold"
                        style={{ background: 'var(--cor-primaria)' }}>
                        {c.naoLidas > 9 ? '9+' : c.naoLidas}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Coluna direita: thread de mensagens ── */}
      <div className={`flex-1 flex-col h-full overflow-hidden ${clienteSelecionado ? 'flex' : 'hidden md:flex'}`}>
        {!clienteSelecionado ? (
          // Estado vazio aprimorado
          <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center px-6">
            <div className="w-20 h-20 rounded-full flex items-center justify-center mb-2" style={{ background: 'rgba(var(--texto-secundario-rgb), 0.1)' }}>
              <MessageCircle size={40} strokeWidth={1.5} style={{ color: 'var(--texto-secundario)' }} />
            </div>
            <h2 className="font-['Inter'] text-lg font-medium" style={{ color: 'var(--texto-principal)' }}>
              Selecione uma conversa
            </h2>
            <p className="font-['Inter'] text-[13px] max-w-[280px]" style={{ color: 'var(--texto-secundario)' }}>
              Escolha um cliente à esquerda para ver as mensagens e responder.
            </p>
          </div>
        ) : (
          <>
            {/* Header do chat */}
            <div className="flex items-center justify-between px-5 py-4 border-b flex-shrink-0" style={{ borderColor: 'var(--borda)', background: 'var(--fundo-card)' }}>
              <div className="flex items-center gap-3">
                {/* Voltar no mobile */}
                <button
                  className="md:hidden p-1 mr-1 transition-transform active:scale-95"
                  onClick={(e) => {
                    e.preventDefault();
                    setClienteSelecionado(null);
                  }}
                  style={{ color: 'var(--texto-secundario)', background: 'none', border: 'none' }}
                  aria-label="Voltar"
                >
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="m15 18-6-6 6-6"/>
                  </svg>
                </button>
                
                <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 font-['Inter'] text-[13px] font-semibold"
                  style={{ background: 'rgba(var(--cor-primaria-rgb), 0.15)', color: 'var(--cor-primaria)' }}>
                  {iniciais(clienteSelecionado.nome)}
                </div>
                <div className="flex flex-col justify-center">
                  <p className="font-['Inter'] text-[14px] font-medium leading-tight capitalize" style={{ color: 'var(--texto-principal)' }}>
                    {clienteSelecionado.nome.toLowerCase()}
                  </p>
                  <p className="font-['Inter'] text-[11px] mt-0.5" style={{ color: 'var(--texto-secundario)' }}>
                    Cliente
                  </p>
                </div>
              </div>
              
              {/* Controles de som */}
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
            <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-6 flex flex-col gap-1">
              {mensagens.length === 0 && !enviando && (
                <div className="flex flex-col items-center justify-center flex-1 gap-3 text-center opacity-60">
                  <MessageCircle size={32} strokeWidth={1} style={{ color: 'var(--texto-secundario)' }} />
                  <p className="font-['Inter'] text-[13px]" style={{ color: 'var(--texto-secundario)' }}>
                    Inicie a conversa com {clienteSelecionado.nome}.
                  </p>
                </div>
              )}

              {grupos.map((grupo) => (
                <div key={grupo.data}>
                  <div className="flex items-center gap-3 my-6">
                    <div className="flex-1 h-px" style={{ background: 'var(--borda)' }} />
                    <span className="font-['Inter'] text-[11px] font-medium" style={{ color: 'var(--texto-secundario)' }}>
                      {grupo.data}
                    </span>
                    <div className="flex-1 h-px" style={{ background: 'var(--borda)' }} />
                  </div>

                  {grupo.itens.map((m, index) => {
                    const isAdmin = m.remetente === 'ADMIN';
                    const nextMsg = grupo.itens[index + 1];
                    const isLastInGroup = !nextMsg || nextMsg.remetente !== m.remetente;
                    const marginBottom = isLastInGroup ? 'mb-4' : 'mb-1';
                    const borderRadius = isAdmin 
                        ? (isLastInGroup ? 'rounded-2xl rounded-br-sm' : 'rounded-2xl')
                        : (isLastInGroup ? 'rounded-2xl rounded-bl-sm' : 'rounded-2xl');

                    return (
                      <div
                        key={m.id}
                        className={`flex ${marginBottom} ${isAdmin ? 'justify-end' : 'justify-start'} ${isAdmin ? 'msg-enter-sent' : 'msg-enter-received'}`}
                      >
                        <div
                          className={`max-w-[75%] px-3.5 py-2.5 ${borderRadius} shadow-sm`}
                          style={
                            isAdmin
                              ? { background: 'var(--cor-primaria)', color: '#111827' }
                              : { background: 'var(--fundo-card)', border: '1px solid var(--borda)', color: 'var(--texto-principal)' }
                          }
                        >
                          <p className="font-['Inter'] text-[14px] leading-relaxed whitespace-pre-wrap break-words">
                            {m.texto}
                          </p>
                          <p
                            className="text-right mt-1 font-['JetBrains_Mono'] text-[10px]"
                            style={{
                              color: isAdmin ? 'rgba(0,0,0,0.6)' : 'var(--texto-secundario)',
                            }}
                          >
                            {new Date(m.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                          </p>
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
              className="flex items-end gap-3 px-4 py-4 border-t flex-shrink-0"
              style={{ borderColor: 'var(--borda)', background: 'var(--fundo-card)' }}
            >
              <textarea
                ref={inputRef}
                value={texto}
                onChange={e => setTexto(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Digite sua mensagem..."
                disabled={enviando}
                rows={1}
                className="flex-1 rounded-2xl px-4 py-3 outline-none resize-none overflow-y-auto"
                style={{
                  background: 'var(--fundo-pagina)',
                  border: '1px solid var(--borda)',
                  color: 'var(--texto-principal)',
                  fontFamily: 'var(--fonte-interface), Inter, sans-serif',
                  fontSize: '14px',
                  minHeight: '44px',
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
                className="w-11 h-11 md:w-12 md:h-12 rounded-full flex items-center justify-center flex-shrink-0 transition-all chat-btn disabled:opacity-50 disabled:scale-100"
                style={{
                  background: 'var(--cor-primaria)',
                  color: '#111827', // Texto escuro para contraste garantido com primária (amber/yellow/etc)
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
                  <Send size={20} strokeWidth={2} />
                )}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
