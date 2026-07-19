import { useState, useEffect } from 'react';
import { Calendar as CalendarIcon, Clock, Ban } from 'lucide-react';
import barbeiroApi from '../../api/barbeiroApi';
import { hojeBrasilia } from '../../utils/datas';
import { Modal } from '../../components/Modal';

interface AgendamentoAgenda {
  id: string;
  dataHora: string;
  status: string;
  servico: { nome: string; duracaoMinutos: number };
  cliente: { usuario: { nome: string } };
  valorCobrado: string;
}

interface Bloqueio {
  id: string;
  dataInicio: string;
  dataFim: string;
  motivo?: string;
}

export function BarbeiroAgenda() {
  const [dataSel, setDataSel] = useState(hojeBrasilia());
  const [agendamentos, setAgendamentos] = useState<AgendamentoAgenda[]>([]);
  const [bloqueios, setBloqueios] = useState<Bloqueio[]>([]);
  const [carregando, setCarregando] = useState(false);
  
  const [modalAberto, setModalAberto] = useState(false);
  const [form, setForm] = useState({ data: '', horaInicio: '', horaFim: '', motivo: '' });
  
  const [sucessoMsg, setSucessoMsg] = useState('');
  const [erroMsg, setErroMsg] = useState('');

  const mostrarErro = (msg: string) => { setErroMsg(msg); setTimeout(() => setErroMsg(''), 4000); };
  const mostrarSucesso = (msg: string) => { setSucessoMsg(msg); setTimeout(() => setSucessoMsg(''), 3000); };

  function carregar() {
    setCarregando(true);
    Promise.all([
      barbeiroApi.get<AgendamentoAgenda[]>('/barbeiro/agenda', { params: { data: dataSel } }),
      barbeiroApi.get<Bloqueio[]>('/bloqueios')
    ]).then(([resAg, resBl]) => {
      setAgendamentos(resAg.data);
      setBloqueios(resBl.data.filter(b => b.dataInicio.startsWith(dataSel)));
    })
    .catch(() => mostrarErro('Erro ao carregar a agenda'))
    .finally(() => setCarregando(false));
  }

  useEffect(() => {
    carregar();
  }, [dataSel]);

  async function criarBloqueio() {
    if (!form.data || !form.horaInicio || !form.horaFim) {
      alert('Preencha data e horários.');
      return;
    }
    try {
      const dataInicioStr = `${form.data}T${form.horaInicio}:00-03:00`;
      const dataFimStr = `${form.data}T${form.horaFim}:00-03:00`;
      const { barbeiroId } = JSON.parse(localStorage.getItem('@garoa:barbeiro_dados') || '{}');
      await barbeiroApi.post('/bloqueios', { 
        barbeiroId,
        dataInicio: dataInicioStr,
        dataFim: dataFimStr,
        motivo: form.motivo 
      });
      setModalAberto(false);
      setForm({ data: '', horaInicio: '', horaFim: '', motivo: '' });
      mostrarSucesso('Horário bloqueado com sucesso.');
      carregar();
    } catch (err: any) {
      alert(err.response?.data?.erro || 'Erro ao bloquear horário');
    }
  }

  async function removerBloqueio(id: string) {
    if (!confirm('Remover este bloqueio?')) return;
    try {
      await barbeiroApi.delete(`/bloqueios/${id}`);
      mostrarSucesso('Bloqueio removido.');
      carregar();
    } catch (err: any) {
      alert(err.response?.data?.erro || 'Erro ao remover');
    }
  }

    
  // Ordena eventos misturados (bloqueios e agendamentos) por hora para exibir em uma timeline simples
  

  const horarios = [
    '08:00', '08:30', '09:00', '09:30', '10:00', '10:30', '11:00', '11:30',
    '12:00', '12:30', '13:00', '13:30', '14:00', '14:30', '15:00', '15:30',
    '16:00', '16:30', '17:00', '17:30', '18:00', '18:30', '19:00', '19:30', '20:00'
  ];
  
  const statusStyles: Record<string, { bg: string, color: string, border: string }> = {
    'AGUARDANDO': { bg: 'var(--bg-surface2)', color: 'var(--cor-primaria)', border: 'var(--cor-primaria)' },
    'CONFIRMADO': { bg: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6', border: '#3b82f6' },
    'CONCLUIDO': { bg: 'rgba(34, 197, 94, 0.1)', color: 'var(--success-text)', border: 'var(--success-text)' },
    'CANCELADO': { bg: 'rgba(239, 68, 68, 0.1)', color: 'var(--error-text)', border: 'var(--error-text)' },
  };

  const hoje = new Date();
  const agoraStr = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-${String(hoje.getDate()).padStart(2, '0')}`;
  const isHoje = dataSel === agoraStr;

  return (
    <div className="px-4 py-6 md:px-8 max-w-4xl mx-auto animate-fade-in" style={{ fontFamily: 'var(--fonte-interface)' }}>
      {/* Feedbacks */}
      {sucessoMsg && (
        <div className="bg-green-100 text-green-800 p-3 rounded-lg mb-4 text-sm font-medium border border-green-200">
          {sucessoMsg}
        </div>
      )}
      {erroMsg && (
        <div className="bg-red-100 text-red-800 p-3 rounded-lg mb-4 text-sm font-medium border border-red-200">
          {erroMsg}
        </div>
      )}

      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl md:text-3xl font-semibold" style={{ color: 'var(--text-primary)' }}>
          Sua Agenda
        </h1>
        <button onClick={() => { setForm({...form, data: dataSel}); setModalAberto(true); }} className="btn-primary flex items-center gap-2 px-3 py-2 text-xs">
          <Ban size={14} /> <span className="hidden sm:inline">Bloquear Horário</span>
        </button>
      </div>

      {/* Seletor de Data */}
      <div className="mb-8 max-w-xs">
        <label className="input-label flex items-center gap-1 mb-2"><CalendarIcon size={14} />Escolha a Data</label>
        <input 
          type="date" 
          value={dataSel} 
          onChange={(e) => setDataSel(e.target.value)}
          className="ds-input text-lg" 
        />
      </div>

      {/* Lista de Agendamentos e Bloqueios (Formato Calendário) */}
      {carregando ? (
        <div className="flex justify-center py-20" style={{ color: 'var(--text-muted)' }}>
          <Clock className="animate-spin mr-2" /> Carregando agenda...
        </div>
      ) : (
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', overflowX: 'hidden', width: '100%', position: 'relative' }}>
          <div style={{ display: 'grid', gridTemplateColumns: `60px 1fr`, borderBottom: '1px solid var(--border)' }}>
            <div style={{ padding: '8px' }} />
            <div className="text-center" style={{ padding: '12px', borderLeft: '1px solid var(--border)', background: isHoje ? 'rgba(var(--cor-primaria-rgb), 0.10)' : 'transparent' }}>
              <p style={{ fontFamily: 'var(--fonte-interface)', fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>Seus Agendamentos</p>
            </div>
          </div>
          <div style={{ position: 'relative' }}>
            {isHoje && (
              <div style={{
                position: 'absolute', left: '60px', right: 0,
                top: `${((hoje.getHours() - 8) * 60 + hoje.getMinutes()) * (48 / 30)}px`,
                borderTop: '2px solid var(--cor-primaria)', zIndex: 40, pointerEvents: 'none'
              }}>
                <div style={{ position: 'absolute', left: '-4px', top: '-5px', width: '8px', height: '8px', borderRadius: '50%', background: 'var(--cor-primaria)' }} />
              </div>
            )}
            
            {horarios.map((horario) => {
              const dtBase = `${dataSel}T${horario}:00-03:00`;
              
              const ags = agendamentos.filter(ag => {
                const h = new Date(ag.dataHora).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
                return h === horario;
              });

              const bls = bloqueios.filter(bl => {
                const dtAtual = new Date(dtBase);
                return dtAtual >= new Date(bl.dataInicio) && dtAtual < new Date(bl.dataFim);
              });

              return (
                <div key={horario} style={{ display: 'grid', gridTemplateColumns: `60px 1fr`, borderBottom: '1px solid var(--border)' }}>
                  <div className="text-right pr-3 pt-3" style={{ padding: '8px', fontFamily: 'var(--fonte-interface)', fontSize: '10px', color: 'var(--text-disabled)', letterSpacing: '0.04em', height: '48px' }}>
                    {horario}
                  </div>
                  <div style={{ borderLeft: '1px solid var(--border)', height: '48px', position: 'relative' }}>
                    {bls.map((bl, idx) => (
                      <div key={bl.id} className="cursor-pointer truncate" onClick={() => removerBloqueio(bl.id)}
                        style={{
                          padding: '4px 8px', background: 'repeating-linear-gradient(45deg, var(--bg-surface2), var(--bg-surface2) 10px, transparent 10px, transparent 20px)',
                          borderLeft: `3px solid var(--text-muted)`, color: 'var(--text-muted)', fontFamily: 'var(--fonte-interface)', fontSize: '11px',
                          borderRadius: '0 4px 4px 0', position: 'absolute', top: '2px', left: '2px', right: '2px', height: '44px', zIndex: 5 + idx
                        }}>
                        <p className="truncate" style={{ fontWeight: 600 }}>Bloqueado: {bl.motivo || 'Indisponível'}</p>
                      </div>
                    ))}
                    {ags.map((ag, idx) => {
                      const st = statusStyles[ag.status] || statusStyles['AGUARDANDO'];
                      const isConcluido = ag.status === 'CONCLUIDO';
                      const heightPx = Math.max(44, ((ag.servico.duracaoMinutos || 30) / 30) * 49 - 5);
                      
                      return (
                        <div key={ag.id} className="cursor-pointer flex flex-col overflow-hidden shadow-sm"
                          style={{
                            padding: '6px 8px', background: st.bg, borderLeft: `3px solid ${st.border}`, color: 'var(--text-primary)', opacity: isConcluido ? 0.7 : 1,
                            fontFamily: 'var(--fonte-interface)', fontSize: '11px', position: 'absolute', top: '2px', left: `${2 + (idx * 10)}px`, right: '2px',
                            height: `${heightPx}px`, zIndex: 10 + idx, borderRadius: '0 4px 4px 0', lineHeight: 1.2
                          }}>
                          <div className="flex justify-between items-start mb-1.5">
                            <p className="truncate pr-1" style={{ fontWeight: 600 }}>{ag.cliente.usuario.nome}</p>
                          </div>
                          <div>
                            <p className="truncate" style={{ fontFamily: 'var(--fonte-interface)', fontSize: '11px' }}>
                              {ag.servico.nome} ({ag.servico.duracaoMinutos} min)
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Modal Bloqueio */}
      <Modal aberto={modalAberto} onFechar={() => setModalAberto(false)} titulo="Bloquear Horário">
        <div className="flex flex-col gap-4 p-1">
          <div>
            <label className="input-label">Data</label>
            <input type="date" value={form.data} onChange={e => setForm({...form, data: e.target.value})} className="ds-input" />
          </div>
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="input-label">Início</label>
              <input type="time" value={form.horaInicio} onChange={e => setForm({...form, horaInicio: e.target.value})} className="ds-input" />
            </div>
            <div className="flex-1">
              <label className="input-label">Fim</label>
              <input type="time" value={form.horaFim} onChange={e => setForm({...form, horaFim: e.target.value})} className="ds-input" />
            </div>
          </div>
          <div>
            <label className="input-label">Motivo (Opcional)</label>
            <input type="text" placeholder="Ex: Almoço, Folga" value={form.motivo} onChange={e => setForm({...form, motivo: e.target.value})} className="ds-input" />
          </div>
          <div className="flex gap-3 mt-4">
            <button onClick={() => setModalAberto(false)} className="btn-secondary flex-1 py-3">Cancelar</button>
            <button onClick={criarBloqueio} className="btn-primary flex-1 py-3 justify-center">Confirmar</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
