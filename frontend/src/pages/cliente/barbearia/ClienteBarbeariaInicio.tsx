// Aba Início da barbearia — visão geral para o cliente
import { useState, useEffect } from 'react';
import { useNavigate, useOutletContext, useParams } from 'react-router-dom';
import { CalendarBlank, Plus, CalendarPlus, NavigationArrow, ArrowsClockwise, Clock, ChatCircle, Star, MapPin } from '@phosphor-icons/react';
import clienteApi from '../../../api/clienteApi';
import { useClienteAuth } from '../../../hooks/useClienteAuth';
import { EstadoVazio } from '../../../components/ui/EstadoVazio';
import { SkeletonCard, SkeletonText } from '../../../components/ui/Skeleton';
import { formatarNomeServico } from '../../../utils/formato';

interface BarbeariaCtx {
  barbearia: { id: string; nome: string; logo: string | null; endereco: string | null; createdAt: string } | null;
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

interface FidelidadeResumo {
  saldo: number;
  proxima: number | null;
}

export function ClienteBarbeariaInicio() {
  const navigate = useNavigate();
  const { barbeariaId } = useParams<{ barbeariaId: string }>();
  const { barbearia } = useOutletContext<BarbeariaCtx>();
  const { cliente } = useClienteAuth();
  const [agendamentos, setAgendamentos] = useState<AgendamentoItem[]>([]);
  const [fidelidade, setFidelidade] = useState<FidelidadeResumo>({ saldo: 0, proxima: null });
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    if (barbeariaId) {
      setCarregando(true);
      Promise.allSettled([
        clienteApi.get<AgendamentoItem[]>(`/cliente/barbearia/${barbeariaId}/agendamentos`),
        clienteApi.get(`/cliente/barbearia/${barbeariaId}/fidelidade`)
      ]).then(([resAgendamentos, resFidelidade]) => {
        if (resAgendamentos.status === 'fulfilled') {
          setAgendamentos(resAgendamentos.value.data);
        }
        if (resFidelidade.status === 'fulfilled') {
          const d = resFidelidade.value.data;
          const proximas = (d.recompensas as Array<{ pontosNecessarios: number }>)
            .filter(r => r.pontosNecessarios > d.saldo)
            .sort((a, b) => a.pontosNecessarios - b.pontosNecessarios);
          setFidelidade({
            saldo: d.saldo,
            proxima: proximas.length > 0 ? proximas[0].pontosNecessarios : null,
          });
        }
      }).finally(() => setCarregando(false));
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

  const atendimentosConcluidos = agendamentos.filter(a => a.status === 'CONCLUIDO').length;
  const sessoes = atendimentosConcluidos;

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

  const ultimoConcluido = agendamentosPassados.find(a => a.status === 'CONCLUIDO');
  const diasDesdeUltimo = ultimoConcluido ? Math.floor((Date.now() - new Date(ultimoConcluido.dataHora).getTime()) / 86400000) : null;

  const primeiroAgendamento = agendamentos.length > 0
    ? [...agendamentos].sort((a, b) => new Date(a.dataHora).getTime() - new Date(b.dataHora).getTime())[0]
    : null;
  const desdeStr = primeiroAgendamento
    ? new Date(primeiroAgendamento.dataHora).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
    : null;

  const fidPercent = fidelidade.proxima
    ? Math.min(100, Math.round((fidelidade.saldo / fidelidade.proxima) * 100))
    : fidelidade.saldo > 0 ? 100 : 0;

  const fmtData = (d: string) => new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
  const fmtHora = (d: string) => new Date(d).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  const fmtDataExt = (d: string) => new Date(d).toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' });

  if (carregando) {
    return (
      <div className="px-5 py-6 animate-fade-in flex flex-col md:flex-row gap-6 max-w-6xl mx-auto">
        <div className="flex-1 flex flex-col gap-6">
          <div className="flex justify-between items-center">
            <SkeletonText lines={2} style={{ width: '220px' }} />
            <SkeletonCard style={{ width: '160px', height: '44px' }} />
          </div>
          <SkeletonCard style={{ height: '180px', width: '100%' }} />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <SkeletonCard key={i} style={{ height: '100px' }} />
            ))}
          </div>
        </div>
        <div className="w-full md:w-[280px] flex-shrink-0">
          <SkeletonCard style={{ height: '280px' }} />
        </div>
      </div>
    );
  }

  return (
    <div className="px-5 py-6 animate-fade-in flex flex-col md:flex-row gap-6 max-w-6xl mx-auto">
      {/* Coluna Principal */}
      <div className="flex-1 flex flex-col">

        {/* Header Responsivo — Saudação na fonte serif */}
        <div className="mb-6 flex flex-col md:flex-row md:items-start md:justify-between gap-4">
          <div>
            <h2 style={{ fontFamily: 'var(--fonte-serif)', fontSize: '24px', fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '-0.01em', marginBottom: '2px' }}>
              {getSaudacao()}, <span style={{ color: 'var(--amber)' }}>{cliente?.nome.split(' ')[0] || 'Cliente'}</span>.
            </h2>
            {prox && (
              <p style={{ fontFamily: 'var(--fonte-interface)', fontSize: '12px', color: 'var(--texto-secundario)' }}>
                Esta será sua <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{atendimentosConcluidos + 1}ª sessão</span> conosco.
              </p>
            )}
          </div>

          <button onClick={() => navigate(`/cliente/barbearia/${barbeariaId}/agendar`)} className="hidden md:flex btn-primary items-center gap-2" style={{ textTransform: 'uppercase', fontSize: '12px', fontWeight: 600 }}>
            <Plus size={16} weight="bold" /> Novo Agendamento
          </button>
        </div>

        {/* Letterhead (Somente Mobile) */}
        <div className="md:hidden flex flex-col items-center justify-center py-4 mb-6 relative">
          <div style={{ position: 'absolute', top: 0, left: '50%', transform: 'translate(-50%, -50%) rotate(45deg)', width: '6px', height: '6px', background: 'var(--amber)' }} />
          <div className="w-full h-px absolute top-0" style={{ background: 'var(--borda)' }} />

          <h1 style={{ fontFamily: 'var(--fonte-interface)', fontWeight: 600, fontSize: '22px', letterSpacing: '0.4em', textTransform: 'uppercase', color: 'var(--text-primary)' }}>
            {barbearia?.nome || 'BARBEARIA'}
          </h1>
          {barbearia?.createdAt && (
            <p style={{ fontFamily: 'var(--fonte-mono)', fontSize: '10px', letterSpacing: '0.3em', color: 'var(--amber)', textTransform: 'uppercase', marginTop: '4px' }}>
              Desde {new Date(barbearia.createdAt).getFullYear()}
            </p>
          )}

          <div style={{ position: 'absolute', bottom: 0, left: '50%', transform: 'translate(-50%, 50%) rotate(45deg)', width: '6px', height: '6px', background: 'var(--amber)' }} />
          <div className="w-full h-px absolute bottom-0" style={{ background: 'var(--borda)' }} />
        </div>

        {/* Hero Card */}
        {prox ? (
          <div className="hero-card mb-8">
            <div className="flex flex-col md:flex-row md:items-start md:justify-between mb-4">
              <div>
                <p style={{ fontFamily: 'var(--fonte-interface)', fontSize: '9px', letterSpacing: '0.32em', textTransform: 'uppercase', color: 'var(--amber)', marginBottom: '8px', fontWeight: 600 }}>
                  Próximo Atendimento
                </p>
                <p style={{ fontFamily: 'var(--fonte-mono)', fontSize: '12px', color: 'var(--texto-secundario)' }}>
                  {calcCountdown(prox.dataHora) || 'Agendamento para hoje'}
                </p>
              </div>
            </div>

            <div className="flex flex-col md:flex-row md:items-end md:justify-between mb-6">
              <div>
                <h2 className="text-[24px] md:text-[26px]" style={{ fontFamily: 'var(--fonte-interface)', fontWeight: 600, color: 'var(--text-primary)' }}>
                  {formatarNomeServico(prox)}
                </h2>
                <p style={{ fontFamily: 'var(--fonte-interface)', fontSize: '13px', color: 'var(--texto-secundario)', marginTop: '4px' }}>
                  com <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{prox.barbeiro.usuario.nome}</span>
                </p>
              </div>
              <div className="hidden md:block">
                <span style={{ fontFamily: 'var(--fonte-mono)', fontSize: '16px', color: 'var(--amber)', fontWeight: 600 }}>
                  R$ {prox.valorCobrado || '--'}
                </span>
              </div>
            </div>

            <div style={{ borderTop: '1px dashed var(--borda)', margin: '20px -20px', padding: '0 20px' }} />

            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-6">
                <p className="flex items-center gap-2" style={{ fontFamily: 'var(--fonte-mono)', fontSize: '13px', color: 'var(--text-primary)' }}>
                  <CalendarBlank size={16} style={{ color: 'var(--amber)' }} />
                  <span className="capitalize">{fmtDataExt(prox.dataHora)}</span> <span className="text-[var(--texto-secundario)] mx-1">·</span> {fmtHora(prox.dataHora)}
                </p>
                {barbearia?.endereco && (
                  <p className="flex items-center gap-2" style={{ fontFamily: 'var(--fonte-interface)', fontSize: '12px', color: 'var(--text-primary)' }}>
                    <MapPin size={16} style={{ color: 'var(--amber)' }} /> {barbearia.endereco}
                  </p>
                )}
              </div>

              <div className="flex items-center gap-2 mt-2 md:mt-0">
                <button className="btn-ghost flex-1 md:flex-none flex items-center justify-center gap-1.5"><CalendarPlus size={16} /> Calendário</button>
                <button className="btn-ghost-amber flex-1 md:flex-none flex items-center justify-center gap-1.5"><NavigationArrow size={16} /> Como chegar</button>
              </div>
            </div>
          </div>
        ) : (
          <div className="hero-card mb-8 p-6">
            <EstadoVazio
              icone={CalendarBlank}
              titulo="Nenhum agendamento futuro"
              descricao="Que tal agendar um horário para o seu próximo corte?"
              textoBotao="Novo Agendamento"
              onClickBotao={() => navigate(`/cliente/barbearia/${barbeariaId}/agendar`)}
            />
          </div>
        )}

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
          <div className="stat-card relative overflow-hidden">
            <p style={{ fontSize: '9px', letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--texto-secundario)', fontWeight: 600 }}>Fidelidade</p>
            <p className="mt-2" style={{ fontFamily: 'var(--fonte-mono)', fontSize: '22px', fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1 }}>{fidelidade.saldo} <span className="text-sm font-normal opacity-60">pts</span></p>
            <p style={{ fontFamily: 'var(--fonte-interface)', fontSize: '10px', color: 'var(--amber)', marginTop: '6px', fontWeight: 500 }}>
              {fidelidade.proxima
                ? `Faltam ${fidelidade.proxima - fidelidade.saldo} pts para prêmio`
                : fidelidade.saldo > 0 ? 'Recompensa disponível!' : 'Acumule pontos'}
            </p>
            <div className="w-full h-[2px] mt-3 rounded overflow-hidden" style={{ background: 'var(--borda)' }}>
              <div className="h-full transition-all duration-300" style={{ background: 'var(--amber)', width: `${fidPercent}%` }} />
            </div>
          </div>

          <div className="stat-card">
            <p style={{ fontSize: '9px', letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--texto-secundario)', fontWeight: 600 }}>Visitas</p>
            <p className="mt-2" style={{ fontFamily: 'var(--fonte-mono)', fontSize: '22px', fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1 }}>{sessoes}</p>
            {desdeStr && (
              <p style={{ fontFamily: 'var(--fonte-mono)', fontSize: '11px', color: 'var(--texto-secundario)', marginTop: '6px' }}>Desde {desdeStr}</p>
            )}
          </div>

          <div className="stat-card">
            <p style={{ fontSize: '9px', letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--texto-secundario)', fontWeight: 600 }}>Barbeiro Favorito</p>
            <p className="mt-2 truncate" style={{ fontFamily: 'var(--fonte-interface)', fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)' }}>{favBarbeiro}</p>
            <p style={{ fontFamily: 'var(--fonte-mono)', fontSize: '11px', color: 'var(--texto-secundario)', marginTop: '6px' }}>{favCount > 0 ? `${favCount} atendimentos` : 'Sem histórico'}</p>
          </div>

          <div className="stat-card">
            <p style={{ fontSize: '9px', letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--texto-secundario)', fontWeight: 600 }}>Último Corte</p>
            <p className="mt-2" style={{ fontFamily: 'var(--fonte-mono)', fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)' }}>{diasDesdeUltimo !== null ? `há ${diasDesdeUltimo} dia${diasDesdeUltimo > 1 ? 's' : ''}` : 'Nenhum'}</p>
            <p style={{ fontFamily: 'var(--fonte-interface)', fontSize: '11px', color: 'var(--amber)', marginTop: '6px', fontWeight: 500 }}>Hora de marcar?</p>
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
                    <tr key={a.id} className="border-b border-[var(--borda)] last:border-0 hover:bg-[var(--superficie-2)] transition-colors">
                      <td className="p-4" style={{ fontFamily: 'var(--fonte-interface)', fontSize: '14px', fontWeight: 500, color: 'var(--text-primary)' }}>{formatarNomeServico(a)}</td>
                      <td className="p-4" style={{ fontFamily: 'var(--fonte-interface)', fontSize: '13px', color: 'var(--texto-secundario)' }}>com {a.barbeiro.usuario.nome}</td>
                      <td className="p-4 text-right" style={{ fontFamily: 'var(--fonte-mono)', fontSize: '14px', fontWeight: 500, color: 'var(--text-primary)' }}>R$ {a.valorCobrado || '--'}</td>
                      <td className="p-4 text-right" style={{ fontFamily: 'var(--fonte-mono)', fontSize: '13px', color: 'var(--texto-secundario)' }}>{fmtData(a.dataHora)}</td>
                      <td className="p-4 text-right"><span style={{ fontSize: '11px', fontWeight: 600, padding: '4px 10px', borderRadius: '999px', background: 'rgba(52,211,153,0.14)', color: 'var(--sucesso)' }}>Concluído</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Lista (Mobile) */}
            <div className="md:hidden flex flex-col gap-2">
              {agendamentosPassados.slice(0, 3).map(a => (
                <div key={a.id} className="flex items-center justify-between p-3.5 rounded-md border border-[var(--borda)] bg-[var(--superficie-1)]">
                  <div>
                    <p style={{ fontFamily: 'var(--fonte-interface)', fontSize: '14px', fontWeight: 500, color: 'var(--text-primary)' }}>{formatarNomeServico(a)}</p>
                    <p style={{ fontFamily: 'var(--fonte-interface)', fontSize: '12px', color: 'var(--texto-secundario)', marginTop: '2px' }}>com {a.barbeiro.usuario.nome}</p>
                  </div>
                  <div className="text-right">
                    <span style={{ fontFamily: 'var(--fonte-mono)', fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>R$ {a.valorCobrado || '--'}</span>
                    <p style={{ fontFamily: 'var(--fonte-mono)', fontSize: '11px', color: 'var(--texto-secundario)', marginTop: '2px' }}>{fmtData(a.dataHora)}</p>
                  </div>
                </div>
              ))}
              {agendamentosPassados.length > 3 && (
                <button className="py-3 text-center w-full mt-1" style={{ fontFamily: 'var(--fonte-interface)', fontSize: '13px', color: 'var(--texto-secundario)', fontWeight: 500 }}>
                  Ver todo histórico →
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Painel de Atalhos (Sidebar direita no Desktop, Empilhado no Mobile) */}
      <div className="w-full md:w-[280px] flex-shrink-0">
        <div className="md:p-5 md:border md:border-[var(--borda)] md:rounded-lg md:bg-[var(--superficie-1)]">
          <h2 className="section-label-amber mb-4 md:mb-5">Atalhos</h2>
          <div className="flex flex-col gap-3">
            {ultimoConcluido && (
              <button onClick={() => navigate(`/cliente/barbearia/${barbeariaId}/agendar`)} className="flex items-center gap-3 w-full text-left p-3 md:p-2.5 rounded-md border border-[var(--borda)] bg-[var(--superficie-1)] hover:bg-[var(--superficie-2)] transition-colors">
                <div className="w-8 h-8 rounded-md flex items-center justify-center bg-[var(--superficie-2)] border border-[var(--borda)] text-[var(--texto-secundario)]"><ArrowsClockwise size={16} /></div>
                <div>
                  <p style={{ fontFamily: 'var(--fonte-interface)', fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)' }}>Repetir último corte</p>
                  <p style={{ fontFamily: 'var(--fonte-interface)', fontSize: '11px', color: 'var(--texto-secundario)' }}>{formatarNomeServico(ultimoConcluido)} · {ultimoConcluido.barbeiro.usuario.nome}</p>
                </div>
              </button>
            )}

            <button onClick={() => navigate(`/cliente/barbearia/${barbeariaId}/horarios`)} className="flex items-center gap-3 w-full text-left p-3 md:p-2.5 rounded-md border border-[var(--borda)] bg-[var(--superficie-1)] hover:bg-[var(--superficie-2)] transition-colors">
              <div className="w-8 h-8 rounded-md flex items-center justify-center bg-[rgba(var(--cor-primaria-rgb),0.12)] border border-[var(--amber)] text-[var(--amber)]"><Clock size={16} /></div>
              <p style={{ fontFamily: 'var(--fonte-interface)', fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)' }}>Ver horários disponíveis</p>
            </button>

            <button onClick={() => navigate(`/cliente/barbearia/${barbeariaId}/chat`)} className="flex items-center gap-3 w-full text-left p-3 md:p-2.5 rounded-md border border-[var(--borda)] bg-[var(--superficie-1)] hover:bg-[var(--superficie-2)] transition-colors">
              <div className="w-8 h-8 rounded-md flex items-center justify-center bg-[rgba(var(--cor-primaria-rgb),0.12)] border border-[var(--amber)] text-[var(--amber)]"><ChatCircle size={16} /></div>
              <p style={{ fontFamily: 'var(--fonte-interface)', fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)' }}>Falar com a barbearia</p>
            </button>

            <button onClick={() => navigate(`/cliente/barbearia/${barbeariaId}/fidelidade`)} className="hidden md:flex items-center gap-3 w-full text-left p-3 md:p-2.5 rounded-md border border-[var(--borda)] bg-[var(--superficie-1)] hover:bg-[var(--superficie-2)] transition-colors">
              <div className="w-8 h-8 rounded-md flex items-center justify-center bg-[var(--superficie-2)] border border-[var(--borda)] text-[var(--texto-secundario)]"><Star size={16} /></div>
              <div>
                <p style={{ fontFamily: 'var(--fonte-interface)', fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)' }}>Fidelidade</p>
                <p style={{ fontFamily: 'var(--fonte-mono)', fontSize: '11px', color: 'var(--texto-secundario)' }}>{fidelidade.saldo} pts · {fidPercent}%</p>
              </div>
            </button>
          </div>
        </div>

        {/* Mobile CTA */}
        {prox && (
          <div className="md:hidden mt-6 pb-6">
            <button onClick={() => navigate(`/cliente/barbearia/${barbeariaId}/agendar`)} className="btn-primary w-full justify-center items-center gap-2" style={{ padding: '14px', fontSize: '13px', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
              <Plus size={16} weight="bold" /> Novo Agendamento
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
