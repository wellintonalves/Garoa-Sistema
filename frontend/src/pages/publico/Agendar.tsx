import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api/client';
import { ChevronRight, ChevronLeft, Check, Scissors, User, Calendar, Clock, CheckCircle } from 'lucide-react';

interface Servico { id: string; nome: string; descricao: string; preco: string; duracaoMinutos: number; }
interface Barbeiro { id: string; usuario: { nome: string }; especialidades: string[]; foto: string | null; }

export function Agendar() {
  const navigate = useNavigate();
  const [etapa, setEtapa] = useState(1);
  const [carregando, setCarregando] = useState(false);
  const nomeBarbearia = import.meta.env.VITE_BARBEARIA_NOME || 'Garoa Barbearia';

  // Dados do backend
  const [servicos, setServicos] = useState<Servico[]>([]);
  const [barbeiros, setBarbeiros] = useState<Barbeiro[]>([]);
  const [horarios, setHorarios] = useState<string[]>([]);

  // Seleções do usuário
  const [servicoId, setServicoId] = useState<string>('');
  const [barbeiroId, setBarbeiroId] = useState<string>('');
  const [data, setData] = useState<string>('');
  const [horario, setHorario] = useState<string>('');
  const [cliente, setCliente] = useState({ nome: '', telefone: '', observacoes: '' });

  useEffect(() => {
    carregarServicos();
    carregarBarbeiros();
  }, []);

  async function carregarServicos() {
    try {
      const res = await api.get('/publico/servicos');
      setServicos(res.data);
    } catch (e) {
      console.error(e);
    }
  }

  async function carregarBarbeiros() {
    try {
      const res = await api.get('/publico/barbeiros');
      setBarbeiros(res.data);
    } catch (e) {
      console.error(e);
    }
  }

  async function buscarHorarios(novaData: string) {
    setData(novaData);
    setHorario('');
    if (!novaData || !servicoId) return;

    setCarregando(true);
    try {
      const res = await api.get('/publico/horarios-disponiveis', {
        params: { data: novaData, servicoId, barbeiroId: barbeiroId || 'sem_preferencia' }
      });
      setHorarios(res.data);
    } catch (e) {
      console.error(e);
    } finally {
      setCarregando(false);
    }
  }

  async function confirmarAgendamento() {
    setCarregando(true);
    try {
      // Combina data e horario — envia como horário local (Brasília) sem converter para UTC
      const dataHoraLocal = `${data}T${horario}:00`;

      await api.post('/publico/agendamentos', {
        nomeCliente: cliente.nome,
        telefoneCliente: cliente.telefone,
        barbeiroId: barbeiroId || 'sem_preferencia',
        servicoId,
        dataHora: dataHoraLocal,
        observacoes: cliente.observacoes
      });

      setEtapa(6); // Tela de sucesso
    } catch (e) {
      alert('Erro ao confirmar agendamento. Tente novamente.');
      console.error(e);
    } finally {
      setCarregando(false);
    }
  }

  const servicoSelecionado = servicos.find(s => s.id === servicoId);
  const barbeiroSelecionado = barbeiros.find(b => b.id === barbeiroId);

  // Auxiliares de UI
  const progresso = ((etapa - 1) / 4) * 100;
  
  // Datas dos próximos 30 dias
  const proximosDias = Array.from({ length: 30 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i);
    return d;
  });

  return (
    <div className="min-h-screen bg-[var(--fundo-pagina)] text-white flex flex-col font-body">
      {/* Header Público */}
      <header className="h-16 flex items-center justify-center bg-[var(--bg-surface)] border-b border-[var(--border)] sticky top-0 z-10">
        <h1 className="font-display text-xl tracking-wider text-[var(--cor-primaria)] uppercase">
          {nomeBarbearia}
        </h1>
      </header>

      {/* Container Centralizado */}
      <main className="flex-1 max-w-md w-full mx-auto p-4 flex flex-col">
        {etapa < 6 && (
          <div className="mb-6">
            <div className="flex justify-between text-xs font-mono text-[var(--text-muted)] mb-2 uppercase tracking-widest">
              <span>Etapa {etapa} de 5</span>
            </div>
            <div className="h-1 w-full bg-[var(--bg-surface2)] rounded overflow-hidden">
              <div 
                className="h-full bg-[var(--cor-primaria)] transition-all duration-300 ease-in-out" 
                style={{ width: `${progresso}%` }}
              />
            </div>
          </div>
        )}

        {/* ETAPA 1: SERVIÇO */}
        {etapa === 1 && (
          <div className="animate-fade-in flex flex-col gap-4 flex-1">
            <div className="flex items-center gap-2 mb-2">
              <Scissors className="text-[var(--cor-primaria)]" size={20} />
              <h2 className="text-xl font-bold font-display tracking-wide">Escolha o Serviço</h2>
            </div>
            
            <div className="space-y-3 flex-1 overflow-y-auto">
              {servicos.map(s => (
                <div 
                  key={s.id}
                  onClick={() => setServicoId(s.id)}
                  className={`p-4 rounded border cursor-pointer transition-all ${
                    servicoId === s.id 
                      ? 'border-[var(--cor-primaria)] bg-[rgba(var(--cor-primaria-rgb), 0.10)]' 
                      : 'border-[var(--border)] bg-[var(--bg-surface)] hover:border-[var(--border-hover)]'
                  }`}
                >
                  <div className="flex justify-between items-start mb-1">
                    <h3 className="font-bold">{s.nome}</h3>
                    <span className="text-[var(--cor-primaria)] font-mono font-bold">
                      R$ {Number(s.preco).toFixed(2)}
                    </span>
                  </div>
                  <p className="text-sm text-[var(--text-muted)] mb-2">{s.descricao || 'Sem descrição'}</p>
                  <div className="text-xs font-mono text-[var(--text-muted)] flex items-center gap-1">
                    <Clock size={12} /> {s.duracaoMinutos} min
                  </div>
                </div>
              ))}
            </div>

            <button 
              onClick={() => setEtapa(2)}
              disabled={!servicoId}
              className="mt-4 flex items-center justify-center gap-2 w-full py-3 bg-[var(--cor-primaria)] hover:bg-[var(--cor-primaria)] disabled:opacity-50 disabled:cursor-not-allowed text-black font-bold uppercase tracking-widest text-sm rounded transition-colors"
            >
              Avançar <ChevronRight size={18} />
            </button>
          </div>
        )}

        {/* ETAPA 2: BARBEIRO */}
        {etapa === 2 && (
          <div className="animate-fade-in flex flex-col gap-4 flex-1">
            <button onClick={() => setEtapa(1)} className="text-[var(--text-muted)] flex items-center gap-1 text-sm mb-2 w-fit">
              <ChevronLeft size={16} /> Voltar
            </button>
            <div className="flex items-center gap-2 mb-2">
              <User className="text-[var(--cor-primaria)]" size={20} />
              <h2 className="text-xl font-bold font-display tracking-wide">Escolha o Barbeiro</h2>
            </div>
            
            <div className="space-y-3 flex-1 overflow-y-auto">
              <div 
                onClick={() => setBarbeiroId('')}
                className={`p-4 rounded border cursor-pointer transition-all flex items-center gap-4 ${
                  barbeiroId === '' 
                    ? 'border-[var(--cor-primaria)] bg-[rgba(var(--cor-primaria-rgb), 0.10)]' 
                    : 'border-[var(--border)] bg-[var(--bg-surface)] hover:border-[var(--border-hover)]'
                }`}
              >
                <div className="w-12 h-12 rounded-full bg-[var(--bg-surface2)] flex items-center justify-center">
                  <Scissors size={20} className="text-[var(--text-muted)]" />
                </div>
                <div>
                  <h3 className="font-bold">Sem preferência</h3>
                  <p className="text-sm text-[var(--text-muted)]">O primeiro horário livre</p>
                </div>
              </div>

              {barbeiros.map(b => (
                <div 
                  key={b.id}
                  onClick={() => setBarbeiroId(b.id)}
                  className={`p-4 rounded border cursor-pointer transition-all flex items-center gap-4 ${
                    barbeiroId === b.id 
                      ? 'border-[var(--cor-primaria)] bg-[rgba(var(--cor-primaria-rgb), 0.10)]' 
                      : 'border-[var(--border)] bg-[var(--bg-surface)] hover:border-[var(--border-hover)]'
                  }`}
                >
                  <div className="w-12 h-12 rounded-full bg-[var(--bg-surface2)] flex items-center justify-center overflow-hidden">
                    {b.foto ? (
                      <img src={b.foto} alt={b.usuario.nome} className="w-full h-full object-cover" />
                    ) : (
                      <User size={20} className="text-[var(--text-muted)]" />
                    )}
                  </div>
                  <div>
                    <h3 className="font-bold">{b.usuario.nome}</h3>
                    <p className="text-xs text-[var(--text-muted)] mt-1 truncate max-w-[200px]">
                      {b.especialidades.join(', ')}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            <button 
              onClick={() => { setEtapa(3); buscarHorarios(data); }}
              className="mt-4 flex items-center justify-center gap-2 w-full py-3 bg-[var(--cor-primaria)] hover:bg-[var(--cor-primaria)] text-black font-bold uppercase tracking-widest text-sm rounded transition-colors"
            >
              Avançar <ChevronRight size={18} />
            </button>
          </div>
        )}

        {/* ETAPA 3: DATA E HORA */}
        {etapa === 3 && (
          <div className="animate-fade-in flex flex-col gap-4 flex-1">
            <button onClick={() => setEtapa(2)} className="text-[var(--text-muted)] flex items-center gap-1 text-sm mb-2 w-fit">
              <ChevronLeft size={16} /> Voltar
            </button>
            <div className="flex items-center gap-2 mb-2">
              <Calendar className="text-[var(--cor-primaria)]" size={20} />
              <h2 className="text-xl font-bold font-display tracking-wide">Data e Horário</h2>
            </div>
            
            <div className="mb-4">
              <label className="text-sm text-[var(--text-muted)] font-mono uppercase tracking-widest mb-2 block">Selecione o Dia</label>
              <div className="flex gap-2 overflow-x-auto pb-2 snap-x">
                {proximosDias.map((d, i) => {
                  const dataIso = d.toISOString().split('T')[0];
                  const diasDaSemanaAbrev = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
                  return (
                    <div 
                      key={i}
                      onClick={() => buscarHorarios(dataIso)}
                      className={`flex-shrink-0 snap-center w-16 p-2 flex flex-col items-center justify-center rounded border cursor-pointer transition-all ${
                        data === dataIso 
                          ? 'border-[var(--cor-primaria)] bg-[rgba(var(--cor-primaria-rgb), 0.10)]' 
                          : 'border-[var(--border)] bg-[var(--bg-surface)]'
                      }`}
                    >
                      <span className="text-[10px] uppercase font-mono text-[var(--text-muted)]">{diasDaSemanaAbrev[d.getDay()]}</span>
                      <span className="text-xl font-bold font-display">{d.getDate()}</span>
                      <span className="text-[10px] uppercase font-mono text-[var(--text-muted)]">{d.toLocaleDateString('pt-BR', { month: 'short' })}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="flex-1">
              <label className="text-sm text-[var(--text-muted)] font-mono uppercase tracking-widest mb-2 block">
                {carregando ? 'Buscando...' : 'Horários Disponíveis'}
              </label>
              
              {!data ? (
                <div className="text-center p-6 text-[var(--text-muted)] border border-dashed border-[var(--border)] rounded">
                  Selecione um dia acima
                </div>
              ) : carregando ? (
                <div className="flex justify-center p-6"><div className="animate-spin w-6 h-6 border-2 border-[var(--cor-primaria)] border-t-transparent rounded-full"></div></div>
              ) : horarios.length === 0 ? (
                <div className="text-center p-6 text-[var(--text-muted)] border border-dashed border-[var(--border)] rounded">
                  Nenhum horário disponível para este dia.
                </div>
              ) : (
                <div className="grid grid-cols-4 gap-2">
                  {horarios.map(h => (
                    <div
                      key={h}
                      onClick={() => setHorario(h)}
                      className={`p-2 text-center rounded border cursor-pointer font-mono text-sm transition-all ${
                        horario === h
                          ? 'border-[var(--cor-primaria)] bg-[var(--cor-primaria)] text-black font-bold'
                          : 'border-[var(--border)] bg-[var(--bg-surface)] hover:border-[rgba(var(--cor-primaria-rgb), 0.10)]'
                      }`}
                    >
                      {h}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <button 
              onClick={() => setEtapa(4)}
              disabled={!data || !horario}
              className="mt-4 flex items-center justify-center gap-2 w-full py-3 bg-[var(--cor-primaria)] hover:bg-[var(--cor-primaria)] disabled:opacity-50 disabled:cursor-not-allowed text-black font-bold uppercase tracking-widest text-sm rounded transition-colors"
            >
              Avançar <ChevronRight size={18} />
            </button>
          </div>
        )}

        {/* ETAPA 4: DADOS DO CLIENTE */}
        {etapa === 4 && (
          <div className="animate-fade-in flex flex-col gap-4 flex-1">
            <button onClick={() => setEtapa(3)} className="text-[var(--text-muted)] flex items-center gap-1 text-sm mb-2 w-fit">
              <ChevronLeft size={16} /> Voltar
            </button>
            <div className="flex items-center gap-2 mb-4">
              <User className="text-[var(--cor-primaria)]" size={20} />
              <h2 className="text-xl font-bold font-display tracking-wide">Seus Dados</h2>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="text-xs text-[var(--text-muted)] font-mono uppercase tracking-widest mb-1 block">Nome Completo</label>
                <input 
                  type="text" 
                  value={cliente.nome}
                  onChange={(e) => setCliente({...cliente, nome: e.target.value})}
                  className="w-full p-3 bg-[var(--bg-surface)] border border-[var(--border)] rounded focus:outline-none focus:border-[var(--cor-primaria)] text-white"
                  placeholder="Seu nome"
                />
              </div>
              <div>
                <label className="text-xs text-[var(--text-muted)] font-mono uppercase tracking-widest mb-1 block">Telefone (WhatsApp)</label>
                <input 
                  type="tel" 
                  value={cliente.telefone}
                  onChange={(e) => setCliente({...cliente, telefone: e.target.value})}
                  className="w-full p-3 bg-[var(--bg-surface)] border border-[var(--border)] rounded focus:outline-none focus:border-[var(--cor-primaria)] text-white"
                  placeholder="(00) 00000-0000"
                />
              </div>
              <div>
                <label className="text-xs text-[var(--text-muted)] font-mono uppercase tracking-widest mb-1 block">Observação (Opcional)</label>
                <textarea 
                  value={cliente.observacoes}
                  onChange={(e) => setCliente({...cliente, observacoes: e.target.value})}
                  className="w-full p-3 bg-[var(--bg-surface)] border border-[var(--border)] rounded focus:outline-none focus:border-[var(--cor-primaria)] text-white h-24 resize-none"
                  placeholder="Algum detalhe para o barbeiro?"
                />
              </div>
            </div>

            <button 
              onClick={() => setEtapa(5)}
              disabled={!cliente.nome || !cliente.telefone}
              className="mt-auto flex items-center justify-center gap-2 w-full py-3 bg-[var(--cor-primaria)] hover:bg-[var(--cor-primaria)] disabled:opacity-50 disabled:cursor-not-allowed text-black font-bold uppercase tracking-widest text-sm rounded transition-colors"
            >
              Avançar <ChevronRight size={18} />
            </button>
          </div>
        )}

        {/* ETAPA 5: CONFIRMAÇÃO */}
        {etapa === 5 && (
          <div className="animate-fade-in flex flex-col gap-4 flex-1">
            <button onClick={() => setEtapa(4)} className="text-[var(--text-muted)] flex items-center gap-1 text-sm mb-2 w-fit">
              <ChevronLeft size={16} /> Voltar
            </button>
            <div className="flex items-center gap-2 mb-4">
              <Check className="text-[var(--cor-primaria)]" size={20} />
              <h2 className="text-xl font-bold font-display tracking-wide">Confirmar Agendamento</h2>
            </div>
            
            <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded p-5 space-y-4">
              <div>
                <p className="text-[10px] text-[var(--text-muted)] font-mono uppercase tracking-widest mb-1">Serviço</p>
                <p className="font-bold">{servicoSelecionado?.nome}</p>
                <p className="text-sm text-[var(--cor-primaria)] font-mono">R$ {Number(servicoSelecionado?.preco || 0).toFixed(2)}</p>
              </div>
              <div className="h-px bg-[var(--border)] w-full"></div>
              <div>
                <p className="text-[10px] text-[var(--text-muted)] font-mono uppercase tracking-widest mb-1">Profissional</p>
                <p className="font-bold">{barbeiroId ? barbeiroSelecionado?.usuario.nome : 'Sem preferência (Primeiro disponível)'}</p>
              </div>
              <div className="h-px bg-[var(--border)] w-full"></div>
              <div className="flex gap-8">
                <div>
                  <p className="text-[10px] text-[var(--text-muted)] font-mono uppercase tracking-widest mb-1">Data</p>
                  <p className="font-bold">{new Date(data).toLocaleDateString('pt-BR')}</p>
                </div>
                <div>
                  <p className="text-[10px] text-[var(--text-muted)] font-mono uppercase tracking-widest mb-1">Horário</p>
                  <p className="font-bold">{horario}</p>
                </div>
              </div>
              <div className="h-px bg-[var(--border)] w-full"></div>
              <div>
                <p className="text-[10px] text-[var(--text-muted)] font-mono uppercase tracking-widest mb-1">Seus Dados</p>
                <p className="font-bold">{cliente.nome}</p>
                <p className="text-sm text-[var(--text-muted)]">{cliente.telefone}</p>
              </div>
            </div>

            <button 
              onClick={confirmarAgendamento}
              disabled={carregando}
              className="mt-auto flex items-center justify-center gap-2 w-full py-3 bg-[var(--success-text)] hover:bg-[#2e9c60] text-black font-bold uppercase tracking-widest text-sm rounded transition-colors"
            >
              {carregando ? 'Processando...' : 'Confirmar Agendamento'}
            </button>
          </div>
        )}

        {/* ETAPA 6: SUCESSO */}
        {etapa === 6 && (
          <div className="animate-fade-in flex flex-col items-center justify-center gap-4 flex-1 text-center py-10">
            <CheckCircle size={64} className="text-[var(--success-text)] mb-4" />
            <h2 className="text-2xl font-bold font-display tracking-wide text-white">Agendamento Confirmado!</h2>
            <p className="text-[var(--text-muted)] mb-8">
              Tudo certo, {cliente.nome.split(' ')[0]}! Seu horário foi reservado com sucesso.<br/><br/>
              Te esperamos na <strong>{nomeBarbearia}</strong> dia {new Date(data).toLocaleDateString('pt-BR')} às {horario}.
            </p>

            <button 
              onClick={() => navigate('/fidelidade')}
              className="mt-auto flex items-center justify-center gap-2 w-full py-3 bg-[var(--bg-surface)] border border-[var(--border)] hover:border-[var(--cor-primaria)] text-white font-bold uppercase tracking-widest text-sm rounded transition-colors"
            >
              Ver meus Pontos de Fidelidade
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
