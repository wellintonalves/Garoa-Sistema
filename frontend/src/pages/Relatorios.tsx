import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Filter, DollarSign, Users, Scissors } from 'lucide-react';
import { LoadingSpinner } from '../components/LoadingSpinner';
import api from '../api/client';

export function Relatorios() {
  const [searchParams] = useSearchParams();
  const [carregando, setCarregando] = useState(false);
  const [barbeiros, setBarbeiros] = useState<any[]>([]);
  
  const dataAtual = new Date();
  const dataPrimeiroDia = new Date(dataAtual.getFullYear(), dataAtual.getMonth(), 1).toISOString().split('T')[0];
  const dataHoje = dataAtual.toISOString().split('T')[0];

  const barbeiroIdUrl = searchParams.get('barbeiroId') || 'todos';
  const [filtros, setFiltros] = useState({ inicio: dataPrimeiroDia, fim: dataHoje, barbeiroId: barbeiroIdUrl });
  const [relatorio, setRelatorio] = useState<any>(null);

  useEffect(() => {
    async function carregar() {
      const res = await api.get('/barbeiros');
      setBarbeiros(res.data.filter((b: any) => b.ativo));
    }
    carregar();
  }, []);

  async function buscarRelatorio() {
    setCarregando(true);
    try {
      const res = await api.get('/financeiro/relatorio', { params: filtros });
      setRelatorio(res.data);
    } catch (e) {
      console.error(e);
    } finally {
      setCarregando(false);
    }
  }

  // Busca inicial ao carregar a página
  useEffect(() => {
    buscarRelatorio();
  }, []);

  const fmt = (v: number) => Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  return (
    <div className="space-y-6 animate-fade-in">
      <h1 className="text-2xl font-bold text-white">Relatórios & Comissões</h1>

      {/* Filtros */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-5 flex flex-wrap gap-4 items-end">
        <div>
          <label className="block text-xs font-medium text-neutral-400 mb-1">Data Início</label>
          <input type="date" value={filtros.inicio} onChange={e => setFiltros({...filtros, inicio: e.target.value})} className="px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-white text-sm focus:outline-none" />
        </div>
        <div>
          <label className="block text-xs font-medium text-neutral-400 mb-1">Data Fim</label>
          <input type="date" value={filtros.fim} onChange={e => setFiltros({...filtros, fim: e.target.value})} className="px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-white text-sm focus:outline-none" />
        </div>
        <div>
          <label className="block text-xs font-medium text-neutral-400 mb-1">Barbeiro</label>
          <select value={filtros.barbeiroId} onChange={e => setFiltros({...filtros, barbeiroId: e.target.value})} className="px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-white text-sm focus:outline-none min-w-[200px]">
            <option value="todos">Todos os Barbeiros</option>
            {barbeiros.map(b => <option key={b.id} value={b.id}>{b.usuario.nome}</option>)}
          </select>
        </div>
        <button onClick={buscarRelatorio} className="flex items-center gap-2 px-4 py-2 bg-cyan-500 hover:bg-cyan-400 text-neutral-900 text-sm font-semibold rounded-lg transition-colors">
          <Filter className="w-4 h-4" /> Filtrar
        </button>
      </div>

      {carregando ? (
        <LoadingSpinner />
      ) : relatorio ? (
        <>
          {/* Cards de Totais */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4">
              <div className="flex items-center gap-2 text-neutral-400 mb-2"><DollarSign className="w-4 h-4" /><span className="text-xs font-medium">Total Bruto (Entradas)</span></div>
              <p className="text-2xl font-bold text-white">{fmt(relatorio.consolidado.totalBruto)}</p>
            </div>
            <div className="bg-neutral-900 border border-red-500/20 rounded-xl p-4">
              <div className="flex items-center gap-2 text-red-400 mb-2"><Users className="w-4 h-4" /><span className="text-xs font-medium">Total Comissões Pagas</span></div>
              <p className="text-2xl font-bold text-white">{fmt(relatorio.consolidado.totalComissoes)}</p>
            </div>
            <div className="bg-neutral-900 border border-green-500/20 rounded-xl p-4">
              <div className="flex items-center gap-2 text-green-400 mb-2"><DollarSign className="w-4 h-4" /><span className="text-xs font-medium">Líquido Barbearia</span></div>
              <p className="text-2xl font-bold text-white">{fmt(relatorio.consolidado.totalLiquido)}</p>
            </div>
            <div className="bg-neutral-900 border border-cyan-500/20 rounded-xl p-4">
              <div className="flex items-center gap-2 text-cyan-400 mb-2"><Scissors className="w-4 h-4" /><span className="text-xs font-medium">Atendimentos</span></div>
              <p className="text-2xl font-bold text-white">{relatorio.consolidado.totalAtendimentos}</p>
            </div>
          </div>

          {/* Resumo por Barbeiro (quando "Todos" está selecionado) */}
          {filtros.barbeiroId === 'todos' && Object.keys(relatorio.consolidado.porBarbeiro).length > 0 && (
            <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-5">
              <h3 className="text-sm font-medium text-neutral-400 mb-4">Resumo por Barbeiro</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {Object.values(relatorio.consolidado.porBarbeiro).map((b: any, i) => (
                  <div key={i} className="p-3 border border-neutral-800 rounded-lg">
                    <p className="text-white font-semibold mb-2">{b.nome}</p>
                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between"><span className="text-neutral-500">Produzido:</span><span className="text-neutral-300">{fmt(b.bruto)}</span></div>
                      <div className="flex justify-between"><span className="text-neutral-500">Comissão:</span><span className="text-red-400">{fmt(b.comissao)}</span></div>
                      <div className="flex justify-between border-t border-neutral-800 mt-1 pt-1"><span className="text-neutral-500">Líquido:</span><span className="text-green-400 font-medium">{fmt(b.liquido)}</span></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tabela de Lançamentos */}
          <div className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden">
            <h3 className="text-sm font-medium text-neutral-400 p-4 border-b border-neutral-800">Detalhamento dos Lançamentos</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-neutral-300">
                <thead className="bg-neutral-800/50 text-neutral-400 text-xs uppercase">
                  <tr>
                    <th className="px-4 py-3">Data</th>
                    <th className="px-4 py-3">Barbeiro / Serviço</th>
                    <th className="px-4 py-3 text-right">Valor Total</th>
                    <th className="px-4 py-3 text-right">Comissão</th>
                    <th className="px-4 py-3 text-right">Líquido</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-800">
                  {relatorio.lancamentos.filter((l: any) => l.tipo === 'ENTRADA').map((l: any) => (
                    <tr key={l.id} className="hover:bg-neutral-800/30">
                      <td className="px-4 py-3 whitespace-nowrap">{new Date(l.data + 'T12:00:00').toLocaleDateString('pt-BR')}</td>
                      <td className="px-4 py-3">
                        <p className="text-white">{l.servico ? l.servico.nome : l.categoria}</p>
                        <p className="text-xs text-neutral-500">{l.barbeiro ? l.barbeiro.usuario.nome : 'Sem Barbeiro'}</p>
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-white">{fmt(l.valor)}</td>
                      <td className="px-4 py-3 text-right text-red-400">{l.valorComissao ? fmt(l.valorComissao) : '-'}</td>
                      <td className="px-4 py-3 text-right text-green-400">{l.valorLiquido ? fmt(l.valorLiquido) : fmt(l.valor)}</td>
                    </tr>
                  ))}
                  {relatorio.lancamentos.length === 0 && (
                    <tr><td colSpan={5} className="px-4 py-8 text-center text-neutral-500">Nenhum dado encontrado para o período.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
