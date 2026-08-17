// force redeploy
// Página de Agenda — calendário semanal com estética industrial
import { useEffect, useState, useCallback, useRef } from 'react';
import { CaretLeft, CaretRight, Plus, CaretDown } from '@phosphor-icons/react';
import { Modal } from '../components/Modal';
import { ModalAlert } from '../components/ModalAlert';
import { ModalConcluirServico } from '../components/ModalConcluirServico';
import { SkeletonPage } from '../components/Skeleton';
import { AgendaMobile } from '../components/agenda/AgendaMobile';
import { dataBrasilia, hojeBrasilia } from '../utils/datas';
import api from '../api/client';
import { PALETA_CORES_BARBEIROS } from '../styles/tokens';
import { formatarNomeServico } from '../utils/formato';
import { calcularLanes, EventoBase } from '../utils/lanes';

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
  cliente: { id: string; usuario: { nome: string } };
  barbeiroId: string;
  barbeiro: { id: string; usuario: { nome: string }; cor: string };
  servico: { id: string; nome: string; duracaoMinutos: number; cor: string };
  historicoRemarcacoes?: any[];
}

interface Barbeiro { id: string; usuario: { nome: string }; cor: string; ativo?: boolean }
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
  CONCLUIDO:   { bg: 'var(--sucesso-fundo)', border: 'var(--sucesso)', color: 'var(--sucesso)' },
  CANCELADO:   { bg: 'var(--error)', border: 'var(--error-text)', color: 'var(--error-text)' },
};

const statusLabels: Record<string, string> = {
  AGUARDANDO: 'Aguardando',
  CONFIRMADO: 'Confirmado',
  CONCLUIDO: 'Concluído',
  CANCELADO: 'Cancelado',
};

const diasSemana = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const PALETA_CORES = PALETA_CORES_BARBEIROS;

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
    const d = new Date(hojeBrasilia() + 'T12:00:00-03:00'); d.setDate(d.getDate() - d.getDay() + 1); return d;
  });
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const [modoMobile, setModoMobile] = useState<'grade' | 'lista'>(() => {
    return (localStorage.getItem('agenda.modoVisualizacao') as 'grade' | 'lista') || 'grade';
  });
  
  useEffect(() => {
    localStorage.setItem('agenda.modoVisualizacao', modoMobile);
  }, [modoMobile]);

  const [viewMode, setViewMode] = useState<'day' | 'week'>('day');
  const [diaMobile, setDiaMobile] = useState(() => {
    const d = new Date(hojeBrasilia() + 'T12:00:00-03:00'); return d;
  });

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  const [agendamentos, setAgendamentos] = useState<Agendamento[]>([]);
  const [bloqueios, setBloqueios] = useState<Bloqueio[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [configuracao, setConfiguracao] = useState<any>(null);
  const [modalAberto, setModalAberto] = useState(false);
  const [overflowModal, setOverflowModal] = useState<{aberto: boolean; eventos: EventoBase[]}>({ aberto: false, eventos: [] });
  const [modalBloqueioAberto, setModalBloqueioAberto] = useState(false);
  const [cancelarAlertAberto, setCancelarAlertAberto] = useState(false);
  const [agendamentoSelecionado, setAgendamentoSelecionado] = useState<Agendamento | null>(null);
  const [modalConcluirAberto, setModalConcluirAberto] = useState(false);
  const [alterandoStatus, setAlterandoStatus] = useState<string | null>(null);
  const [erroStatus, setErroStatus] = useState<string | null>(null);
  const [barbeiros, setBarbeiros] = useState<Barbeiro[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [servicos, setServicos] = useState<Servico[]>([]);
  const [filtroBarbeiro, setFiltroBarbeiro] = useState('todos');
  const [dropdownAberto, setDropdownAberto] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const [modalRemarcarAberto, setModalRemarcarAberto] = useState(false);
  const [formRemarcar, setFormRemarcar] = useState({ barbeiroId: '', servicoId: '', dataHora: '' });

  const [fidelidadeCache, setFidelidadeCache] = useState<any>(null);

  useEffect(() => {
    if (agendamentoSelecionado && (agendamentoSelecionado.status === 'CONFIRMADO' || agendamentoSelecionado.status === 'AGUARDANDO')) {
      setFidelidadeCache(null);
      api.get(`/fidelidade/clientes/${agendamentoSelecionado.cliente.id}/saldo?valorServico=${agendamentoSelecionado.valorCobrado}`)
        .then(res => setFidelidadeCache(res.data))
        .catch(err => console.error('Erro prefetch fidelidade:', err));
    }
  }, [agendamentoSelecionado]);

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
  const diasExibidos = viewMode === 'day' ? [diaMobile] : diasDaSemana;

  const carregar = useCallback(async () => {
    setCarregando(true);
    
    try {
      const dataInicio = dataBrasilia(diasDaSemana[0]);
      const dataFim = dataBrasilia(diasDaSemana[6]);

      const [resAgendamentos, resBloq, resBarb, resConfig] = await Promise.allSettled([
        api.get<Agendamento[]>('/agendamentos', { params: { dataInicio, dataFim } }),
        api.get<Bloqueio[]>('/bloqueios'),
        api.get<Barbeiro[]>('/barbeiros?todos=true'),
        api.get('/configuracoes')
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
      
      if (resConfig.status === 'fulfilled') {
        setConfiguracao(resConfig.value.data.horariosFuncionamento || 'vazio');
      } else {
        console.error('Erro ao carregar configuracoes:', resConfig.reason);
        setConfiguracao('erro');
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

  async function remarcarAgendamento() {
    if (salvando) return;
    if (!agendamentoSelecionado || !formRemarcar.barbeiroId || !formRemarcar.servicoId || !formRemarcar.dataHora) {
      setErroSalvar('Preencha todos os campos para remarcar.');
      return;
    }
    setSalvando(true);
    setErroSalvar(null);
    try {
      await api.put(`/agendamentos/${agendamentoSelecionado.id}`, formRemarcar);
      setModalRemarcarAberto(false);
      setAgendamentoSelecionado(null);
      carregar();
    } catch (err: any) {
      setErroSalvar(err.response?.data?.erro || 'Erro ao remarcar agendamento');
    } finally {
      setSalvando(false);
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

  async function mudarStatus(novoStatus: string) {
    if (!agendamentoSelecionado) return;
    setAlterandoStatus(novoStatus);
    setErroStatus(null);
    try {
      await api.put(`/agendamentos/${agendamentoSelecionado.id}`, { status: novoStatus });
      setAgendamentoSelecionado(null);
      setCancelarAlertAberto(false);
      carregar();
    } catch (err: any) {
      console.error('Erro ao alterar status:', err);
      setErroStatus(err.response?.data?.erro || 'Erro ao alterar status. Tente novamente.');
    } finally {
      setAlterandoStatus(null);
    }
  }

  function mudarSemana(direcao: number) {
    const nova = new Date(semanaInicio);
    nova.setDate(nova.getDate() + direcao * 7);
    setSemanaInicio(nova);
  }

  function navegar(direcao: number) {
    if (viewMode === 'day') {
      const nova = new Date(diaMobile);
      nova.setDate(nova.getDate() + direcao);
      setDiaMobile(nova);

      const novaStr = getDataBrasilia(nova);
      const inicioStr = getDataBrasilia(diasDaSemana[0]);
      const fimStr = getDataBrasilia(diasDaSemana[6]);

      if (novaStr < inicioStr || novaStr > fimStr) {
        const novaSemana = new Date(nova);
        novaSemana.setDate(novaSemana.getDate() - novaSemana.getDay() + 1);
        setSemanaInicio(novaSemana);
      }
    } else {
      mudarSemana(direcao);
    }
  }

  
  
  const mapearParaEventos = (ags: Agendamento[], bls: Bloqueio[]): EventoBase[] => {
    const evs: EventoBase[] = [];
    ags.forEach(ag => {
      const d = new Date(ag.dataHora);
      const hm = getHoraMinutoBrasilia(d);
      const iniMin = hm.hora * 60 + hm.minuto;
      const dur = ag.servico.duracaoMinutos || 30;
      evs.push({ id: ag.id, inicioMinutos: iniMin, fimMinutos: iniMin + dur, tipo: 'AGENDAMENTO', original: ag });
    });
    bls.forEach(bl => {
      const dInicio = new Date(bl.dataInicio);
      const hmIni = getHoraMinutoBrasilia(dInicio);
      const dFim = new Date(bl.dataFim);
      const hmFim = getHoraMinutoBrasilia(dFim);
      evs.push({ id: bl.id, inicioMinutos: hmIni.hora * 60 + hmIni.minuto, fimMinutos: hmFim.hora * 60 + hmFim.minuto, tipo: 'BLOQUEIO', original: bl });
    });
    return evs;
  };

  const isForaExpediente = (ag: Agendamento, configDia: any) => {
    if (!configDia || configDia.fechado) return true;
    if (!configDia.abertura || !configDia.fechamento) return true;
    const [aH, aM] = configDia.abertura.split(':').map(Number);
    const [fH, fM] = configDia.fechamento.split(':').map(Number);
    const aberturaM = aH * 60 + aM;
    const fechamentoM = fH * 60 + fM;
    const hmInicio = getHoraMinutoBrasilia(new Date(ag.dataHora));
    const inicioM = hmInicio.hora * 60 + hmInicio.minuto;
    const fimM = inicioM + (ag.servico?.duracaoMinutos || 0);
    return inicioM < aberturaM || fimM > fechamentoM;
  };

  const getEventosColuna = (dia: Date, barbeiroId?: string): EventoBase[] => {
    const diaISO = dataBrasilia(dia);
    const ags = agendamentos.filter(ag => getDataBrasilia(new Date(ag.dataHora)) === diaISO && (!barbeiroId || ag.barbeiroId === barbeiroId) && ag.status !== 'CANCELADO');
    const bls = bloqueios.filter(bl => getDataBrasilia(new Date(bl.dataInicio)) === diaISO && (!barbeiroId || bl.barbeiroId === barbeiroId));
    
    const CHAVES_DIA = ['domingo', 'segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado'];
    const diaSemana = CHAVES_DIA[dia.getDay()];
    const configDia = (configuracao && configuracao !== 'vazio' && configuracao !== 'erro') ? configuracao[diaSemana] || { fechado: true } : { fechado: false, abertura: '08:00', fechamento: '20:00' };

    const eventos = mapearParaEventos(ags, bls);
    return eventos.map(ev => {
      if (ev.tipo === 'AGENDAMENTO') {
        ev.foraExpediente = isForaExpediente(ev.original as Agendamento, configDia);
      }
      return ev;
    });
  };

  const renderEventosColuna = (eventosBase: EventoBase[], minOfDay: number, maxLanes: number = 3) => {
    const lanes = calcularLanes(eventosBase, maxLanes);
    return lanes.map(ev => {
      const laneWidth = 100 / ev.totalLanes;
      const leftOffset = ev.lane * laneWidth;
      const topPx = (ev.inicioMinutos - minOfDay) * (48 / 30);
      const heightPx = (ev.fimMinutos - ev.inicioMinutos) * (48 / 30);
      
      if (ev.isOverflow) {
        if (ev.overflowCount === undefined) return null;
        return (
          <div key={`overflow-${ev.id}`}
            onClick={(e) => { e.stopPropagation(); setOverflowModal({ aberto: true, eventos: ev.grupoCluster || [] }); }}
            style={{ position: 'absolute', top: `${topPx + 2}px`, left: `${leftOffset}%`, width: `${laneWidth}%`, height: `${heightPx - 4}px`, background: 'var(--bg-surface2)', border: '1px solid var(--border)', zIndex: 30, pointerEvents: 'auto', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--texto-secundario)', fontWeight: 600, fontSize: '0.8125rem' }}>
            +{ev.overflowCount}
          </div>
        );
      }
      
      if (ev.tipo === 'BLOQUEIO') {
        const bl = ev.original as Bloqueio;
        return (
          <div key={bl.id} className="truncate cursor-pointer flex flex-col" onClick={() => removerBloqueio(bl.id)} title="Clique para remover bloqueio"
            style={{ position: 'absolute', top: `${topPx + 2}px`, left: `${leftOffset}%`, width: `calc(${laneWidth}% - 4px)`, height: `${heightPx - 4}px`, padding: '4px 8px', background: 'repeating-linear-gradient(45deg, var(--bg-surface2), var(--bg-surface2) 10px, transparent 10px, transparent 20px)', borderLeft: `3px solid var(--texto-secundario)`, color: 'var(--texto-secundario)', fontFamily: 'var(--fonte-interface)', fontSize: '0.8125rem', borderRadius: '0 4px 4px 0', lineHeight: 1.2, zIndex: 20, pointerEvents: 'auto' }}>
            <p className="truncate pr-1" style={{ fontWeight: 600, marginBottom: '2px' }}>{bl?.barbeiro?.usuario?.nome || 'Bloqueado'}</p>
            <p className="truncate" style={{ fontSize: '0.8125rem' }}>Bloqueado</p>
          </div>
        );
      }

      const ag = ev.original as Agendamento;
      const st = statusStyles[ag.status] || statusStyles['AGUARDANDO'];
      const title = `${String(Math.floor(ev.inicioMinutos/60)).padStart(2,'0')}:${String(ev.inicioMinutos%60).padStart(2,'0')} · ${ag?.cliente?.usuario?.nome || 'Cliente'} · ${formatarNomeServico(ag)} · ${ag?.barbeiro?.usuario?.nome || 'Barbeiro'}`;
      
      const isCompact = heightPx < 35;
      const clientName = laneWidth < 40 ? ag?.cliente?.usuario?.nome || 'Cliente'.split(' ')[0] : ag?.cliente?.usuario?.nome || 'Cliente';

      return (
        <div key={ag.id} className="cursor-pointer overflow-hidden" onClick={() => setAgendamentoSelecionado(ag)} title={title}
          style={{ position: 'absolute', top: `${topPx + 2}px`, left: `${leftOffset}%`, width: `calc(${laneWidth}% - 4px)`, height: `${heightPx - 4}px`, padding: isCompact ? '2px 4px' : '6px 8px', background: st.bg, borderLeft: `3px solid ${st.color}`, color: 'var(--text-primary)', opacity: ag.status === 'CONCLUIDO' ? 0.7 : 1, fontFamily: 'var(--fonte-interface)', fontSize: '0.8125rem', borderRadius: '0 4px 4px 0', lineHeight: 1.2, zIndex: 20, pointerEvents: 'auto', display: 'flex', flexDirection: isCompact ? 'row' : 'column', gap: isCompact ? '4px' : '0', alignItems: isCompact ? 'center' : 'flex-start', boxShadow: '0 1px 2px rgba(0,0,0,0.1)' }}>
          <div className={`flex justify-between items-center overflow-hidden w-full ${isCompact ? '' : 'mb-1.5'}`}>
            <p className="truncate pr-1 shrink-0" style={{ fontWeight: 600, fontSize: isCompact ? '11px' : '13px' }}>{clientName}</p>
            <div className="flex items-center gap-1 shrink-0">
              {ev.foraExpediente && <span className="text-[var(--cor-erro)] bg-[var(--perigo-fundo)] px-1 rounded text-[10px] font-bold" title="Fora do Expediente">!</span>}
              {(!isCompact && ag.origem === 'ONLINE') && <span className="bg-[var(--cor-primaria)] text-[var(--texto-sobre-primaria)] px-1 rounded text-[8px] font-bold">WEB</span>}
            </div>
          </div>
          <div className="overflow-hidden w-full">
            <p className="truncate" style={{ fontFamily: 'var(--fonte-interface)', fontSize: isCompact ? '11px' : '0.8125rem', color: isCompact ? 'var(--texto-secundario)' : 'inherit' }}>
              {isCompact ? ` - ${formatarNomeServico(ag)}` : formatarNomeServico(ag)}
            </p>
          </div>
        </div>
      );
    });
  };


  if (carregando) return <SkeletonPage />;

  const barbeirosValidos = barbeiros.filter(b => {
    if (b.ativo !== false) return true;
    const temAgendamento = agendamentos.some(a => a.barbeiroId === b.id);
    const temBloqueio = bloqueios.some(bl => bl.barbeiroId === b.id);
    return temAgendamento || temBloqueio;
  });

  return (
    <div className="animate-fade-in flex flex-col gap-4 h-full" style={{ minWidth: 0, height: 'calc(100vh - 96px)' }}>
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
              style={{ color: 'var(--texto-secundario)', background: 'transparent', border: 'none', cursor: 'pointer', minHeight: isMobile ? '44px' : '32px', minWidth: isMobile ? '44px' : '32px' }}
            >
              <CaretLeft size={16} />
            </button>
            <span
              className="px-3 min-w-[180px] text-center"
              style={{
                fontFamily: 'var(--fonte-interface)',
                fontSize: '11px',
                color: 'var(--texto-secundario)',
                letterSpacing: '0.04em',
              }}
            >
              {viewMode === 'day' ? (
                `${diasSemana[diaMobile.getDay()]}, ${diaMobile.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}`
              ) : (
                `${diasDaSemana[0].toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })} — ${diasDaSemana[6].toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}`
              )}
            </span>
            <button
              onClick={() => navegar(1)}
              className="p-2 transition-colors flex items-center justify-center"
              style={{ color: 'var(--texto-secundario)', background: 'transparent', border: 'none', cursor: 'pointer', minHeight: isMobile ? '44px' : '32px', minWidth: isMobile ? '44px' : '32px' }}
            >
              <CaretRight size={16} />
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => setViewMode(v => v === 'day' ? 'week' : 'day')} className="btn-secondary flex-1 sm:flex-none justify-center">
              {viewMode === 'day' ? 'Visão Semana' : 'Visão Dia'}
            </button>
            <button onClick={() => setModalBloqueioAberto(true)} className="btn-secondary flex-1 sm:flex-none justify-center">
              Bloquear Horário
            </button>
            <button onClick={abrirModal} className="btn-primary flex-1 sm:flex-none justify-center">
              <Plus size={14} /> Novo Agendamento
            </button>
          </div>
        </div>
      </div>

      {/* Filtros de Barbeiro (Dropdown) */}
      {(!isMobile || modoMobile === 'lista') && (
        <div className="relative" style={{ width: '100%', maxWidth: isMobile ? 'none' : '300px' }} ref={dropdownRef}>
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
          <CaretDown size={16} style={{ color: 'var(--texto-secundario)' }} />
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
              className="hover:bg-[var(--superficie-2)] border-[var(--borda)] transition-colors"
            >
              <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: 'var(--amber)' }} />
              Todos os barbeiros
            </button>

            {barbeirosValidos.map((b) => {
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
                  className="hover:bg-[var(--superficie-2)] border-[var(--borda)] transition-colors"
                >
                  <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: cor }} />
                  {b.usuario.nome}
                </button>
              );
            })}
          </div>
        )}
      </div>
      )}

      {/* Calendário semanal/diário */}
      {(() => {
        if (carregando || !configuracao) {
          return (
            <div style={{ padding: '24px', textAlign: 'center', color: 'var(--texto-secundario)' }}>
              <p className="font-interface font-medium">Carregando horários...</p>
            </div>
          );
        }

        const barbeirosExibidos = filtroBarbeiro === 'todos' ? barbeirosValidos : barbeirosValidos.filter(b => b.id === filtroBarbeiro);
        const cols = viewMode === 'day' ? barbeirosExibidos.length : diasExibidos.length;
        const agora = new Date();
        const CHAVES_DIA = ['domingo', 'segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado'];

        const getConfigDia = (diaDate: Date) => {
          if (configuracao === 'vazio' || configuracao === 'erro') {
            return { fechado: false, abertura: '08:00', fechamento: '20:00' };
          }
          const diaSemana = CHAVES_DIA[diaDate.getDay()];
          return configuracao[diaSemana] || { fechado: true };
        };

        const isAlmoco = (horario: string, c: any) => {
          if (!c || c.fechado || !c.temAlmoco || !c.almocoInicio || !c.almocoFim) return false;
          if (!/^\d{2}:\d{2}$/.test(c.almocoInicio) || !/^\d{2}:\d{2}$/.test(c.almocoFim)) return false;
          const [h, m] = horario.split(':').map(Number);
          const hm = h * 60 + m;
          const [aiH, aiM] = c.almocoInicio.split(':').map(Number);
          const [afH, afM] = c.almocoFim.split(':').map(Number);
          const ai = aiH * 60 + aiM;
          const af = afH * 60 + afM;
          return hm >= ai && hm < af;
        };

        let min = 24 * 60;
        let max = 0;
        let temHorarioExpediente = false;
        
        for (const d of diasExibidos) {
          const c = getConfigDia(d);
          if (c.fechado === false && c.abertura && c.fechamento && /^\d{2}:\d{2}$/.test(c.abertura) && /^\d{2}:\d{2}$/.test(c.fechamento)) {
            temHorarioExpediente = true;
            const [ah, am] = c.abertura.split(':').map(Number);
            const [fh, fm] = c.fechamento.split(':').map(Number);
            if (!isNaN(ah) && !isNaN(am) && ah * 60 + am < min) min = ah * 60 + am;
            if (!isNaN(fh) && !isNaN(fm) && fh * 60 + fm > max) max = fh * 60 + fm;
          }
        }

        const diasExibidosSet = new Set(diasExibidos.map(d => getDataBrasilia(d)));
        let temAgendamento = false;

        for (const ag of agendamentos) {
          if (ag.status === 'CANCELADO') continue;
          if (filtroBarbeiro !== 'todos' && ag.barbeiroId !== filtroBarbeiro) continue;
          const agDate = new Date(ag.dataHora);
          if (!diasExibidosSet.has(getDataBrasilia(agDate))) continue;
          
          temAgendamento = true;
          const hm = getHoraMinutoBrasilia(agDate);
          const inicioM = hm.hora * 60 + hm.minuto;
          const fimM = inicioM + (ag.servico?.duracaoMinutos || 0);
          if (inicioM < min) min = inicioM;
          if (fimM > max) max = fimM;
        }

        if (!temHorarioExpediente && !temAgendamento) {
          return (
            <div style={{ padding: '32px', textAlign: 'center' }}>
              <p className="font-interface font-medium text-[var(--texto-secundario)]">Barbearia fechada neste(s) dia(s)</p>
            </div>
          );
        }

        min = Math.floor(min / 30) * 30;
        max = Math.ceil(max / 30) * 30;

        const horariosExibidos: string[] = [];
        for (let m = min; m < max; m += 30) {
          horariosExibidos.push(`${String(Math.floor(m / 60)).padStart(2, '0')}:${m % 60 === 0 ? '00' : '30'}`);
        }
        
        return isMobile ? (
          <AgendaMobile 
            agendamentos={agendamentos}
            bloqueios={bloqueios}
            barbeiros={barbeiros}
            diaMobile={diaMobile}
            horarios={horariosExibidos}
            getColor={(id) => getBarbeiroColor(id, barbeiros)}
            abrirModal={abrirModal}
            setAgendamentoSelecionado={setAgendamentoSelecionado}
            removerBloqueio={removerBloqueio}
            modo={modoMobile}
            setModo={setModoMobile}
            configuracao={configuracao}
          />
        ) : (
          <div className="flex-1" style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', overflowX: 'auto', overflowY: 'auto', flex: 1, minHeight: 0, width: '100%', position: 'relative' }}>
            <div style={{ minWidth: isMobile ? '100%' : '700px' }}>
              <>
                {/* Cabeçalho das colunas */}
                <div style={{ display: 'grid', gridTemplateColumns: `60px repeat(${Math.max(cols, 1)}, 1fr)`, borderBottom: '1px solid var(--border)', position: 'sticky', top: 0, zIndex: 50, background: 'var(--bg-surface)' }}>
                  <div style={{ padding: '8px' }} />
                  {viewMode === 'day' ? barbeirosExibidos.map((b) => (
                    <div key={b.id} className="text-center" style={{ padding: '12px', borderLeft: '1px solid var(--border)' }}>
                      <p style={{ fontFamily: 'var(--fonte-interface)', fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>{b.usuario.nome}</p>
                    </div>
                  )) : diasExibidos.map((dia, i) => {
                    const isHoje = dia.toDateString() === agora.toDateString();
                    return (
                      <div key={i} className="text-center" style={{ padding: '12px', borderLeft: '1px solid var(--border)', background: isHoje ? 'rgba(var(--cor-primaria-rgb), 0.10)' : 'transparent' }}>
                        <p style={{ fontFamily: 'var(--fonte-interface)', fontSize: '9px', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--texto-secundario)' }}>{diasSemana[dia.getDay()]}</p>
                        <p style={{ fontFamily: 'var(--fonte-interface)', fontSize: '24px', color: isHoje ? 'var(--amber)' : 'var(--text-primary)', lineHeight: 1.2 }}>{dia.getDate()}</p>
                      </div>
                    );
                  })}
                  {cols === 0 && <div style={{ padding: '12px', borderLeft: '1px solid var(--border)' }}><p className="text-center text-[var(--texto-secundario)] text-sm">Nenhum barbeiro disponível</p></div>}
                </div>

                {/* Grid de horários */}
                <div style={{ position: 'relative' }}>
                  {/* Linha do Agora */}
                  {viewMode === 'day' && diaMobile.toDateString() === agora.toDateString() && (
                    <div style={{
                      position: 'absolute', left: '60px', right: 0,
                      top: `${((agora.getHours() * 60 + agora.getMinutes()) - min) * (48 / 30)}px`,
                      borderTop: '2px solid var(--cor-primaria)', zIndex: 40, pointerEvents: 'none'
                    }}>
                      <div style={{ position: 'absolute', left: '-4px', top: '-5px', width: '8px', height: '8px', borderRadius: '50%', background: 'var(--cor-primaria)' }} />
                    </div>
                  )}

                  {/* Fundo da Grade */}
                  {horariosExibidos.map((horario) => (
                    <div key={horario} style={{ display: 'grid', gridTemplateColumns: `60px repeat(${Math.max(cols, 1)}, 1fr)`, borderBottom: '1px solid var(--border)' }}>
                      <div className="text-right pr-3 pt-3" style={{ padding: '8px', fontFamily: 'var(--fonte-interface)', fontSize: '10px', color: 'var(--text-disabled)', letterSpacing: '0.04em', height: '48px' }}>
                        {horario}
                      </div>
                      {viewMode === 'day' ? barbeirosExibidos.map((barbeiro) => {
                        const inAlmoco = isAlmoco(horario, getConfigDia(diaMobile));
                        return <div key={barbeiro.id} style={{ borderLeft: '1px solid var(--border)', background: inAlmoco ? 'repeating-linear-gradient(45deg, var(--bg-surface), var(--bg-surface) 10px, var(--bg-surface2) 10px, var(--bg-surface2) 20px)' : 'transparent' }} />;
                      }) : diasExibidos.map((dia, diaIdx) => {
                        const cDia = getConfigDia(dia);
                        const diaFechado = cDia.fechado;
                        const inAlmoco = isAlmoco(horario, cDia);
                        return <div key={diaIdx} style={{ borderLeft: '1px solid var(--border)', background: diaFechado || inAlmoco ? 'repeating-linear-gradient(45deg, var(--bg-surface), var(--bg-surface) 10px, var(--bg-surface2) 10px, var(--bg-surface2) 20px)' : 'transparent', opacity: diaFechado ? 0.7 : 1 }} />;
                      })}
                      {cols === 0 && <div style={{ borderLeft: '1px solid var(--border)', height: '48px' }} />}
                    </div>
                  ))}

                  {/* Camada de Eventos */}
                  <div style={{ position: 'absolute', top: 0, left: '60px', right: 0, bottom: 0, display: 'grid', gridTemplateColumns: `repeat(${Math.max(cols, 1)}, 1fr)`, pointerEvents: 'none' }}>
                    {viewMode === 'day' ? barbeirosExibidos.map(barbeiro => (
                      <div key={barbeiro.id} style={{ position: 'relative', width: '100%', height: '100%' }}>
                        {renderEventosColuna(getEventosColuna(diaMobile, barbeiro.id), min, 3)}
                      </div>
                    )) : diasExibidos.map((dia, diaIdx) => {
                      const cDia = getConfigDia(dia);
                      return (
                        <div key={diaIdx} style={{ position: 'relative', width: '100%', height: '100%' }}>
                           {!cDia.fechado && renderEventosColuna(getEventosColuna(dia, filtroBarbeiro === 'todos' ? undefined : filtroBarbeiro), min, 3)}
                        </div>
                      );
                    })}
                    {cols === 0 && <div />}
                  </div>
                </div>
              </>
            </div>
          </div>
          </div>
        );
      })()}
{/* Footer safe area on mobile */}
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
                color: 'var(--texto-secundario)',
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
            <div style={{ padding: '12px', background: 'var(--perigo-fundo)', border: '1px solid var(--error-text)', borderRadius: '6px', color: 'var(--error-text)', fontFamily: 'var(--fonte-interface)', fontSize: '13px', fontWeight: 500 }}>
              {erroSalvar}
            </div>
          )}
          <div>
            <label className="input-label">Cliente</label>
            <select value={form.clienteId} onChange={(e) => { setForm({ ...form, clienteId: e.target.value }); setErroSalvar(null); }} className="ds-select">
              <option value="">Selecione...</option>
              {clientes.map((c) => <option key={c.id} value={c.id}>{c.usuario.nome}</option>)}
            </select>
          </div>
          <div>
            <label className="input-label">Barbeiro</label>
            <select value={form.barbeiroId} onChange={(e) => { setForm({ ...form, barbeiroId: e.target.value }); setErroSalvar(null); }} className="ds-select">
              <option value="">Selecione...</option>
              {barbeiros.filter(b => b.ativo !== false).map((b) => <option key={b.id} value={b.id}>{b.usuario.nome}</option>)}
            </select>
          </div>
          <div>
            <label className="input-label">Serviço</label>
            <select value={form.servicoId} onChange={(e) => { setForm({ ...form, servicoId: e.target.value }); setErroSalvar(null); }} className="ds-select">
              <option value="">Selecione...</option>
              {servicos.map((s) => <option key={s.id} value={s.id}>{s.nome} — R$ {Number(s.preco).toFixed(2)}</option>)}
            </select>
          </div>
          <div>
            <label className="input-label">Data e Horário</label>
            <input type="datetime-local" value={form.dataHora} onChange={(e) => { setForm({ ...form, dataHora: e.target.value }); setErroSalvar(null); }} className="ds-input" />
          </div>
          <div>
            <label className="input-label">Observações</label>
            <textarea value={form.observacoes} onChange={(e) => { setForm({ ...form, observacoes: e.target.value }); setErroSalvar(null); }} rows={2} className="ds-textarea" />
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

      {/* Modal para Remarcar */}
      <Modal aberto={modalRemarcarAberto} onFechar={() => setModalRemarcarAberto(false)} titulo="Remarcar Agendamento">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {erroSalvar && (
            <div style={{ padding: '12px', background: 'var(--perigo-fundo)', border: '1px solid var(--error-text)', borderRadius: '6px', color: 'var(--error-text)', fontFamily: 'var(--fonte-interface)', fontSize: '13px', fontWeight: 500 }}>
              {erroSalvar}
            </div>
          )}
          <div>
            <label className="input-label">Barbeiro</label>
            <select value={formRemarcar.barbeiroId} onChange={(e) => { setFormRemarcar({ ...formRemarcar, barbeiroId: e.target.value }); setErroSalvar(null); }} className="ds-select">
              <option value="">Selecione...</option>
              {barbeiros.filter(b => b.ativo !== false).map((b) => <option key={b.id} value={b.id}>{b.usuario.nome}</option>)}
            </select>
          </div>
          <div>
            <label className="input-label">Serviço</label>
            <select value={formRemarcar.servicoId} onChange={(e) => { setFormRemarcar({ ...formRemarcar, servicoId: e.target.value }); setErroSalvar(null); }} className="ds-select">
              <option value="">Selecione...</option>
              {servicos.map((s) => <option key={s.id} value={s.id}>{s.nome} — R$ {Number(s.preco).toFixed(2)}</option>)}
            </select>
          </div>
          <div>
            <label className="input-label">Data e Horário</label>
            <input type="datetime-local" value={formRemarcar.dataHora} onChange={(e) => { setFormRemarcar({ ...formRemarcar, dataHora: e.target.value }); setErroSalvar(null); }} className="ds-input" />
          </div>
          <button 
            onClick={remarcarAgendamento} 
            className="btn-primary w-full justify-center"
            disabled={salvando}
            style={{ opacity: salvando ? 0.7 : 1, cursor: salvando ? 'not-allowed' : 'pointer' }}
          >
            {salvando ? 'Salvando...' : 'Confirmar Remarcação'}
          </button>
        </div>
      </Modal>

      {/* Modal de Overflow */}
      <Modal aberto={overflowModal.aberto} onFechar={() => setOverflowModal({ aberto: false, eventos: [] })} titulo="Agendamentos">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {overflowModal.eventos.map(ev => {
            if (ev.tipo === 'BLOQUEIO') {
              const bl = ev.original as Bloqueio;
              return (
                <div key={bl.id} style={{ padding: '12px', background: 'var(--bg-surface2)', borderRadius: '8px', borderLeft: '4px solid var(--texto-secundario)' }}>
                  <p style={{ fontWeight: 600 }}>{bl?.barbeiro?.usuario?.nome || 'Bloqueado'}</p>
                  <p style={{ fontSize: '13px', color: 'var(--texto-secundario)' }}>Bloqueio: {bl.motivo || 'Indisponível'}</p>
                </div>
              );
            }
            const ag = ev.original as Agendamento;
            const st = statusStyles[ag.status] || statusStyles['AGUARDANDO'];
            return (
              <div key={ag.id} onClick={() => { setAgendamentoSelecionado(ag); setOverflowModal({ aberto: false, eventos: [] }); }} style={{ padding: '12px', background: st.bg, borderRadius: '8px', borderLeft: `4px solid ${st.color}`, display: 'flex', flexDirection: 'column', gap: '4px', cursor: 'pointer' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <p style={{ fontWeight: 600 }}>{ag?.cliente?.usuario?.nome || 'Cliente'}</p>
                  <span style={{ fontSize: '12px', color: st.color, fontWeight: 600 }}>{statusLabels[ag.status]}</span>
                </div>
                <p style={{ fontSize: '13px' }}>{ag?.barbeiro?.usuario?.nome || 'Barbeiro'} · {formatarNomeServico(ag)}</p>
                <p style={{ fontSize: '13px', color: 'var(--texto-secundario)' }}>{String(Math.floor(ev.inicioMinutos/60)).padStart(2,'0')}:{String(ev.inicioMinutos%60).padStart(2,'0')} - {String(Math.floor(ev.fimMinutos/60)).padStart(2,'0')}:{String(ev.fimMinutos%60).padStart(2,'0')}</p>
              </div>
            );
          })}
        </div>
      </Modal>
  

      {/* Modal para Bloqueio de Agenda */}
      <Modal aberto={modalBloqueioAberto} onFechar={() => setModalBloqueioAberto(false)} titulo="Bloquear Horário">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label className="input-label">Barbeiro</label>
            <select value={formBloqueio.barbeiroId} onChange={(e) => setFormBloqueio({ ...formBloqueio, barbeiroId: e.target.value })} className="ds-select">
              <option value="">Selecione...</option>
              {barbeiros.filter(b => b.ativo !== false).map((b) => <option key={b.id} value={b.id}>{b.usuario.nome}</option>)}
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
          <button onClick={criarBloqueio} className="btn-secondary w-full justify-center text-[var(--texto-principal)] bg-[var(--perigo)] hover:bg-[var(--perigo)]">
            Confirmar Bloqueio
          </button>
        </div>
      </Modal>

      {/* Modal de Detalhes e Ações do Agendamento */}
      <Modal 
        aberto={agendamentoSelecionado !== null} 
        onFechar={() => {
          setAgendamentoSelecionado(null);
          setErroStatus(null);
        }} 
        titulo="Detalhes do Agendamento"
      >
        {agendamentoSelecionado && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {erroStatus && (
              <div style={{ padding: '12px', background: 'var(--perigo-fundo)', border: '1px solid var(--error-text)', borderRadius: '6px', color: 'var(--error-text)', fontFamily: 'var(--fonte-interface)', fontSize: '13px', fontWeight: 500 }}>
                {erroStatus}
              </div>
            )}
            
            <div className="flex flex-col gap-2 mb-2" style={{ fontFamily: 'var(--fonte-interface)', fontSize: '14px', color: 'var(--text-primary)' }}>
              <p><strong style={{ color: 'var(--texto-secundario)' }}>Cliente:</strong> {agendamentoSelecionado.cliente.usuario.nome}</p>
              <p><strong style={{ color: 'var(--texto-secundario)' }}>Serviço:</strong> {formatarNomeServico(agendamentoSelecionado)} ({agendamentoSelecionado.servico.duracaoMinutos} min)</p>
              <p><strong style={{ color: 'var(--texto-secundario)' }}>Barbeiro:</strong> {agendamentoSelecionado.barbeiro.usuario.nome}</p>
              <p><strong style={{ color: 'var(--texto-secundario)' }}>Data/Hora:</strong> {new Date(agendamentoSelecionado.dataHora).toLocaleString('pt-BR')}</p>
              <p><strong style={{ color: 'var(--texto-secundario)' }}>Status Atual:</strong> {statusLabels[agendamentoSelecionado.status] || agendamentoSelecionado.status}</p>
            </div>

            {agendamentoSelecionado.historicoRemarcacoes && agendamentoSelecionado.historicoRemarcacoes.length > 0 && (
              <div style={{ padding: '8px 12px', background: 'var(--bg-surface2)', borderRadius: '6px', fontSize: '12px', color: 'var(--texto-secundario)' }}>
                <p style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>Histórico de Remarcações</p>
                {agendamentoSelecionado.historicoRemarcacoes.map((hist: any, idx: number) => (
                  <div key={hist.id} style={{ marginBottom: idx < agendamentoSelecionado.historicoRemarcacoes!.length - 1 ? '8px' : '0' }}>
                    • Remarcado de {new Date(hist.dataHoraAnterior).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })} 
                    {hist.barbeiroAnteriorId !== hist.barbeiroNovoId ? ` (${hist.barbeiroAnterior?.usuario?.nome})` : ''} 
                    <br/><span style={{ opacity: 0.7, marginLeft: '8px' }}>por {hist.usuarioAcao?.nome || 'Sistema'} em {new Date(hist.criadoEm).toLocaleDateString('pt-BR')}</span>
                  </div>
                ))}
              </div>
            )}

            <div className="flex flex-col gap-2">
              {agendamentoSelecionado.status === 'AGUARDANDO' && (
                <>
                  <button 
                    onClick={() => mudarStatus('CONFIRMADO')} 
                    className="btn-primary w-full justify-center"
                    disabled={alterandoStatus !== null}
                    style={{ opacity: alterandoStatus !== null ? 0.7 : 1 }}
                  >
                    {alterandoStatus === 'CONFIRMADO' ? 'Carregando...' : 'Confirmar Agendamento'}
                  </button>
                  <button 
                    onClick={() => setModalConcluirAberto(true)} 
                    className="btn-secondary w-full justify-center"
                    disabled={alterandoStatus !== null}
                    style={{ background: 'var(--sucesso-fundo)', color: 'var(--sucesso)', opacity: alterandoStatus !== null ? 0.7 : 1 }}
                  >
                    {alterandoStatus === 'CONCLUIDO' ? 'Carregando...' : 'Concluir Agendamento'}
                  </button>
                  <button 
                    onClick={() => {
                      setFormRemarcar({
                        barbeiroId: agendamentoSelecionado.barbeiro.id,
                        servicoId: agendamentoSelecionado.servico.id,
                        dataHora: new Date(new Date(agendamentoSelecionado.dataHora).getTime() - (new Date().getTimezoneOffset() * 60000)).toISOString().slice(0, 16)
                      });
                      setModalRemarcarAberto(true);
                      setAgendamentoSelecionado(null);
                    }} 
                    className="btn-secondary w-full justify-center"
                    disabled={alterandoStatus !== null}
                    style={{ background: 'var(--bg-surface2)', color: 'var(--text-primary)', border: '1px solid var(--border)' }}
                  >
                    Remarcar Agendamento
                  </button>
                  <button 
                    onClick={() => setCancelarAlertAberto(true)} 
                    className="btn-secondary w-full justify-center"
                    disabled={alterandoStatus !== null}
                    style={{ background: 'var(--error)', color: 'var(--error-text)', opacity: alterandoStatus !== null ? 0.7 : 1 }}
                  >
                    {alterandoStatus === 'CANCELADO' ? 'Carregando...' : 'Cancelar Agendamento'}
                  </button>
                </>
              )}

              {agendamentoSelecionado.status === 'CONFIRMADO' && (
                <>
                  <button 
                    onClick={() => setModalConcluirAberto(true)} 
                    className="btn-secondary w-full justify-center"
                    disabled={alterandoStatus !== null}
                    style={{ background: 'var(--sucesso-fundo)', color: 'var(--sucesso)', opacity: alterandoStatus !== null ? 0.7 : 1 }}
                  >
                    {alterandoStatus === 'CONCLUIDO' ? 'Carregando...' : 'Concluir Agendamento'}
                  </button>
                  <button 
                    onClick={() => {
                      setFormRemarcar({
                        barbeiroId: agendamentoSelecionado.barbeiro.id,
                        servicoId: agendamentoSelecionado.servico.id,
                        dataHora: new Date(new Date(agendamentoSelecionado.dataHora).getTime() - (new Date().getTimezoneOffset() * 60000)).toISOString().slice(0, 16)
                      });
                      setModalRemarcarAberto(true);
                      setAgendamentoSelecionado(null);
                    }} 
                    className="btn-secondary w-full justify-center"
                    disabled={alterandoStatus !== null}
                    style={{ background: 'var(--bg-surface2)', color: 'var(--text-primary)', border: '1px solid var(--border)' }}
                  >
                    Remarcar Agendamento
                  </button>
                  <button 
                    onClick={() => setCancelarAlertAberto(true)} 
                    className="btn-secondary w-full justify-center"
                    disabled={alterandoStatus !== null}
                    style={{ background: 'var(--error)', color: 'var(--error-text)', opacity: alterandoStatus !== null ? 0.7 : 1 }}
                  >
                    {alterandoStatus === 'CANCELADO' ? 'Carregando...' : 'Cancelar Agendamento'}
                  </button>
                </>
              )}

              {(agendamentoSelecionado.status === 'CONCLUIDO' || agendamentoSelecionado.status === 'CANCELADO') && (
                <button 
                  onClick={() => {
                    setAgendamentoSelecionado(null);
                    setErroStatus(null);
                  }} 
                  className="btn-secondary w-full justify-center"
                >
                  Fechar
                </button>
              )}
            </div>
          </div>
        )}
      </Modal>

      <ModalAlert
        aberto={cancelarAlertAberto}
        onFechar={() => setCancelarAlertAberto(false)}
        onConfirmar={() => mudarStatus('CANCELADO')}
        titulo="Cancelar Agendamento"
        mensagem="Tem certeza que deseja cancelar este agendamento? Ele será removido da agenda."
        tipo="aviso"
        textoBotao="Sim, cancelar"
        textoCancelar="Não, voltar"
        isConfirm={true}
      />

      <ModalConcluirServico
        aberto={modalConcluirAberto}
        onFechar={() => setModalConcluirAberto(false)}
        agendamento={agendamentoSelecionado as any}
        fidelidadeCache={fidelidadeCache}
        onConfirmar={async (dados) => {
          if (!agendamentoSelecionado) return;
          await api.put(`/agendamentos/${agendamentoSelecionado.id}`, dados);
          setAgendamentoSelecionado(null);
          setModalConcluirAberto(false);
          carregar();
        }}
      />
    </div>
  );
}
