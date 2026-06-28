// Página de chat do admin — inbox + thread de mensagens
import { useState, useEffect, useRef, useCallback } from 'react';
import { MessageCircle, Send, Search, User } from 'lucide-react';
import api from '../../api/client';

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
  const inputRef = useRef<HTMLInputElement>(null);

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
  const fetchMensagens = useCallback(async () => {
    if (!clienteSelecionado) return;
    try {
      const res = await api.get<Mensagem[]>(`/chat/conversas/${clienteSelecionado.id}`);
      setMensagens(res.data);
      // Atualiza contagem de não lidas na lista
      setConversas(prev =>
        prev.map(c => c.clienteId === clienteSelecionado.id ? { ...c, naoLidas: 0 } : c)
      );
    } catch {
      // silencioso
    }
  }, [clienteSelecionado]);

  // Polling conversas (a cada 5s)
  useEffect(() => {
    fetchConversas();
    const interval = setInterval(fetchConversas, 5000);
    return () => clearInterval(interval);
  }, [fetchConversas]);

  // Polling mensagens do cliente selecionado (a cada 3s)
  useEffect(() => {
    if (!clienteSelecionado) return;
    fetchMensagens();
    const interval = setInterval(fetchMensagens, 3000);
    return () => clearInterval(interval);
  }, [fetchMensagens, clienteSelecionado]);

  // Scroll para o fim quando chegam mensagens
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [mensagens]);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (!texto.trim() || enviando || !clienteSelecionado) return;
    setEnviando(true);
    const textoEnviar = texto.trim();
    setTexto('');
    try {
      const res = await api.post<Mensagem>(`/chat/conversas/${clienteSelecionado.id}`, { texto: textoEnviar });
      setMensagens(prev => [...prev, res.data]);
      // Atualiza preview da conversa na lista
      setConversas(prev =>
        prev.map(c =>
          c.clienteId === clienteSelecionado.id
            ? { ...c, ultimaMensagem: textoEnviar, ultimaAt: new Date().toISOString(), ultimoRemetente: 'ADMIN' }
            : c
        )
      );
    } catch {
      setTexto(textoEnviar);
    } finally {
      setEnviando(false);
      inputRef.current?.focus();
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
    <div className="flex h-full" style={{ background: 'var(--fundo-pagina)' }}>
      {/* ── Coluna esquerda: lista de conversas ── */}
      <div
        className={`flex flex-col border-r flex-shrink-0 ${clienteSelecionado ? 'hidden md:flex' : 'flex'}`}
        style={{ width: '300px', borderColor: 'var(--borda)', background: 'var(--fundo-sidebar)' }}
      >
        {/* Header inbox */}
        <div className="px-4 py-4 border-b" style={{ borderColor: 'var(--borda)' }}>
          <h1 style={{ fontFamily: 'var(--fonte-interface)', fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)' }}>
            Chat
          </h1>
          <p style={{ fontFamily: 'var(--fonte-interface)', fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
            {conversas.reduce((s, c) => s + c.naoLidas, 0) > 0
              ? `${conversas.reduce((s, c) => s + c.naoLidas, 0)} não lidas`
              : 'Todas as conversas'}
          </p>
        </div>

        {/* Busca */}
        <div className="px-3 py-3 border-b" style={{ borderColor: 'var(--borda)' }}>
          <div className="flex items-center gap-2 rounded-md px-3 py-2" style={{ background: 'var(--fundo-input)', border: '1px solid var(--borda)' }}>
            <Search size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
            <input
              value={busca}
              onChange={e => setBusca(e.target.value)}
              placeholder="Buscar cliente..."
              className="flex-1 bg-transparent outline-none"
              style={{ fontFamily: 'var(--fonte-interface)', fontSize: '12px', color: 'var(--text-primary)' }}
            />
          </div>
        </div>

        {/* Lista */}
        <div className="flex-1 overflow-y-auto">
          {conversasFiltradas.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 gap-3" style={{ color: 'var(--text-muted)' }}>
              <MessageCircle size={32} strokeWidth={1} />
              <p style={{ fontFamily: 'var(--fonte-interface)', fontSize: '13px' }}>
                {busca ? 'Nenhum resultado' : 'Nenhuma conversa ainda'}
              </p>
            </div>
          )}
          {conversasFiltradas.map(c => (
            <button
              key={c.clienteId}
              onClick={() => setClienteSelecionado({ id: c.clienteId, nome: c.clienteNome })}
              className="w-full flex items-center gap-3 px-4 py-3 text-left transition-colors"
              style={{
                background: clienteSelecionado?.id === c.clienteId ? 'rgba(var(--cor-primaria-rgb), 0.08)' : 'transparent',
                borderLeft: clienteSelecionado?.id === c.clienteId ? '3px solid var(--amber)' : '3px solid transparent',
              }}
            >
              {/* Avatar */}
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
                style={{ background: 'rgba(var(--cor-primaria-rgb), 0.15)', color: 'var(--amber)', fontFamily: 'var(--fonte-interface)', fontSize: '13px', fontWeight: 600 }}
              >
                {iniciais(c.clienteNome)}
              </div>
              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <p className="truncate" style={{ fontFamily: 'var(--fonte-interface)', fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
                    {c.clienteNome}
                  </p>
                  <span style={{ fontFamily: 'var(--fonte-interface)', fontSize: '10px', color: 'var(--text-muted)', flexShrink: 0, marginLeft: '8px' }}>
                    {formatarHora(c.ultimaAt)}
                  </span>
                </div>
                <div className="flex items-center justify-between mt-0.5">
                  <p className="truncate" style={{ fontFamily: 'var(--fonte-interface)', fontSize: '11px', color: 'var(--text-muted)' }}>
                    {c.ultimoRemetente === 'ADMIN' ? 'Você: ' : ''}{c.ultimaMensagem}
                  </p>
                  {c.naoLidas > 0 && (
                    <span className="flex-shrink-0 ml-2 w-5 h-5 rounded-full flex items-center justify-center text-black"
                      style={{ background: 'var(--amber)', fontFamily: 'var(--fonte-interface)', fontSize: '10px', fontWeight: 700 }}>
                      {c.naoLidas > 9 ? '9+' : c.naoLidas}
                    </span>
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* ── Coluna direita: thread de mensagens ── */}
      <div className={`flex-1 flex flex-col ${clienteSelecionado ? 'flex' : 'hidden md:flex'}`}>
        {!clienteSelecionado ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-4" style={{ color: 'var(--text-muted)' }}>
            <MessageCircle size={48} strokeWidth={1} />
            <p style={{ fontFamily: 'var(--fonte-interface)', fontSize: '14px' }}>Selecione uma conversa</p>
          </div>
        ) : (
          <>
            {/* Header do chat */}
            <div className="flex items-center gap-3 px-5 py-4 border-b flex-shrink-0" style={{ borderColor: 'var(--borda)', background: 'var(--fundo-sidebar)' }}>
              {/* Voltar no mobile */}
              <button
                className="md:hidden p-1 mr-1"
                onClick={() => setClienteSelecionado(null)}
                style={{ color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer' }}
              >
                ←
              </button>
              <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0"
                style={{ background: 'rgba(var(--cor-primaria-rgb), 0.15)', color: 'var(--amber)', fontFamily: 'var(--fonte-interface)', fontSize: '12px', fontWeight: 600 }}>
                {iniciais(clienteSelecionado.nome)}
              </div>
              <div>
                <p style={{ fontFamily: 'var(--fonte-interface)', fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>
                  {clienteSelecionado.nome}
                </p>
                <p style={{ fontFamily: 'var(--fonte-interface)', fontSize: '11px', color: 'var(--text-muted)' }}>
                  Cliente
                </p>
              </div>
            </div>

            {/* Mensagens */}
            <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-1">
              {mensagens.length === 0 && (
                <div className="flex flex-col items-center justify-center flex-1 gap-3 text-center" style={{ color: 'var(--text-muted)', paddingTop: '60px' }}>
                  <User size={40} strokeWidth={1} />
                  <p style={{ fontFamily: 'var(--fonte-interface)', fontSize: '13px' }}>
                    Nenhuma mensagem com {clienteSelecionado.nome} ainda.
                  </p>
                </div>
              )}

              {grupos.map(grupo => (
                <div key={grupo.data}>
                  <div className="flex items-center gap-3 my-4">
                    <div className="flex-1 h-px" style={{ background: 'var(--borda)' }} />
                    <span style={{ fontFamily: 'var(--fonte-interface)', fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                      {grupo.data}
                    </span>
                    <div className="flex-1 h-px" style={{ background: 'var(--borda)' }} />
                  </div>

                  {grupo.itens.map(m => (
                    <div
                      key={m.id}
                      className={`flex mb-2 ${m.remetente === 'ADMIN' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className="max-w-[70%] rounded-2xl px-4 py-2.5"
                        style={
                          m.remetente === 'ADMIN'
                            ? { background: 'var(--amber)', color: '#000' }
                            : { background: 'var(--fundo-sidebar)', border: '1px solid var(--borda)', color: 'var(--text-primary)' }
                        }
                      >
                        <p style={{ fontFamily: 'var(--fonte-interface)', fontSize: '13px', lineHeight: '1.5', wordBreak: 'break-word' }}>
                          {m.texto}
                        </p>
                        <p
                          className="text-right mt-1"
                          style={{
                            fontFamily: 'var(--fonte-interface)',
                            fontSize: '10px',
                            opacity: 0.6,
                            color: m.remetente === 'ADMIN' ? '#000' : 'var(--text-muted)',
                          }}
                        >
                          {new Date(m.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ))}
              <div ref={bottomRef} />
            </div>

            {/* Input */}
            <form
              onSubmit={enviar}
              className="flex items-center gap-2 px-4 py-3 border-t flex-shrink-0"
              style={{ borderColor: 'var(--borda)', background: 'var(--fundo-sidebar)' }}
            >
              <input
                ref={inputRef}
                value={texto}
                onChange={e => setTexto(e.target.value)}
                placeholder={`Responder ${clienteSelecionado.nome}...`}
                disabled={enviando}
                className="flex-1 rounded-full px-4 py-2.5 text-sm outline-none"
                style={{
                  background: 'var(--fundo-input)',
                  border: '1px solid var(--borda)',
                  color: 'var(--text-primary)',
                  fontFamily: 'var(--fonte-interface)',
                  fontSize: '13px',
                }}
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    enviar(e as unknown as React.FormEvent);
                  }
                }}
              />
              <button
                type="submit"
                disabled={!texto.trim() || enviando}
                className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 transition-opacity"
                style={{
                  background: texto.trim() ? 'var(--amber)' : 'var(--fundo-input)',
                  border: '1px solid var(--borda)',
                  color: texto.trim() ? '#000' : 'var(--text-muted)',
                  cursor: texto.trim() ? 'pointer' : 'not-allowed',
                  opacity: enviando ? 0.6 : 1,
                }}
              >
                <Send size={16} />
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
