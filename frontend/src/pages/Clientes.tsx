// Página de Clientes — busca + histórico
import { useEffect, useState } from 'react';
import { Search, User, Calendar } from 'lucide-react';
import { Modal } from '../components/Modal';
import { LoadingSpinner } from '../components/LoadingSpinner';
import api from '../api/client';

interface Cliente {
  id: string; telefone: string | null; observacoes: string | null;
  usuario: { id: string; nome: string; email: string };
  agendamentos?: Array<{
    id: string; dataHora: string; status: string; valorCobrado: string;
    servico: { nome: string }; barbeiro: { usuario: { nome: string } };
  }>;
}

export function Clientes() {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [busca, setBusca] = useState('');
  const [clienteSelecionado, setClienteSelecionado] = useState<Cliente | null>(null);

  async function carregar(termo?: string) {
    setCarregando(true);
    try {
      const r = await api.get<Cliente[]>('/clientes', { params: termo ? { busca: termo } : {} });
      setClientes(r.data);
    } catch (e) { console.error(e); }
    finally { setCarregando(false); }
  }

  useEffect(() => { carregar(); }, []);

  async function verHistorico(id: string) {
    try {
      const r = await api.get<Cliente>(`/clientes/${id}`);
      setClienteSelecionado(r.data);
    } catch (e) { console.error(e); }
  }

  function handleBusca() { carregar(busca || undefined); }

  const statusCores: Record<string, string> = {
    CONCLUIDO: 'text-green-400', CONFIRMADO: 'text-blue-400',
    AGUARDANDO: 'text-yellow-400', CANCELADO: 'text-red-400',
  };

  if (carregando) return <LoadingSpinner />;

  return (
    <div className="space-y-6 animate-fade-in">
      <h1 className="text-2xl font-bold text-white">Clientes</h1>

      {/* Busca */}
      <div className="flex gap-2">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-600" />
          <input value={busca} onChange={e => setBusca(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleBusca()}
            placeholder="Buscar por nome ou telefone..."
            className="w-full pl-10 pr-4 py-2.5 bg-neutral-900 border border-neutral-800 rounded-lg text-white text-sm placeholder-neutral-600 focus:outline-none focus:border-amber-500 transition-colors" />
        </div>
        <button onClick={handleBusca} className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-white text-sm rounded-lg transition-colors">Buscar</button>
      </div>

      {/* Tabela */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead><tr className="border-b border-neutral-800">
            <th className="text-left p-4 text-neutral-500 font-medium">Nome</th>
            <th className="text-left p-4 text-neutral-500 font-medium">Email</th>
            <th className="text-left p-4 text-neutral-500 font-medium">Telefone</th>
            <th className="text-right p-4 text-neutral-500 font-medium">Ações</th>
          </tr></thead>
          <tbody>
            {clientes.map(c => (
              <tr key={c.id} className="border-b border-neutral-800/50 hover:bg-neutral-800/30 transition-colors">
                <td className="p-4"><div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-neutral-800 flex items-center justify-center"><User className="w-4 h-4 text-neutral-500" /></div>
                  <span className="text-white">{c.usuario.nome}</span>
                </div></td>
                <td className="p-4 text-neutral-400">{c.usuario.email}</td>
                <td className="p-4 text-neutral-400">{c.telefone || '—'}</td>
                <td className="p-4 text-right">
                  <button onClick={() => verHistorico(c.id)} className="px-3 py-1 text-amber-400 hover:bg-amber-500/10 rounded text-xs font-medium transition-colors">
                    Ver Histórico
                  </button>
                </td>
              </tr>
            ))}
            {clientes.length === 0 && (
              <tr><td colSpan={4} className="p-8 text-center text-neutral-600">Nenhum cliente encontrado</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Modal de histórico */}
      <Modal aberto={!!clienteSelecionado} onFechar={() => setClienteSelecionado(null)} titulo={`Histórico — ${clienteSelecionado?.usuario.nome || ''}`}>
        {clienteSelecionado?.observacoes && (
          <p className="text-sm text-neutral-400 mb-4 p-3 bg-neutral-800 rounded-lg">{clienteSelecionado.observacoes}</p>
        )}
        <div className="space-y-2 max-h-80 overflow-y-auto">
          {clienteSelecionado?.agendamentos?.map(ag => (
            <div key={ag.id} className="flex items-center justify-between p-3 bg-neutral-800/50 rounded-lg">
              <div className="flex items-center gap-3">
                <Calendar className="w-4 h-4 text-neutral-600" />
                <div>
                  <p className="text-sm text-white">{ag.servico.nome}</p>
                  <p className="text-xs text-neutral-500">{new Date(ag.dataHora).toLocaleDateString('pt-BR')} — {ag.barbeiro.usuario.nome}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm text-white">R$ {Number(ag.valorCobrado).toFixed(2)}</p>
                <p className={`text-xs ${statusCores[ag.status] || 'text-neutral-500'}`}>{ag.status}</p>
              </div>
            </div>
          ))}
          {(!clienteSelecionado?.agendamentos || clienteSelecionado.agendamentos.length === 0) && (
            <p className="text-sm text-neutral-600 text-center py-4">Nenhum agendamento encontrado</p>
          )}
        </div>
      </Modal>
    </div>
  );
}
