import { useState, useEffect } from 'react';
import { Calendar as CalendarIcon, Clock, Ban, X } from 'lucide-react';
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

  const fmtHora = (d: string) => new Date(d).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  
  // Ordena eventos misturados (bloqueios e agendamentos) por hora para exibir em uma timeline simples
  const eventos = [
    ...agendamentos.map(a => ({ tipo: 'AGENDAMENTO', time: new Date(a.dataHora).getTime(), data: a })),
    ...bloqueios.map(b => ({ tipo: 'BLOQUEIO', time: new Date(b.dataInicio).getTime(), data: b }))
  ].sort((a, b) => a.time - b.time);

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

      {/* Lista de Agendamentos e Bloqueios */}
      {carregando ? (
        <div className="flex justify-center py-20" style={{ color: 'var(--text-muted)' }}>
          <Clock className="animate-spin mr-2" /> Carregando agenda...
        </div>
      ) : eventos.length === 0 ? (
        <div className="p-10 rounded-2xl border text-center flex flex-col items-center justify-center" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)' }}>
          <div className="w-16 h-16 rounded-full flex items-center justify-center mb-4" style={{ background: 'var(--bg-surface2)' }}>
            <CalendarIcon size={28} style={{ color: 'var(--text-muted)' }} />
          </div>
          <p className="font-medium" style={{ color: 'var(--text-primary)' }}>Agenda vazia neste dia</p>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>Você não possui agendamentos ou bloqueios para esta data.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-4 relative">
          {/* Linha vertical da timeline */}
          <div className="absolute left-[38px] top-6 bottom-6 w-0.5" style={{ background: 'var(--border)' }}></div>
          
          {eventos.map((ev) => {
            if (ev.tipo === 'BLOQUEIO') {
              const b = ev.data as Bloqueio;
              return (
                <div key={b.id} className="flex items-start gap-4 relative">
                  <div className="mt-4 p-2 rounded-full z-10" style={{ background: 'var(--bg-surface)', border: '2px solid var(--text-muted)' }}>
                    <Ban size={14} style={{ color: 'var(--text-muted)' }} />
                  </div>
                  <div className="flex-1 p-4 rounded-xl border flex justify-between items-center transition-all opacity-80 hover:opacity-100" style={{ background: 'repeating-linear-gradient(45deg, var(--bg-surface), var(--bg-surface) 10px, var(--bg-surface2) 10px, var(--bg-surface2) 20px)', borderColor: 'var(--border)' }}>
                    <div>
                      <p className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>Período Bloqueado</p>
                      <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                        {fmtHora(b.dataInicio)} às {fmtHora(b.dataFim)} • {b.motivo || 'Motivo não informado'}
                      </p>
                    </div>
                    <button onClick={() => removerBloqueio(b.id)} className="p-2 rounded-lg hover:bg-black/10" style={{ color: 'var(--error-text)' }} title="Remover Bloqueio">
                      <X size={16} />
                    </button>
                  </div>
                </div>
              );
            } else {
              const a = ev.data as AgendamentoAgenda;
              const isConcluido = a.status === 'CONCLUIDO';
              const isCancelado = a.status === 'CANCELADO';
              
              let corIndicador = 'var(--cor-primaria)';
              let bgIndicador = 'var(--bg-surface2)';
              if (isConcluido) { corIndicador = 'var(--success-text)'; bgIndicador = 'rgba(34, 197, 94, 0.1)'; }
              if (isCancelado) { corIndicador = 'var(--error-text)'; bgIndicador = 'rgba(239, 68, 68, 0.1)'; }

              return (
                <div key={a.id} className="flex items-start gap-4 relative">
                  <div className="mt-5 p-2 rounded-full z-10 font-mono text-xs font-semibold shadow-sm" style={{ background: bgIndicador, color: corIndicador, border: `2px solid ${corIndicador}` }}>
                    {fmtHora(a.dataHora)}
                  </div>
                  
                  <div className={`flex-1 p-5 rounded-2xl border-l-4 shadow-sm transition-transform hover:translate-y-[-2px]`} style={{ background: 'var(--bg-surface)', borderLeftColor: corIndicador, borderTop: '1px solid var(--border)', borderRight: '1px solid var(--border)', borderBottom: '1px solid var(--border)', opacity: isCancelado ? 0.6 : 1 }}>
                    <div className="flex justify-between items-start mb-2">
                      <p className="font-semibold text-lg" style={{ color: 'var(--text-primary)' }}>
                        {a.cliente.usuario.nome}
                      </p>
                      <span className={`text-xs px-2 py-1 rounded-md font-medium uppercase tracking-wider`} style={{ background: bgIndicador, color: corIndicador }}>
                        {a.status}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-sm" style={{ color: 'var(--text-muted)' }}>
                      <span>{a.servico.nome}</span>
                      <span className="w-1 h-1 rounded-full bg-current opacity-50"></span>
                      <span className="font-mono">{a.servico.duracaoMinutos || 30} min</span>
                      {a.valorCobrado && (
                        <>
                          <span className="w-1 h-1 rounded-full bg-current opacity-50"></span>
                          <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>R$ {Number(a.valorCobrado).toFixed(2)}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            }
          })}
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
