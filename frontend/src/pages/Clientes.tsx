// Página de Clientes — estética industrial com dados ricos
import { useEffect, useState, useCallback, useRef } from 'react';
import {
  Search, Users, Calendar, TrendingUp, DollarSign, Gift,
  Star, Phone, Mail, X, Plus, MessageCircle, Cake,
} from 'lucide-react';
import { StatCard } from '../components/StatCard';
import { LoadingSpinner } from '../components/LoadingSpinner';
import api from '../api/client';

/* ─── Tipos ────────────────────────────────────────────────── */
interface ClienteResumo {
  id: string;
  telefone: string | null;
  dataNascimento: string | null;
  observacoes: string | null;
  usuario: { id: string; nome: string; email: string };
  totalVisitas: number;
  totalGasto: number;
  ultimoAtendimento: string | null;
  pontosAtuais: number;
  nivel: string;
  cor: string;
  proximoNivel: number;
  pontosParaProximo: number;
}

interface Agendamento {
  id: string; dataHora: string; status: string;
  valorCobrado: string; servico: string; barbeiro: string;
}
interface HistoricoPonto { id: string; pontos: number; descricao: string; data: string }
interface HistoricoResgate { id: string; pontosUsados: number; recompensa: string; data: string }

interface ClienteDetalhado extends ClienteResumo {
  ticketMedio: number;
  primeiraVisita: string | null;
  ultimaVisita: string | null;
  pontosGanhos: number;
  pontosUsados: number;
  agendamentos: Agendamento[];
  historicoPontos: HistoricoPonto[];
  historicoResgates: HistoricoResgate[];
}

interface Resumo { totalClientes: number; clientesAtivos: number; ticketMedio: number }

interface Aniversariante {
  id: string;
  usuario: { id: string; nome: string; email: string };
  telefone: string | null;
  dataNascimento: string;
  diaAniversario: number;
}

interface Recompensa {
  id: string; nome: string; pontosNecessarios: number; ativo: boolean;
}

/* ─── Helpers ──────────────────────────────────────────────── */
const statusStyles: Record<string, string> = {
  CONCLUIDO: 'var(--success-text)',
  CONFIRMADO: 'var(--text-primary)',
  AGUARDANDO: 'var(--amber-light)',
  CANCELADO: 'var(--error-text)',
};

function getIniciais(nome: string) {
  return nome.split(' ').slice(0, 2).map(p => p[0]).join('').toUpperCase();
}

function badgeClass(nivel: string) {
  switch (nivel) {
    case 'Diamante': return 'badge-diamante';
    case 'Ouro': return 'badge-ouro';
    case 'Prata': return 'badge-prata';
    default: return 'badge-bronze';
  }
}

function formatarData(d: string | null) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('pt-BR');
}

function formatarMoeda(v: number) {
  return `R$ ${v.toFixed(2).replace('.', ',')}`;
}

const MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

/* ─── Component ────────────────────────────────────────────── */
export function Clientes() {
  // State
  const [clientes, setClientes] = useState<ClienteResumo[]>([]);
  const [resumo, setResumo] = useState<Resumo | null>(null);
  const [aniversariantes, setAniversariantes] = useState<Aniversariante[]>([]);
  const [recompensas, setRecompensas] = useState<Recompensa[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [busca, setBusca] = useState('');
  const [buscaDebounced, setBuscaDebounced] = useState('');
  const [filtroNivel, setFiltroNivel] = useState('Todos');
  const [ordenar, setOrdenar] = useState('recente');
  const [abaAtiva, setAbaAtiva] = useState<'clientes' | 'aniversariantes'>('clientes');

  // Detalhe do cliente
  const [clienteSelecionado, setClienteSelecionado] = useState<ClienteDetalhado | null>(null);
  const [carregandoDetalhe, setCarregandoDetalhe] = useState(false);
  const [abaDetalhe, setAbaDetalhe] = useState<'info' | 'historico' | 'pontos'>('info');

  // Formulário de pontos
  const [mostrarFormPontos, setMostrarFormPontos] = useState(false);
  const [pontosManual, setPontosManual] = useState('');
  const [descricaoPontos, setDescricaoPontos] = useState('');

  // Formulário de resgate
  const [mostrarFormResgate, setMostrarFormResgate] = useState(false);

  // Ref para o timer de debounce
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* ─── Debounce da busca (500ms) ────────────────────────── */
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setBuscaDebounced(busca);
    }, 500);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [busca]);

  /* ─── Carregamento ─────────────────────────────────────── */
  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const params: Record<string, string> = {};
      if (buscaDebounced) params.busca = buscaDebounced;
      if (filtroNivel !== 'Todos') params.nivel = filtroNivel;
      if (ordenar) params.ordenar = ordenar;

      const [rClientes, rResumo, rAniver] = await Promise.all([
        api.get<ClienteResumo[]>('/clientes', { params }),
        api.get<Resumo>('/clientes/resumo'),
        api.get<Aniversariante[]>('/clientes/aniversariantes'),
      ]);
      setClientes(rClientes.data);
      setResumo(rResumo.data);
      setAniversariantes(rAniver.data);
    } catch (e) { console.error(e); }
    finally { setCarregando(false); }
  }, [buscaDebounced, filtroNivel, ordenar]);

  useEffect(() => { carregar(); }, [carregar]);

  /* ─── Abrir perfil detalhado ───────────────────────────── */
  async function abrirPerfil(id: string) {
    setCarregandoDetalhe(true);
    setAbaDetalhe('info');
    try {
      const [rCliente, rRecomp] = await Promise.all([
        api.get<ClienteDetalhado>(`/clientes/${id}`),
        api.get<Recompensa[]>('/fidelidade/recompensas'),
      ]);
      setClienteSelecionado(rCliente.data);
      setRecompensas(rRecomp.data.filter(r => r.ativo));
    } catch (e) { console.error(e); }
    finally { setCarregandoDetalhe(false); }
  }

  function fecharPerfil() {
    setClienteSelecionado(null);
    setMostrarFormPontos(false);
    setMostrarFormResgate(false);
  }

  /* ─── Adicionar pontos ─────────────────────────────────── */
  async function handleAdicionarPontos() {
    if (!clienteSelecionado || !pontosManual) return;
    try {
      await api.post(`/clientes/${clienteSelecionado.id}/pontos`, {
        pontos: Number(pontosManual),
        descricao: descricaoPontos || 'Cortesia',
      });
      setPontosManual('');
      setDescricaoPontos('');
      setMostrarFormPontos(false);
      abrirPerfil(clienteSelecionado.id);
      carregar();
    } catch (e) { console.error(e); alert('Erro ao adicionar pontos'); }
  }

  /* ─── Resgatar recompensa ──────────────────────────────── */
  async function handleResgatar(recompensaId: string) {
    if (!clienteSelecionado) return;
    try {
      await api.post(`/clientes/${clienteSelecionado.id}/resgatar/${recompensaId}`);
      setMostrarFormResgate(false);
      abrirPerfil(clienteSelecionado.id);
      carregar();
    } catch (e: any) {
      alert(e?.response?.data?.erro || 'Erro ao resgatar');
    }
  }

  /* ─── Busca imediata (botão/Enter) ──────────────────────── */
  function handleBusca() {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setBuscaDebounced(busca);
  }

  /* ─── WhatsApp ─────────────────────────────────────────── */
  function enviarWhatsApp(telefone: string | null, mensagem: string) {
    if (!telefone) return;
    const num = telefone.replace(/\D/g, '');
    window.open(`https://wa.me/55${num}?text=${encodeURIComponent(mensagem)}`, '_blank');
  }

  const mesAtual = MESES[new Date().getMonth()];

  /* ─── Render ───────────────────────────────────────────── */
  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Header */}
      <h1
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: '32px',
          color: 'var(--text-primary)',
          letterSpacing: '0.04em',
        }}
      >
        Clientes
      </h1>

      {/* Cards de resumo */}
      {resumo && (
        <div className="dashboard-grid">
          <StatCard titulo="Total de clientes" valor={String(resumo.totalClientes)} icone={Users} />
          <StatCard titulo="Ativos no mês" valor={String(resumo.clientesAtivos)} icone={TrendingUp} destaque />
          <StatCard titulo="Ticket médio" valor={formatarMoeda(resumo.ticketMedio)} icone={DollarSign} />
        </div>
      )}

      {/* Tabs */}
      <div className="tab-bar">
        <button
          className={`tab-item ${abaAtiva === 'clientes' ? 'active' : ''}`}
          onClick={() => setAbaAtiva('clientes')}
        >
          Clientes
        </button>
        <button
          className={`tab-item ${abaAtiva === 'aniversariantes' ? 'active' : ''}`}
          onClick={() => setAbaAtiva('aniversariantes')}
        >
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            <Cake size={12} /> Aniversariantes — {mesAtual}
            {aniversariantes.length > 0 && (
              <span className="badge badge-pending" style={{ marginLeft: 4 }}>{aniversariantes.length}</span>
            )}
          </span>
        </button>
      </div>

      {/* ─── TAB: CLIENTES ───────────────────────────────── */}
      {abaAtiva === 'clientes' && (
        <>
          {/* Filtros */}
          <div className="flex flex-col sm:flex-row gap-2 flex-wrap items-end">
            <div className="relative w-full sm:max-w-sm">
              <Search size={14} strokeWidth={1.5} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
              <input
                value={busca}
                onChange={e => setBusca(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleBusca()}
                placeholder="Buscar por nome ou telefone..."
                className="ds-input"
                style={{ paddingLeft: '36px' }}
              />
            </div>
            <select
              value={filtroNivel}
              onChange={e => setFiltroNivel(e.target.value)}
              className="ds-select"
              style={{ maxWidth: '160px' }}
            >
              <option value="Todos">Todos os níveis</option>
              <option value="Bronze">Bronze</option>
              <option value="Prata">Prata</option>
              <option value="Ouro">Ouro</option>
              <option value="Diamante">Diamante</option>
            </select>
            <select
              value={ordenar}
              onChange={e => setOrdenar(e.target.value)}
              className="ds-select"
              style={{ maxWidth: '180px' }}
            >
              <option value="recente">Mais recente</option>
              <option value="visitas">Mais visitas</option>
              <option value="gasto">Maior gasto</option>
              <option value="pontos">Mais pontos</option>
            </select>
            <button onClick={handleBusca} className="btn-secondary">
              Buscar
            </button>
          </div>

          {/* Tabela de clientes */}
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div className="table-wrapper">
              <table className="ds-table" style={{ minWidth: '900px' }}>
                <thead>
                  <tr>
                    <th>Cliente</th>
                    <th>Contato</th>
                    <th>Última Visita</th>
                    <th style={{ textAlign: 'center' }}>Visitas</th>
                    <th style={{ textAlign: 'right' }}>Gasto Total</th>
                    <th style={{ textAlign: 'center' }}>Pontos</th>
                    <th style={{ textAlign: 'center' }}>Nível</th>
                    <th style={{ textAlign: 'right' }}>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {clientes.map(c => (
                    <tr key={c.id} style={{ cursor: 'pointer' }} onClick={() => abrirPerfil(c.id)}>
                      {/* Avatar + Nome */}
                      <td>
                        <div className="flex items-center gap-3">
                          <div
                            className="flex items-center justify-center flex-shrink-0"
                            style={{
                              width: '36px',
                              height: '36px',
                              background: `${c.cor}20`,
                              border: `1px solid ${c.cor}40`,
                              fontFamily: 'var(--font-display)',
                              fontSize: '14px',
                              color: c.cor,
                              letterSpacing: '0.04em',
                            }}
                          >
                            {getIniciais(c.usuario?.nome || 'Cliente')}
                          </div>
                          <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '13px' }}>
                            {c.usuario?.nome || 'Cliente sem nome'}
                          </span>
                        </div>
                      </td>
                      {/* Contato */}
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <Mail size={10} /> {c.usuario?.email || '—'}
                          </span>
                          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <Phone size={10} /> {c.telefone || '—'}
                          </span>
                        </div>
                      </td>
                      {/* Última visita */}
                      <td style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-muted)' }}>
                        {formatarData(c.ultimoAtendimento)}
                      </td>
                      {/* Visitas */}
                      <td style={{ textAlign: 'center', fontFamily: 'var(--font-display)', fontSize: '20px', color: 'var(--text-primary)' }}>
                        {c.totalVisitas}
                      </td>
                      {/* Gasto total */}
                      <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--amber-light)' }}>
                        {formatarMoeda(c.totalGasto)}
                      </td>
                      {/* Pontos */}
                      <td style={{ textAlign: 'center', fontFamily: 'var(--font-display)', fontSize: '18px', color: c.cor }}>
                        {c.pontosAtuais}
                      </td>
                      {/* Badge nível */}
                      <td style={{ textAlign: 'center' }}>
                        <span className={`badge ${badgeClass(c.nivel)}`}>{c.nivel}</span>
                      </td>
                      {/* Ações */}
                      <td style={{ textAlign: 'right' }} onClick={e => e.stopPropagation()}>
                        <button
                          onClick={() => abrirPerfil(c.id)}
                          className="transition-colors"
                          style={{
                            fontFamily: 'var(--font-mono)',
                            fontSize: '9px',
                            letterSpacing: '0.12em',
                            textTransform: 'uppercase',
                            color: 'var(--text-muted)',
                            background: 'transparent',
                            border: 'none',
                            cursor: 'pointer',
                          }}
                          onMouseEnter={e => { e.currentTarget.style.color = 'var(--amber)'; }}
                          onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; }}
                        >
                          Ver perfil
                        </button>
                      </td>
                    </tr>
                  ))}
                  {clientes.length === 0 && (
                    <tr>
                      <td colSpan={8} style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: '11px' }}>
                        {carregando ? 'Buscando clientes...' : 'Nenhum cliente encontrado'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* ─── TAB: ANIVERSARIANTES ────────────────────────── */}
      {abaAtiva === 'aniversariantes' && (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
            <p style={{ fontFamily: 'var(--font-body)', fontSize: '14px', color: 'var(--text-primary)', fontWeight: 600 }}>
              🎂 Aniversariantes de {mesAtual}
            </p>
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-muted)', marginTop: '4px' }}>
              {aniversariantes.length} cliente{aniversariantes.length !== 1 ? 's' : ''} fazendo aniversário este mês
            </p>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {aniversariantes.map(a => (
              <div
                key={a.id}
                className="flex items-center justify-between"
                style={{
                  padding: '14px 20px',
                  borderBottom: '1px solid var(--border)',
                  transition: 'background 0.15s',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-surface2)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
              >
                <div className="flex items-center gap-3">
                  <div
                    className="flex items-center justify-center"
                    style={{
                      width: '40px',
                      height: '40px',
                      background: 'var(--amber-dim)',
                      fontFamily: 'var(--font-display)',
                      fontSize: '14px',
                      color: 'var(--cor-icone)',
                    }}
                  >
                    {getIniciais(a.usuario.nome)}
                  </div>
                  <div>
                    <p style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '14px' }}>{a.usuario.nome}</p>
                    <p style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-muted)' }}>
                      {formatarData(a.dataNascimento)} — Dia {a.diaAniversario}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {a.telefone && (
                    <button
                      className="btn-whatsapp"
                      onClick={() => enviarWhatsApp(a.telefone, `Feliz aniversário, ${a.usuario.nome.split(' ')[0]}! 🎂🎉 A equipe da barbearia deseja tudo de bom pra você!`)}
                    >
                      <MessageCircle size={13} /> Parabéns
                    </button>
                  )}
                </div>
              </div>
            ))}
            {aniversariantes.length === 0 && (
              <p style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: '11px' }}>
                Nenhum aniversariante encontrado este mês
              </p>
            )}
          </div>
        </div>
      )}

      {/* ─── PAINEL LATERAL — Perfil Detalhado ───────────── */}
      {(clienteSelecionado || carregandoDetalhe) && (
        <>
          {/* Backdrop */}
          <div
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 105 }}
            onClick={fecharPerfil}
          />
          {/* Panel */}
          <div className="slide-panel">
            {carregandoDetalhe ? (
              <div style={{ padding: '3rem', display: 'flex', justifyContent: 'center' }}>
                <LoadingSpinner />
              </div>
            ) : clienteSelecionado && (
              <>
                {/* Header */}
                <div style={{ padding: '20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div className="flex items-center gap-3">
                    <div
                      className="flex items-center justify-center"
                      style={{
                        width: '48px',
                        height: '48px',
                        background: `${clienteSelecionado.cor}20`,
                        border: `1px solid ${clienteSelecionado.cor}40`,
                        fontFamily: 'var(--font-display)',
                        fontSize: '18px',
                        color: clienteSelecionado.cor,
                      }}
                    >
                      {getIniciais(clienteSelecionado.usuario.nome)}
                    </div>
                    <div>
                      <h2 style={{ fontFamily: 'var(--font-body)', fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)' }}>
                        {clienteSelecionado.usuario.nome}
                      </h2>
                      <span className={`badge ${badgeClass(clienteSelecionado.nivel)}`}>{clienteSelecionado.nivel}</span>
                    </div>
                  </div>
                  <button
                    onClick={fecharPerfil}
                    style={{ width: '32px', height: '32px', background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  >
                    <X size={14} />
                  </button>
                </div>

                {/* Tabs do perfil */}
                <div className="tab-bar">
                  <button className={`tab-item ${abaDetalhe === 'info' ? 'active' : ''}`} onClick={() => setAbaDetalhe('info')}>Informações</button>
                  <button className={`tab-item ${abaDetalhe === 'historico' ? 'active' : ''}`} onClick={() => setAbaDetalhe('historico')}>Atendimentos</button>
                  <button className={`tab-item ${abaDetalhe === 'pontos' ? 'active' : ''}`} onClick={() => setAbaDetalhe('pontos')}>Pontos</button>
                </div>

                <div style={{ padding: '20px' }}>
                  {/* ─── ABA: INFO ─────────────────────── */}
                  {abaDetalhe === 'info' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                      {/* Dados pessoais */}
                      <div className="section-divider">Dados pessoais</div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                        {[
                          { label: 'Email', value: clienteSelecionado.usuario.email, icon: <Mail size={12} /> },
                          { label: 'Telefone', value: clienteSelecionado.telefone || '—', icon: <Phone size={12} /> },
                          { label: 'Nascimento', value: formatarData(clienteSelecionado.dataNascimento), icon: <Cake size={12} /> },
                        ].map((item, i) => (
                          <div key={i} style={{ padding: '10px', background: 'var(--bg-surface2)', border: '1px solid var(--border)' }}>
                            <span className="input-label" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>{item.icon} {item.label}</span>
                            <p style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--text-primary)', marginTop: '4px' }}>{item.value}</p>
                          </div>
                        ))}
                      </div>
                      {clienteSelecionado.observacoes && (
                        <div style={{ padding: '10px', background: 'var(--bg-surface2)', border: '1px solid var(--border)' }}>
                          <span className="input-label">Observações</span>
                          <p style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>{clienteSelecionado.observacoes}</p>
                        </div>
                      )}

                      {/* Estatísticas */}
                      <div className="section-divider">Estatísticas</div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
                        {[
                          { label: 'Total visitas', value: String(clienteSelecionado.totalVisitas) },
                          { label: 'Total gasto', value: formatarMoeda(clienteSelecionado.totalGasto) },
                          { label: 'Ticket médio', value: formatarMoeda(clienteSelecionado.ticketMedio) },
                          { label: 'Primeira visita', value: formatarData(clienteSelecionado.primeiraVisita) },
                          { label: 'Última visita', value: formatarData(clienteSelecionado.ultimaVisita) },
                          { label: 'Pontos atuais', value: String(clienteSelecionado.pontosAtuais) },
                        ].map((s, i) => (
                          <div key={i} style={{ padding: '10px', background: 'var(--bg-surface2)', border: '1px solid var(--border)' }}>
                            <span className="metric-label">{s.label}</span>
                            <p style={{ fontFamily: 'var(--font-display)', fontSize: '22px', color: i === 5 ? clienteSelecionado.cor : 'var(--text-primary)', marginTop: '4px' }}>{s.value}</p>
                          </div>
                        ))}
                      </div>

                      {/* Barra de progresso de fidelidade */}
                      <div className="section-divider">Fidelidade</div>
                      <div style={{ padding: '14px', background: 'var(--bg-surface2)', border: '1px solid var(--border)' }}>
                        <div className="flex items-center justify-between" style={{ marginBottom: '8px' }}>
                          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-muted)' }}>
                            {clienteSelecionado.pontosAtuais} pts
                          </span>
                          {clienteSelecionado.nivel !== 'Diamante' && (
                            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-muted)' }}>
                              {clienteSelecionado.proximoNivel} pts (próximo nível)
                            </span>
                          )}
                        </div>
                        <div className="progress-bar-container">
                          <div
                            className="progress-bar-fill"
                            style={{
                              width: clienteSelecionado.nivel === 'Diamante'
                                ? '100%'
                                : `${Math.min(100, ((clienteSelecionado.pontosAtuais) / clienteSelecionado.proximoNivel) * 100)}%`,
                              background: clienteSelecionado.cor,
                            }}
                          />
                        </div>
                        <div className="flex items-center justify-between" style={{ marginTop: '6px' }}>
                          <span className={`badge ${badgeClass(clienteSelecionado.nivel)}`} style={{ fontSize: '10px' }}>
                            <Star size={10} style={{ display: 'inline', marginRight: '3px', verticalAlign: 'middle' }} />
                            {clienteSelecionado.nivel}
                          </span>
                          {clienteSelecionado.pontosParaProximo > 0 && (
                            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-muted)' }}>
                              Faltam {clienteSelecionado.pontosParaProximo} pts
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Ações */}
                      <div className="flex gap-2" style={{ marginTop: '8px' }}>
                        <button className="btn-primary" onClick={() => setMostrarFormPontos(true)}>
                          <Plus size={14} /> Adicionar pontos
                        </button>
                        <button className="btn-secondary" onClick={() => setMostrarFormResgate(true)}>
                          <Gift size={14} /> Resgatar recompensa
                        </button>
                      </div>

                      {/* Form adicionar pontos */}
                      {mostrarFormPontos && (
                        <div style={{ padding: '14px', background: 'var(--bg-primary)', border: '1px solid var(--amber-dim)' }}>
                          <p className="section-divider" style={{ marginTop: 0 }}>Adicionar pontos manualmente</p>
                          <div className="flex gap-2" style={{ marginTop: '10px' }}>
                            <div style={{ flex: 1 }}>
                              <label className="input-label">Pontos</label>
                              <input
                                type="number"
                                value={pontosManual}
                                onChange={e => setPontosManual(e.target.value)}
                                className="ds-input"
                                placeholder="Ex: 50"
                                min="1"
                              />
                            </div>
                            <div style={{ flex: 2 }}>
                              <label className="input-label">Descrição</label>
                              <input
                                value={descricaoPontos}
                                onChange={e => setDescricaoPontos(e.target.value)}
                                className="ds-input"
                                placeholder="Motivo (cortesia, promoção...)"
                              />
                            </div>
                          </div>
                          <div className="flex gap-2" style={{ marginTop: '10px' }}>
                            <button className="btn-primary" onClick={handleAdicionarPontos}>Confirmar</button>
                            <button className="btn-secondary" onClick={() => setMostrarFormPontos(false)}>Cancelar</button>
                          </div>
                        </div>
                      )}

                      {/* Form resgatar */}
                      {mostrarFormResgate && (
                        <div style={{ padding: '14px', background: 'var(--bg-primary)', border: '1px solid var(--amber-dim)' }}>
                          <p className="section-divider" style={{ marginTop: 0 }}>Resgatar recompensa</p>
                          <p style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-muted)', margin: '8px 0' }}>
                            Saldo atual: <strong style={{ color: clienteSelecionado.cor }}>{clienteSelecionado.pontosAtuais} pts</strong>
                          </p>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            {recompensas.map(r => (
                              <div
                                key={r.id}
                                className="flex items-center justify-between"
                                style={{ padding: '10px', background: 'var(--bg-surface2)', border: '1px solid var(--border)' }}
                              >
                                <div>
                                  <p style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '13px' }}>{r.nome}</p>
                                  <p style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-muted)' }}>{r.pontosNecessarios} pts necessários</p>
                                </div>
                                <button
                                  className="btn-primary"
                                  disabled={clienteSelecionado.pontosAtuais < r.pontosNecessarios}
                                  onClick={() => handleResgatar(r.id)}
                                  style={{ fontSize: '10px', padding: '6px 12px' }}
                                >
                                  Resgatar
                                </button>
                              </div>
                            ))}
                            {recompensas.length === 0 && (
                              <p style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-muted)', textAlign: 'center', padding: '12px' }}>
                                Nenhuma recompensa cadastrada
                              </p>
                            )}
                          </div>
                          <button className="btn-secondary" onClick={() => setMostrarFormResgate(false)} style={{ marginTop: '10px' }}>Fechar</button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* ─── ABA: HISTÓRICO DE ATENDIMENTOS ── */}
                  {abaDetalhe === 'historico' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {clienteSelecionado.agendamentos.map(ag => (
                        <div
                          key={ag.id}
                          className="flex items-center justify-between"
                          style={{
                            padding: '12px',
                            background: 'var(--bg-surface2)',
                            border: '1px solid var(--border)',
                            borderLeft: `2px solid ${statusStyles[ag.status] || 'var(--border)'}`,
                          }}
                        >
                          <div className="flex items-center gap-3">
                            <Calendar size={14} strokeWidth={1.5} style={{ color: 'var(--text-muted)' }} />
                            <div>
                              <p style={{ fontFamily: 'var(--font-body)', fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>{ag.servico}</p>
                              <p style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>
                                {formatarData(ag.dataHora)} — {ag.barbeiro}
                              </p>
                            </div>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <p style={{ fontFamily: 'var(--font-display)', fontSize: '16px', color: 'var(--cor-icone)' }}>R$ {Number(ag.valorCobrado).toFixed(2)}</p>
                            <p style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', letterSpacing: '0.1em', textTransform: 'uppercase', color: statusStyles[ag.status] || 'var(--text-muted)', marginTop: '2px' }}>
                              {ag.status}
                            </p>
                          </div>
                        </div>
                      ))}
                      {clienteSelecionado.agendamentos.length === 0 && (
                        <p style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: '11px' }}>
                          Nenhum agendamento encontrado
                        </p>
                      )}
                    </div>
                  )}

                  {/* ─── ABA: HISTÓRICO DE PONTOS ────────── */}
                  {abaDetalhe === 'pontos' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                      {/* Pontos ganhos */}
                      <div>
                        <div className="section-divider" style={{ marginTop: 0 }}>Pontos ganhos</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '8px' }}>
                          {clienteSelecionado.historicoPontos.map(p => (
                            <div
                              key={p.id}
                              className="flex items-center justify-between"
                              style={{ padding: '10px', background: 'var(--bg-surface2)', border: '1px solid var(--border)' }}
                            >
                              <div>
                                <p style={{ fontSize: '12px', color: 'var(--text-primary)' }}>{p.descricao}</p>
                                <p style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>
                                  {formatarData(p.data)}
                                </p>
                              </div>
                              <span style={{ fontFamily: 'var(--font-display)', fontSize: '18px', color: 'var(--success-text)' }}>
                                +{p.pontos}
                              </span>
                            </div>
                          ))}
                          {clienteSelecionado.historicoPontos.length === 0 && (
                            <p style={{ textAlign: 'center', padding: '1rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: '11px' }}>
                              Nenhum ponto registrado
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Resgates */}
                      <div>
                        <div className="section-divider">Resgates realizados</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '8px' }}>
                          {clienteSelecionado.historicoResgates.map(r => (
                            <div
                              key={r.id}
                              className="flex items-center justify-between"
                              style={{ padding: '10px', background: 'var(--bg-surface2)', border: '1px solid var(--border)' }}
                            >
                              <div>
                                <p style={{ fontSize: '12px', color: 'var(--text-primary)' }}>{r.recompensa}</p>
                                <p style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>
                                  {formatarData(r.data)}
                                </p>
                              </div>
                              <span style={{ fontFamily: 'var(--font-display)', fontSize: '18px', color: 'var(--error-text)' }}>
                                −{r.pontosUsados}
                              </span>
                            </div>
                          ))}
                          {clienteSelecionado.historicoResgates.length === 0 && (
                            <p style={{ textAlign: 'center', padding: '1rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: '11px' }}>
                              Nenhum resgate realizado
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
