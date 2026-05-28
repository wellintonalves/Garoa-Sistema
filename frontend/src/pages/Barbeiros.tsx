// Página de Barbeiros — listagem com cards + seção de comissões por período
import { useEffect, useState } from 'react';
import { User, Star, Plus, DollarSign, TrendingUp, Calendar } from 'lucide-react';
import { Modal } from '../components/Modal';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { useNavigate } from 'react-router-dom';
import api from '../api/client';

interface Barbeiro {
  id: string;
  foto: string | null;
  especialidades: string[];
  comissaoPercent: number;
  ativo: boolean;
  usuario: { id: string; nome: string; email: string };
}

interface ComissaoBarbeiro {
  nome: string;
  bruto: number;
  comissao: number;
  liquido: number;
}

export function Barbeiros() {
  const [barbeiros, setBarbeiros] = useState<Barbeiro[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [modalAberto, setModalAberto] = useState(false);
  const [form, setForm] = useState({ nome: '', email: '', senha: '', especialidades: '', comissaoPercent: '50' });
  const navigate = useNavigate();

  // Seção de comissões
  const dataAtual = new Date();
  const dataPrimeiroDia = new Date(dataAtual.getFullYear(), dataAtual.getMonth(), 1).toISOString().split('T')[0];
  const dataHoje = dataAtual.toISOString().split('T')[0];
  const [comissaoInicio, setComissaoInicio] = useState(dataPrimeiroDia);
  const [comissaoFim, setComissaoFim] = useState(dataHoje);
  const [comissoes, setComissoes] = useState<Record<string, ComissaoBarbeiro>>({});
  const [carregandoComissoes, setCarregandoComissoes] = useState(true);

  async function carregar() {
    try {
      const res = await api.get<Barbeiro[]>('/barbeiros');
      setBarbeiros(res.data);
    } catch (err) { console.error(err); }
    finally { setCarregando(false); }
  }

  async function carregarComissoes() {
    setCarregandoComissoes(true);
    try {
      const res = await api.get('/financeiro/relatorio', {
        params: { inicio: comissaoInicio, fim: comissaoFim, barbeiroId: 'todos' }
      });
      setComissoes(res.data.consolidado.porBarbeiro || {});
    } catch (err) { console.error(err); }
    finally { setCarregandoComissoes(false); }
  }

  useEffect(() => { carregar(); }, []);
  useEffect(() => { carregarComissoes(); }, []);

  async function criarBarbeiro() {
    try {
      await api.post('/barbeiros', {
        nome: form.nome, email: form.email, senha: form.senha,
        especialidades: form.especialidades.split(',').map(e => e.trim()).filter(Boolean),
        comissaoPercent: Number(form.comissaoPercent),
      });
      setModalAberto(false);
      setForm({ nome: '', email: '', senha: '', especialidades: '', comissaoPercent: '50' });
      carregar();
    } catch (err) { console.error(err); }
  }

  const fmt = (v: number) => Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  if (carregando) return <LoadingSpinner />;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Barbeiros</h1>
        <button onClick={() => setModalAberto(true)} className="flex items-center gap-2 px-4 py-2 bg-cyan-500 hover:bg-cyan-400 text-neutral-900 text-sm font-semibold rounded-lg transition-colors">
          <Plus className="w-4 h-4" /> Novo
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {barbeiros.map(b => (
          <div key={b.id} className="bg-neutral-900 border border-neutral-800 rounded-xl p-5 hover:border-neutral-700 transition-colors">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-14 h-14 rounded-full bg-gradient-to-br from-cyan-400 to-cyan-600 flex items-center justify-center flex-shrink-0">
                <User className="w-6 h-6 text-neutral-900" />
              </div>
              <div className="min-w-0">
                <h3 className="text-white font-semibold truncate">{b.usuario.nome}</h3>
                <p className="text-neutral-500 text-sm truncate">{b.usuario.email}</p>
              </div>
              <div className={`ml-auto w-3 h-3 rounded-full flex-shrink-0 ${b.ativo ? 'bg-green-400' : 'bg-neutral-600'}`} />
            </div>
            <div className="flex flex-wrap gap-1.5 mb-3">
              {b.especialidades.map((e, i) => (
                <span key={i} className="px-2 py-0.5 bg-neutral-800 text-neutral-400 text-xs rounded-full">{e}</span>
              ))}
            </div>
            <div className="flex items-center justify-between mt-4 border-t border-neutral-800 pt-3">
              <div className="flex items-center gap-1.5 text-cyan-400 text-sm">
                <Star className="w-3.5 h-3.5" /> <span>Comissão: {b.comissaoPercent}%</span>
              </div>
              <button 
                onClick={() => navigate(`/relatorios?barbeiroId=${b.id}`)}
                className="flex items-center gap-1 text-xs text-neutral-400 hover:text-cyan-400 transition-colors"
                title="Ver comissões"
              >
                <DollarSign className="w-3.5 h-3.5" /> Comissões
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Seção de Comissões por Período */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden">
        <div className="p-5 border-b border-neutral-800">
          <div className="flex flex-wrap items-end gap-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-cyan-400" />
              <h2 className="text-lg font-semibold text-white">Comissões por Barbeiro</h2>
            </div>
            <div className="flex flex-wrap items-end gap-3 ml-auto">
              <div>
                <label className="block text-xs font-medium text-neutral-400 mb-1">De</label>
                <input type="date" value={comissaoInicio} onChange={e => setComissaoInicio(e.target.value)} className="px-3 py-1.5 bg-neutral-800 border border-neutral-700 rounded-lg text-white text-sm focus:outline-none focus:border-cyan-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-neutral-400 mb-1">Até</label>
                <input type="date" value={comissaoFim} onChange={e => setComissaoFim(e.target.value)} className="px-3 py-1.5 bg-neutral-800 border border-neutral-700 rounded-lg text-white text-sm focus:outline-none focus:border-cyan-500" />
              </div>
              <button onClick={carregarComissoes} className="flex items-center gap-1.5 px-3 py-1.5 bg-cyan-500 hover:bg-cyan-400 text-neutral-900 text-sm font-semibold rounded-lg transition-colors">
                <Calendar className="w-3.5 h-3.5" /> Buscar
              </button>
            </div>
          </div>
        </div>

        <div className="p-5">
          {carregandoComissoes ? (
            <LoadingSpinner />
          ) : Object.keys(comissoes).length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {Object.entries(comissoes).map(([id, b]) => (
                <div key={id} className="p-4 bg-neutral-800/50 border border-neutral-700/50 rounded-xl">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-500/30 to-cyan-600/30 flex items-center justify-center">
                      <User className="w-4 h-4 text-cyan-400" />
                    </div>
                    <p className="text-white font-semibold">{b.nome}</p>
                  </div>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between items-center">
                      <span className="text-neutral-500">Produzido</span>
                      <span className="text-white font-medium">{fmt(b.bruto)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-neutral-500">Comissão</span>
                      <span className="text-amber-400 font-medium">{fmt(b.comissao)}</span>
                    </div>
                    <div className="flex justify-between items-center border-t border-neutral-700 pt-2 mt-2">
                      <span className="text-neutral-500">Líquido Barbearia</span>
                      <span className="text-green-400 font-semibold">{fmt(b.liquido)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-neutral-500 text-sm py-6">Nenhuma comissão encontrada para o período selecionado.</p>
          )}
        </div>
      </div>

      <Modal aberto={modalAberto} onFechar={() => setModalAberto(false)} titulo="Novo Barbeiro">
        <div className="space-y-4">
          <div><label className="block text-xs font-medium text-neutral-400 mb-1">Nome</label>
          <input value={form.nome} onChange={e => setForm({...form, nome: e.target.value})} className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-white text-sm focus:outline-none focus:border-cyan-500" /></div>
          <div><label className="block text-xs font-medium text-neutral-400 mb-1">Email</label>
          <input type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-white text-sm focus:outline-none focus:border-cyan-500" /></div>
          <div><label className="block text-xs font-medium text-neutral-400 mb-1">Senha</label>
          <input type="password" value={form.senha} onChange={e => setForm({...form, senha: e.target.value})} className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-white text-sm focus:outline-none focus:border-cyan-500" /></div>
          <div><label className="block text-xs font-medium text-neutral-400 mb-1">Especialidades (vírgula)</label>
          <input value={form.especialidades} onChange={e => setForm({...form, especialidades: e.target.value})} placeholder="Corte, Barba" className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-white text-sm focus:outline-none focus:border-cyan-500" /></div>
          <div><label className="block text-xs font-medium text-neutral-400 mb-1">Comissão (%)</label>
          <input type="number" value={form.comissaoPercent} onChange={e => setForm({...form, comissaoPercent: e.target.value})} className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-white text-sm focus:outline-none focus:border-cyan-500" /></div>
          <button onClick={criarBarbeiro} className="w-full py-2.5 bg-cyan-500 hover:bg-cyan-400 text-neutral-900 font-semibold text-sm rounded-lg transition-colors">Cadastrar</button>
        </div>
      </Modal>
    </div>
  );
}
