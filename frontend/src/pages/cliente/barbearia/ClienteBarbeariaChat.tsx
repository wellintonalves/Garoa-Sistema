// Chat do cliente com a barbearia
import { useState, useEffect, useRef, useCallback } from 'react';
import { useOutletContext, useParams } from 'react-router-dom';
import { Send, MessageCircle } from 'lucide-react';
import clienteApi from '../../../api/clienteApi';

interface Mensagem {
  id: string;
  texto: string;
  remetente: 'CLIENTE' | 'ADMIN';
  lida: boolean;
  createdAt: string;
}

interface BarbeariaCtx {
  barbearia: { id: string; nome: string; logo: string | null } | null;
}

export function ClienteBarbeariaChat() {
  const { barbearia } = useOutletContext<BarbeariaCtx>();
  const { barbeariaId } = useParams<{ barbeariaId: string }>();
  const [mensagens, setMensagens] = useState<Mensagem[]>([]);
  const [texto, setTexto] = useState('');
  const [enviando, setEnviando] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const fetchMensagens = useCallback(async () => {
    if (!barbeariaId) return;
    try {
      const res = await clienteApi.get<Mensagem[]>(`/cliente/barbearia/${barbeariaId}/chat`);
      setMensagens(res.data);
    } catch {
      // silencioso
    }
  }, [barbeariaId]);

  // Carrega mensagens inicialmente e faz polling a cada 3 s
  useEffect(() => {
    fetchMensagens();
    const interval = setInterval(fetchMensagens, 3000);
    return () => clearInterval(interval);
  }, [fetchMensagens]);

  // Scroll automático para o fim quando chegam mensagens novas
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [mensagens]);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (!texto.trim() || enviando || !barbeariaId) return;
    setEnviando(true);
    const textoEnviar = texto.trim();
    setTexto('');
    try {
      const res = await clienteApi.post<Mensagem>(`/cliente/barbearia/${barbeariaId}/chat`, { texto: textoEnviar });
      setMensagens(prev => [...prev, res.data]);
    } catch {
      setTexto(textoEnviar); // restaura em caso de erro
    } finally {
      setEnviando(false);
      inputRef.current?.focus();
    }
  }

  function formatarHora(iso: string) {
    return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  }

  function formatarData(iso: string) {
    const d = new Date(iso);
    const hoje = new Date();
    if (d.toDateString() === hoje.toDateString()) return 'Hoje';
    const ontem = new Date();
    ontem.setDate(ontem.getDate() - 1);
    if (d.toDateString() === ontem.toDateString()) return 'Ontem';
    return d.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long' });
  }

  // Agrupa mensagens por data para exibir separadores
  const grupos: { data: string; itens: Mensagem[] }[] = [];
  for (const m of mensagens) {
    const label = formatarData(m.createdAt);
    const ultimo = grupos[grupos.length - 1];
    if (ultimo && ultimo.data === label) {
      ultimo.itens.push(m);
    } else {
      grupos.push({ data: label, itens: [m] });
    }
  }

  return (
    <div className="flex flex-col h-full" style={{ background: 'var(--fundo-pagina)' }}>
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-4 border-b flex-shrink-0" style={{ borderColor: 'var(--borda)', background: 'var(--fundo-sidebar)' }}>
        <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(var(--cor-primaria-rgb), 0.15)', color: 'var(--amber)' }}>
          <MessageCircle size={18} />
        </div>
        <div>
          <p style={{ fontFamily: 'var(--fonte-interface)', fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>
            {barbearia?.nome || 'Barbearia'}
          </p>
          <p style={{ fontFamily: 'var(--fonte-interface)', fontSize: '11px', color: 'var(--text-muted)' }}>
            Atendimento
          </p>
        </div>
      </div>

      {/* Lista de mensagens */}
      <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-1">
        {mensagens.length === 0 && (
          <div className="flex flex-col items-center justify-center flex-1 gap-3 text-center" style={{ color: 'var(--text-muted)', paddingTop: '60px' }}>
            <MessageCircle size={40} strokeWidth={1} />
            <p style={{ fontFamily: 'var(--fonte-interface)', fontSize: '14px' }}>
              Nenhuma mensagem ainda
            </p>
            <p style={{ fontFamily: 'var(--fonte-interface)', fontSize: '12px' }}>
              Envie uma mensagem para falar com a barbearia
            </p>
          </div>
        )}

        {grupos.map(grupo => (
          <div key={grupo.data}>
            {/* Separador de data */}
            <div className="flex items-center gap-3 my-4">
              <div className="flex-1 h-px" style={{ background: 'var(--borda)' }} />
              <span style={{ fontFamily: 'var(--fonte-interface)', fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                {grupo.data}
              </span>
              <div className="flex-1 h-px" style={{ background: 'var(--borda)' }} />
            </div>

            {/* Mensagens do grupo */}
            {grupo.itens.map(m => (
              <div
                key={m.id}
                className={`flex mb-2 ${m.remetente === 'CLIENTE' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className="max-w-[75%] rounded-2xl px-4 py-2.5"
                  style={
                    m.remetente === 'CLIENTE'
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
                      color: m.remetente === 'CLIENTE' ? '#000' : 'var(--text-muted)',
                    }}
                  >
                    {formatarHora(m.createdAt)}
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
          placeholder="Digite sua mensagem..."
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
    </div>
  );
}
