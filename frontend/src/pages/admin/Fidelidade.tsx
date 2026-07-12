// Página de gestão do programa de fidelidade
import { useState, useEffect, useCallback } from 'react';
import {
  Star, Save, Plus, Edit, Trash, Gift, Users, History,
  Settings, TrendingUp, ChevronDown, ChevronUp, X, AlertCircle, CheckCircle
} from 'lucide-react';
import api from '../../api/client';

type Tab = 'regras' | 'recompensas' | 'clientes' | 'historico' | 'pendentes';

interface ConfigFidelidade {
  ativo: boolean;
  pontosPorReal: number;
  pontosPorVisita: number;
  pontosDobroAniversario: boolean;
  pontosPorIndicacao: number;
  pontosBoasVindas: number;
  regrasPorServico: Array<{ servicoId: string; pontos: number }> | null;
}

interface Servico { id: string; nome: string; preco: number }
interface Recompensa {
  id: string; nome: string; tipo: string; valorDesconto?: number;
  servicoId?: string; servico?: { nome: string }; pontosNecessarios: number; ativo: boolean;
}
interface ClientePontos {
  id: string; nome: string; email: string; saldo: number;
  totalGanho: number; totalGasto: number; codigoIndicacao?: string; conectadoEm: string;
}
interface HistoricoItem {
  id: string; tipo: 'GANHO' | 'RESGATE'; pontos: number; descricao: string; data: string;
}

function Toast({ msg, tipo, onClose }: { msg: string; tipo: 'ok' | 'erro'; onClose: () => void }) {
  useEffect(() => { const t = setTimeout(onClose, 4000); return () => clearTimeout(t); }, [onClose]);
  return (
    <div style={{
      position: 'fixed', bottom: '24px', right: '24px', zIndex: 9999,
      display: 'flex', alignItems: 'center', gap: '10px',
      background: tipo === 'ok' ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)',
      border: `1px solid ${tipo === 'ok' ? 'rgba(34,197,94,0.4)' : 'rgba(239,68,68,0.4)'}`,
      borderRadius: '10px', padding: '12px 16px', boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
      maxWidth: '340px', backdropFilter: 'blur(8px)',
    }}>
      {tipo === 'ok' ? <CheckCircle size={16} color="#22C55E" /> : <AlertCircle size={16} color="#EF4444" />}
      <span style={{ fontSize: '13px', color: tipo === 'ok' ? '#22C55E' : '#EF4444' }}>{msg}</span>
      <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#666', marginLeft: '4px' }}>
        <X size={14} />
      </button>
    </div>
  );
}

export function Fidelidade() {
  const [tab, setTab] = useState<Tab>('regras');
  const [toast, setToast] = useState<{ msg: string; tipo: 'ok' | 'erro' } | null>(null);
  const [pendentesCount, setPendentesCount] = useState(0);

  const showToast = useCallback((msg: string, tipo: 'ok' | 'erro' = 'ok') => setToast({ msg, tipo }), []);

  useEffect(() => {
    api.get('/fidelidade/resgates?status=PENDENTE')
      .then(r => setPendentesCount(r.data.length))
      .catch(() => {});
  }, [tab]);

  const tabs: { id: Tab; label: string; icon: React.ComponentType<any>, count?: number }[] = [
    { id: 'regras', label: 'Regras', icon: Settings },
    { id: 'recompensas', label: 'Recompensas', icon: Gift },
    { id: 'clientes', label: 'Clientes', icon: Users },
    { id: 'pendentes', label: 'Pendentes', icon: AlertCircle, count: pendentesCount },
    { id: 'historico', label: 'Histórico', icon: History },
  ];

  return (
    <div style={{ padding: '24px', maxWidth: '1100px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
        <div style={{
          width: '40px', height: '40px', borderRadius: '10px',
          background: 'rgba(245,158,11,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Star size={20} color="var(--amber, #F59E0B)" />
        </div>
        <div>
          <h1 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
            Programa de Fidelidade
          </h1>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0 }}>
            Configure as regras, recompensas e acompanhe os pontos dos clientes
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div style={{
        display: 'flex', gap: '4px', marginBottom: '24px',
        background: 'var(--bg-surface)', border: '1px solid var(--border)',
        borderRadius: '10px', padding: '4px', overflowX: 'auto'
      }}>
        {tabs.map(t => {
          const Icon = t.icon;
          const active = tab === t.id;
          return (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
              gap: '6px', padding: '8px 12px', border: 'none', borderRadius: '7px', cursor: 'pointer',
              background: active ? 'var(--amber, #F59E0B)' : 'transparent',
              color: active ? '#000' : 'var(--text-muted)',
              fontSize: '12px', fontWeight: active ? 600 : 400, transition: 'all 0.15s',
              whiteSpace: 'nowrap'
            }}>
              <Icon size={14} />
              {t.label}
              {t.count !== undefined && t.count > 0 && (
                <span style={{
                  background: active ? '#000' : 'var(--amber, #F59E0B)',
                  color: active ? 'var(--amber, #F59E0B)' : '#000',
                  padding: '2px 6px', borderRadius: '10px', fontSize: '10px', fontWeight: 700
                }}>
                  {t.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Content */}
      {tab === 'regras' && <TabRegras showToast={showToast} />}
      {tab === 'recompensas' && <TabRecompensas showToast={showToast} />}
      {tab === 'clientes' && <TabClientes showToast={showToast} />}
      {tab === 'pendentes' && <TabPendentes showToast={showToast} onUpdateCount={setPendentesCount} />}
      {tab === 'historico' && <TabHistorico showToast={showToast} />}

      {toast && <Toast msg={toast.msg} tipo={toast.tipo} onClose={() => setToast(null)} />}
    </div>
  );
}

// ─── TAB REGRAS ──────────────────────────────────────────────────────────────

function TabRegras({ showToast }: { showToast: (m: string, t?: 'ok' | 'erro') => void }) {
  const [config, setConfig] = useState<ConfigFidelidade>({
    ativo: false, pontosPorReal: 0, pontosPorVisita: 0, pontosDobroAniversario: false,
    pontosPorIndicacao: 0, pontosBoasVindas: 0, regrasPorServico: null,
  });
  const [servicos, setServicos] = useState<Servico[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    Promise.all([api.get('/fidelidade/configuracao'), api.get('/servicos')])
      .then(([resConfig, resServ]) => {
        if (resConfig.data) {
          setConfig({
            ativo: resConfig.data.ativo ?? false,
            pontosPorReal: resConfig.data.pontosPorReal ?? 0,
            pontosPorVisita: resConfig.data.pontosPorVisita ?? 0,
            pontosDobroAniversario: resConfig.data.pontosDobroAniversario ?? false,
            pontosPorIndicacao: resConfig.data.pontosPorIndicacao ?? 0,
            pontosBoasVindas: resConfig.data.pontosBoasVindas ?? 0,
            regrasPorServico: resConfig.data.regrasPorServico ?? null,
          });
        }
        setServicos(resServ.data || []);
      })
      .catch(() => showToast('Erro ao carregar configuração', 'erro'))
      .finally(() => setCarregando(false));
  }, []);

  function setRegraPorServico(servicoId: string, pontos: number) {
    const regrasCopy = [...(config.regrasPorServico ?? [])];
    const idx = regrasCopy.findIndex(r => r.servicoId === servicoId);
    if (pontos === 0) {
      if (idx >= 0) regrasCopy.splice(idx, 1);
    } else {
      if (idx >= 0) regrasCopy[idx] = { servicoId, pontos };
      else regrasCopy.push({ servicoId, pontos });
    }
    setConfig({ ...config, regrasPorServico: regrasCopy.length > 0 ? regrasCopy : null });
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setSalvando(true);
    try {
      await api.put('/fidelidade/configuracao', {
        ...config,
        pontosPorReal: Number(config.pontosPorReal),
        pontosPorVisita: Number(config.pontosPorVisita),
        pontosPorIndicacao: Number(config.pontosPorIndicacao),
        pontosBoasVindas: Number(config.pontosBoasVindas),
      });
      showToast('Regras salvas com sucesso!');
    } catch {
      showToast('Erro ao salvar regras', 'erro');
    } finally {
      setSalvando(false);
    }
  }

  if (carregando) return <Spinner />;

  const inputStyle: React.CSSProperties = {
    width: '100%', background: 'var(--bg-input, #1A1A1A)',
    border: '1px solid var(--border)', borderRadius: '8px',
    padding: '9px 12px', color: 'var(--text-primary)', fontSize: '13px',
    fontFamily: 'inherit', boxSizing: 'border-box',
  };

  return (
    <form onSubmit={salvar}>
      <Card>
        {/* Ativar programa */}
        <SectionTitle>Status do programa</SectionTitle>
        <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', userSelect: 'none' }}>
          <Toggle checked={config.ativo} onChange={v => setConfig({ ...config, ativo: v })} />
          <div>
            <span style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-primary)' }}>
              {config.ativo ? 'Programa ativo' : 'Programa inativo'}
            </span>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '2px 0 0' }}>
              {config.ativo
                ? 'Clientes estão acumulando e resgatando pontos'
                : 'Ative para começar a distribuir pontos automaticamente'}
            </p>
          </div>
        </label>
      </Card>

      {config.ativo && (
        <>
          {/* Regras de acúmulo */}
          <Card style={{ marginTop: '16px' }}>
            <SectionTitle>Acúmulo por agendamento</SectionTitle>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '16px' }}>
              Defina como os pontos são calculados. A <strong>Regra por Serviço</strong> tem prioridade máxima —
              caso não configurada para o serviço, o sistema usa a regra por valor gasto ou por visita.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
              <FieldGroup label="Pontos por R$1 gasto" hint="0 = desativado">
                <input type="number" min="0" style={inputStyle}
                  value={config.pontosPorReal}
                  onChange={e => setConfig({ ...config, pontosPorReal: Number(e.target.value) })} />
              </FieldGroup>
              <FieldGroup label="Pontos fixos por visita" hint="Usado se 'por valor' for 0">
                <input type="number" min="0" style={inputStyle}
                  value={config.pontosPorVisita}
                  onChange={e => setConfig({ ...config, pontosPorVisita: Number(e.target.value) })} />
              </FieldGroup>
              <FieldGroup label="Aniversário" hint="">
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px', cursor: 'pointer' }}>
                  <Toggle checked={config.pontosDobroAniversario} onChange={v => setConfig({ ...config, pontosDobroAniversario: v })} />
                  <span style={{ fontSize: '13px', color: 'var(--text-primary)' }}>Dobrar pontos no aniversário</span>
                </label>
              </FieldGroup>
            </div>
          </Card>

          {/* Regras por serviço */}
          <Card style={{ marginTop: '16px' }}>
            <SectionTitle>Regras por serviço (opcional)</SectionTitle>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '16px' }}>
              Defina pontos específicos para cada serviço. Deixe 0 para usar a regra geral.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {servicos.map(s => {
                const regra = (config.regrasPorServico ?? []).find(r => r.servicoId === s.id);
                return (
                  <div key={s.id} style={{
                    display: 'flex', alignItems: 'center', gap: '12px',
                    padding: '10px 14px', background: 'rgba(255,255,255,0.03)',
                    border: '1px solid var(--border)', borderRadius: '8px',
                  }}>
                    <span style={{ flex: 1, fontSize: '13px', color: 'var(--text-primary)' }}>
                      {s.nome}
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginLeft: '8px' }}>
                        R$ {Number(s.preco).toFixed(2).replace('.', ',')}
                      </span>
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <input
                        type="number" min="0" placeholder="0"
                        style={{ ...inputStyle, width: '80px', textAlign: 'center' }}
                        value={regra?.pontos ?? 0}
                        onChange={e => setRegraPorServico(s.id, Number(e.target.value))}
                      />
                      <span style={{ fontSize: '12px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>pts</span>
                    </div>
                    {regra && regra.pontos > 0 && (
                      <span style={{
                        fontSize: '10px', background: 'rgba(245,158,11,0.15)',
                        color: 'var(--amber, #F59E0B)', padding: '2px 8px', borderRadius: '20px',
                      }}>
                        Personalizado
                      </span>
                    )}
                  </div>
                );
              })}
              {servicos.length === 0 && (
                <p style={{ fontSize: '13px', color: 'var(--text-muted)', textAlign: 'center', padding: '20px' }}>
                  Nenhum serviço cadastrado ainda.
                </p>
              )}
            </div>
          </Card>

          {/* Indicação e boas-vindas */}
          <Card style={{ marginTop: '16px' }}>
            <SectionTitle>Indicação e boas-vindas</SectionTitle>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
              <FieldGroup label="Pontos de boas-vindas" hint="Dado ao cliente ao se conectar pela 1ª vez">
                <input type="number" min="0" style={inputStyle}
                  value={config.pontosBoasVindas}
                  onChange={e => setConfig({ ...config, pontosBoasVindas: Number(e.target.value) })} />
              </FieldGroup>
              <FieldGroup label="Pontos por indicação" hint="Dado a quem indicou após 1º agendamento concluído">
                <input type="number" min="0" style={inputStyle}
                  value={config.pontosPorIndicacao}
                  onChange={e => setConfig({ ...config, pontosPorIndicacao: Number(e.target.value) })} />
              </FieldGroup>
            </div>
            <div style={{
              marginTop: '12px', padding: '12px', background: 'rgba(245,158,11,0.06)',
              border: '1px solid rgba(245,158,11,0.2)', borderRadius: '8px',
            }}>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0, lineHeight: 1.6 }}>
                <strong style={{ color: 'var(--amber, #F59E0B)' }}>Como funciona a indicação:</strong> cada cliente tem um
                código de indicação único visível na área de fidelidade do app. Quando um amigo entra com esse código ao
                conectar-se à barbearia, os pontos de boas-vindas são creditados para o novo cliente imediatamente.
                Os pontos de indicação são creditados para quem indicou assim que o amigo conclui o primeiro agendamento.
              </p>
            </div>
          </Card>
        </>
      )}

      <div style={{ marginTop: '20px' }}>
        <button type="submit" disabled={salvando} style={{
          display: 'flex', alignItems: 'center', gap: '8px',
          padding: '11px 24px', background: 'var(--amber, #F59E0B)', color: '#000',
          border: 'none', borderRadius: '8px', cursor: salvando ? 'not-allowed' : 'pointer',
          fontSize: '13px', fontWeight: 600, opacity: salvando ? 0.7 : 1, transition: 'opacity 0.15s',
        }}>
          <Save size={16} />
          {salvando ? 'Salvando...' : 'Salvar Regras'}
        </button>
      </div>
    </form>
  );
}

// ─── TAB RECOMPENSAS ─────────────────────────────────────────────────────────

function TabRecompensas({ showToast }: { showToast: (m: string, t?: 'ok' | 'erro') => void }) {
  const [recompensas, setRecompensas] = useState<Recompensa[]>([]);
  const [servicos, setServicos] = useState<Servico[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState<any>({
    nome: '', tipo: 'SERVICO_GRATIS', valorDesconto: '', servicoId: '', pontosNecessarios: 100, ativo: true,
  });

  function carregar() {
    Promise.all([api.get('/fidelidade/recompensas'), api.get('/servicos')])
      .then(([r1, r2]) => { setRecompensas(r1.data); setServicos(r2.data); })
      .catch(() => showToast('Erro ao carregar', 'erro'))
      .finally(() => setCarregando(false));
  }

  useEffect(() => { carregar(); }, []);

  function abrirModal(rec?: Recompensa) {
    setForm(rec ? { ...rec } : { nome: '', tipo: 'SERVICO_GRATIS', valorDesconto: '', servicoId: '', pontosNecessarios: 100, ativo: true });
    setModal(true);
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    try {
      const payload = {
        ...form,
        pontosNecessarios: Number(form.pontosNecessarios),
        valorDesconto: form.valorDesconto ? Number(form.valorDesconto) : null,
      };
      if (form.id) await api.put(`/fidelidade/recompensas/${form.id}`, payload);
      else await api.post('/fidelidade/recompensas', payload);
      showToast('Recompensa salva!');
      setModal(false);
      carregar();
    } catch {
      showToast('Erro ao salvar', 'erro');
    }
  }

  async function remover(id: string) {
    if (!confirm('Remover esta recompensa?')) return;
    try {
      await api.delete(`/fidelidade/recompensas/${id}`);
      showToast('Recompensa removida');
      carregar();
    } catch {
      showToast('Erro ao remover', 'erro');
    }
  }

  if (carregando) return <Spinner />;

  const inputStyle: React.CSSProperties = {
    width: '100%', background: 'var(--bg-input, #1A1A1A)',
    border: '1px solid var(--border)', borderRadius: '8px',
    padding: '9px 12px', color: 'var(--text-primary)', fontSize: '13px',
    fontFamily: 'inherit', boxSizing: 'border-box',
  };

  return (
    <Card>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
        <SectionTitle style={{ margin: 0 }}>Recompensas cadastradas</SectionTitle>
        <button onClick={() => abrirModal()} style={{
          display: 'flex', alignItems: 'center', gap: '6px',
          padding: '8px 14px', background: 'var(--amber, #F59E0B)', color: '#000',
          border: 'none', borderRadius: '7px', cursor: 'pointer', fontSize: '12px', fontWeight: 600,
        }}>
          <Plus size={14} /> Nova Recompensa
        </button>
      </div>

      {recompensas.length === 0 ? (
        <EmptyState icon={Gift} text="Nenhuma recompensa cadastrada. Crie a primeira!" />
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                {['Nome', 'Tipo / Valor', 'Pontos', 'Status', 'Ações'].map(h => (
                  <th key={h} style={{ padding: '10px 12px', fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textAlign: 'left', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {recompensas.map(rec => (
                <tr key={rec.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                  <td style={{ padding: '12px', fontSize: '13px', color: 'var(--text-primary)' }}>{rec.nome}</td>
                  <td style={{ padding: '12px', fontSize: '12px', color: 'var(--text-muted)' }}>
                    {rec.tipo === 'SERVICO_GRATIS' ? `Serviço: ${rec.servico?.nome ?? '—'}` :
                      rec.tipo === 'DESCONTO_PERCENTUAL' ? `Desconto ${rec.valorDesconto}%` :
                        `Desconto R$${Number(rec.valorDesconto).toFixed(2)}`}
                  </td>
                  <td style={{ padding: '12px' }}>
                    <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--amber, #F59E0B)' }}>
                      {rec.pontosNecessarios} pts
                    </span>
                  </td>
                  <td style={{ padding: '12px' }}>
                    <span style={{
                      fontSize: '11px', padding: '3px 10px', borderRadius: '20px',
                      background: rec.ativo ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)',
                      color: rec.ativo ? '#22C55E' : '#EF4444',
                    }}>
                      {rec.ativo ? 'Ativo' : 'Inativo'}
                    </span>
                  </td>
                  <td style={{ padding: '12px' }}>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <IconBtn onClick={() => abrirModal(rec)} title="Editar"><Edit size={14} /></IconBtn>
                      <IconBtn onClick={() => remover(rec.id)} title="Remover" danger><Trash size={14} /></IconBtn>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modal && (
        <Modal title={form.id ? 'Editar Recompensa' : 'Nova Recompensa'} onClose={() => setModal(false)}>
          <form onSubmit={salvar} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <FieldGroup label="Nome">
              <input required type="text" style={inputStyle} value={form.nome}
                onChange={e => setForm({ ...form, nome: e.target.value })} placeholder="Ex: Corte Grátis" />
            </FieldGroup>
            <FieldGroup label="Tipo de Recompensa">
              <select style={inputStyle} value={form.tipo}
                onChange={e => setForm({ ...form, tipo: e.target.value, servicoId: '', valorDesconto: '' })}>
                <option value="SERVICO_GRATIS">Serviço Grátis</option>
                <option value="DESCONTO_PERCENTUAL">Desconto (%)</option>
                <option value="DESCONTO_REAIS">Desconto (R$)</option>
              </select>
            </FieldGroup>
            {form.tipo === 'SERVICO_GRATIS' && (
              <FieldGroup label="Serviço">
                <select required style={inputStyle} value={form.servicoId || ''}
                  onChange={e => setForm({ ...form, servicoId: e.target.value })}>
                  <option value="" disabled>Selecione o serviço</option>
                  {servicos.map(s => <option key={s.id} value={s.id}>{s.nome}</option>)}
                </select>
              </FieldGroup>
            )}
            {(form.tipo === 'DESCONTO_PERCENTUAL' || form.tipo === 'DESCONTO_REAIS') && (
              <FieldGroup label={form.tipo === 'DESCONTO_PERCENTUAL' ? 'Percentual (%)' : 'Valor (R$)'}>
                <input required type="number" min="0.01" step="0.01" style={inputStyle} value={form.valorDesconto}
                  onChange={e => setForm({ ...form, valorDesconto: e.target.value })}
                  placeholder={form.tipo === 'DESCONTO_PERCENTUAL' ? 'Ex: 20' : 'Ex: 15.00'} />
              </FieldGroup>
            )}
            <FieldGroup label="Pontos Necessários">
              <input required type="number" min="1" style={inputStyle} value={form.pontosNecessarios}
                onChange={e => setForm({ ...form, pontosNecessarios: e.target.value })} />
            </FieldGroup>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
              <Toggle checked={form.ativo} onChange={v => setForm({ ...form, ativo: v })} />
              <span style={{ fontSize: '13px', color: 'var(--text-primary)' }}>Recompensa ativa</span>
            </label>
            <div style={{ display: 'flex', gap: '8px', paddingTop: '4px' }}>
              <button type="button" onClick={() => setModal(false)} style={{
                flex: 1, padding: '10px', background: 'transparent',
                border: '1px solid var(--border)', borderRadius: '8px', cursor: 'pointer',
                fontSize: '13px', color: 'var(--text-muted)',
              }}>Cancelar</button>
              <button type="submit" style={{
                flex: 1, padding: '10px', background: 'var(--amber, #F59E0B)',
                border: 'none', borderRadius: '8px', cursor: 'pointer',
                fontSize: '13px', fontWeight: 600, color: '#000',
              }}>Salvar</button>
            </div>
          </form>
        </Modal>
      )}
    </Card>
  );
}

// ─── TAB CLIENTES ────────────────────────────────────────────────────────────

function TabClientes({ showToast }: { showToast: (m: string, t?: 'ok' | 'erro') => void }) {
  const [clientes, setClientes] = useState<ClientePontos[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [busca, setBusca] = useState('');
  const [ajusteModal, setAjusteModal] = useState<ClientePontos | null>(null);
  const [ajusteForm, setAjusteForm] = useState({ pontos: '', descricao: '' });
  const [salvando, setSalvando] = useState(false);
  const [expandido, setExpandido] = useState<string | null>(null);
  const [historico, setHistorico] = useState<Record<string, HistoricoItem[]>>({});

  function carregar() {
    api.get('/fidelidade/clientes')
      .then(r => setClientes(r.data))
      .catch(() => showToast('Erro ao carregar clientes', 'erro'))
      .finally(() => setCarregando(false));
  }

  useEffect(() => { carregar(); }, []);

  async function carregarHistorico(clienteId: string) {
    if (historico[clienteId]) return;
    try {
      const r = await api.get(`/fidelidade/historico/${clienteId}`);
      setHistorico(h => ({ ...h, [clienteId]: r.data.historico.slice(0, 10) }));
    } catch { /* silent */ }
  }

  function toggleExpand(id: string) {
    if (expandido === id) {
      setExpandido(null);
    } else {
      setExpandido(id);
      carregarHistorico(id);
    }
  }

  async function salvarAjuste(e: React.FormEvent) {
    e.preventDefault();
    if (!ajusteModal) return;
    setSalvando(true);
    try {
      await api.post(`/fidelidade/ajuste/${ajusteModal.id}`, {
        pontos: Number(ajusteForm.pontos),
        descricao: ajusteForm.descricao,
      });
      showToast('Pontos ajustados com sucesso!');
      setAjusteModal(null);
      setAjusteForm({ pontos: '', descricao: '' });
      // Limpa histórico cacheado para forçar reload
      setHistorico(h => { const n = { ...h }; delete n[ajusteModal.id]; return n; });
      carregar();
    } catch (err: any) {
      showToast(err?.response?.data?.erro || 'Erro ao ajustar pontos', 'erro');
    } finally {
      setSalvando(false);
    }
  }

  const filtrados = clientes.filter(c =>
    c.nome.toLowerCase().includes(busca.toLowerCase()) ||
    c.email.toLowerCase().includes(busca.toLowerCase())
  );

  if (carregando) return <Spinner />;

  return (
    <Card>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', gap: '12px', flexWrap: 'wrap' }}>
        <SectionTitle style={{ margin: 0 }}>Clientes com pontos</SectionTitle>
        <input
          type="text" placeholder="Buscar por nome ou email..."
          value={busca} onChange={e => setBusca(e.target.value)}
          style={{
            padding: '8px 12px', background: 'var(--bg-input, #1A1A1A)',
            border: '1px solid var(--border)', borderRadius: '7px',
            color: 'var(--text-primary)', fontSize: '13px', fontFamily: 'inherit',
            width: '220px',
          }}
        />
      </div>

      {filtrados.length === 0 ? (
        <EmptyState icon={Users} text="Nenhum cliente encontrado." />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {filtrados.map(c => (
            <div key={c.id} style={{
              border: '1px solid var(--border)', borderRadius: '10px',
              overflow: 'hidden', background: 'rgba(255,255,255,0.02)',
            }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: '12px',
                padding: '12px 16px', cursor: 'pointer',
              }} onClick={() => toggleExpand(c.id)}>
                <div style={{
                  width: '36px', height: '36px', borderRadius: '50%', flexShrink: 0,
                  background: 'rgba(245,158,11,0.12)', display: 'flex', alignItems: 'center',
                  justifyContent: 'center', fontSize: '13px', fontWeight: 700, color: 'var(--amber, #F59E0B)',
                }}>
                  {c.nome.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: 0, fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)' }}>{c.nome}</p>
                  <p style={{ margin: '2px 0 0', fontSize: '11px', color: 'var(--text-muted)' }}>{c.email}</p>
                </div>
                <div style={{ textAlign: 'right', marginRight: '8px' }}>
                  <p style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: 'var(--amber, #F59E0B)' }}>
                    {c.saldo} pts
                  </p>
                  <p style={{ margin: 0, fontSize: '10px', color: 'var(--text-muted)' }}>
                    +{c.totalGanho} / -{c.totalGasto}
                  </p>
                </div>
                <button onClick={e => { e.stopPropagation(); setAjusteModal(c); setAjusteForm({ pontos: '', descricao: '' }); }} style={{
                  padding: '6px 12px', background: 'transparent',
                  border: '1px solid var(--border)', borderRadius: '6px',
                  cursor: 'pointer', fontSize: '11px', color: 'var(--text-muted)',
                  whiteSpace: 'nowrap',
                }}>
                  <TrendingUp size={13} style={{ verticalAlign: 'middle', marginRight: '4px' }} />
                  Ajustar
                </button>
                {expandido === c.id ? <ChevronUp size={16} color="var(--text-muted)" /> : <ChevronDown size={16} color="var(--text-muted)" />}
              </div>

              {expandido === c.id && (
                <div style={{ padding: '0 16px 14px', borderTop: '1px solid var(--border)' }}>
                  <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: '10px 0 8px' }}>
                    Últimas movimentações
                  </p>
                  {historico[c.id] ? (
                    historico[c.id].length === 0 ? (
                      <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Sem histórico ainda.</p>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        {historico[c.id].map(h => (
                          <div key={h.id} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{
                              fontSize: '12px', fontWeight: 700, minWidth: '50px', textAlign: 'right',
                              color: h.pontos > 0 ? '#22C55E' : '#EF4444',
                            }}>
                              {h.pontos > 0 ? '+' : ''}{h.pontos}
                            </span>
                            <span style={{ fontSize: '12px', color: 'var(--text-muted)', flex: 1 }}>{h.descricao}</span>
                            <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                              {new Date(h.data).toLocaleDateString('pt-BR')}
                            </span>
                          </div>
                        ))}
                      </div>
                    )
                  ) : (
                    <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Carregando...</p>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {ajusteModal && (
        <Modal title={`Ajustar pontos — ${ajusteModal.nome}`} onClose={() => setAjusteModal(null)}>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '16px' }}>
            Saldo atual: <strong style={{ color: 'var(--amber, #F59E0B)' }}>{ajusteModal.saldo} pts</strong>
          </p>
          <form onSubmit={salvarAjuste} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <FieldGroup label="Pontos (use valor negativo para deduzir)" hint="Ex: 50 para adicionar, -20 para descontar">
              <input required type="number" style={{
                width: '100%', background: 'var(--bg-input, #1A1A1A)',
                border: '1px solid var(--border)', borderRadius: '8px',
                padding: '9px 12px', color: 'var(--text-primary)', fontSize: '13px',
                fontFamily: 'inherit', boxSizing: 'border-box',
              }} value={ajusteForm.pontos} onChange={e => setAjusteForm({ ...ajusteForm, pontos: e.target.value })}
                placeholder="Ex: 50" />
            </FieldGroup>
            <FieldGroup label="Motivo / Descrição">
              <input required type="text" style={{
                width: '100%', background: 'var(--bg-input, #1A1A1A)',
                border: '1px solid var(--border)', borderRadius: '8px',
                padding: '9px 12px', color: 'var(--text-primary)', fontSize: '13px',
                fontFamily: 'inherit', boxSizing: 'border-box',
              }} value={ajusteForm.descricao} onChange={e => setAjusteForm({ ...ajusteForm, descricao: e.target.value })}
                placeholder="Ex: Bônus por indicação especial" />
            </FieldGroup>
            <div style={{ display: 'flex', gap: '8px', paddingTop: '4px' }}>
              <button type="button" onClick={() => setAjusteModal(null)} style={{
                flex: 1, padding: '10px', background: 'transparent',
                border: '1px solid var(--border)', borderRadius: '8px',
                cursor: 'pointer', fontSize: '13px', color: 'var(--text-muted)',
              }}>Cancelar</button>
              <button type="submit" disabled={salvando} style={{
                flex: 1, padding: '10px', background: 'var(--amber, #F59E0B)',
                border: 'none', borderRadius: '8px', cursor: salvando ? 'not-allowed' : 'pointer',
                fontSize: '13px', fontWeight: 600, color: '#000', opacity: salvando ? 0.7 : 1,
              }}>
                {salvando ? 'Salvando...' : 'Confirmar Ajuste'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </Card>
  );
}

// ─── TAB HISTÓRICO ───────────────────────────────────────────────────────────

function TabHistorico({ showToast }: { showToast: (m: string, t?: 'ok' | 'erro') => void }) {
  const [resgates, setResgates] = useState<any[]>([]);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    api.get('/fidelidade/resgates')
      .then(r => setResgates(r.data))
      .catch(() => showToast('Erro ao carregar histórico', 'erro'))
      .finally(() => setCarregando(false));
  }, []);

  if (carregando) return <Spinner />;

  return (
    <Card>
      <SectionTitle>Resgates de recompensas</SectionTitle>
      {resgates.length === 0 ? (
        <EmptyState icon={History} text="Nenhum resgate realizado ainda." />
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                {['Data', 'Cliente', 'Recompensa', 'Pontos', 'Status'].map(h => (
                  <th key={h} style={{ padding: '10px 12px', fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textAlign: 'left', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {resgates.map(r => (
                <tr key={r.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                  <td style={{ padding: '12px', fontSize: '12px', color: 'var(--text-muted)' }}>
                    {new Date(r.createdAt).toLocaleDateString('pt-BR')}
                  </td>
                  <td style={{ padding: '12px', fontSize: '13px', color: 'var(--text-primary)' }}>
                    {r.cliente?.usuario?.nome}
                  </td>
                  <td style={{ padding: '12px', fontSize: '13px', color: 'var(--text-primary)' }}>
                    {r.recompensa?.nome}
                  </td>
                  <td style={{ padding: '12px' }}>
                    <span style={{ fontSize: '13px', fontWeight: 700, color: '#EF4444' }}>
                      -{r.pontosUsados} pts
                    </span>
                  </td>
                  <td style={{ padding: '12px' }}>
                    <span style={{
                      fontSize: '11px', padding: '3px 10px', borderRadius: '20px',
                      background: r.status === 'CONFIRMADO' ? 'rgba(34,197,94,0.12)' : r.status === 'PENDENTE' ? 'rgba(245,158,11,0.12)' : 'rgba(239,68,68,0.12)',
                      color: r.status === 'CONFIRMADO' ? '#22C55E' : r.status === 'PENDENTE' ? '#F59E0B' : '#EF4444',
                    }}>
                      {r.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

// ─── TAB PENDENTES ───────────────────────────────────────────────────────────

function TabPendentes({ showToast, onUpdateCount }: { showToast: (m: string, t?: 'ok' | 'erro') => void, onUpdateCount: (c: number) => void }) {
  const [resgates, setResgates] = useState<any[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [acaoId, setAcaoId] = useState<string | null>(null);

  function carregar() {
    api.get('/fidelidade/resgates?status=PENDENTE')
      .then(r => {
        setResgates(r.data);
        onUpdateCount(r.data.length);
      })
      .catch(() => showToast('Erro ao carregar pendentes', 'erro'))
      .finally(() => setCarregando(false));
  }

  useEffect(() => { carregar(); }, []);

  async function confirmar(id: string) {
    setAcaoId(id);
    try {
      await api.patch(`/fidelidade/resgates/${id}/confirmar`);
      showToast('Resgate confirmado!');
      carregar();
    } catch {
      showToast('Erro ao confirmar', 'erro');
    } finally {
      setAcaoId(null);
    }
  }

  async function cancelar(id: string) {
    if (!confirm('Tem certeza que deseja cancelar este resgate? O cliente receberá os pontos de volta.')) return;
    setAcaoId(id);
    try {
      await api.patch(`/fidelidade/resgates/${id}/cancelar`);
      showToast('Resgate cancelado.');
      carregar();
    } catch {
      showToast('Erro ao cancelar', 'erro');
    } finally {
      setAcaoId(null);
    }
  }

  if (carregando) return <Spinner />;

  return (
    <Card>
      <SectionTitle>Resgates pendentes</SectionTitle>
      {resgates.length === 0 ? (
        <EmptyState icon={AlertCircle} text="Nenhum resgate pendente de confirmação." />
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                {['Data', 'Cliente', 'Recompensa', 'Pontos', 'Ações'].map(h => (
                  <th key={h} style={{ padding: '10px 12px', fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textAlign: 'left', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {resgates.map(r => (
                <tr key={r.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                  <td style={{ padding: '12px', fontSize: '12px', color: 'var(--text-muted)' }}>
                    {new Date(r.createdAt).toLocaleDateString('pt-BR')}
                  </td>
                  <td style={{ padding: '12px', fontSize: '13px', color: 'var(--text-primary)' }}>
                    {r.cliente?.usuario?.nome}
                  </td>
                  <td style={{ padding: '12px', fontSize: '13px', color: 'var(--text-primary)' }}>
                    {r.recompensa?.nome}
                  </td>
                  <td style={{ padding: '12px' }}>
                    <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--amber, #F59E0B)' }}>
                      {r.pontosUsados} pts
                    </span>
                  </td>
                  <td style={{ padding: '12px' }}>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button onClick={() => confirmar(r.id)} disabled={acaoId === r.id} style={{
                        padding: '6px 12px', background: 'rgba(34,197,94,0.15)', color: '#22C55E',
                        border: '1px solid rgba(34,197,94,0.3)', borderRadius: '6px', cursor: 'pointer',
                        fontSize: '11px', fontWeight: 600, opacity: acaoId === r.id ? 0.5 : 1
                      }}>Confirmar</button>
                      <button onClick={() => cancelar(r.id)} disabled={acaoId === r.id} style={{
                        padding: '6px 12px', background: 'rgba(239,68,68,0.15)', color: '#EF4444',
                        border: '1px solid rgba(239,68,68,0.3)', borderRadius: '6px', cursor: 'pointer',
                        fontSize: '11px', fontWeight: 600, opacity: acaoId === r.id ? 0.5 : 1
                      }}>Cancelar</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

// ─── UI HELPERS ──────────────────────────────────────────────────────────────

function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{
      background: 'var(--bg-surface)', border: '1px solid var(--border)',
      borderRadius: '12px', padding: '20px', ...style,
    }}>
      {children}
    </div>
  );
}

function SectionTitle({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <h3 style={{
      fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)',
      textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 14px', ...style,
    }}>
      {children}
    </h3>
  );
}

function FieldGroup({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: '6px' }}>
        {label}
      </label>
      {children}
      {hint && <p style={{ fontSize: '10px', color: 'var(--text-muted)', margin: '4px 0 0' }}>{hint}</p>}
    </div>
  );
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" onClick={() => onChange(!checked)} style={{
      width: '40px', height: '22px', borderRadius: '11px', border: 'none', cursor: 'pointer',
      background: checked ? 'var(--amber, #F59E0B)' : 'var(--border)',
      position: 'relative', transition: 'background 0.2s', flexShrink: 0,
    }}>
      <span style={{
        position: 'absolute', top: '3px', left: checked ? '21px' : '3px',
        width: '16px', height: '16px', borderRadius: '50%', background: '#fff',
        transition: 'left 0.2s',
      }} />
    </button>
  );
}

function IconBtn({ children, onClick, title, danger }: { children: React.ReactNode; onClick: () => void; title?: string; danger?: boolean }) {
  return (
    <button onClick={onClick} title={title} style={{
      padding: '6px', background: danger ? 'rgba(239,68,68,0.1)' : 'rgba(255,255,255,0.05)',
      border: `1px solid ${danger ? 'rgba(239,68,68,0.2)' : 'var(--border)'}`,
      borderRadius: '6px', cursor: 'pointer',
      color: danger ? '#EF4444' : 'var(--text-muted)', display: 'flex', alignItems: 'center',
    }}>
      {children}
    </button>
  );
}

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', padding: '20px',
    }} onClick={onClose}>
      <div style={{
        background: 'var(--bg-surface)', border: '1px solid var(--border)',
        borderRadius: '14px', padding: '24px', width: '100%', maxWidth: '440px',
        boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
      }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
          <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)' }}>{title}</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function EmptyState({ icon: Icon, text }: { icon: React.ComponentType<any>; text: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '40px', gap: '10px' }}>
      <Icon size={36} style={{ opacity: 0.3 }} />
      <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: 0 }}>{text}</p>
    </div>
  );
}

function Spinner() {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: '60px' }}>
      <div style={{
        width: '28px', height: '28px', borderRadius: '50%',
        border: '2px solid var(--border)', borderTopColor: 'var(--amber, #F59E0B)',
        animation: 'spin 0.7s linear infinite',
      }} />
    </div>
  );
}
