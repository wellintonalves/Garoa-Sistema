import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api/client';
import { Search, Award, Star, History, Scissors, ChevronLeft } from 'lucide-react';

interface FidelidadeData {
  cliente: string;
  pontosAcumulados: number;
  meta: number;
  pontosFaltantes: number;
  historico: { data: string; servico: string; barbeiro: string }[];
}

export function Fidelidade() {
  const navigate = useNavigate();
  const [telefone, setTelefone] = useState('');
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [dados, setDados] = useState<FidelidadeData | null>(null);

  const nomeBarbearia = import.meta.env.VITE_BARBEARIA_NOME || 'Garoa Barbearia';

  async function buscarFidelidade(e: React.FormEvent) {
    e.preventDefault();
    if (!telefone) return;
    
    setCarregando(true);
    setErro(null);
    try {
      const res = await api.get('/publico/fidelidade', { params: { telefone } });
      setDados(res.data);
    } catch (err: any) {
      setErro(err.response?.data?.erro || 'Erro ao buscar dados de fidelidade');
      setDados(null);
    } finally {
      setCarregando(false);
    }
  }

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] text-white flex flex-col font-body">
      {/* Header Público */}
      <header className="h-16 flex items-center px-4 bg-[var(--bg-surface)] border-b border-[var(--border)] sticky top-0 z-10">
        <button onClick={() => navigate('/agendar')} className="text-[var(--amber)]">
          <ChevronLeft size={24} />
        </button>
        <h1 className="font-display text-xl tracking-wider text-[var(--amber)] uppercase mx-auto pr-6">
          Clube {nomeBarbearia}
        </h1>
      </header>

      <main className="flex-1 max-w-md w-full mx-auto p-4 flex flex-col pt-8">
        
        {!dados ? (
          <div className="animate-fade-in flex flex-col items-center">
            <div className="w-20 h-20 bg-[var(--bg-surface2)] rounded-full flex items-center justify-center mb-6 border border-[var(--amber)]">
              <Star className="text-[var(--amber)]" size={40} />
            </div>
            <h2 className="text-2xl font-bold font-display text-center mb-2">Seus Pontos</h2>
            <p className="text-center text-[var(--text-muted)] mb-8 text-sm">
              Digite seu WhatsApp para consultar seu saldo de pontos e histórico de visitas.
            </p>

            <form onSubmit={buscarFidelidade} className="w-full space-y-4">
              <div>
                <label className="text-xs text-[var(--text-muted)] font-mono uppercase tracking-widest mb-1 block">Telefone (WhatsApp)</label>
                <div className="relative">
                  <input 
                    type="tel" 
                    value={telefone}
                    onChange={(e) => setTelefone(e.target.value)}
                    className="w-full p-4 pl-12 bg-[var(--bg-surface)] border border-[var(--border)] rounded focus:outline-none focus:border-[var(--amber)] text-white text-lg"
                    placeholder="(00) 00000-0000"
                    required
                  />
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" size={20} />
                </div>
              </div>

              {erro && <p className="text-[var(--error-text)] text-sm text-center">{erro}</p>}

              <button 
                type="submit"
                disabled={carregando || !telefone}
                className="mt-4 flex items-center justify-center gap-2 w-full py-4 bg-[var(--amber)] hover:bg-amber-600 disabled:opacity-50 text-black font-bold uppercase tracking-widest text-sm rounded transition-colors"
              >
                {carregando ? 'Buscando...' : 'Consultar'}
              </button>
            </form>
          </div>
        ) : (
          <div className="animate-fade-in space-y-6">
            <div className="text-center">
              <h2 className="text-xl font-display text-[var(--text-muted)]">Olá, <span className="text-white">{dados.cliente}</span></h2>
            </div>

            {/* Cartão de Pontos */}
            <div className="bg-[var(--bg-surface)] border border-[var(--amber)] rounded p-6 text-center relative overflow-hidden">
              <div className="absolute -top-10 -right-10 text-[var(--amber)] opacity-10">
                <Award size={120} />
              </div>
              <p className="text-xs text-[var(--amber)] font-mono uppercase tracking-widest mb-2">Saldo Atual</p>
              <div className="flex items-baseline justify-center gap-2 mb-4">
                <span className="text-5xl font-display font-bold text-white">{dados.pontosAcumulados}</span>
                <span className="text-lg text-[var(--text-muted)]">pts</span>
              </div>
              
              <div className="w-full bg-black/50 rounded-full h-3 mb-2 border border-[var(--border)]">
                <div 
                  className="bg-[var(--amber)] h-full rounded-full transition-all duration-1000" 
                  style={{ width: `${Math.min(100, (dados.pontosAcumulados / dados.meta) * 100)}%` }}
                />
              </div>
              <p className="text-sm text-[var(--text-muted)]">
                Faltam <strong className="text-white">{dados.pontosFaltantes} pontos</strong> para sua próxima recompensa!
              </p>
            </div>

            {/* Histórico */}
            <div>
              <div className="flex items-center gap-2 mb-4">
                <History className="text-[var(--text-muted)]" size={18} />
                <h3 className="font-bold text-lg">Últimas Visitas</h3>
              </div>

              {dados.historico.length === 0 ? (
                <p className="text-[var(--text-muted)] text-center py-4 text-sm bg-[var(--bg-surface)] rounded border border-[var(--border)]">
                  Nenhuma visita registrada ainda.
                </p>
              ) : (
                <div className="space-y-3">
                  {dados.historico.map((h, i) => (
                    <div key={i} className="flex items-center gap-4 p-3 bg-[var(--bg-surface)] rounded border border-[var(--border)]">
                      <div className="w-10 h-10 rounded-full bg-[var(--amber-dim)] flex items-center justify-center flex-shrink-0">
                        <Scissors size={16} className="text-[var(--amber)]" />
                      </div>
                      <div className="flex-1 overflow-hidden">
                        <h4 className="font-bold text-sm truncate">{h.servico}</h4>
                        <p className="text-xs text-[var(--text-muted)] truncate">com {h.barbeiro}</p>
                      </div>
                      <div className="text-xs font-mono text-[var(--text-muted)]">
                        {new Date(h.data).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <button 
              onClick={() => setDados(null)}
              className="mt-6 flex items-center justify-center w-full py-3 bg-transparent border border-[var(--border)] hover:border-[var(--amber)] text-white font-bold uppercase tracking-widest text-xs rounded transition-colors"
            >
              Consultar outro número
            </button>
          </div>
        )}

      </main>
    </div>
  );
}
