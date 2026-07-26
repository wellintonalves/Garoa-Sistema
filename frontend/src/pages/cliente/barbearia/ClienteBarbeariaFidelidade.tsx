// Aba Fidelidade — pontos, progresso e histórico
import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Gift, CheckCircle, XCircle, Clock, ShareNetwork, Copy } from '@phosphor-icons/react';
import clienteApi from '../../../api/clienteApi';
import { SkeletonCard, SkeletonText } from '../../../components/ui/Skeleton';
import { EstadoVazio } from '../../../components/ui/EstadoVazio';

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
  historico: Array<{ id: string; tipo: 'GANHO' | 'RESGATE'; status?: string; pontos: number; descricao: string; data: string }>;
}

export function ClienteBarbeariaFidelidade() {
  const { barbeariaId } = useParams<{ barbeariaId: string }>();
  const [dados, setDados] = useState<FidelidadeData | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [resgatando, setResgatando] = useState<string | null>(null);
  const [mensagemSucesso, setMensagemSucesso] = useState<string | null>(null);
  const [mensagemErro, setMensagemErro] = useState<string | null>(null);
  const [codigoIndicacao, setCodigoIndicacao] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);

  useEffect(() => {
    carregarFidelidade();
    clienteApi.get('/cliente/meu-codigo-indicacao')
      .then(res => setCodigoIndicacao(res.data.codigo))
      .catch(() => {});
  }, [barbeariaId]);

  function carregarFidelidade() {
    if (barbeariaId) {
      setCarregando(true);
      clienteApi.get<FidelidadeData>(`/cliente/barbearia/${barbeariaId}/fidelidade`)
        .then(res => setDados(res.data))
        .catch(() => { /* empty */ })
        .finally(() => setCarregando(false));
    }
  }

  function copiarCodigo() {
    if (codigoIndicacao) {
      navigator.clipboard.writeText(codigoIndicacao).then(() => {
        setCopiado(true);
        setTimeout(() => setCopiado(false), 2000);
      });
    }
  }

  async function resgatar(recompensaId: string) {
    if (!confirm('Deseja realmente resgatar esta recompensa?')) return;
    
    setResgatando(recompensaId);
    try {
      await clienteApi.post(`/cliente/barbearia/${barbeariaId}/fidelidade/resgatar`, { recompensaId });
      setMensagemSucesso('Solicitação enviada! Confirme no caixa na sua próxima visita.');
      carregarFidelidade();
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
      <div className="px-5 py-6 animate-fade-in max-w-2xl mx-auto flex flex-col gap-6">
        <SkeletonText lines={2} style={{ width: '50%' }} />
        <SkeletonCard style={{ height: '180px', width: '100%', borderRadius: '12px' }} />
        <SkeletonCard style={{ height: '100px', width: '100%' }} />
        <div className="flex flex-col gap-3">
          <SkeletonCard style={{ height: '70px', width: '100%' }} />
          <SkeletonCard style={{ height: '70px', width: '100%' }} />
        </div>
      </div>
    );
  }

  if (!dados || !dados.config?.ativo) {
    return (
      <div className="px-5 py-12 animate-fade-in max-w-2xl mx-auto">
        <EstadoVazio
          icone={<Gift size={48} />}
          titulo="Programa Indisponível"
          descricao="Esta barbearia não possui o programa de fidelidade ativo no momento."
        />
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
    <div className="px-5 py-6 animate-fade-in max-w-2xl mx-auto pb-16">
      {/* Alertas */}
      {mensagemSucesso && (
        <div className="mb-6 p-4 rounded-md flex items-center gap-3 animate-fade-in" style={{ background: 'var(--sucesso-fundo)', border: '1px solid var(--sucesso)' }}>
          <CheckCircle weight="fill" style={{ color: 'var(--sucesso)' }} size={20} />
          <span style={{ color: 'var(--sucesso)', fontSize: '13px', fontFamily: 'var(--fonte-interface)', fontWeight: 600 }}>{mensagemSucesso}</span>
        </div>
      )}
      {mensagemErro && (
        <div className="mb-6 p-4 rounded-md flex items-center gap-3 animate-fade-in" style={{ background: 'var(--perigo-fundo)', border: '1px solid var(--erro)' }}>
          <XCircle weight="fill" style={{ color: 'var(--erro)' }} size={20} />
          <span style={{ color: 'var(--erro)', fontSize: '13px', fontFamily: 'var(--fonte-interface)', fontWeight: 600 }}>{mensagemErro}</span>
        </div>
      )}

      {/* Título Principal */}
      <div className="mb-8">
        <h1 style={{ fontFamily: 'var(--fonte-serif)', fontSize: '24px', fontWeight: 600, color: 'var(--text-primary)' }}>
          Seus Pontos
        </h1>
        <p style={{ fontFamily: 'var(--fonte-interface)', fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>
          Acompanhe seu progresso e resgate prêmios exclusivos.
        </p>
      </div>

      {/* Progress Ring (SVG) */}
      <div className="flex flex-col items-center justify-center mb-10 p-6 rounded-xl bg-[var(--fundo-sidebar)] border border-[var(--borda)] shadow-sm">
        <div className="relative flex items-center justify-center mb-4">
          <svg className="transform -rotate-90" width="180" height="180">
            {/* Fundo do anel */}
            <circle
              cx="90" cy="90" r={raio}
              fill="transparent"
              stroke="var(--superficie-2)"
              strokeWidth="10"
            />
            {/* Anel de progresso com glow */}
            <circle
              cx="90" cy="90" r={raio}
              fill="transparent"
              stroke="var(--amber)"
              strokeWidth="10"
              strokeDasharray={circunferencia}
              strokeDashoffset={dashoffset}
              strokeLinecap="round"
              className="transition-all duration-1000 ease-out"
              style={{ filter: 'drop-shadow(0 0 6px rgba(var(--cor-primaria-rgb), 0.4))' }}
            />
          </svg>
          
          <div className="absolute flex flex-col items-center justify-center text-center">
            <span style={{ fontFamily: 'var(--fonte-mono)', fontSize: '42px', fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1 }}>
              {dados.saldo}
            </span>
            <span style={{ fontFamily: 'var(--fonte-interface)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--amber)', marginTop: '4px', fontWeight: 600 }}>
              pontos
            </span>
          </div>
        </div>
        
        {proxima ? (
          <p style={{ fontFamily: 'var(--fonte-interface)', fontSize: '13px', color: 'var(--text-muted)', textAlign: 'center' }}>
            Faltam <span style={{ color: 'var(--text-primary)', fontWeight: 700, fontFamily: 'var(--fonte-mono)' }}>{proxima.pontosNecessarios - dados.saldo} pts</span> para o prêmio: 
            <span style={{ color: 'var(--amber)', fontWeight: 600 }}> {proxima.nome}</span>
          </p>
        ) : dados.recompensas.length > 0 ? (
          <p style={{ fontFamily: 'var(--fonte-interface)', fontSize: '13px', color: 'var(--amber)', fontWeight: 600, textAlign: 'center' }}>
            Você já tem pontos suficientes para resgatar qualquer recompensa!
          </p>
        ) : null}
      </div>

      {/* Recompensas */}
      <div className="mb-10">
        <h2 style={{ fontFamily: 'var(--fonte-interface)', fontSize: '11px', letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '16px', fontWeight: 600 }}>
          Prêmios Disponíveis
        </h2>
        {dados.recompensas.length === 0 ? (
          <EstadoVazio
            icone={<Gift size={36} />}
            titulo="Nenhum prêmio disponível"
            descricao="Novas recompensas serão adicionadas em breve."
          />
        ) : (
          <div className="flex flex-col gap-3">
            {dados.recompensas.sort((a,b) => a.pontosNecessarios - b.pontosNecessarios).map(rec => {
              const podeResgatar = dados.saldo >= rec.pontosNecessarios;
              return (
                <div key={rec.id} className="p-4 rounded-md flex items-center justify-between transition-all" style={{
                  background: 'var(--fundo-sidebar)',
                  border: podeResgatar ? '1px solid var(--amber)' : '1px solid var(--borda)',
                }}>
                  <div>
                    <h3 style={{ fontFamily: 'var(--fonte-interface)', fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)' }}>{rec.nome}</h3>
                    <p style={{ fontFamily: 'var(--fonte-interface)', fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                      <span style={{ fontFamily: 'var(--fonte-mono)', fontWeight: 700, color: podeResgatar ? 'var(--amber)' : 'var(--text-muted)' }}>{rec.pontosNecessarios} pts</span> • {rec.tipo === 'SERVICO_GRATIS' ? `Serviço: ${rec.servico?.nome}` : (rec.tipo === 'DESCONTO_PERCENTUAL' ? `Desc. ${rec.valorDesconto}%` : `Desc. R$${rec.valorDesconto}`)}
                    </p>
                  </div>
                  
                  {podeResgatar ? (
                    <button 
                      onClick={() => resgatar(rec.id)}
                      disabled={resgatando === rec.id}
                      className="btn-primary"
                      style={{ padding: '8px 16px', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600 }}
                    >
                      {resgatando === rec.id ? 'Aguarde' : 'Resgatar'}
                    </button>
                  ) : (
                    <div className="px-3 py-1.5 rounded bg-[var(--superficie-1)] border border-[var(--borda)]" style={{ fontFamily: 'var(--fonte-interface)', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-disabled)', fontWeight: 600 }}>
                      Bloqueado
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Código de Indicação */}
      {codigoIndicacao && (
        <div className="mb-10 p-5 rounded-xl" style={{ background: 'var(--fundo-sidebar)', border: '1px solid var(--borda)' }}>
          <div className="flex items-center gap-2 mb-2">
            <ShareNetwork size={18} style={{ color: 'var(--amber)' }} weight="bold" />
            <h2 style={{ fontFamily: 'var(--fonte-interface)', fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
              Indique amigos e ganhe pontos
            </h2>
          </div>
          <p style={{ fontFamily: 'var(--fonte-interface)', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '14px', lineHeight: 1.5 }}>
            Compartilhe seu código exclusivo. Quando um amigo concluir o primeiro agendamento, você é recompensado automaticamente!
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{
              flex: 1, padding: '12px 16px', background: 'var(--fundo-input)',
              border: '1px solid var(--amber)', borderRadius: '8px',
              fontFamily: 'var(--fonte-mono)', fontSize: '20px', fontWeight: 700,
              color: 'var(--amber)', letterSpacing: '0.2em', textAlign: 'center',
            }}>
              {codigoIndicacao}
            </div>
            <button onClick={copiarCodigo} style={{
              padding: '12px 16px', background: copiado ? 'var(--sucesso-fundo)' : 'rgba(var(--cor-primaria-rgb), 0.15)',
              border: `1px solid ${copiado ? 'var(--sucesso)' : 'var(--amber)'}`,
              borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px',
              color: copiado ? 'var(--sucesso)' : 'var(--amber)', fontSize: '12px', fontFamily: 'var(--fonte-interface)',
              fontWeight: 600, transition: 'all 0.2s',
            }}>
              {copiado ? <CheckCircle size={16} weight="fill" /> : <Copy size={16} />}
              {copiado ? 'Copiado!' : 'Copiar'}
            </button>
          </div>
        </div>
      )}

      {/* Histórico Timeline */}
      <div>
        <h2 style={{ fontFamily: 'var(--fonte-interface)', fontSize: '11px', letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '20px', fontWeight: 600 }}>
          Histórico
        </h2>
        {dados.historico.length === 0 ? (
          <EstadoVazio
            icone={<Clock size={36} />}
            titulo="Nenhum histórico"
            descricao="Suas movimentações de pontos aparecerão aqui após seus agendamentos."
          />
        ) : (
          <div className="relative ml-3 border-l border-[var(--borda)] pl-6 flex flex-col gap-6">
            {dados.historico.map(h => (
              <div key={h.id} className="relative">
                {/* Dot Timeline */}
                <div className="absolute -left-[30px] top-[2px] w-3 h-3 rounded-full" 
                     style={{ background: h.tipo === 'GANHO' ? 'var(--amber)' : 'var(--superficie-2)', border: h.tipo === 'GANHO' ? 'none' : '2px solid var(--text-muted)' }} />
                
                <div className="flex justify-between items-start gap-4">
                  <div>
                    <p style={{ fontFamily: 'var(--fonte-interface)', fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>
                      {h.descricao}
                      {h.tipo === 'RESGATE' && h.status && (
                        <span style={{ 
                          marginLeft: '8px', fontSize: '10px', padding: '2px 6px', borderRadius: '4px', fontWeight: 600,
                          background: h.status === 'CONFIRMADO' ? 'var(--sucesso-fundo)' : h.status === 'PENDENTE' ? 'rgba(var(--cor-primaria-rgb), 0.1)' : 'var(--perigo-fundo)',
                          color: h.status === 'CONFIRMADO' ? 'var(--sucesso)' : h.status === 'PENDENTE' ? 'var(--cor-primaria)' : 'var(--perigo)'
                        }}>
                          {h.status}
                        </span>
                      )}
                    </p>
                    <div className="flex items-center gap-1.5 mt-1" style={{ color: 'var(--text-muted)' }}>
                      <Clock size={12} />
                      <p style={{ fontFamily: 'var(--fonte-mono)', fontSize: '11px' }}>
                        {new Date(h.data).toLocaleDateString('pt-BR')}
                      </p>
                    </div>
                  </div>
                  <span style={{ 
                    fontFamily: 'var(--fonte-mono)', fontSize: '15px', fontWeight: 700, 
                    color: h.status === 'CANCELADO' ? 'var(--text-disabled)' : h.tipo === 'GANHO' ? 'var(--amber)' : 'var(--text-primary)',
                    textDecoration: h.status === 'CANCELADO' ? 'line-through' : 'none'
                  }}>
                    {h.tipo === 'GANHO' ? '+' : ''}{h.pontos}
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
