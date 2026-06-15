// Aba Fidelidade — pontos, progresso e histórico
import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Star, Gift, TrendingUp, CheckCircle, XCircle } from 'lucide-react';
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
      <div className="flex items-center justify-center py-20">
        <div className="spinner w-8 h-8" />
      </div>
    );
  }

  if (!dados || !dados.config?.ativo) {
    return (
      <div className="flex flex-col items-center justify-center py-20 px-5 text-center">
        <Gift size={48} className="text-zinc-600 mb-4" />
        <h2 className="text-xl font-bold text-white mb-2">Programa Indisponível</h2>
        <p className="text-zinc-400 text-sm">Esta barbearia não possui o programa de fidelidade ativo no momento.</p>
      </div>
    );
  }

  return (
    <div className="px-5 py-6 animate-fade-in relative">
      {/* Mensagens */}
      {mensagemSucesso && (
        <div className="mb-4 bg-green-900/50 border border-green-500 p-4 rounded flex items-center gap-3 animate-fade-in">
          <CheckCircle className="text-green-400" size={24} />
          <span className="text-green-100 text-sm">{mensagemSucesso}</span>
        </div>
      )}

      {mensagemErro && (
        <div className="mb-4 bg-red-900/50 border border-red-500 p-4 rounded flex items-center gap-3 animate-fade-in">
          <XCircle className="text-red-400" size={24} />
          <span className="text-red-100 text-sm">{mensagemErro}</span>
        </div>
      )}

      <h1 style={{ fontFamily: 'var(--fonte-interface)', fontSize: '24px', color: 'var(--text-primary)', marginBottom: '24px', letterSpacing: '0.04em' }}>
        Fidelidade
      </h1>

      {/* Card de Pontos */}
      <div className="p-6 mb-6" style={{
        background: 'linear-gradient(135deg, rgba(var(--cor-primaria-rgb), 0.10) 0%, var(--bg-surface) 100%)',
        border: '1px solid var(--amber)',
      }}>
        <div className="flex items-center gap-3 mb-4">
          <Star size={24} style={{ color: 'rgba(var(--cor-primaria-rgb), 0.15)' }} />
          <span style={{ fontFamily: 'var(--fonte-interface)', fontSize: '10px', letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--cor-icone)' }}>
            Seu Saldo
          </span>
        </div>
        <p style={{ fontFamily: 'var(--fonte-interface)', fontSize: '48px', color: 'rgba(var(--cor-primaria-rgb), 0.15)', lineHeight: 1 }}>
          {dados.saldo} <span className="text-lg text-[var(--cor-primaria)]/50">pts</span>
        </p>
        <p style={{ fontFamily: 'var(--fonte-numeros)', fontSize: '11px', color: 'var(--text-muted)', marginTop: '8px' }}>
          Você já acumulou {dados.totalGanhos} pts no total
        </p>
      </div>

      {/* Recompensas Disponíveis */}
      <div className="mb-8">
        <h2 style={{ fontFamily: 'var(--fonte-interface)', fontSize: '10px', letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--cor-icone)', marginBottom: '12px' }}>
          <Gift size={12} className="inline mr-1" /> Recompensas
        </h2>
        {dados.recompensas.length === 0 ? (
          <p className="text-xs text-zinc-500 text-center py-4 bg-zinc-900 rounded">Nenhuma recompensa disponível no momento.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {dados.recompensas.map(rec => {
              const podeResgatar = dados.saldo >= rec.pontosNecessarios;
              const falta = rec.pontosNecessarios - dados.saldo;
              return (
                <div key={rec.id} className="p-4 rounded border" style={{
                  background: 'var(--bg-surface)',
                  borderColor: podeResgatar ? 'var(--amber)' : 'var(--border)',
                  opacity: podeResgatar ? 1 : 0.7
                }}>
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="font-bold text-white text-sm">{rec.nome}</h3>
                    <span className="font-bold text-[var(--cor-primaria)] text-sm">{rec.pontosNecessarios} pts</span>
                  </div>
                  <p className="text-xs text-zinc-400 mb-4">
                    {rec.tipo === 'SERVICO_GRATIS' ? `Serviço: ${rec.servico?.nome}` : (rec.tipo === 'DESCONTO_PERCENTUAL' ? `Desconto de ${rec.valorDesconto}%` : `Desconto de R$${rec.valorDesconto}`)}
                  </p>
                  
                  {podeResgatar ? (
                    <button 
                      onClick={() => resgatar(rec.id)}
                      disabled={resgatando === rec.id}
                      className="w-full py-2 bg-[var(--cor-primaria)] hover:bg-[var(--cor-primaria)] text-black font-bold text-xs rounded transition-colors"
                    >
                      {resgatando === rec.id ? 'Resgatando...' : 'Resgatar Recompensa'}
                    </button>
                  ) : (
                    <div className="w-full py-2 bg-zinc-800 text-zinc-400 text-center font-bold text-xs rounded">
                      Faltam {falta} pts
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Histórico */}
      <div>
        <h2 style={{ fontFamily: 'var(--fonte-interface)', fontSize: '10px', letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--cor-icone)', marginBottom: '12px' }}>
          <TrendingUp size={12} className="inline mr-1" /> Histórico
        </h2>
        {dados.historico.length === 0 ? (
          <p style={{ fontFamily: 'var(--fonte-interface)', fontSize: '11px', color: 'var(--text-muted)', textAlign: 'center', padding: '2rem 0' }}>
            Nenhum registro ainda.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {dados.historico.map(h => (
              <div key={h.id} className="flex items-center justify-between p-3"
                style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
                <div>
                  <p style={{ fontFamily: 'var(--fonte-interface)', fontSize: '13px', color: 'var(--text-primary)' }}>{h.descricao}</p>
                  <p style={{ fontFamily: 'var(--fonte-numeros)', fontSize: '10px', color: 'var(--text-muted)' }}>
                    {new Date(h.data).toLocaleDateString('pt-BR')}
                  </p>
                </div>
                <span style={{ fontFamily: 'var(--fonte-interface)', fontSize: '20px', color: h.tipo === 'GANHO' ? 'var(--amber)' : 'var(--error-text)' }}>
                  {h.tipo === 'GANHO' ? '+' : ''}{h.pontos}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
