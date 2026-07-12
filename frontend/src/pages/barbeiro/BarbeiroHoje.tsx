// Aba Hoje do barbeiro — agenda do dia atual e conclusão de atendimentos
import { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Check, Clock, Scissors } from 'lucide-react';
import barbeiroApi from '../../api/barbeiroApi';
import { Modal } from '../../components/Modal';

interface AgendamentoHoje {
  id: string;
  dataHora: string;
  status: string;
  valorCobrado: string;
  servico: { nome: string; duracaoMinutos: number };
  cliente: { usuario: { nome: string } };
}

export function BarbeiroHoje() {
  const { barbeiro } = useOutletContext<{ barbeiro: { nome: string } }>();
  const [agendamentos, setAgendamentos] = useState<AgendamentoHoje[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [concluindoId, setConcluindoId] = useState<string | null>(null);
  const [trabalhandoAgora, setTrabalhandoAgora] = useState(false);
  const [atualizandoStatus, setAtualizandoStatus] = useState(false);

  // Modal states
  const [concluindoAg, setConcluindoAg] = useState<AgendamentoHoje | null>(null);
  const [formaPagamento, setFormaPagamento] = useState('PIX');

  // In-app feedback messages
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
    carregarAgenda();
  }, []);

  async function carregarAgenda() {
    try {
      const res = await barbeiroApi.get<AgendamentoHoje[]>('/barbeiro/agenda-hoje');
      setAgendamentos(res.data);
      const perfilRes = await barbeiroApi.get('/barbeiro/perfil');
      setTrabalhandoAgora(perfilRes.data.trabalhandoAgora);
    } catch { /* empty */ }
    finally { setCarregando(false); }
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

  async function confirmarConclusao() {
    if (!concluindoAg) return;
    
    setConcluindoId(concluindoAg.id);
    setErroMsg(''); // limpa erro modal se houver
    
    try {
      await barbeiroApi.post(`/barbeiro/concluir-agendamento/${concluindoAg.id}`, { formaPagamento });
      await carregarAgenda();
      setConcluindoAg(null);
      mostrarSucesso(`Atendimento concluído com sucesso!`);
    } catch (err: any) {
      setErroMsg(err.response?.data?.erro || 'Erro ao concluir');
    } finally {
      setConcluindoId(null);
    }
  }

  const fmtHora = (d: string) => new Date(d).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  
  const pendentes = agendamentos.filter(a => a.status === 'AGUARDANDO' || a.status === 'CONFIRMADO');
  const concluidos = agendamentos.filter(a => a.status === 'CONCLUIDO');

  return (
    <div className="px-5 py-6 animate-fade-in">
      {/* Toast In-App */}
      {sucessoMsg && (
        <div style={{ background: 'var(--success-text)', color: '#000', padding: '12px', marginBottom: '16px', fontSize: '13px', fontWeight: 600 }}>
          {sucessoMsg}
        </div>
      )}
      {erroMsg && !concluindoAg && ( // Não mostra toast global se o erro for do modal
        <div style={{ background: 'var(--danger-text)', color: '#fff', padding: '12px', marginBottom: '16px', fontSize: '13px', fontWeight: 600 }}>
          {erroMsg}
        </div>
      )}

      {/* Header */}
      <div className="mb-8 flex justify-between items-start">
        <div>
          <p style={{ fontFamily: 'var(--fonte-interface)', fontSize: '10px', color: 'var(--cor-icone)', letterSpacing: '0.15em', textTransform: '' }}>
            Hoje
          </p>
          <h1 style={{ fontFamily: 'var(--fonte-interface)', fontSize: '28px', color: 'var(--text-primary)', letterSpacing: '0.04em' }}>
            Olá, {barbeiro?.nome.split(' ')[0]}
          </h1>
        </div>
        
        <div className="flex flex-col items-center">
          <label className="relative inline-flex items-center cursor-pointer">
            <input type="checkbox" value="" className="sr-only peer" checked={trabalhandoAgora} onChange={toggleTrabalhando} disabled={atualizandoStatus} />
            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-500"></div>
          </label>
          <span className="text-[9px]  tracking-wider mt-1" style={{ color: trabalhandoAgora ? 'var(--success-text, #22c55e)' : 'var(--text-muted)' }}>
            {trabalhandoAgora ? 'Trabalhando' : 'Ausente'}
          </span>
        </div>
      </div>

      {carregando ? (
        <p style={{ textAlign: 'center', color: 'var(--text-muted)' }}>Carregando...</p>
      ) : (
        <>
          {/* Pendentes */}
          <div className="mb-8">
            <h2 style={{ fontFamily: 'var(--fonte-interface)', fontSize: '10px', letterSpacing: '0.18em', textTransform: '', color: 'var(--cor-icone)', marginBottom: '12px' }}>
              Próximos Atendimentos ({pendentes.length})
            </h2>
            
            {pendentes.length === 0 ? (
              <div className="p-6 text-center" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
                <Scissors size={24} style={{ color: 'var(--text-disabled)', margin: '0 auto 8px' }} />
                <p style={{ fontFamily: 'var(--fonte-interface)', fontSize: '14px', color: 'var(--text-muted)' }}>Sua agenda está livre.</p>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {pendentes.map(a => (
                  <div key={a.id} className="p-4" style={{ background: 'var(--bg-surface)', border: '1px solid var(--amber)' }}>
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex items-center gap-2">
                        <Clock size={14} style={{ color: 'var(--cor-icone)' }} />
                        <span style={{ fontFamily: 'var(--fonte-interface)', fontSize: '20px', color: 'var(--cor-icone)' }}>
                          {fmtHora(a.dataHora)}
                        </span>
                      </div>
                      <span className="badge badge-info">{a.servico.duracaoMinutos} min</span>
                    </div>
                    
                    <div className="mb-4">
                      <p style={{ fontFamily: 'var(--fonte-interface)', fontWeight: 700, fontSize: '16px', color: 'var(--text-primary)' }}>
                        {a.cliente.usuario.nome}
                      </p>
                      <p style={{ fontFamily: 'var(--fonte-numeros)', fontSize: '11px', color: 'var(--text-muted)' }}>
                        {a.servico.nome} — R$ {Number(a.valorCobrado).toFixed(2)}
                      </p>
                    </div>

                    <button 
                      onClick={() => {
                        setConcluindoAg(a);
                        setFormaPagamento('PIX');
                        setErroMsg('');
                      }}
                      className="btn-primary w-full justify-center"
                      style={{ padding: '12px', fontSize: '12px' }}
                    >
                      <Check size={14} /> Concluir Atendimento
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Concluídos */}
          {concluidos.length > 0 && (
            <div>
              <h2 style={{ fontFamily: 'var(--fonte-interface)', fontSize: '10px', letterSpacing: '0.18em', textTransform: '', color: 'var(--text-muted)', marginBottom: '12px' }}>
                Concluídos ({concluidos.length})
              </h2>
              <div className="flex flex-col gap-2">
                {concluidos.map(a => (
                  <div key={a.id} className="flex justify-between items-center p-3" style={{ background: 'var(--bg-surface2)', border: '1px solid var(--border)', opacity: 0.7 }}>
                    <div className="flex items-center gap-3">
                      <span style={{ fontFamily: 'var(--fonte-numeros)', fontSize: '12px', color: 'var(--text-muted)' }}>
                        {fmtHora(a.dataHora)}
                      </span>
                      <div>
                        <p style={{ fontFamily: 'var(--fonte-interface)', fontSize: '13px', color: 'var(--text-primary)' }}>
                          {a.cliente.usuario.nome}
                        </p>
                        <p style={{ fontFamily: 'var(--fonte-interface)', fontSize: '10px', color: 'var(--text-muted)' }}>
                          {a.servico.nome}
                        </p>
                      </div>
                    </div>
                    <Check size={16} style={{ color: 'var(--success-text)' }} />
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Modal Conclusão */}
      <Modal 
        aberto={!!concluindoAg} 
        onFechar={() => setConcluindoAg(null)} 
        titulo="Concluir Atendimento"
      >
        {concluindoAg && (
          <div className="flex flex-col gap-4">
            <div style={{ background: 'var(--bg-surface2)', padding: '12px', border: '1px solid var(--border)' }}>
              <p style={{ fontFamily: 'var(--fonte-interface)', fontSize: '14px', color: 'var(--text-primary)', marginBottom: '4px' }}>
                {concluindoAg.cliente.usuario.nome}
              </p>
              <p style={{ fontFamily: 'var(--fonte-numeros)', fontSize: '12px', color: 'var(--text-muted)' }}>
                {concluindoAg.servico.nome} — <strong>R$ {Number(concluindoAg.valorCobrado).toFixed(2)}</strong>
              </p>
            </div>

            {erroMsg && (
              <div style={{ color: 'var(--danger-text)', fontSize: '13px', padding: '8px', border: '1px solid var(--danger-text)' }}>
                {erroMsg}
              </div>
            )}

            <div className="input-group">
              <label>Forma de Pagamento</label>
              <select 
                value={formaPagamento} 
                onChange={e => setFormaPagamento(e.target.value)}
                disabled={!!concluindoId}
              >
                <option value="DINHEIRO">Dinheiro</option>
                <option value="PIX">PIX</option>
                <option value="CARTAO_DEBITO">Cartão de Débito</option>
                <option value="CARTAO_CREDITO">Cartão de Crédito</option>
              </select>
            </div>

            <button 
              onClick={confirmarConclusao}
              disabled={!!concluindoId}
              className="btn-primary w-full justify-center mt-2"
              style={{ padding: '12px' }}
            >
              {concluindoId ? 'Confirmando...' : 'Confirmar conclusão'}
            </button>
          </div>
        )}
      </Modal>
    </div>
  );
}
