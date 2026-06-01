// Aba Fidelidade — pontos, progresso e histórico
import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Star, Gift, TrendingUp } from 'lucide-react';
import clienteApi from '../../../api/clienteApi';

interface FidelidadeData {
  totalPontos: number;
  pontosParaRecompensa: number;
  progresso: number;
  recompensasResgatadas: number;
  historico: Array<{ id: string; pontos: number; descricao: string; data: string }>;
}

export function ClienteBarbeariaFidelidade() {
  const { barbeariaId } = useParams<{ barbeariaId: string }>();
  const [dados, setDados] = useState<FidelidadeData | null>(null);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    if (barbeariaId) {
      clienteApi.get<FidelidadeData>(`/cliente/barbearia/${barbeariaId}/fidelidade`)
        .then(res => setDados(res.data))
        .catch(() => { /* empty */ })
        .finally(() => setCarregando(false));
    }
  }, [barbeariaId]);

  if (carregando) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="spinner w-8 h-8" />
      </div>
    );
  }

  if (!dados) return null;

  return (
    <div className="px-5 py-6 animate-fade-in">
      <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '24px', color: 'var(--text-primary)', marginBottom: '24px', letterSpacing: '0.04em' }}>
        Fidelidade
      </h1>

      {/* Card de Pontos */}
      <div className="p-6 mb-6" style={{
        background: 'linear-gradient(135deg, var(--amber-dim) 0%, var(--bg-surface) 100%)',
        border: '1px solid var(--amber)',
      }}>
        <div className="flex items-center gap-3 mb-4">
          <Star size={24} style={{ color: 'var(--amber-light)' }} />
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', letterSpacing: '0.15em', textTransform: 'uppercase' as const, color: 'var(--amber)' }}>
            Seus Pontos
          </span>
        </div>
        <p style={{ fontFamily: 'var(--font-display)', fontSize: '48px', color: 'var(--amber-light)', lineHeight: 1 }}>
          {dados.totalPontos}
        </p>
        <p style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-muted)', marginTop: '8px' }}>
          de {dados.pontosParaRecompensa} para a próxima recompensa
        </p>

        {/* Barra de progresso */}
        <div className="mt-4 w-full h-3" style={{ background: 'var(--bg-primary)', overflow: 'hidden' }}>
          <div className="h-full transition-all duration-500"
            style={{
              width: `${Math.min(dados.progresso, 100)}%`,
              background: 'linear-gradient(90deg, var(--amber) 0%, var(--amber-light) 100%)',
            }}
          />
        </div>
        <div className="flex justify-between mt-2">
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-muted)' }}>0</span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--amber)' }}>{dados.pontosParaRecompensa}</span>
        </div>
      </div>

      {/* Recompensas resgatadas */}
      <div className="flex items-center gap-3 p-4 mb-6" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
        <Gift size={20} style={{ color: 'var(--success-text)' }} />
        <div>
          <p style={{ fontFamily: 'var(--font-body)', fontWeight: 700, color: 'var(--text-primary)', fontSize: '14px' }}>
            {dados.recompensasResgatadas} recompensa{dados.recompensasResgatadas !== 1 ? 's' : ''} resgatada{dados.recompensasResgatadas !== 1 ? 's' : ''}
          </p>
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-muted)' }}>
            Continue acumulando!
          </p>
        </div>
      </div>

      {/* Histórico */}
      <div>
        <h2 style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', letterSpacing: '0.18em', textTransform: 'uppercase' as const, color: 'var(--amber)', marginBottom: '12px' }}>
          <TrendingUp size={12} className="inline mr-1" /> Histórico de Pontos
        </h2>
        {dados.historico.length === 0 ? (
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-muted)', textAlign: 'center', padding: '2rem 0' }}>
            Nenhum ponto registrado ainda.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {dados.historico.map(h => (
              <div key={h.id} className="flex items-center justify-between p-3"
                style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
                <div>
                  <p style={{ fontFamily: 'var(--font-body)', fontSize: '13px', color: 'var(--text-primary)' }}>{h.descricao}</p>
                  <p style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-muted)' }}>
                    {new Date(h.data).toLocaleDateString('pt-BR')}
                  </p>
                </div>
                <span style={{ fontFamily: 'var(--font-display)', fontSize: '20px', color: 'var(--amber)' }}>
                  +{h.pontos}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
