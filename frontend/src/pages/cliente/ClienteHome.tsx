// Tela inicial do cliente — buscar e gerenciar barbearias conectadas
import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useClienteAuth } from '../../hooks/useClienteAuth';
import { Search, QrCode, MapPin, ChevronRight, LogOut, Scissors, CheckCircle, XCircle } from 'lucide-react';
import clienteApi from '../../api/clienteApi';
import { QrCodeScanner } from '../../components/QrCodeScanner';

interface BarbeariaItem {
  id: string;
  nome: string;
  slug: string;
  logo: string | null;
  endereco: string | null;
  conectadoEm?: string;
}

export function ClienteHome() {
  const navigate = useNavigate();
  const { cliente, logout } = useClienteAuth();
  const [searchParams] = useSearchParams();
  const [busca, setBusca] = useState('');
  const [resultados, setResultados] = useState<BarbeariaItem[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [minhasBarbearias, setMinhasBarbearias] = useState<BarbeariaItem[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [scannerAberto, setScannerAberto] = useState(false);
  const [mensagemSucesso, setMensagemSucesso] = useState<string | null>(null);
  const [mensagemErro, setMensagemErro] = useState<string | null>(null);

  // Conectar automaticamente se veio de um slug
  useEffect(() => {
    const slug = searchParams.get('slug');
    if (slug) {
      conectarPorSlug(slug);
    }
  }, [searchParams]);

  useEffect(() => {
    carregarMinhasBarbearias();
  }, []);

  async function carregarMinhasBarbearias() {
    try {
      const res = await clienteApi.get<BarbeariaItem[]>('/cliente/minhas-barbearias');
      setMinhasBarbearias(res.data);
    } catch { /* empty */ }
    finally { setCarregando(false); }
  }

  async function buscarBarbearias(nome: string) {
    if (nome.length < 2) { setResultados([]); return; }
    setBuscando(true);
    try {
      const res = await clienteApi.get<BarbeariaItem[]>('/cliente/buscar-barbearia', { params: { nome } });
      setResultados(res.data);
    } catch { /* empty */ }
    finally { setBuscando(false); }
  }

  async function conectarBarbearia(barbeariaId: string) {
    try {
      await clienteApi.post('/cliente/conectar-barbearia', { barbeariaId });
      carregarMinhasBarbearias();
      setResultados([]);
      setBusca('');
    } catch { /* empty */ }
  }

  async function conectarPorSlug(slug: string) {
    try {
      console.log("[ClienteHome] Buscando barbearia pelo slug:", slug);
      const res = await clienteApi.get<BarbeariaItem>('/cliente/buscar-barbearia-slug/' + slug);
      console.log("[ClienteHome] Barbearia encontrada:", res.data);
      
      await clienteApi.post('/cliente/conectar-barbearia', { barbeariaId: res.data.id });
      carregarMinhasBarbearias();
      
      setMensagemSucesso(`Conectado à ${res.data.nome}!`);
      setTimeout(() => setMensagemSucesso(null), 4000);
      
      console.log("[ClienteHome] Redirecionando para:", `/cliente/barbearia/${res.data.id}`);
      navigate(`/cliente/barbearia/${res.data.id}`);
    } catch {
      console.log("[ClienteHome] Falha ao conectar pelo slug:", slug);
      setMensagemErro('Barbearia não encontrada para este QR Code.');
      setTimeout(() => setMensagemErro(null), 4000);
    }
  }

  const handleQrResult = useCallback((slug: string) => {
    setScannerAberto(false);
    conectarPorSlug(slug);
  }, []);

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--fundo-pagina)' }}>
      {/* Header */}
      <div className="px-5 pt-8 pb-4" style={{ borderBottom: '1px solid var(--border)' }}>
        <div className="flex items-center justify-between mb-6">
          <div>
            <p style={{ fontFamily: 'var(--fonte-interface)', fontSize: '10px', color: 'var(--cor-icone)', letterSpacing: '0.15em', textTransform: 'uppercase' as const }}>
              Olá,
            </p>
            <h1 style={{ fontFamily: 'var(--fonte-interface)', fontSize: '28px', color: 'var(--text-primary)', letterSpacing: '0.04em' }}>
              {cliente?.nome.split(' ')[0]}
            </h1>
          </div>
          <button onClick={logout} title="Sair"
            style={{ background: 'var(--bg-surface2)', border: '1px solid var(--border)', padding: '10px', cursor: 'pointer' }}>
            <LogOut size={18} style={{ color: 'var(--text-muted)' }} />
          </button>
        </div>

        {/* Busca */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              type="text"
              value={busca}
              onChange={(e) => { setBusca(e.target.value); buscarBarbearias(e.target.value); }}
              placeholder="Buscar barbearia..."
              className="ds-input"
              style={{ paddingLeft: '36px' }}
            />
          </div>
          <button
            onClick={() => setScannerAberto(true)}
            style={{ background: 'rgba(var(--cor-primaria-rgb), 0.10)', border: '1px solid var(--amber)', padding: '10px 14px', cursor: 'pointer' }}
            title="Escanear QR Code"
          >
            <QrCode size={20} style={{ color: 'var(--cor-icone)' }} />
          </button>
        </div>

        {/* Resultados de busca */}
        {resultados.length > 0 && (
          <div className="mt-3 flex flex-col gap-2">
            {resultados.map(b => (
              <button
                key={b.id}
                onClick={() => conectarBarbearia(b.id)}
                className="flex items-center gap-3 w-full text-left p-3"
                style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', cursor: 'pointer' }}
              >
                <div className="w-10 h-10 flex items-center justify-center flex-shrink-0"
                  style={{ background: 'rgba(var(--cor-primaria-rgb), 0.10)' }}>
                  <Scissors size={18} style={{ color: 'var(--cor-icone)' }} />
                </div>
                <div className="min-w-0 flex-1">
                  <p style={{ fontFamily: 'var(--fonte-interface)', fontWeight: 700, color: 'var(--text-primary)', fontSize: '13px' }}>{b.nome}</p>
                  {b.endereco && (
                    <p className="flex items-center gap-1 truncate" style={{ fontFamily: 'var(--fonte-interface)', fontSize: '10px', color: 'var(--text-muted)' }}>
                      <MapPin size={10} /> {b.endereco}
                    </p>
                  )}
                </div>
                <span style={{ fontFamily: 'var(--fonte-interface)', fontSize: '9px', color: 'var(--cor-icone)', letterSpacing: '0.1em', textTransform: 'uppercase' as const }}>
                  Conectar
                </span>
              </button>
            ))}
          </div>
        )}

        {buscando && (
          <p style={{ fontFamily: 'var(--fonte-interface)', fontSize: '11px', color: 'var(--text-muted)', textAlign: 'center', padding: '12px 0' }}>
            Buscando...
          </p>
        )}
      </div>

      {/* Minhas Barbearias */}
      <div className="flex-1 px-5 py-6">
        <h2 style={{ fontFamily: 'var(--fonte-interface)', fontSize: '10px', letterSpacing: '0.18em', textTransform: 'uppercase' as const, color: 'var(--cor-icone)', marginBottom: '16px' }}>
          Minhas Barbearias
        </h2>

        {carregando ? (
          <p style={{ fontFamily: 'var(--fonte-interface)', fontSize: '11px', color: 'var(--text-muted)', textAlign: 'center', padding: '2rem 0' }}>
            Carregando...
          </p>
        ) : minhasBarbearias.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12">
            <Scissors size={40} style={{ color: 'var(--text-disabled)', marginBottom: '16px' }} />
            <p style={{ fontFamily: 'var(--fonte-interface)', fontSize: '14px', color: 'var(--text-muted)', textAlign: 'center' }}>
              Nenhuma barbearia conectada
            </p>
            <p style={{ fontFamily: 'var(--fonte-interface)', fontSize: '11px', color: 'var(--text-disabled)', textAlign: 'center', marginTop: '4px' }}>
              Busque acima ou escaneie um QR Code
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {minhasBarbearias.map(b => (
              <button
                key={b.id}
                onClick={() => navigate(`/cliente/barbearia/${b.id}`)}
                className="flex items-center gap-4 w-full text-left p-4 transition-all"
                style={{
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border)',
                  borderLeft: '2px solid var(--amber)',
                  cursor: 'pointer',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--border-hover)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.borderLeftColor = 'var(--amber)'; }}
              >
                <div className="w-12 h-12 flex items-center justify-center flex-shrink-0"
                  style={{ background: 'rgba(var(--cor-primaria-rgb), 0.10)' }}>
                  <Scissors size={22} style={{ color: 'rgba(var(--cor-primaria-rgb), 0.15)' }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p style={{ fontFamily: 'var(--fonte-interface)', fontWeight: 700, color: 'var(--text-primary)', fontSize: '14px' }}>
                    {b.nome}
                  </p>
                  {b.endereco && (
                    <p className="flex items-center gap-1 truncate" style={{ fontFamily: 'var(--fonte-interface)', fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>
                      <MapPin size={10} /> {b.endereco}
                    </p>
                  )}
                </div>
                <ChevronRight size={20} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* QR Code Scanner Modal */}
      {scannerAberto && (
        <QrCodeScanner
          onResult={handleQrResult}
          onClose={() => setScannerAberto(false)}
        />
      )}

      {/* Mensagem de sucesso */}
      {mensagemSucesso && (
        <div style={{
          position: 'fixed',
          bottom: '24px',
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'linear-gradient(135deg, #065f46, #064e3b)',
          border: '1px solid #10b981',
          padding: '14px 24px',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          zIndex: 10000,
          boxShadow: '0 8px 30px rgba(16, 185, 129, 0.3)',
          animation: 'slideUp 0.3s ease-out',
          maxWidth: '90vw',
        }}>
          <CheckCircle size={20} style={{ color: '#34d399', flexShrink: 0 }} />
          <span style={{ fontFamily: 'var(--fonte-interface)', fontSize: '13px', color: '#d1fae5', fontWeight: 600 }}>
            {mensagemSucesso}
          </span>
        </div>
      )}

      {/* Mensagem de erro */}
      {mensagemErro && (
        <div style={{
          position: 'fixed',
          bottom: '24px',
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'linear-gradient(135deg, #7f1d1d, #991b1b)',
          border: '1px solid #ef4444',
          padding: '14px 24px',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          zIndex: 10000,
          boxShadow: '0 8px 30px rgba(239, 68, 68, 0.3)',
          animation: 'slideUp 0.3s ease-out',
          maxWidth: '90vw',
        }}>
          <XCircle size={20} style={{ color: '#fca5a5', flexShrink: 0 }} />
          <span style={{ fontFamily: 'var(--fonte-interface)', fontSize: '13px', color: '#fecaca', fontWeight: 600 }}>
            {mensagemErro}
          </span>
        </div>
      )}

      <style>{`
        @keyframes slideUp {
          from { opacity: 0; transform: translateX(-50%) translateY(20px); }
          to { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
      `}</style>
    </div>
  );
}
