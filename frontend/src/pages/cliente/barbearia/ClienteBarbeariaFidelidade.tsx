// Aba Fidelidade — pontos, progresso e histórico
import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Star, Gift, CheckCircle, XCircle, Clock } from 'lucide-react';
import clienteApi from '../../../api/clienteApi';

interface FidelidadeData {
  saldo: number;
  totalGanhos: number;
  totalUsados: number;
  config: { ativo: boolean };
  recompensas: Array<{ 
    id: string; 
    nome: string; 
    pontosNecessarios: number; 
    tipo: string; 
    valorDesconto?: number; 
    servico?: { nome: string } 
  }>;
  historico: Array<{ id: string; tipo: 'GANHO' | 'RESGATE'; pontos: number; descricao: string; data: string }>;
}

export function ClienteBarbeariaFidelidade() {
  const { barbeariaId } = useParams<{ barbeariaId: string }>();
  const [dados, setDados] = useState<FidelidadeData | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [resgatando, setResgatando] = useState<string | null>(null);
  const [mensagemSucesso, setMensagemSucesso] = useState<string | null>(null);
  const [mensagemErro, setMensagemErro] = useState<string | null>(null);

  useEffect(() => {
    carregarFidelidade();
  }, [barbeariaId]);

  function carregarFidelidade() {
    if (barbeariaId) {
      clienteApi.get<FidelidadeData>(`/cliente/barbearia/${barbeariaId}/fidelidade`)
        .then(res => setDados(res.data))
        .catch(() => { /* empty */ })
        .finally(() => setCarregando(false));
    }
  }

  async function resgatar(recompensaId: string) {
    if (!confirm('Deseja realmente resgatar esta recompensa?')) return;
    
    setResgatando(recompensaId);
    try {
      await clienteApi.post(`/cliente/barbearia/${barbeariaId}/fidelidade/resgatar`, { recompensaId });
      setMensagemSucesso('Recompensa resgatada com sucesso! Mostre no caixa.');
      carregarFidelidade(); // Recarrega para atualizar o saldo e o histórico
      setTimeout(() => setMensagemSucesso(null), 5000);
    } catch (error: any) {
      setMensagemErro(error.response?.data?.erro || 'Erro ao resgatar recompensa.');
      setTimeout(() => setMensagemErro(null), 5000);
    } finally {
      setResgatando(null);
    }
  }

  if (carregando) {
    return (
      <div className="flex items-center justify-center py-20 h-full">
        <div className="w-8 h-8 rounded-full border-2 border-[var(--amber)] border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!dados || !dados.config?.ativo) {
    return (
      <div className="flex flex-col items-center justify-center py-20 px-5 text-center h-full">
        <Gift size={48} className="text-[var(--text-disabled)] mb-4" />
        <h2 className="text-xl font-bold text-[var(--text-primary)] mb-2 font-interface">Programa Indisponível</h2>
        <p className="text-[var(--text-muted)] text-sm font-interface">Esta barbearia não possui o programa de fidelidade ativo no momento.</p>
      </div>
    );
  }

  // Cálculos para o anel de progresso
  const proximas = [...dados.recompensas].sort((a,b) => a.pontosNecessarios - b.pontosNecessarios).filter(r => r.pontosNecessarios > dados.saldo);
  const proxima = proximas.length > 0 ? proximas[0] : null;
  const maxPontos = proxima ? proxima.pontosNecessarios : (dados.recompensas.length > 0 ? Math.max(...dados.recompensas.map(r => r.pontosNecessarios)) : 100);
  const progresso = Math.min((dados.saldo / maxPontos) * 100, 100);

  const raio = 70;
  const circunferencia = 2 * Math.PI * raio;
  const dashoffset = circunferencia - (progresso / 100) * circunferencia;

  return (
    <div className="px-5 py-6 animate-fade-in max-w-2xl mx-auto">
      {/* Alertas */}
      {mensagemSucesso && (
        <div className="mb-6 bg-[rgba(34,197,94,0.1)] border border-[#22C55E] p-4 rounded-md flex items-center gap-3 animate-fade-in">
          <CheckCircle color="#22C55E" size={20} />
          <span className="text-[#22C55E] text-sm font-interface font-medium">{mensagemSucesso}</span>
        </div>
      )}
      {mensagemErro && (
        <div className="mb-6 bg-[rgba(239,68,68,0.1)] border border-[#EF4444] p-4 rounded-md flex items-center gap-3 animate-fade-in">
          <XCircle color="#EF4444" size={20} />
          <span className="text-[#EF4444] text-sm font-interface font-medium">{mensagemErro}</span>
        </div>
      )}

      {/* Título Principal */}
      <div className="mb-8">
        <h1 style={{ fontFamily: 'var(--fonte-interface)', fontSize: '24px', fontWeight: 600, color: 'var(--text-primary)' }}>
          Seus Pontos
        </h1>
        <p style={{ fontFamily: 'var(--fonte-interface)', fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>
          Acompanhe seu progresso e resgate prêmios exclusivos.
        </p>
      </div>

      {/* Progress Ring (SVG) */}
      <div className="flex flex-col items-center justify-center mb-10">
        <div className="relative flex items-center justify-center mb-4">
          <svg className="transform -rotate-90" width="180" height="180">
            {/* Fundo do anel */}
            <circle
              cx="90" cy="90" r={raio}
              fill="transparent"
              stroke="var(--fundo-sidebar)"
              strokeWidth="8"
            />
            {/* Anel de progresso com glow */}
            <circle
              cx="90" cy="90" r={raio}
              fill="transparent"
              stroke="var(--amber)"
              strokeWidth="8"
              strokeDasharray={circunferencia}
              strokeDashoffset={dashoffset}
              strokeLinecap="round"
              className="transition-all duration-1000 ease-out"
              style={{ filter: 'drop-shadow(0 0 4px rgba(var(--cor-primaria-rgb), 0.5))' }}
            />
          </svg>
          
          <div className="absolute flex flex-col items-center justify-center text-center">
            <span style={{ fontFamily: 'var(--fonte-numeros)', fontSize: '42px', fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1 }}>
              {dados.saldo}
            </span>
            <span style={{ fontFamily: 'var(--fonte-interface)', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--amber)', marginTop: '2px', fontWeight: 600 }}>
              pontos
            </span>
          </div>
        </div>
        
        {proxima ? (
          <p style={{ fontFamily: 'var(--fonte-interface)', fontSize: '13px', color: 'var(--text-muted)' }}>
            Faltam <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{proxima.pontosNecessarios - dados.saldo} pts</span> para o prêmio: 
            <span style={{ color: 'var(--amber)', fontWeight: 500 }}> {proxima.nome}</span>
          </p>
        ) : dados.recompensas.length > 0 ? (
          <p style={{ fontFamily: 'var(--fonte-interface)', fontSize: '13px', color: 'var(--amber)', fontWeight: 500 }}>
            Você já tem pontos para todas as recompensas!
          </p>
        ) : null}
      </div>

      {/* Recompensas */}
      <div className="mb-10">
        <h2 style={{ fontFamily: 'var(--fonte-interface)', fontSize: '11px', letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '16px', fontWeight: 600 }}>
          Prêmios Disponíveis
        </h2>
        {dados.recompensas.length === 0 ? (
          <div className="p-6 text-center border border-dashed border-[var(--borda)] rounded-md">
             <p style={{ fontFamily: 'var(--fonte-interface)', fontSize: '13px', color: 'var(--text-muted)' }}>Nenhum prêmio disponível.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {dados.recompensas.sort((a,b) => a.pontosNecessarios - b.pontosNecessarios).map(rec => {
              const podeResgatar = dados.saldo >= rec.pontosNecessarios;
              const falta = rec.pontosNecessarios - dados.saldo;
              return (
                <div key={rec.id} className="p-4 rounded-md flex items-center justify-between" style={{
                  background: 'var(--fundo-sidebar)',
                  border: podeResgatar ? '1px solid var(--amber)' : '1px solid var(--borda)',
                }}>
                  <div>
                    <h3 style={{ fontFamily: 'var(--fonte-interface)', fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)' }}>{rec.nome}</h3>
                    <p style={{ fontFamily: 'var(--fonte-interface)', fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                      {rec.pontosNecessarios} pts • {rec.tipo === 'SERVICO_GRATIS' ? `Serviço: ${rec.servico?.nome}` : (rec.tipo === 'DESCONTO_PERCENTUAL' ? `Desc. ${rec.valorDesconto}%` : `Desc. R$${rec.valorDesconto}`)}
                    </p>
                  </div>
                  
                  {podeResgatar ? (
                    <button 
                      onClick={() => resgatar(rec.id)}
                      disabled={resgatando === rec.id}
                      className="btn-ghost"
                      style={{ padding: '8px 16px', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.04em' }}
                    >
                      {resgatando === rec.id ? 'Aguarde' : 'Resgatar'}
                    </button>
                  ) : (
                    <div className="px-3 py-1.5 rounded bg-[var(--bg-surface)] border border-[var(--borda)]" style={{ fontFamily: 'var(--fonte-interface)', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-disabled)', fontWeight: 600 }}>
                      Bloqueado
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Histórico Timeline */}
      <div>
        <h2 style={{ fontFamily: 'var(--fonte-interface)', fontSize: '11px', letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '20px', fontWeight: 600 }}>
          Histórico
        </h2>
        {dados.historico.length === 0 ? (
          <p style={{ fontFamily: 'var(--fonte-interface)', fontSize: '13px', color: 'var(--text-muted)', textAlign: 'center', padding: '1rem 0' }}>
            Nenhuma movimentação ainda.
          </p>
        ) : (
          <div className="relative ml-3 border-l border-[var(--borda)] pl-6 flex flex-col gap-6">
            {dados.historico.map(h => (
              <div key={h.id} className="relative">
                {/* Dot Timeline */}
                <div className="absolute -left-[30px] top-[2px] w-3 h-3 rounded-full" 
                     style={{ background: h.tipo === 'GANHO' ? 'var(--amber)' : 'var(--bg-surface)', border: h.tipo === 'GANHO' ? 'none' : '2px solid var(--text-muted)' }} />
                
                <div className="flex justify-between items-start">
                  <div>
                    <p style={{ fontFamily: 'var(--fonte-interface)', fontSize: '14px', fontWeight: 500, color: 'var(--text-primary)' }}>{h.descricao}</p>
                    <div className="flex items-center gap-1.5 mt-1" style={{ color: 'var(--text-muted)' }}>
                      <Clock size={10} />
                      <p style={{ fontFamily: 'var(--fonte-numeros)', fontSize: '11px' }}>
                        {new Date(h.data).toLocaleDateString('pt-BR')}
                      </p>
                    </div>
                  </div>
                  <span style={{ fontFamily: 'var(--fonte-numeros)', fontSize: '15px', fontWeight: 600, color: h.tipo === 'GANHO' ? 'var(--amber)' : 'var(--text-primary)' }}>
                    {h.tipo === 'GANHO' ? '+' : '-'}{h.pontos}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
