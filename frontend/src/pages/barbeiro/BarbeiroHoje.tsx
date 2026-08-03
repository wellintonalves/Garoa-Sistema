import { useState, useEffect } from 'react';
import { useOutletContext, useNavigate } from 'react-router-dom';
import { Check, Clock, Scissors, Calendar, Plus, Prohibit as Ban, TrendUp as TrendingUp, CurrencyDollar as DollarSign, Users, Briefcase } from '@phosphor-icons/react';
import { formatarNomeServico } from '../../utils/formato';
import barbeiroApi from '../../api/barbeiroApi';
import { ModalConcluirServico } from '../../components/ModalConcluirServico';

// Interfaces
interface AgendamentoHoje {
  id: string;
  dataHora: string;
  status: string;
  valorCobrado: string;
  servico: { nome: string; duracaoMinutos: number };
  cliente: { usuario: { nome: string } };
}

interface ResumoDia {
  data: string;
  atendimentos: number;
}

export function BarbeiroHoje() {
  const { barbeiro } = useOutletContext<{ barbeiro: { id: string; nome: string; comissaoPercent: number } }>();
  const navigate = useNavigate();
  
  const [agendamentos, setAgendamentos] = useState<AgendamentoHoje[]>([]);
  const [resumoSemana, setResumoSemana] = useState<ResumoDia[]>([]);
  const [carregando, setCarregando] = useState(true);
  
  const [trabalhandoAgora, setTrabalhandoAgora] = useState(false);
  const [atualizandoStatus, setAtualizandoStatus] = useState(false);

  const [concluindoAg, setConcluindoAg] = useState<AgendamentoHoje | null>(null);
  const [sucessoMsg, setSucessoMsg] = useState('');
  const [erroMsg, setErroMsg] = useState('');

  const mostrarErro = (msg: string) => {
    setErroMsg(msg);
    setTimeout(() => setErroMsg(''), 4000);
  };
  const mostrarSucesso = (msg: string) => {
    setSucessoMsg(msg);
    setTimeout(() => setSucessoMsg(''), 3000);
  };

  useEffect(() => {
    carregarDados();
  }, []);

  async function carregarDados() {
    setCarregando(true);
    try {
      const [agendaRes, perfilRes, resumoRes] = await Promise.all([
        barbeiroApi.get<AgendamentoHoje[]>('/barbeiro/agenda-hoje'),
        barbeiroApi.get('/barbeiro/perfil'),
        barbeiroApi.get<ResumoDia[]>('/barbeiro/resumo-semana')
      ]);
      setAgendamentos(agendaRes.data);
      setTrabalhandoAgora(perfilRes.data.trabalhandoAgora);
      setResumoSemana(resumoRes.data);
    } catch { 
      mostrarErro('Erro ao carregar dados do dia');
    } finally { 
      setCarregando(false); 
    }
  }

  async function toggleTrabalhando() {
    setAtualizandoStatus(true);
    try {
      const novoStatus = !trabalhandoAgora;
      await barbeiroApi.patch('/barbeiro/status-trabalho', { trabalhandoAgora: novoStatus });
      setTrabalhandoAgora(novoStatus);
    } catch (err: any) {
      mostrarErro(err.response?.data?.erro || 'Erro ao atualizar status');
    } finally {
      setAtualizandoStatus(false);
    }
  }

  async function confirmarConclusao(dados: any) {
    if (!concluindoAg) return;
    setErroMsg('');
    try {
      await barbeiroApi.post(`/barbeiro/concluir-agendamento/${concluindoAg.id}`, dados);
      await carregarDados();
      setConcluindoAg(null);
      mostrarSucesso(`Atendimento concluído com sucesso!`);
    } catch (err: any) {
      setErroMsg(err.response?.data?.erro || 'Erro ao concluir');
    }
  }

  // Cálculos KPIs
  const concluidos = agendamentos.filter(a => a.status === 'CONCLUIDO');
  const pendentes = agendamentos.filter(a => a.status === 'AGUARDANDO' || a.status === 'CONFIRMADO');
  
  const faturamentoHoje = concluidos.reduce((acc, a) => acc + Number(a.valorCobrado), 0);
  const comissaoPercent = barbeiro?.comissaoPercent || 50;
  const comissaoHoje = (faturamentoHoje * comissaoPercent) / 100;

  // Calculando ocupação (estimada para 8 horas de trabalho se não houver horário específico, 8 * 60 = 480 min)
  const tempoOcupado = agendamentos.reduce((acc, a) => acc + a.servico.duracaoMinutos, 0);
  const ocupacaoPercent = Math.min(100, Math.round((tempoOcupado / 480) * 100));

  const fmtHora = (d: string) => new Date(d).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  const dataHojeExtenso = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date());

  // Max atendimentos na semana para o gráfico
  const maxAtendimentos = Math.max(...resumoSemana.map(d => d.atendimentos), 1);

  return (
    <div className="px-4 py-6 md:px-8 max-w-7xl mx-auto animate-fade-in" style={{ fontFamily: 'var(--fonte-interface)' }}>
      {/* Feedbacks */}
      {sucessoMsg && (
        <div className="bg-[var(--sucesso-fundo)] text-[var(--sucesso)] p-3 rounded-lg mb-4 text-sm font-medium border border-[var(--sucesso)]">
          {sucessoMsg}
        </div>
      )}
      {erroMsg && !concluindoAg && (
        <div className="bg-[var(--perigo-fundo)] text-[var(--perigo)] p-3 rounded-lg mb-4 text-sm font-medium border border-[var(--perigo)]">
          {erroMsg}
        </div>
      )}

      {/* Header */}
      <div className="flex justify-between items-start mb-8">
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold" style={{ color: 'var(--text-primary)' }}>
            Olá, {barbeiro?.nome.split(' ')[0]}
          </h1>
          <p className="text-sm mt-1 capitalize" style={{ color: 'var(--texto-secundario)' }}>
            {dataHojeExtenso}
          </p>
        </div>
        
        <div className="flex flex-col items-center p-2 rounded-xl border" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)' }}>
          <label className="relative inline-flex items-center cursor-pointer">
            <input type="checkbox" className="sr-only peer" checked={trabalhandoAgora} onChange={toggleTrabalhando} disabled={atualizandoStatus} />
            <div className="w-11 h-6 bg-[var(--superficie-2)] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-[var(--borda)] after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-[var(--superficie)] after:border-[var(--borda)] after:border after:rounded-full after:h-5 after:w-5 after:transition-all" style={{ backgroundColor: trabalhandoAgora ? 'var(--cor-primaria)' : '' }}></div>
          </label>
          <span className="text-xs font-medium mt-1" style={{ color: trabalhandoAgora ? 'var(--cor-primaria)' : 'var(--texto-secundario)' }}>
            {trabalhandoAgora ? 'Disponível' : 'Ausente'}
          </span>
        </div>
      </div>

      {carregando ? (
        <div className="flex justify-center py-20" style={{ color: 'var(--texto-secundario)' }}>
          <Clock className="animate-spin mr-2" /> Carregando seu dia...
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Coluna Esquerda: KPIs e Ações */}
          <div className="lg:col-span-1 space-y-6">
            {/* KPIs Grid */}
            <div className="grid grid-cols-2 gap-3">
              <div className="p-4 rounded-2xl border" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)' }}>
                <div className="flex justify-between items-start mb-2">
                  <div className="p-2 rounded-lg" style={{ background: 'var(--bg-surface2)' }}>
                    <Users size={16} style={{ color: 'var(--cor-primaria)' }} />
                  </div>
                </div>
                <p className="text-2xl font-semibold" style={{ color: 'var(--text-primary)' }}>{concluidos.length}</p>
                <p className="text-xs mt-1" style={{ color: 'var(--texto-secundario)' }}>Atendimentos</p>
              </div>

              <div className="p-4 rounded-2xl border" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)' }}>
                <div className="flex justify-between items-start mb-2">
                  <div className="p-2 rounded-lg" style={{ background: 'var(--bg-surface2)' }}>
                    <DollarSign size={16} style={{ color: 'var(--cor-primaria)' }} />
                  </div>
                </div>
                <p className="text-2xl font-semibold" style={{ color: 'var(--text-primary)' }}>R$ {faturamentoHoje.toFixed(0)}</p>
                <p className="text-xs mt-1" style={{ color: 'var(--texto-secundario)' }}>Faturamento</p>
              </div>

              <div className="p-4 rounded-2xl border" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)' }}>
                <div className="flex justify-between items-start mb-2">
                  <div className="p-2 rounded-lg" style={{ background: 'var(--bg-surface2)' }}>
                    <Briefcase size={16} style={{ color: 'var(--cor-primaria)' }} />
                  </div>
                </div>
                <p className="text-2xl font-semibold" style={{ color: 'var(--text-primary)' }}>R$ {comissaoHoje.toFixed(0)}</p>
                <p className="text-xs mt-1" style={{ color: 'var(--texto-secundario)' }}>Sua Comissão</p>
              </div>

              <div className="p-4 rounded-2xl border" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)' }}>
                <div className="flex justify-between items-start mb-2">
                  <div className="p-2 rounded-lg" style={{ background: 'var(--bg-surface2)' }}>
                    <TrendingUp size={16} style={{ color: 'var(--cor-primaria)' }} />
                  </div>
                </div>
                <p className="text-2xl font-semibold" style={{ color: 'var(--text-primary)' }}>{ocupacaoPercent}%</p>
                <p className="text-xs mt-1" style={{ color: 'var(--texto-secundario)' }}>Ocupação (Est.)</p>
              </div>
            </div>

            {/* Ações Rápidas */}
            <div className="rounded-2xl border overflow-hidden" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)' }}>
              <h3 className="text-sm font-medium p-4 border-b" style={{ borderColor: 'var(--border)', color: 'var(--text-primary)' }}>
                Ações Rápidas
              </h3>
              <div className="flex flex-col">
                <button onClick={() => navigate('/barbeiro/agenda')} className="flex items-center gap-3 p-4 text-left transition-colors text-sm hover:bg-[var(--superficie)]" style={{ color: 'var(--text-primary)' }}>
                  <Calendar size={18} style={{ color: 'var(--cor-primaria)' }} />
                  Ver agenda completa
                </button>
                <button disabled className="flex items-center gap-3 p-4 text-left transition-colors text-sm border-t opacity-60 hover:bg-[var(--superficie)]" style={{ borderColor: 'var(--border)', color: 'var(--texto-secundario)' }}>
                  <Plus size={18} />
                  Atendimento avulso (em breve)
                </button>
                <button disabled className="flex items-center gap-3 p-4 text-left transition-colors text-sm border-t opacity-60 hover:bg-[var(--superficie)]" style={{ borderColor: 'var(--border)', color: 'var(--texto-secundario)' }}>
                  <Ban size={18} />
                  Bloquear horário (em breve)
                </button>
              </div>
            </div>

            {/* Resumo da Semana (Gráfico simples) */}
            <div className="p-5 rounded-2xl border" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)' }}>
              <h3 className="text-sm font-medium mb-4" style={{ color: 'var(--text-primary)' }}>Evolução (7 dias)</h3>
              <div className="flex items-end justify-between h-32 gap-2">
                {resumoSemana.map((dia, idx) => {
                  const dataObj = new Date(dia.data + 'T12:00:00');
                  const diaSemana = new Intl.DateTimeFormat('pt-BR', { weekday: 'short' }).format(dataObj);
                  const altura = Math.max((dia.atendimentos / maxAtendimentos) * 100, 5); // min 5% height
                  return (
                    <div key={idx} className="flex flex-col items-center flex-1 gap-2">
                      <div className="w-full rounded-t-sm flex items-end relative overflow-hidden" style={{ height: '100%', background: 'var(--bg-surface2)' }}>
                        <div 
                          className="w-full opacity-80 rounded-t-sm transition-all duration-500" 
                          style={{ height: `${altura}%`, background: 'var(--cor-primaria)' }}
                        />
                      </div>
                      <span className="text-[10px] capitalize" style={{ color: 'var(--texto-secundario)' }}>{diaSemana.substring(0,3)}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Coluna Direita: Agenda do Dia */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* Próximos Atendimentos */}
            <div>
              <h2 className="text-sm font-medium mb-4 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                Próximos Atendimentos 
                <span className="text-[var(--texto-principal)] text-xs px-2 py-0.5 rounded-full" style={{ background: 'var(--cor-primaria)' }}>{pendentes.length}</span>
              </h2>
              
              {pendentes.length === 0 ? (
                <div className="p-10 rounded-2xl border text-center flex flex-col items-center justify-center" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)' }}>
                  <div className="w-16 h-16 rounded-full flex items-center justify-center mb-4" style={{ background: 'var(--bg-surface2)' }}>
                    <Scissors size={28} style={{ color: 'var(--texto-secundario)' }} />
                  </div>
                  <p className="font-medium" style={{ color: 'var(--text-primary)' }}>Sua agenda está livre</p>
                  <p className="text-sm mt-1" style={{ color: 'var(--texto-secundario)' }}>Aproveite para organizar suas ferramentas ou tomar um café.</p>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {pendentes.map(a => (
                    <div key={a.id} className="p-5 rounded-2xl border-l-4 shadow-sm" style={{ background: 'var(--bg-surface)', borderLeftColor: 'var(--cor-primaria)', borderTop: '1px solid var(--border)', borderRight: '1px solid var(--border)', borderBottom: '1px solid var(--border)' }}>
                      <div className="flex justify-between items-start mb-4">
                        <div className="flex items-center gap-3">
                          <div className="px-3 py-1.5 rounded-lg flex items-center gap-2" style={{ background: 'var(--bg-surface2)' }}>
                            <Clock size={14} style={{ color: 'var(--cor-primaria)' }} />
                            <span className="font-semibold text-lg" style={{ color: 'var(--text-primary)' }}>
                              {fmtHora(a.dataHora)}
                            </span>
                          </div>
                          <span className="text-xs px-2 py-1 rounded" style={{ background: 'var(--bg-surface2)', color: 'var(--texto-secundario)' }}>{a.servico.duracaoMinutos} min</span>
                        </div>
                      </div>
                      
                      <div className="mb-5 pl-1">
                        <p className="font-semibold text-lg mb-1" style={{ color: 'var(--text-primary)' }}>
                          {a.cliente.usuario.nome}
                        </p>
                        <p className="text-sm" style={{ color: 'var(--texto-secundario)' }}>
                          {formatarNomeServico(a)} • R$ {Number(a.valorCobrado).toFixed(2)}
                        </p>
                      </div>

                      <button 
                        onClick={() => {
                          setConcluindoAg(a);
                          setErroMsg('');
                        }}
                        className="w-full py-3 px-4 text-[var(--texto-principal)] font-medium rounded-xl text-sm flex items-center justify-center gap-2 hover:opacity-90 transition-opacity"
                        style={{ background: 'var(--cor-primaria)' }}
                      >
                        <Check size={16} /> Concluir Atendimento
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Concluídos */}
            {concluidos.length > 0 && (
              <div className="pt-4">
                <h2 className="text-sm font-medium mb-3 flex items-center gap-2" style={{ color: 'var(--texto-secundario)' }}>
                  Concluídos Hoje
                  <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'var(--bg-surface2)', color: 'var(--texto-secundario)' }}>{concluidos.length}</span>
                </h2>
                <div className="flex flex-col gap-2 opacity-75">
                  {concluidos.map(a => (
                    <div key={a.id} className="flex justify-between items-center p-4 rounded-xl border" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)' }}>
                      <div className="flex items-center gap-4">
                        <span className="text-sm font-medium w-12" style={{ color: 'var(--texto-secundario)' }}>
                          {fmtHora(a.dataHora)}
                        </span>
                        <div>
                          <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                            {a.cliente.usuario.nome}
                          </p>
                          <p className="text-xs mt-0.5" style={{ color: 'var(--texto-secundario)' }}>
                            {formatarNomeServico(a)}
                          </p>
                        </div>
                      </div>
                      <div className="bg-[var(--sucesso-fundo)] p-1.5 rounded-full">
                        <Check size={14} className="text-[var(--sucesso)]" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
          </div>
        </div>
      )}

      {/* Modal Conclusão */}
      <ModalConcluirServico 
        aberto={!!concluindoAg} 
        onFechar={() => setConcluindoAg(null)} 
        agendamento={concluindoAg as any}
        onConfirmar={confirmarConclusao}
      />
    </div>
  );
}
