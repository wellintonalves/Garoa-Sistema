import { useState, useEffect } from 'react';
import { Save, Plus, Edit, Trash, Gift } from 'lucide-react';
import api from '../../api/client';

export function FidelidadeConfig() {
  const [config, setConfig] = useState({
    ativo: false,
    pontosPorReal: 0,
    pontosPorVisita: 0,
    pontosDobroAniversario: false,
  });
  
  const [recompensas, setRecompensas] = useState<any[]>([]);
  const [resgates, setResgates] = useState<any[]>([]);
  const [servicos, setServicos] = useState<any[]>([]);
  
  const [loadingConfig, setLoadingConfig] = useState(true);
  const [salvandoConfig, setSalvandoConfig] = useState(false);
  
  const [modalRecompensa, setModalRecompensa] = useState(false);
  const [recompensaForm, setRecompensaForm] = useState<any>({
    nome: '',
    tipo: 'SERVICO_GRATIS',
    valorDesconto: '',
    servicoId: '',
    pontosNecessarios: 0,
    ativo: true,
  });
  
  useEffect(() => {
    carregarDados();
  }, []);
  
  async function carregarDados() {
    try {
      setLoadingConfig(true);
      const [resConfig, resRec, resResg, resServ] = await Promise.all([
        api.get('/fidelidade/configuracao'),
        api.get('/fidelidade/recompensas'),
        api.get('/fidelidade/resgates'),
        api.get('/servicos')
      ]);
      
      if (resConfig.data) {
        setConfig({
          ativo: resConfig.data.ativo || false,
          pontosPorReal: resConfig.data.pontosPorReal || 0,
          pontosPorVisita: resConfig.data.pontosPorVisita || 0,
          pontosDobroAniversario: resConfig.data.pontosDobroAniversario || false,
        });
      }
      setRecompensas(resRec.data || []);
      setResgates(resResg.data || []);
      setServicos(resServ.data || []);
    } catch (error) {
      console.error('Erro ao carregar dados de fidelidade:', error);
    } finally {
      setLoadingConfig(false);
    }
  }
  
  async function salvarConfig(e: React.FormEvent) {
    e.preventDefault();
    setSalvandoConfig(true);
    try {
      await api.put('/fidelidade/configuracao', {
        ...config,
        pontosPorReal: Number(config.pontosPorReal),
        pontosPorVisita: Number(config.pontosPorVisita),
      });
      alert('Configuração de Fidelidade salva!');
    } catch (error) {
      alert('Erro ao salvar fidelidade');
    } finally {
      setSalvandoConfig(false);
    }
  }
  
  function abrirModal(recompensa?: any) {
    if (recompensa) {
      setRecompensaForm({ ...recompensa });
    } else {
      setRecompensaForm({
        nome: '',
        tipo: 'SERVICO_GRATIS',
        valorDesconto: '',
        servicoId: '',
        pontosNecessarios: 0,
        ativo: true,
      });
    }
    setModalRecompensa(true);
  }
  
  async function salvarRecompensa(e: React.FormEvent) {
    e.preventDefault();
    try {
      const payload = {
        ...recompensaForm,
        pontosNecessarios: Number(recompensaForm.pontosNecessarios),
        valorDesconto: recompensaForm.valorDesconto ? Number(recompensaForm.valorDesconto) : null,
      };
      
      if (recompensaForm.id) {
        await api.put(`/fidelidade/recompensas/${recompensaForm.id}`, payload);
      } else {
        await api.post('/fidelidade/recompensas', payload);
      }
      
      setModalRecompensa(false);
      carregarDados();
    } catch (error) {
      alert('Erro ao salvar recompensa');
    }
  }
  
  async function removerRecompensa(id: string) {
    if (!confirm('Deseja remover esta recompensa?')) return;
    try {
      await api.delete(`/fidelidade/recompensas/${id}`);
      carregarDados();
    } catch (error) {
      alert('Erro ao remover recompensa');
    }
  }
  
  if (loadingConfig) return <div className="p-4">Carregando fidelidade...</div>;

  return (
    <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded p-6 shadow col-span-1 lg:col-span-2 mt-6">
      <div className="flex items-center gap-2 mb-4">
        <Gift className="text-[var(--amber)]" size={24} />
        <h2 className="text-xl font-bold text-white">Programa de Fidelidade</h2>
      </div>
      
      <form onSubmit={salvarConfig} className="space-y-4 mb-8">
        <div className="flex items-center gap-2">
          <input 
            type="checkbox" 
            id="ativo-fidelidade"
            checked={config.ativo}
            onChange={e => setConfig({...config, ativo: e.target.checked})}
            className="w-4 h-4 rounded border-[var(--border)] bg-black/50 text-[var(--amber)] focus:ring-[var(--amber)]"
          />
          <label htmlFor="ativo-fidelidade" className="text-sm font-medium">Ativar programa de fidelidade</label>
        </div>
        
        {config.ativo && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4 bg-black/20 rounded border border-[var(--border)] animate-fade-in">
            <div>
              <label className="block text-sm font-medium mb-1">Pontos por R$ 1 gasto</label>
              <input 
                type="number" 
                min="0"
                className="form-input w-full p-2 bg-black/50 border border-[var(--border)] rounded" 
                value={config.pontosPorReal} 
                onChange={e => setConfig({...config, pontosPorReal: Number(e.target.value)})} 
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Pontos fixos por visita</label>
              <input 
                type="number" 
                min="0"
                className="form-input w-full p-2 bg-black/50 border border-[var(--border)] rounded" 
                value={config.pontosPorVisita} 
                onChange={e => setConfig({...config, pontosPorVisita: Number(e.target.value)})} 
              />
            </div>
            <div className="flex items-end pb-2">
              <div className="flex items-center gap-2">
                <input 
                  type="checkbox" 
                  id="dobro-aniversario"
                  checked={config.pontosDobroAniversario}
                  onChange={e => setConfig({...config, pontosDobroAniversario: e.target.checked})}
                  className="w-4 h-4 rounded border-[var(--border)] bg-black/50 text-[var(--amber)] focus:ring-[var(--amber)]"
                />
                <label htmlFor="dobro-aniversario" className="text-sm font-medium">Pontos em dobro no aniversário</label>
              </div>
            </div>
          </div>
        )}
        
        <button type="submit" disabled={salvandoConfig} className="flex items-center justify-center gap-2 w-full md:w-auto px-6 py-2 bg-[var(--amber)] hover:bg-amber-600 text-black font-bold rounded transition-colors">
          <Save size={20} />
          {salvandoConfig ? 'Salvando...' : 'Salvar Regras'}
        </button>
      </form>
      
      {/* Recompensas */}
      {config.ativo && (
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-white">Recompensas Cadastradas</h3>
            <button 
              onClick={() => abrirModal()}
              className="flex items-center gap-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded font-medium border border-[var(--border)] transition-colors"
            >
              <Plus size={18} /> Nova Recompensa
            </button>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[var(--border)]">
                  <th className="p-3 text-sm font-medium text-zinc-400">Nome</th>
                  <th className="p-3 text-sm font-medium text-zinc-400">Tipo</th>
                  <th className="p-3 text-sm font-medium text-zinc-400">Pontos</th>
                  <th className="p-3 text-sm font-medium text-zinc-400">Status</th>
                  <th className="p-3 text-sm font-medium text-zinc-400">Ações</th>
                </tr>
              </thead>
              <tbody>
                {recompensas.map(rec => (
                  <tr key={rec.id} className="border-b border-[var(--border)]/50 hover:bg-white/5 transition-colors">
                    <td className="p-3 text-sm">{rec.nome}</td>
                    <td className="p-3 text-sm">{rec.tipo === 'SERVICO_GRATIS' ? `Serviço: ${rec.servico?.nome}` : (rec.tipo === 'DESCONTO_PERCENTUAL' ? `Desconto de ${rec.valorDesconto}%` : `Desconto de R$${rec.valorDesconto}`)}</td>
                    <td className="p-3 text-sm font-bold text-[var(--amber)]">{rec.pontosNecessarios}</td>
                    <td className="p-3 text-sm">
                      <span className={`px-2 py-1 rounded text-xs ${rec.ativo ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                        {rec.ativo ? 'Ativo' : 'Inativo'}
                      </span>
                    </td>
                    <td className="p-3 text-sm flex gap-2">
                      <button onClick={() => abrirModal(rec)} className="p-2 bg-zinc-800 hover:bg-zinc-700 rounded text-zinc-300 transition-colors">
                        <Edit size={16} />
                      </button>
                      <button onClick={() => removerRecompensa(rec.id)} className="p-2 bg-red-900/40 hover:bg-red-900/80 rounded text-red-400 transition-colors">
                        <Trash size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
                {recompensas.length === 0 && (
                  <tr>
                    <td colSpan={5} className="p-6 text-center text-zinc-500 text-sm">Nenhuma recompensa cadastrada.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
      
      {/* Histórico */}
      {config.ativo && resgates.length > 0 && (
        <div>
          <h3 className="text-lg font-bold text-white mb-4">Últimos Resgates</h3>
          <div className="overflow-x-auto max-h-64 overflow-y-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[var(--border)]">
                  <th className="p-3 text-sm font-medium text-zinc-400 sticky top-0 bg-[var(--bg-surface)]">Data</th>
                  <th className="p-3 text-sm font-medium text-zinc-400 sticky top-0 bg-[var(--bg-surface)]">Cliente</th>
                  <th className="p-3 text-sm font-medium text-zinc-400 sticky top-0 bg-[var(--bg-surface)]">Recompensa</th>
                  <th className="p-3 text-sm font-medium text-zinc-400 sticky top-0 bg-[var(--bg-surface)]">Pontos Usados</th>
                </tr>
              </thead>
              <tbody>
                {resgates.map(resg => (
                  <tr key={resg.id} className="border-b border-[var(--border)]/50">
                    <td className="p-3 text-sm">{new Date(resg.createdAt).toLocaleDateString()}</td>
                    <td className="p-3 text-sm">{resg.cliente?.usuario?.nome}</td>
                    <td className="p-3 text-sm">{resg.recompensa?.nome}</td>
                    <td className="p-3 text-sm text-red-400">-{resg.pontosUsados}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      
      {/* Modal Recompensa */}
      {modalRecompensa && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded p-6 w-full max-w-md shadow-2xl scale-in">
            <h3 className="text-xl font-bold mb-4">{recompensaForm.id ? 'Editar Recompensa' : 'Nova Recompensa'}</h3>
            
            <form onSubmit={salvarRecompensa} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Nome</label>
                <input required type="text" className="form-input w-full p-2 bg-black/50 border border-[var(--border)] rounded" value={recompensaForm.nome} onChange={e => setRecompensaForm({...recompensaForm, nome: e.target.value})} placeholder="Ex: Corte Grátis" />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1">Tipo de Recompensa</label>
                <select className="form-select w-full p-2 bg-black/50 border border-[var(--border)] rounded" value={recompensaForm.tipo} onChange={e => setRecompensaForm({...recompensaForm, tipo: e.target.value, servicoId: '', valorDesconto: ''})}>
                  <option value="SERVICO_GRATIS">Serviço Grátis</option>
                  <option value="DESCONTO_PERCENTUAL">Desconto Percentual (%)</option>
                  <option value="DESCONTO_REAIS">Desconto em Reais (R$)</option>
                </select>
              </div>
              
              {recompensaForm.tipo === 'SERVICO_GRATIS' && (
                <div className="animate-fade-in">
                  <label className="block text-sm font-medium mb-1">Selecione o Serviço</label>
                  <select required className="form-select w-full p-2 bg-black/50 border border-[var(--border)] rounded" value={recompensaForm.servicoId || ''} onChange={e => setRecompensaForm({...recompensaForm, servicoId: e.target.value})}>
                    <option value="" disabled>Selecione um serviço</option>
                    {servicos.map(s => (
                      <option key={s.id} value={s.id}>
                        {s.nome} — R$ {Number(s.preco).toFixed(2).replace('.', ',')}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              
              {(recompensaForm.tipo === 'DESCONTO_PERCENTUAL' || recompensaForm.tipo === 'DESCONTO_REAIS') && (
                <div className="animate-fade-in">
                  <label className="block text-sm font-medium mb-1">Valor do Desconto</label>
                  <input required type="number" min="0.01" step="0.01" className="form-input w-full p-2 bg-black/50 border border-[var(--border)] rounded" value={recompensaForm.valorDesconto} onChange={e => setRecompensaForm({...recompensaForm, valorDesconto: e.target.value})} placeholder={recompensaForm.tipo === 'DESCONTO_PERCENTUAL' ? 'Ex: 20' : 'Ex: 15.50'} />
                </div>
              )}
              
              <div>
                <label className="block text-sm font-medium mb-1">Pontos Necessários</label>
                <input required type="number" min="1" className="form-input w-full p-2 bg-black/50 border border-[var(--border)] rounded" value={recompensaForm.pontosNecessarios} onChange={e => setRecompensaForm({...recompensaForm, pontosNecessarios: e.target.value})} />
              </div>
              
              <div className="flex items-center gap-2 pt-2">
                <input type="checkbox" id="ativo-recompensa" checked={recompensaForm.ativo} onChange={e => setRecompensaForm({...recompensaForm, ativo: e.target.checked})} className="w-4 h-4 rounded border-[var(--border)] bg-black/50 text-[var(--amber)] focus:ring-[var(--amber)]" />
                <label htmlFor="ativo-recompensa" className="text-sm font-medium">Recompensa Ativa</label>
              </div>
              
              <div className="flex gap-2 pt-4">
                <button type="button" onClick={() => setModalRecompensa(false)} className="flex-1 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded transition-colors">Cancelar</button>
                <button type="submit" className="flex-1 py-2 bg-[var(--amber)] hover:bg-amber-600 text-black font-bold rounded transition-colors">Salvar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
