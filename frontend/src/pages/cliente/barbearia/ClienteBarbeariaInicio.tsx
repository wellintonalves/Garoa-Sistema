// Aba Início da barbearia — visão geral para o cliente
import { useState, useEffect } from 'react';
import { useNavigate, useOutletContext, useParams } from 'react-router-dom';
import { Calendar, Clock, Scissors, Plus, CalendarPlus, Navigation, RefreshCw, Clock4, MessageCircle, Star, MapPin } from 'lucide-react';
import clienteApi from '../../../api/clienteApi';
import { useClienteAuth } from '../../../hooks/useClienteAuth';

interface BarbeariaCtx {
  barbearia: { id: string; nome: string; logo: string | null } | null;
  barbeariaId: string;
}

interface AgendamentoItem {
  id: string;
  dataHora: string;
  status: string;
  valorCobrado: string;
  servico: { nome: string };
  barbeiro: { usuario: { nome: string } };
}

export function ClienteBarbeariaInicio() {
  const navigate = useNavigate();
  const { barbeariaId } = useParams<{ barbeariaId: string }>();
  const { barbearia } = useOutletContext<BarbeariaCtx>();
  const { cliente } = useClienteAuth();
  const [agendamentos, setAgendamentos] = useState<AgendamentoItem[]>([]);

  useEffect(() => {
    if (barbeariaId) {
      clienteApi.get<AgendamentoItem[]>(`/cliente/barbearia/${barbeariaId}/agendamentos`)
        .then(res => setAgendamentos(res.data))
        .catch(() => { /* empty */ });
    }
  }, [barbeariaId]);

  const agendamentosFuturos = agendamentos
    .filter(a => new Date(a.dataHora) >= new Date() && a.status !== 'CANCELADO' && a.status !== 'CONCLUIDO')
    .sort((a, b) => new Date(a.dataHora).getTime() - new Date(b.dataHora).getTime());

  const agendamentosPassados = agendamentos
    .filter(a => new Date(a.dataHora) < new Date() || a.status === 'CONCLUIDO')
    .sort((a, b) => new Date(b.dataHora).getTime() - new Date(a.dataHora).getTime());

  const prox = agendamentosFuturos.length > 0 ? agendamentosFuturos[0] : null;

  const getSaudacao = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Bom dia';
    if (h < 18) return 'Boa tarde';
    return 'Boa noite';
  };

  const calcCountdown = (dataHora: string) => {
    const diff = new Date(dataHora).getTime() - Date.now();
    if (diff <= 0) return null;
    const dias = Math.floor(diff / 86400000);
    const horas = Math.floor((diff % 86400000) / 3600000);
    if (dias > 0) return `em ${dias} dia${dias > 1 ? 's' : ''} e ${horas} hora${horas > 1 ? 's' : ''}`;
    if (horas > 0) return `em ${horas} hora${horas > 1 ? 's' : ''}`;
    const min = Math.floor((diff % 3600000) / 60000);
    return `em ${min} minuto${min > 1 ? 's' : ''}`;
  };

  const sessoes = agendamentosPassados.length + (prox ? 1 : 0);
  
  // Barbeiro favorito
  const barbeiroCounts: Record<string, number> = {};
  agendamentosPassados.forEach(a => {
    const bName = a.barbeiro.usuario.nome;
    barbeiroCounts[bName] = (barbeiroCounts[bName] || 0) + 1;
  });
  let favBarbeiro = 'Nenhum';
  let favCount = 0;
  Object.entries(barbeiroCounts).forEach(([nome, count]) => {
    if (count > favCount) { favBarbeiro = nome; favCount = count; }
  });

  // Dias desde o último corte
  const ultimoConcluido = agendamentosPassados.find(a => a.status === 'CONCLUIDO');
  const diasDesdeUltimo = ultimoConcluido ? Math.floor((Date.now() - new Date(ultimoConcluido.dataHora).getTime()) / 86400000) : null;

  // Fidelidade Mock (em um app real viria da API específica)
  const fidelidade = { saldo: 150, proxima: 300 };
  const fidPercent = Math.min(100, Math.round((fidelidade.saldo / fidelidade.proxima) * 100));

  const fmtData = (d: string) => new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
  const fmtHora = (d: string) => new Date(d).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  const fmtDataExt = (d: string) => new Date(d).toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' });

  return (
    <div className="px-5 py-6 animate-fade-in flex flex-col md:flex-row gap-6 max-w-6xl mx-auto">
      {/* Coluna Principal */}
      <div className="flex-1 flex flex-col">
        
        {/* Header Responsivo */}
        <div className="mb-6 flex flex-col md:flex-row md:items-start md:justify-between gap-4">
          <div>
            <p style={{ fontFamily: 'var(--fonte-interface)', fontSize: '12px', color: 'var(--text-muted)' }}>
              {getSaudacao()}, <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{cliente?.nome.split(' ')[0] || 'Cliente'}</span>.
            </p>
            {sessoes > 0 && (
              <p style={{ fontFamily: 'var(--fonte-interface)', fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                Esta será sua <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{sessoes}ª sessão</span> conosco.
              </p>
            )}
          </div>
          
          <button onClick={() => navigate(`/cliente/barbearia/${barbeariaId}/agendar`)} className="hidden md:flex btn-primary" style={{ textTransform: 'uppercase', fontSize: '12px', fontWeight: 600 }}>
            <Plus size={16} /> Novo Agendamento
          </button>
        </div>

        {/* Letterhead (Somente Mobile) */}
        <div className="md:hidden flex flex-col items-center justify-center py-4 mb-6 relative">
          <div style={{ position: 'absolute', top: 0, left: '50%', transform: 'translate(-50%, -50%) rotate(45deg)', width: '6px', height: '6px', background: 'var(--amber)' }} />
          <div className="w-full h-px absolute top-0" style={{ background: 'var(--borda)' }} />
          
          <h1 style={{ fontFamily: 'var(--fonte-interface)', fontWeight: 600, fontSize: '22px', letterSpacing: '0.4em', textTransform: 'uppercase', color: 'var(--text-primary)' }}>
            {barbearia?.nome || 'VALEN BARBER'}
          </h1>
          <p style={{ fontFamily: 'var(--fonte-interface)', fontSize: '9px', letterSpacing: '0.4em', color: 'var(--amber)', textTransform: 'uppercase', marginTop: '4px' }}>
            Estabelecida em 2024
          </p>

          <div style={{ position: 'absolute', bottom: 0, left: '50%', transform: 'translate(-50%, 50%) rotate(45deg)', width: '6px', height: '6px', background: 'var(--amber)' }} />
          <div className="w-full h-px absolute bottom-0" style={{ background: 'var(--borda)' }} />
        </div>

        {/* Hero Card */}
        {prox ? (
          <div className="hero-card mb-8">
            <div className="flex flex-col md:flex-row md:items-start md:justify-between mb-4">
              <div>
                <p style={{ fontFamily: 'var(--fonte-interface)', fontSize: '9px', letterSpacing: '0.32em', textTransform: 'uppercase', color: 'var(--amber)', marginBottom: '8px' }}>
                  Próximo Atendimento
                </p>
                <p style={{ fontFamily: 'var(--fonte-numeros)', fontSize: '11px', color: 'var(--text-muted)' }}>
                  {calcCountdown(prox.dataHora) || 'Agendamento para hoje'}
                </p>
              </div>
            </div>

            <div className="flex flex-col md:flex-row md:items-end md:justify-between mb-6">
              <div>
                <h2 className="text-[24px] md:text-[26px]" style={{ fontFamily: 'var(--fonte-interface)', fontWeight: 500, color: 'var(--text-primary)' }}>
                  {prox.servico.nome}
                </h2>
                <p style={{ fontFamily: 'var(--fonte-interface)', fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>
                  com <span style={{ color: 'var(--text-primary)' }}>{prox.barbeiro.usuario.nome}</span>
                </p>
              </div>
              <div className="hidden md:block">
                <span style={{ fontFamily: 'var(--fonte-numeros)', fontSize: '15px', color: 'var(--amber)', fontWeight: 500 }}>
                  R$ {prox.valorCobrado || '45.00'}
                </span>
              </div>
            </div>

            <div style={{ borderTop: '1px dashed #2A2A2A', margin: '20px -20px', padding: '0 20px' }} />

            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-6">
                <p className="flex items-center gap-2" style={{ fontFamily: 'var(--fonte-interface)', fontSize: '12px', color: 'var(--text-primary)' }}>
                  <Calendar size={14} style={{ color: 'var(--amber)' }} /> 
                  <span className="capitalize">{fmtDataExt(prox.dataHora)}</span> <span className="text-muted mx-1">·</span> {fmtHora(prox.dataHora)}
                </p>
                <p className="flex items-center gap-2 justify-between w-full md:w-auto" style={{ fontFamily: 'var(--fonte-interface)', fontSize: '12px', color: 'var(--text-primary)' }}>
                  <span className="flex items-center gap-2"><MapPin size={14} style={{ color: 'var(--amber)' }} /> Av. Brasil, 100</span>
                  <span className="md:hidden text-[11px] font-mono text-muted">2,3 km</span>
                </p>
              </div>

              <div className="flex items-center gap-2 mt-2 md:mt-0">
                <button className="btn-ghost flex-1 md:flex-none"><CalendarPlus size={14} /> Calendário</button>
                <button className="btn-ghost-amber flex-1 md:flex-none"><Navigation size={14} /> Como chegar</button>
              </div>
            </div>
          </div>
        ) : (
          <div className="hero-card mb-8 flex flex-col items-center justify-center py-10 text-center">
            <Calendar size={32} style={{ color: 'var(--text-disabled)', marginBottom: '16px' }} />
            <h2 style={{ fontFamily: 'var(--fonte-interface)', fontSize: '16px', color: 'var(--text-primary)', marginBottom: '8px', fontWeight: 500 }}>
              Nenhum agendamento futuro
            </h2>
            <p style={{ fontFamily: 'var(--fonte-interface)', fontSize: '13px', color: 'var(--text-muted)' }}>
              Que tal agendar um horário para o seu próximo corte?
            </p>
            <div className="md:hidden mt-6 w-full">
              <button onClick={() => navigate(`/cliente/barbearia/${barbeariaId}/agendar`)} className="btn-primary w-full justify-center" style={{ padding: '14px', fontSize: '13px', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                <Plus size={16} /> Novo Agendamento
              </button>
            </div>
          </div>
        )}

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
          <div className="stat-card relative overflow-hidden">
            <p style={{ fontSize: '9px', letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Fidelidade</p>
            <p className="mt-2" style={{ fontFamily: 'var(--fonte-numeros)', fontSize: '22px', color: 'var(--text-primary)', lineHeight: 1 }}>{fidelidade.saldo} <span className="text-sm opacity-50">pts</span></p>
            <p style={{ fontFamily: 'var(--fonte-interface)', fontSize: '10px', color: 'var(--amber)', marginTop: '4px' }}>Faltam {fidelidade.proxima - fidelidade.saldo} para Corte Grátis</p>
            <div className="w-full h-[2px] mt-3 rounded overflow-hidden" style={{ background: 'var(--borda)' }}>
              <div className="h-full" style={{ background: 'var(--amber)', width: `${fidPercent}%` }} />
            </div>
          </div>
          
          <div className="stat-card">
            <p style={{ fontSize: '9px', letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Visitas</p>
            <p className="mt-2" style={{ fontFamily: 'var(--fonte-numeros)', fontSize: '22px', color: 'var(--text-primary)', lineHeight: 1 }}>{sessoes}</p>
            <p style={{ fontFamily: 'var(--fonte-interface)', fontSize: '10px', color: 'var(--text-muted)', marginTop: '4px' }}>Desde março de 2024</p>
          </div>

          <div className="stat-card">
            <p style={{ fontSize: '9px', letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Barbeiro Favorito</p>
            <p className="mt-2" style={{ fontFamily: 'var(--fonte-interface)', fontSize: '16px', fontWeight: 500, color: 'var(--text-primary)' }}>{favBarbeiro}</p>
            <p style={{ fontFamily: 'var(--fonte-interface)', fontSize: '10px', color: 'var(--text-muted)', marginTop: '4px' }}>{favCount > 0 ? `${favCount} atendimentos com ele` : 'Nenhum histórico'}</p>
          </div>

          <div className="stat-card">
            <p style={{ fontSize: '9px', letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Último Corte</p>
            <p className="mt-2" style={{ fontFamily: 'var(--fonte-interface)', fontSize: '16px', fontWeight: 500, color: 'var(--text-primary)' }}>{diasDesdeUltimo !== null ? `há ${diasDesdeUltimo} dia${diasDesdeUltimo > 1 ? 's' : ''}` : 'Nenhum'}</p>
            <p style={{ fontFamily: 'var(--fonte-interface)', fontSize: '10px', color: 'var(--amber)', marginTop: '4px' }}>Hora de marcar?</p>
          </div>
        </div>

        {/* Histórico */}
        {agendamentosPassados.length > 0 && (
          <div className="mb-6 md:mb-0">
            <h2 className="section-label-amber mb-4">Histórico</h2>
            
            {/* Tabela (Desktop) */}
            <div className="hidden md:block overflow-x-auto border border-[var(--borda)] rounded-md">
              <table className="w-full text-left" style={{ borderCollapse: 'collapse' }}>
                <tbody>
                  {agendamentosPassados.map(a => (
                    <tr key={a.id} className="border-b border-[var(--borda)] last:border-0 hover:bg-[var(--bg-surface2)] transition-colors">
                      <td className="p-4" style={{ fontFamily: 'var(--fonte-interface)', fontSize: '13px', color: 'var(--text-primary)' }}>{a.servico.nome}</td>
                      <td className="p-4" style={{ fontFamily: 'var(--fonte-interface)', fontSize: '13px', color: 'var(--text-muted)' }}>com {a.barbeiro.usuario.nome}</td>
                      <td className="p-4" style={{ fontFamily: 'var(--fonte-numeros)', fontSize: '13px', color: 'var(--text-primary)' }}>R$ {a.valorCobrado || '45.00'}</td>
                      <td className="p-4" style={{ fontFamily: 'var(--fonte-interface)', fontSize: '13px', color: 'var(--text-muted)' }}>{fmtData(a.dataHora)}</td>
                      <td className="p-4"><span style={{ fontSize: '10px', fontWeight: 500, padding: '3px 10px', borderRadius: '3px', background: '#1A3D2A', color: '#22C55E' }}>Concluído</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Lista (Mobile) */}
            <div className="md:hidden flex flex-col">
              {agendamentosPassados.slice(0, 3).map(a => (
                <div key={a.id} className="flex items-center justify-between py-3 border-b border-[var(--borda)] last:border-0">
                  <div>
                    <p style={{ fontFamily: 'var(--fonte-interface)', fontSize: '13px', color: 'var(--text-primary)' }}>{a.servico.nome}</p>
                    <p style={{ fontFamily: 'var(--fonte-interface)', fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>com {a.barbeiro.usuario.nome}</p>
                  </div>
                  <span style={{ fontFamily: 'var(--fonte-numeros)', fontSize: '11px', color: 'var(--text-muted)' }}>{fmtData(a.dataHora)}</span>
                </div>
              ))}
              {agendamentosPassados.length > 3 && (
                <button className="py-4 text-center w-full mt-2" style={{ fontFamily: 'var(--fonte-interface)', fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.04em' }}>
                  Ver todo histórico →
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Painel de Atalhos (Sidebar direita no Desktop, Empilhado no Mobile) */}
      <div className="w-full md:w-[280px] flex-shrink-0">
        <div className="md:p-5 md:border md:border-[var(--borda)] md:rounded-lg md:bg-[var(--fundo-sidebar)]">
          <h2 className="section-label-amber mb-4 md:mb-5">Atalhos</h2>
          <div className="flex flex-col gap-3">
            {ultimoConcluido && (
              <button className="flex items-center gap-3 w-full text-left p-3 md:p-2.5 rounded-md border border-[var(--borda)] bg-[var(--fundo-input)] hover:bg-[var(--borda)] transition-colors">
                <div className="icon-box-disabled w-8 h-8"><RefreshCw size={14} /></div>
                <div>
                  <p style={{ fontFamily: 'var(--fonte-interface)', fontSize: '13px', color: 'var(--text-primary)' }}>Repetir último corte</p>
                  <p style={{ fontFamily: 'var(--fonte-interface)', fontSize: '11px', color: 'var(--text-muted)' }}>{ultimoConcluido.servico.nome} · {ultimoConcluido.barbeiro.usuario.nome}</p>
                </div>
              </button>
            )}

            <button className="flex items-center gap-3 w-full text-left p-3 md:p-2.5 rounded-md border border-[var(--borda)] bg-[var(--fundo-input)] hover:bg-[var(--borda)] transition-colors">
              <div className="icon-box-amber w-8 h-8"><Clock4 size={14} /></div>
              <p style={{ fontFamily: 'var(--fonte-interface)', fontSize: '13px', color: 'var(--text-primary)' }}>Ver horários hoje</p>
            </button>

            <button className="flex items-center gap-3 w-full text-left p-3 md:p-2.5 rounded-md border border-[var(--borda)] bg-[var(--fundo-input)] hover:bg-[var(--borda)] transition-colors">
              <div className="icon-box-disabled w-8 h-8"><MessageCircle size={14} /></div>
              <p style={{ fontFamily: 'var(--fonte-interface)', fontSize: '13px', color: 'var(--text-primary)' }}>Falar com a barbearia</p>
            </button>

            <button onClick={() => navigate(`/cliente/barbearia/${barbeariaId}/fidelidade`)} className="hidden md:flex items-center gap-3 w-full text-left p-3 md:p-2.5 rounded-md border border-[var(--borda)] bg-[var(--fundo-input)] hover:bg-[var(--borda)] transition-colors">
              <div className="icon-box-disabled w-8 h-8"><Star size={14} /></div>
              <div>
                <p style={{ fontFamily: 'var(--fonte-interface)', fontSize: '13px', color: 'var(--text-primary)' }}>Fidelidade</p>
                <p style={{ fontFamily: 'var(--fonte-interface)', fontSize: '11px', color: 'var(--text-muted)' }}>{fidelidade.saldo} pts · {fidPercent}% do resgate</p>
              </div>
            </button>
          </div>
        </div>
        
        {/* Mobile CTA */}
        {prox && (
          <div className="md:hidden mt-6 pb-6">
            <button onClick={() => navigate(`/cliente/barbearia/${barbeariaId}/agendar`)} className="btn-primary w-full justify-center" style={{ padding: '14px', fontSize: '13px', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
              <Plus size={16} /> Novo Agendamento
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
