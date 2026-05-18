// Página de Agenda — calendário semanal visual com cores por status
import { useEffect, useState, useCallback } from 'react';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { Modal } from '../components/Modal';
import { LoadingSpinner } from '../components/LoadingSpinner';
import api from '../api/client';

interface Agendamento {
  id: string;
  dataHora: string;
  status: 'AGUARDANDO' | 'CONFIRMADO' | 'CONCLUIDO' | 'CANCELADO';
  valorCobrado: string;
  cliente: { usuario: { nome: string } };
  barbeiro: { usuario: { nome: string } };
  servico: { nome: string; duracaoMinutos: number };
}

interface Barbeiro { id: string; usuario: { nome: string } }
interface Cliente { id: string; usuario: { nome: string } }
interface Servico { id: string; nome: string; preco: string; duracaoMinutos: number }

const coresStatus = {
  AGUARDANDO: 'bg-yellow-500/20 border-yellow-500/40 text-yellow-300',
  CONFIRMADO: 'bg-blue-500/20 border-blue-500/40 text-blue-300',
  CONCLUIDO: 'bg-green-500/20 border-green-500/40 text-green-300',
  CANCELADO: 'bg-red-500/20 border-red-500/40 text-red-300',
};

const diasSemana = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const horarios = Array.from({ length: 22 }, (_, i) => `${String(Math.floor(i / 2) + 8).padStart(2, '0')}:${i % 2 === 0 ? '00' : '30'}`);

export function Agenda() {
  const [semanaInicio, setSemanaInicio] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - d.getDay() + 1); d.setHours(0, 0, 0, 0); return d;
  });
  const [agendamentos, setAgendamentos] = useState<Agendamento[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [modalAberto, setModalAberto] = useState(false);
  const [barbeiros, setBarbeiros] = useState<Barbeiro[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [servicos, setServicos] = useState<Servico[]>([]);

  // Form
  const [form, setForm] = useState({ clienteId: '', barbeiroId: '', servicoId: '', dataHora: '', observacoes: '' });

  const diasDaSemana = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(semanaInicio); d.setDate(semanaInicio.getDate() + i); return d;
  });

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const promises = diasDaSemana.map((d) =>
        api.get<Agendamento[]>('/agendamentos', { params: { data: d.toISOString().split('T')[0] } })
      );
      const resultados = await Promise.all(promises);
      const todos = resultados.flatMap((r) => r.data);
      setAgendamentos(todos);
    } catch (err) {
      console.error('Erro ao carregar agenda:', err);
    } finally {
      setCarregando(false);
    }
  }, [semanaInicio]);

  useEffect(() => { carregar(); }, [carregar]);

  async function abrirModal() {
    try {
      const [b, c, s] = await Promise.all([
        api.get<Barbeiro[]>('/barbeiros'),
        api.get<Cliente[]>('/clientes'),
        api.get<Servico[]>('/servicos'),
      ]);
      setBarbeiros(b.data);
      setClientes(c.data);
      setServicos(s.data);
      setModalAberto(true);
    } catch (err) {
      console.error('Erro ao carregar dados:', err);
    }
  }

  async function criarAgendamento() {
    try {
      const servico = servicos.find((s) => s.id === form.servicoId);
      await api.post('/agendamentos', { ...form, valorCobrado: servico ? Number(servico.preco) : 0 });
      setModalAberto(false);
      setForm({ clienteId: '', barbeiroId: '', servicoId: '', dataHora: '', observacoes: '' });
      carregar();
    } catch (err) {
      console.error('Erro ao criar agendamento:', err);
    }
  }

  function mudarSemana(direcao: number) {
    const nova = new Date(semanaInicio);
    nova.setDate(nova.getDate() + direcao * 7);
    setSemanaInicio(nova);
  }

  if (carregando) return <LoadingSpinner />;

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-white">Agenda</h1>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 bg-neutral-900 rounded-lg border border-neutral-800">
            <button onClick={() => mudarSemana(-1)} className="p-2 text-neutral-400 hover:text-white transition-colors">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-sm text-neutral-300 px-2 min-w-[160px] text-center">
              {diasDaSemana[0].toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })} — {diasDaSemana[6].toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}
            </span>
            <button onClick={() => mudarSemana(1)} className="p-2 text-neutral-400 hover:text-white transition-colors">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
          <button onClick={abrirModal} className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-400 text-neutral-900 text-sm font-semibold rounded-lg transition-colors">
            <Plus className="w-4 h-4" /> Novo
          </button>
        </div>
      </div>

      {/* Calendário semanal */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-x-auto">
        <div className="min-w-[700px]">
          {/* Cabeçalho dos dias */}
          <div className="grid grid-cols-[60px_repeat(7,1fr)] border-b border-neutral-800">
            <div className="p-2" />
            {diasDaSemana.map((dia, i) => {
              const isHoje = dia.toDateString() === new Date().toDateString();
              return (
                <div key={i} className={`p-3 text-center border-l border-neutral-800 ${isHoje ? 'bg-amber-500/5' : ''}`}>
                  <p className="text-xs text-neutral-500">{diasSemana[dia.getDay()]}</p>
                  <p className={`text-lg font-bold ${isHoje ? 'text-amber-400' : 'text-white'}`}>{dia.getDate()}</p>
                </div>
              );
            })}
          </div>

          {/* Grid de horários */}
          {horarios.map((horario) => (
            <div key={horario} className="grid grid-cols-[60px_repeat(7,1fr)] border-b border-neutral-800/50">
              <div className="p-2 text-xs text-neutral-600 text-right pr-3 pt-3">{horario}</div>
              {diasDaSemana.map((dia, diaIdx) => {
                const agendamentosDoCelula = agendamentos.filter((ag) => {
                  const d = new Date(ag.dataHora);
                  return d.toDateString() === dia.toDateString() &&
                    `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}` === horario;
                });

                return (
                  <div key={diaIdx} className="border-l border-neutral-800/50 min-h-[48px] p-0.5">
                    {agendamentosDoCelula.map((ag) => (
                      <div key={ag.id} className={`px-2 py-1 rounded text-xs border ${coresStatus[ag.status]} truncate cursor-pointer hover:opacity-80 transition-opacity`}>
                        <p className="font-medium truncate">{ag.cliente.usuario.nome}</p>
                        <p className="truncate opacity-70">{ag.servico.nome}</p>
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Legenda */}
      <div className="flex flex-wrap gap-4 text-xs">
        {Object.entries(coresStatus).map(([status, classe]) => (
          <div key={status} className="flex items-center gap-1.5">
            <div className={`w-3 h-3 rounded ${classe.split(' ')[0]}`} />
            <span className="text-neutral-400">{status === 'AGUARDANDO' ? 'Aguardando' : status === 'CONFIRMADO' ? 'Confirmado' : status === 'CONCLUIDO' ? 'Concluído' : 'Cancelado'}</span>
          </div>
        ))}
      </div>

      {/* Modal para novo agendamento */}
      <Modal aberto={modalAberto} onFechar={() => setModalAberto(false)} titulo="Novo Agendamento">
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-neutral-400 mb-1">Cliente</label>
            <select value={form.clienteId} onChange={(e) => setForm({ ...form, clienteId: e.target.value })} className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-white text-sm focus:outline-none focus:border-amber-500">
              <option value="">Selecione...</option>
              {clientes.map((c) => <option key={c.id} value={c.id}>{c.usuario.nome}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-neutral-400 mb-1">Barbeiro</label>
            <select value={form.barbeiroId} onChange={(e) => setForm({ ...form, barbeiroId: e.target.value })} className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-white text-sm focus:outline-none focus:border-amber-500">
              <option value="">Selecione...</option>
              {barbeiros.map((b) => <option key={b.id} value={b.id}>{b.usuario.nome}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-neutral-400 mb-1">Serviço</label>
            <select value={form.servicoId} onChange={(e) => setForm({ ...form, servicoId: e.target.value })} className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-white text-sm focus:outline-none focus:border-amber-500">
              <option value="">Selecione...</option>
              {servicos.map((s) => <option key={s.id} value={s.id}>{s.nome} — R$ {Number(s.preco).toFixed(2)}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-neutral-400 mb-1">Data e Horário</label>
            <input type="datetime-local" value={form.dataHora} onChange={(e) => setForm({ ...form, dataHora: e.target.value })} className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-white text-sm focus:outline-none focus:border-amber-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-neutral-400 mb-1">Observações</label>
            <textarea value={form.observacoes} onChange={(e) => setForm({ ...form, observacoes: e.target.value })} rows={2} className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-white text-sm focus:outline-none focus:border-amber-500 resize-none" />
          </div>
          <button onClick={criarAgendamento} className="w-full py-2.5 bg-amber-500 hover:bg-amber-400 text-neutral-900 font-semibold text-sm rounded-lg transition-colors">
            Criar Agendamento
          </button>
        </div>
      </Modal>
    </div>
  );
}
