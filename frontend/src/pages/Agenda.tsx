// force redeploy
// Página de Agenda — calendário semanal com estética industrial
import { useEffect, useState, useCallback, useRef } from 'react';
import { ChevronLeft, ChevronRight, Plus, ChevronDown } from 'lucide-react';
import { Modal } from '../components/Modal';
import { SkeletonPage } from '../components/Skeleton';
import { dataBrasilia } from '../utils/datas';
import api from '../api/client';

/** Extrai hora e minuto de um Date no fuso de Brasília */
function getHoraMinutoBrasilia(date: Date): { hora: number; minuto: number } {
  const formatter = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const parts = formatter.formatToParts(date);
  const hora = parseInt(parts.find(p => p.type === 'hour')?.value || '0', 10);
  const minuto = parseInt(parts.find(p => p.type === 'minute')?.value || '0', 10);
  return { hora, minuto };
}

/** Extrai data no fuso de Brasília como string YYYY-MM-DD */
function getDataBrasilia(date: Date): string {
  const formatter = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const parts = formatter.formatToParts(date);
  const day = parts.find(p => p.type === 'day')?.value || '01';
  const month = parts.find(p => p.type === 'month')?.value || '01';
  const year = parts.find(p => p.type === 'year')?.value || '2026';
  return `${year}-${month}-${day}`;
}

interface Agendamento {
  id: string;
  dataHora: string;
  status: 'AGUARDANDO' | 'CONFIRMADO' | 'CONCLUIDO' | 'CANCELADO';
  valorCobrado: string;
  origem?: string;
  cliente: { usuario: { nome: string } };
  barbeiroId: string;
  barbeiro: { usuario: { nome: string }; cor: string };
  servico: { nome: string; duracaoMinutos: number; cor: string };
}

interface Barbeiro { id: string; usuario: { nome: string }; cor: string }
interface Cliente { id: string; usuario: { nome: string } }
interface Servico { id: string; nome: string; preco: string; duracaoMinutos: number; cor: string }
interface Bloqueio {
  id: string;
  barbeiroId: string;
  dataInicio: string;
  dataFim: string;
  motivo?: string;
  barbeiro: { usuario: { nome: string } };
}

const statusStyles: Record<string, { bg: string; border: string; color: string }> = {
  AGUARDANDO:  { bg: 'rgba(var(--cor-primaria-rgb), 0.10)', border: 'var(--amber)', color: 'rgba(var(--cor-primaria-rgb), 0.15)' },
  CONFIRMADO:  { bg: 'var(--bg-surface2)', border: 'var(--border-hover)', color: 'var(--text-primary)' },
  CONCLUIDO:   { bg: '#1A3D2A', border: 'var(--success-text)', color: 'var(--success-text)' },
  CANCELADO:   { bg: 'var(--error)', border: 'var(--error-text)', color: 'var(--error-text)' },
};

const statusLabels: Record<string, string> = {
  AGUARDANDO: 'Aguardando',
  CONFIRMADO: 'Confirmado',
  CONCLUIDO: 'Concluído',
  CANCELADO: 'Cancelado',
};

const diasSemana = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const horarios = Array.from({ length: 22 }, (_, i) => `${String(Math.floor(i / 2) + 8).padStart(2, '0')}:${i % 2 === 0 ? '00' : '30'}`);

const PALETA_CORES = [
  '#EF4444', '#F59E0B', '#10B981', '#3B82F6', '#8B5CF6',
  '#EC4899', '#14B8A6', '#D946EF', '#F97316', '#0EA5E9',
  '#84CC16', '#6366F1'
];

function getBarbeiroColor(id: string, listaBarbeiros: {id: string}[] = []): string {
  if (!id) return PALETA_CORES[0];
  if (listaBarbeiros && listaBarbeiros.length > 0) {
    const idx = listaBarbeiros.findIndex(b => b.id === id);
    if (idx !== -1) return PALETA_CORES[idx % PALETA_CORES.length];
  }
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash << 5) - hash + id.charCodeAt(i);
    hash = Math.imul(hash, 31);
  }
  return PALETA_CORES[Math.abs(hash) % PALETA_CORES.length];
}

export function Agenda() {
  const [semanaInicio, setSemanaInicio] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - d.getDay() + 1); d.setHours(0, 0, 0, 0); return d;
  });
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const [diaMobile, setDiaMobile] = useState(() => {
    const d = new Date(); d.setHours(0, 0, 0, 0); return d;
  });

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  const [agendamentos, setAgendamentos] = useState<Agendamento[]>([]);
  const [bloqueios, setBloqueios] = useState<Bloqueio[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [modalAberto, setModalAberto] = useState(false);
  const [modalBloqueioAberto, setModalBloqueioAberto] = useState(false);
  const [barbeiros, setBarbeiros] = useState<Barbeiro[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [servicos, setServicos] = useState<Servico[]>([]);
  const [filtroBarbeiro, setFiltroBarbeiro] = useState('todos');
  const [dropdownAberto, setDropdownAberto] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent | TouchEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownAberto(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, []);

  // Form
  const [form, setForm] = useState({ clienteId: '', barbeiroId: '', servicoId: '', dataHora: '', observacoes: '' });
  const [salvando, setSalvando] = useState(false);
  const [erroSalvar, setErroSalvar] = useState<string | null>(null);
  const [formBloqueio, setFormBloqueio] = useState({ barbeiroId: '', data: '', horaInicio: '', horaFim: '', motivo: '' });

  const diasDaSemana = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(semanaInicio); d.setDate(semanaInicio.getDate() + i); return d;
  });
  const diasExibidos = isMobile ? [diaMobile] : diasDaSemana;

  const carregar = useCallback(async () => {
    setCarregando(true);
    
    try {
      const dataInicio = dataBrasilia(diasDaSemana[0]);
      const dataFim = dataBrasilia(diasDaSemana[6]);

      const [resAgendamentos, resBloq, resBarb] = await Promise.allSettled([
        api.get<Agendamento[]>('/agendamentos', { params: { dataInicio, dataFim } }),
        api.get<Bloqueio[]>('/bloqueios'),
        api.get<Barbeiro[]>('/barbeiros')
      ]);

      if (resAgendamentos.status === 'fulfilled') {
        setAgendamentos(resAgendamentos.value.data);
      } else {
        console.error('Erro ao carregar agendamentos:', resAgendamentos.reason);
      }

      if (resBloq.status === 'fulfilled') {
        setBloqueios(resBloq.value.data);
      } else {
        console.error('Erro ao carregar bloqueios:', resBloq.reason);
      }

      if (resBarb.status === 'fulfilled') {
        setBarbeiros(resBarb.value.data);
      } else {
        console.error('Erro ao carregar barbeiros:', resBarb.reason);
      }
    } catch (err) {
      console.error('Erro inesperado no carregar:', err);
    }

    setCarregando(false);
  }, [semanaInicio]);

  useEffect(() => { carregar(); }, [carregar]);

  async function abrirModal() {
    try {
      const [c, s] = await Promise.all([
        api.get<Cliente[]>('/clientes'),
        api.get<Servico[]>('/servicos'),
      ]);
      setClientes(c.data);
      setServicos(s.data);
      setErroSalvar(null);
      setModalAberto(true);
    } catch (err) {
      console.error('Erro ao carregar dados:', err);
    }
  }

  async function criarAgendamento() {
    if (salvando) return;
    setSalvando(true);
    setErroSalvar(null);
    try {
      const servico = servicos.find((s) => s.id === form.servicoId);
      await api.post('/agendamentos', { ...form, valorCobrado: servico ? Number(servico.preco) : 0 });
      setModalAberto(false);
      setForm({ clienteId: '', barbeiroId: '', servicoId: '', dataHora: '', observacoes: '' });
      carregar();
    } catch (err: any) {
      console.error('Erro ao criar agendamento:', err);
      setErroSalvar(err?.response?.data?.erro || 'Não foi possível salvar o lançamento — tente novamente');
    } finally {
      setSalvando(false);
    }
  }

  async function criarBloqueio() {
    try {
      const dataInicioStr = `${formBloqueio.data}T${formBloqueio.horaInicio}:00-03:00`;
      const dataFimStr = `${formBloqueio.data}T${formBloqueio.horaFim}:00-03:00`;
      await api.post('/bloqueios', {
        barbeiroId: formBloqueio.barbeiroId,
        dataInicio: dataInicioStr,
        dataFim: dataFimStr,
        motivo: formBloqueio.motivo
      });
      setModalBloqueioAberto(false);
      setFormBloqueio({ barbeiroId: '', data: '', horaInicio: '', horaFim: '', motivo: '' });
      carregar();
    } catch (err: any) {
      alert(err.response?.data?.erro || 'Erro ao criar bloqueio');
    }
  }

  async function removerBloqueio(id: string) {
    if (!confirm('Deseja realmente remover este bloqueio?')) return;
    try {
      await api.delete(`/bloqueios/${id}`);
      carregar();
    } catch (err: any) {
      alert(err.response?.data?.erro || 'Erro ao remover bloqueio');
    }
  }

  function mudarSemana(direcao: number) {
    const nova = new Date(semanaInicio);
    nova.setDate(nova.getDate() + direcao * 7);
    setSemanaInicio(nova);
  }

  function navegar(direcao: number) {
    if (isMobile) {
      const nova = new Date(diaMobile);
      nova.setDate(nova.getDate() + direcao);
      setDiaMobile(nova);

      const novaStr = getDataBrasilia(nova);
      const inicioStr = getDataBrasilia(diasDaSemana[0]);
      const fimStr = getDataBrasilia(diasDaSemana[6]);

      if (novaStr < inicioStr || novaStr > fimStr) {
        const novaSemana = new Date(nova);
        novaSemana.setDate(novaSemana.getDate() - novaSemana.getDay() + 1);
        novaSemana.setHours(0, 0, 0, 0);
        setSemanaInicio(novaSemana);
      }
    } else {
      mudarSemana(direcao);
    }
  }

  if (carregando) return <SkeletonPage />;

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', minWidth: 0 }}>
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1
          style={{
            fontFamily: 'var(--fonte-interface)',
            fontSize: '32px',
            color: 'var(--text-primary)',
            letterSpacing: '0.04em',
          }}
        >
          Agenda
        </h1>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full md:w-auto">
          <div
            className="flex items-center justify-between"
            style={{
              border: '1px solid var(--border)',
              background: 'var(--bg-surface)',
            }}
          >
            <button
              onClick={() => navegar(-1)}
              className="p-2 transition-colors flex items-center justify-center"
              style={{ color: 'var(--text-muted)', background: 'transparent', border: 'none', cursor: 'pointer', minHeight: isMobile ? '44px' : '32px', minWidth: isMobile ? '44px' : '32px' }}
            >
              <ChevronLeft size={16} strokeWidth={1.5} />
            </button>
            <span
              className="px-3 min-w-[180px] text-center"
              style={{
                fontFamily: 'var(--fonte-interface)',
                fontSize: '11px',
                color: 'var(--text-muted)',
                letterSpacing: '0.04em',
              }}
            >
              {isMobile ? (
                `${diasSemana[diaMobile.getDay()]}, ${diaMobile.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}`
              ) : (
                `${diasDaSemana[0].toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })} — ${diasDaSemana[6].toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}`
              )}
            </span>
            <button
              onClick={() => navegar(1)}
              className="p-2 transition-colors flex items-center justify-center"
              style={{ color: 'var(--text-muted)', background: 'transparent', border: 'none', cursor: 'pointer', minHeight: isMobile ? '44px' : '32px', minWidth: isMobile ? '44px' : '32px' }}
            >
              <ChevronRight size={16} strokeWidth={1.5} />
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => setModalBloqueioAberto(true)} className="btn-secondary flex-1 sm:flex-none justify-center">
              Bloquear Horário
            </button>
            <button onClick={abrirModal} className="btn-primary flex-1 sm:flex-none justify-center">
              <Plus size={14} strokeWidth={1.5} /> Novo Agendamento
            </button>
          </div>
        </div>
      </div>

      {/* Filtros de Barbeiro (Dropdown) */}
      <div className="relative" style={{ width: '100%', maxWidth: '300px' }} ref={dropdownRef}>
        <button
          onClick={() => setDropdownAberto(prev => !prev)}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'var(--bg-surface)',
            color: 'var(--text-primary)',
            border: '1px solid var(--border)',
            padding: '8px 16px',
            borderRadius: '4px',
            cursor: 'pointer',
            fontFamily: 'var(--fonte-interface)',
            fontSize: '14px',
            fontWeight: 500,
            minHeight: isMobile ? '44px' : '40px',
            width: '100%',
          }}
        >
          <div className="flex items-center gap-2">
            {filtroBarbeiro === 'todos' ? (
              <>
                <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: 'var(--amber)' }} />
                Todos os barbeiros
              </>
            ) : (
              <>
                <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: getBarbeiroColor(filtroBarbeiro, barbeiros) }} />
                {barbeiros.find((b) => b.id === filtroBarbeiro)?.usuario.nome || 'Desconhecido'}
              </>
            )}
          </div>
          <ChevronDown size={16} strokeWidth={1.5} style={{ color: 'var(--text-muted)' }} />
        </button>

        {dropdownAberto && (
          <div
            style={{
              position: 'absolute',
              top: '100%',
              left: 0,
              width: '100%',
              marginTop: '4px',
              background: 'var(--bg-surface)',
              border: '1px solid var(--border)',
              borderRadius: '4px',
              zIndex: 50,
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
              maxHeight: '300px',
              overflowY: 'auto'
            }}
          >
            <button
              onClick={() => { setFiltroBarbeiro('todos'); setDropdownAberto(false); }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 16px',
                background: filtroBarbeiro === 'todos' ? 'rgba(var(--cor-primaria-rgb), 0.1)' : 'transparent',
                color: 'var(--text-primary)',
                border: 'none',
                borderBottom: '1px solid var(--border)',
                cursor: 'pointer',
                fontFamily: 'var(--fonte-interface)',
                fontSize: '14px',
                textAlign: 'left',
                minHeight: '44px',
              }}
              className="hover:bg-zinc-800 transition-colors"
            >
              <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: 'var(--amber)' }} />
              Todos os barbeiros
            </button>

            {barbeiros.map((b) => {
              const cor = getBarbeiroColor(b.id, barbeiros);
              const isSelected = filtroBarbeiro === b.id;
              return (
                <button
                  key={b.id}
                  onClick={() => { setFiltroBarbeiro(b.id); setDropdownAberto(false); }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '10px 16px',
                    background: isSelected ? 'rgba(var(--cor-primaria-rgb), 0.1)' : 'transparent',
                    color: 'var(--text-primary)',
                    border: 'none',
                    cursor: 'pointer',
                    fontFamily: 'var(--fonte-interface)',
                    fontSize: '14px',
                    textAlign: 'left',
                    minHeight: '44px',
                  }}
                  className="hover:bg-zinc-800 transition-colors"
                >
                  <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: cor }} />
                  {b.usuario.nome}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Calendário semanal/diário */}
      <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', overflowX: 'auto', width: '100%' }}>
        <div style={{ minWidth: isMobile ? '100%' : '700px' }}>
          {/* Cabeçalho dos dias */}
          <div style={{ display: 'grid', gridTemplateColumns: `60px repeat(${diasExibidos.length}, 1fr)`, borderBottom: '1px solid var(--border)' }}>
            <div style={{ padding: '8px' }} />
            {diasExibidos.map((dia, i) => {
              const isHoje = dia.toDateString() === new Date().toDateString();
              return (
                <div
                  key={i}
                  className="text-center"
                  style={{
                    padding: '12px',
                    borderLeft: '1px solid var(--border)',
                    background: isHoje ? 'rgba(var(--cor-primaria-rgb), 0.10)' : 'transparent',
                  }}
                >
                  <p
                    style={{
                      fontFamily: 'var(--fonte-interface)',
                      fontSize: '9px',
                      letterSpacing: '0.14em',
                      textTransform: 'uppercase',
                      color: 'var(--text-muted)',
                    }}
                  >
                    {diasSemana[dia.getDay()]}
                  </p>
                  <p
                    style={{
                      fontFamily: 'var(--fonte-interface)',
                      fontSize: '24px',
                      color: isHoje ? 'var(--amber)' : 'var(--text-primary)',
                      lineHeight: 1.2,
                    }}
                  >
                    {dia.getDate()}
                  </p>
                </div>
              );
            })}
          </div>

          {/* Grid de horários */}
          {horarios.map((horario) => (
            <div key={horario} style={{ display: 'grid', gridTemplateColumns: `60px repeat(${diasExibidos.length}, 1fr)`, borderBottom: '1px solid var(--border)' }}>
              <div
                className="text-right pr-3 pt-3"
                style={{
                  padding: '8px',
                  fontFamily: 'var(--fonte-interface)',
                  fontSize: '10px',
                  color: 'var(--text-disabled)',
                  letterSpacing: '0.04em',
                }}
              >
                {horario}
              </div>
              {diasExibidos.map((dia, diaIdx) => {
                const diaISO = dataBrasilia(dia);

                const agendamentosDoCelula = agendamentos.filter((ag) => {
                  const d = new Date(ag.dataHora);
                  const dataBR = getDataBrasilia(d);
                  const hm = getHoraMinutoBrasilia(d);
                  const horarioAg = `${String(hm.hora).padStart(2, '0')}:${String(hm.minuto).padStart(2, '0')}`;
                  
                  const checkBarbeiro = filtroBarbeiro === 'todos' || ag.barbeiroId === filtroBarbeiro;
                  return dataBR === diaISO && horarioAg === horario && checkBarbeiro;
                });

                const bloqueiosDaCelula = bloqueios.filter((bl) => {
                  const dInicio = new Date(bl.dataInicio);
                  const dFim = new Date(bl.dataFim);
                  const dtAtual = new Date(diaISO + 'T' + horario + ':00-03:00'); // Hora do slot atual em SP

                  // Consideramos o bloqueio na célula se o slot começar dentro do bloqueio
                  const dentroBloqueio = dtAtual >= dInicio && dtAtual < dFim;
                  
                  const checkBarbeiro = filtroBarbeiro === 'todos' || bl.barbeiroId === filtroBarbeiro;
                  return dentroBloqueio && checkBarbeiro;
                });

                return (
                  <div key={diaIdx} style={{ borderLeft: '1px solid var(--border)', minHeight: '48px', padding: '2px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    {bloqueiosDaCelula.map((bl) => (
                      <div
                        key={bl.id}
                        className="truncate cursor-pointer"
                        onClick={() => removerBloqueio(bl.id)}
                        title="Clique para remover bloqueio"
                        style={{
                          padding: '4px 8px',
                          background: 'repeating-linear-gradient(45deg, var(--bg-surface2), var(--bg-surface2) 10px, transparent 10px, transparent 20px)',
                          borderLeft: `3px solid var(--text-muted)`,
                          color: 'var(--text-muted)',
                          fontFamily: 'var(--fonte-interface)',
                          fontSize: isMobile ? '11px' : '12px',
                          borderRadius: '0 4px 4px 0',
                          lineHeight: 1.2
                        }}
                      >
                        <p className="truncate pr-1" style={{ fontWeight: 600, marginBottom: '2px' }}>{bl.barbeiro.usuario.nome}</p>
                        <p className="truncate" style={{ fontSize: isMobile ? '11px' : '12px' }}>Bloqueado: {bl.motivo || 'Indisponível'}</p>
                      </div>
                    ))}

                    {agendamentosDoCelula.map((ag) => {
                      const isCancelado = ag.status === 'CANCELADO';
                      const isConcluido = ag.status === 'CONCLUIDO';
                      const corB = isCancelado ? '#ef4444' : getBarbeiroColor(ag.barbeiroId, barbeiros);
                      const bgB = isCancelado ? '#ef444420' : (corB + '20');
                      
                      const corS = ag.servico.cor || '#22C55E';
                      const bgS = corS + '30';

                      return (
                        <div
                          key={ag.id}
                          className="truncate cursor-pointer flex flex-col"
                          style={{
                            padding: '6px 8px',
                            background: bgB,
                            borderLeft: `3px solid ${corB}`,
                            color: 'var(--text-primary)',
                            opacity: isConcluido ? 0.7 : 1,
                            fontFamily: 'var(--fonte-interface)',
                            fontSize: isMobile ? '11px' : '12px',
                            marginBottom: '4px',
                            position: 'relative',
                            borderRadius: '0 4px 4px 0',
                            lineHeight: 1.2
                          }}
                        >
                          <div className="flex justify-between items-start mb-1.5">
                            <p className="truncate pr-1" style={{ fontWeight: 600 }}>{ag.cliente.usuario.nome}</p>
                            {ag.origem === 'ONLINE' && (
                              <span className="bg-[var(--cor-primaria)] text-black px-1 rounded text-[8px] font-bold shrink-0">WEB</span>
                            )}
                          </div>
                          <div>
                            <p className="truncate" style={{ 
                              fontFamily: 'var(--fonte-interface)', 
                              fontSize: isMobile ? '11px' : '12px', 
                              background: bgS, 
                              color: 'var(--text-primary)',
                              padding: '3px 6px', 
                              borderRadius: '4px', 
                              display: 'inline-block', 
                              border: `1px solid ${corS}50`,
                              maxWidth: '100%',
                              lineHeight: 1.2
                            }}>
                              {ag.servico.nome}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Legenda */}
      <div className="flex flex-wrap gap-4">
        {Object.entries(statusStyles).map(([status, st]) => (
          <div key={status} className="flex items-center gap-2">
            <div style={{ width: '12px', height: '12px', background: st.bg, borderLeft: `2px solid ${st.border}` }} />
            <span
              style={{
                fontFamily: 'var(--fonte-interface)',
                fontSize: '9px',
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                color: 'var(--text-muted)',
              }}
            >
              {statusLabels[status]}
            </span>
          </div>
        ))}
      </div>

      {/* Modal para novo agendamento */}
      <Modal aberto={modalAberto} onFechar={() => setModalAberto(false)} titulo="Novo Agendamento">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {erroSalvar && (
            <div style={{ padding: '12px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid var(--error-text)', borderRadius: '6px', color: 'var(--error-text)', fontFamily: 'var(--fonte-interface)', fontSize: '13px', fontWeight: 500 }}>
              {erroSalvar}
            </div>
          )}
          <div>
            <label className="input-label">Cliente</label>
            <select value={form.clienteId} onChange={(e) => setForm({ ...form, clienteId: e.target.value })} className="ds-select">
              <option value="">Selecione...</option>
              {clientes.map((c) => <option key={c.id} value={c.id}>{c.usuario.nome}</option>)}
            </select>
          </div>
          <div>
            <label className="input-label">Barbeiro</label>
            <select value={form.barbeiroId} onChange={(e) => setForm({ ...form, barbeiroId: e.target.value })} className="ds-select">
              <option value="">Selecione...</option>
              {barbeiros.map((b) => <option key={b.id} value={b.id}>{b.usuario.nome}</option>)}
            </select>
          </div>
          <div>
            <label className="input-label">Serviço</label>
            <select value={form.servicoId} onChange={(e) => setForm({ ...form, servicoId: e.target.value })} className="ds-select">
              <option value="">Selecione...</option>
              {servicos.map((s) => <option key={s.id} value={s.id}>{s.nome} — R$ {Number(s.preco).toFixed(2)}</option>)}
            </select>
          </div>
          <div>
            <label className="input-label">Data e Horário</label>
            <input type="datetime-local" value={form.dataHora} onChange={(e) => setForm({ ...form, dataHora: e.target.value })} className="ds-input" />
          </div>
          <div>
            <label className="input-label">Observações</label>
            <textarea value={form.observacoes} onChange={(e) => setForm({ ...form, observacoes: e.target.value })} rows={2} className="ds-textarea" />
          </div>
          <button 
            onClick={criarAgendamento} 
            className="btn-primary w-full justify-center"
            disabled={salvando}
            style={{ opacity: salvando ? 0.7 : 1, cursor: salvando ? 'not-allowed' : 'pointer' }}
          >
            {salvando ? 'Salvando...' : 'Criar Agendamento'}
          </button>
        </div>
      </Modal>

      {/* Modal para Bloqueio de Agenda */}
      <Modal aberto={modalBloqueioAberto} onFechar={() => setModalBloqueioAberto(false)} titulo="Bloquear Horário">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label className="input-label">Barbeiro</label>
            <select value={formBloqueio.barbeiroId} onChange={(e) => setFormBloqueio({ ...formBloqueio, barbeiroId: e.target.value })} className="ds-select">
              <option value="">Selecione...</option>
              {barbeiros.map((b) => <option key={b.id} value={b.id}>{b.usuario.nome}</option>)}
            </select>
          </div>
          <div>
            <label className="input-label">Data</label>
            <input type="date" value={formBloqueio.data} onChange={(e) => setFormBloqueio({ ...formBloqueio, data: e.target.value })} className="ds-input" />
          </div>
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="input-label">Hora Início</label>
              <input type="time" value={formBloqueio.horaInicio} onChange={(e) => setFormBloqueio({ ...formBloqueio, horaInicio: e.target.value })} className="ds-input" />
            </div>
            <div className="flex-1">
              <label className="input-label">Hora Fim</label>
              <input type="time" value={formBloqueio.horaFim} onChange={(e) => setFormBloqueio({ ...formBloqueio, horaFim: e.target.value })} className="ds-input" />
            </div>
          </div>
          <div>
            <label className="input-label">Motivo (Opcional)</label>
            <input type="text" value={formBloqueio.motivo} onChange={(e) => setFormBloqueio({ ...formBloqueio, motivo: e.target.value })} placeholder="Ex: Almoço, Atestado" className="ds-input" />
          </div>
          <button onClick={criarBloqueio} className="btn-secondary w-full justify-center text-white bg-red-600 hover:bg-red-700">
            Confirmar Bloqueio
          </button>
        </div>
      </Modal>
    </div>
  );
}
