// Aba Agendar — fluxo em etapas: serviço → barbeiro → data/horário → confirmação
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Check, ArrowLeft, Scissors, Star, CheckCircle, CaretDown, CaretUp } from '@phosphor-icons/react';
import clienteApi from '../../../api/clienteApi';
import { hojeBrasilia } from '../../../utils/datas';
import { SkeletonCard, SkeletonText } from '../../../components/ui/Skeleton';

interface Servico { id: string; nome: string; preco: string; duracaoMinutos: number; }
interface Barbeiro { 
  id: string; 
  foto: string | null; 
  usuario: { nome: string }; 
  especialidades: string[]; 
}
interface Slot { horario: string; disponivel: boolean; }

type Etapa = 'servico' | 'barbeiro' | 'data' | 'confirmacao';

export function ClienteBarbeariaAgendar() {
  const { barbeariaId } = useParams<{ barbeariaId: string }>();
  const navigate = useNavigate();
  const [etapa, setEtapa] = useState<Etapa>('servico');
  const [servicos, setServicos] = useState<Servico[]>([]);
  const [barbeiros, setBarbeiros] = useState<Barbeiro[]>([]);
  const [slots, setSlots] = useState<Slot[]>([]);

  const [servicoSel, setServicoSel] = useState<Servico | null>(null);
  const [barbeiroSel, setBarbeiroSel] = useState<Barbeiro | null>(null);
  const [dataSel, setDataSel] = useState('');
  const [horarioSel, setHorarioSel] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [sucesso, setSucesso] = useState(false);
  const [animado, setAnimado] = useState(false);

  const [carregando, setCarregando] = useState(true);
  const [carregandoSlots, setCarregandoSlots] = useState(false);
  const [mostrarTodosServicos, setMostrarTodosServicos] = useState(false);

  useEffect(() => {
    if (barbeariaId) {
      setCarregando(true);
      Promise.allSettled([
        clienteApi.get<Servico[]>(`/cliente/barbearia/${barbeariaId}/servicos`),
        clienteApi.get<Barbeiro[]>(`/cliente/barbearia/${barbeariaId}/barbeiros`)
      ]).then(([resServicos, resBarbeiros]) => {
        if (resServicos.status === 'fulfilled') {
          setServicos(resServicos.value.data);
        }
        if (resBarbeiros.status === 'fulfilled') {
          setBarbeiros(resBarbeiros.value.data);
        }
      }).finally(() => setCarregando(false));
    }
  }, [barbeariaId]);

  useEffect(() => {
    if (dataSel && barbeiroSel && servicoSel && barbeariaId) {
      setCarregandoSlots(true);
      clienteApi.get<Slot[]>(`/cliente/barbearia/${barbeariaId}/horarios-disponiveis`, {
        params: { barbeiroId: barbeiroSel.id, data: dataSel, servicoId: servicoSel.id }
      }).then(r => setSlots(r.data))
        .catch(() => setSlots([]))
        .finally(() => setCarregandoSlots(false));
    }
  }, [dataSel, barbeiroSel, servicoSel, barbeariaId]);

  useEffect(() => {
    if (sucesso) {
      const t = setTimeout(() => setAnimado(true), 10);
      return () => clearTimeout(t);
    }
  }, [sucesso]);

  const fmt = (v: string | number) => Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const hoje = hojeBrasilia();

  async function confirmarAgendamento() {
    if (!servicoSel || !barbeiroSel || !dataSel || !horarioSel) return;
    setEnviando(true);
    try {
      await clienteApi.post(`/cliente/barbearia/${barbeariaId}/agendar`, {
        servicoId: servicoSel.id,
        barbeiroId: barbeiroSel.id,
        data: dataSel,
        hora: horarioSel,
      });
      setSucesso(true);
    } catch { 
      alert('Erro ao realizar o agendamento. Tente outro horário.'); 
    } finally { 
      setEnviando(false); 
    }
  }

  // Lei do Pico-Fim — Tela de Confirmação Dedicada com animação e card de resumo
  if (sucesso) {
    return (
      <div className="flex flex-col items-center justify-center px-6 py-12 animate-fade-in max-w-md mx-auto min-h-[70vh]">
        <div className={`w-24 h-24 rounded-full flex items-center justify-center mb-6 transition-all duration-250 ease-out transform ${animado ? 'scale-100 opacity-100' : 'scale-50 opacity-0'} motion-reduce:transition-none motion-reduce:scale-100 motion-reduce:opacity-100`}
          style={{ background: 'rgba(52, 211, 153, 0.15)', border: '2px solid var(--sucesso)' }}>
          <Check size={44} weight="bold" style={{ color: 'var(--sucesso)' }} />
        </div>
        <h2 style={{ fontFamily: 'var(--fonte-serif)', fontSize: '28px', color: 'var(--text-primary)', marginBottom: '8px', fontWeight: 600, textAlign: 'center' }}>
          Agendamento Confirmado!
        </h2>
        <p style={{ fontFamily: 'var(--fonte-interface)', fontSize: '14px', color: 'var(--text-muted)', textAlign: 'center', marginBottom: '28px' }}>
          Tudo pronto! Te esperamos no dia <span className="font-semibold text-[var(--text-primary)]">{new Date(dataSel + 'T00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })}</span> às <span className="font-semibold text-[var(--amber)]">{horarioSel}</span>.
        </p>

        {/* Card Resumo do Agendamento */}
        <div className="w-full bg-[var(--fundo-sidebar)] border border-[var(--borda)] rounded-lg p-5 mb-8 text-left shadow-md">
          <div className="flex justify-between items-center pb-3 border-b border-[var(--borda)] mb-3">
            <span style={{ fontFamily: 'var(--fonte-interface)', fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Serviço</span>
            <span style={{ fontFamily: 'var(--fonte-interface)', fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>{servicoSel?.nome}</span>
          </div>
          <div className="flex justify-between items-center pb-3 border-b border-[var(--borda)] mb-3">
            <span style={{ fontFamily: 'var(--fonte-interface)', fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Profissional</span>
            <span style={{ fontFamily: 'var(--fonte-interface)', fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>{barbeiroSel?.usuario.nome}</span>
          </div>
          <div className="flex justify-between items-center pb-3 border-b border-[var(--borda)] mb-3">
            <span style={{ fontFamily: 'var(--fonte-interface)', fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Horário</span>
            <span style={{ fontFamily: 'var(--fonte-mono)', fontSize: '14px', fontWeight: 600, color: 'var(--amber)' }}>{horarioSel}</span>
          </div>
          <div className="flex justify-between items-center">
            <span style={{ fontFamily: 'var(--fonte-interface)', fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Valor Total</span>
            <span style={{ fontFamily: 'var(--fonte-mono)', fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>{fmt(servicoSel?.preco || '0')}</span>
          </div>
        </div>

        <button onClick={() => navigate(`/cliente/barbearia/${barbeariaId}`)} className="btn-primary w-full justify-center flex items-center gap-2" style={{ height: '48px', textTransform: 'uppercase', fontSize: '13px', fontWeight: 600, letterSpacing: '0.04em' }}>
          Ver meus agendamentos
        </button>
      </div>
    );
  }

  const etapas = [
    { key: 'servico', label: 'Serviço' },
    { key: 'barbeiro', label: 'Barbeiro' },
    { key: 'data', label: 'Horário' },
    { key: 'confirmacao', label: 'Confirmar' },
  ];
  const etapaIdx = etapas.findIndex(e => e.key === etapa);

  // Lei de Hick — Destaque no topo e máximo 7 opções visíveis
  const servicosExibidos = mostrarTodosServicos ? servicos : servicos.slice(0, 7);
  const temMaisServicos = servicos.length > 7;

  // Lógica do botão de avançar de cada etapa
  const podeAvancar = () => {
    if (etapa === 'servico') return !!servicoSel;
    if (etapa === 'barbeiro') return !!barbeiroSel;
    if (etapa === 'data') return !!dataSel && !!horarioSel;
    return false;
  };

  const proximaEtapa = () => {
    if (etapa === 'servico' && servicoSel) setEtapa('barbeiro');
    if (etapa === 'barbeiro' && barbeiroSel) setEtapa('data');
    if (etapa === 'data' && dataSel && horarioSel) setEtapa('confirmacao');
    if (etapa === 'confirmacao') confirmarAgendamento();
  };

  const getTextoBotao = () => {
    if (etapa === 'servico') return 'Avançar para Barbeiro →';
    if (etapa === 'barbeiro') return 'Avançar para Horário →';
    if (etapa === 'data') return 'Avançar para Resumo →';
    if (etapa === 'confirmacao') return enviando ? 'Confirmando...' : 'Confirmar Agendamento';
    return 'Continuar';
  };

  if (carregando) {
    return (
      <div className="px-5 py-6 animate-fade-in max-w-2xl mx-auto flex flex-col gap-6">
        <SkeletonText lines={2} style={{ width: '60%' }} />
        <SkeletonCard style={{ height: '48px', width: '100%' }} />
        <div className="flex flex-col gap-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <SkeletonCard key={i} style={{ height: '80px', width: '100%' }} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="px-5 py-6 animate-fade-in max-w-2xl mx-auto pb-32 md:pb-12 relative">
      {/* Indicador de Progresso com Efeito Zeigarnik (passo atual e quantos faltam) */}
      <div className="mb-8">
        <div className="flex justify-between items-center mb-2">
          <span style={{ fontFamily: 'var(--fonte-interface)', fontSize: '11px', fontWeight: 600, color: 'var(--amber)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Passo {etapaIdx + 1} de {etapas.length}
          </span>
          <span style={{ fontFamily: 'var(--fonte-interface)', fontSize: '11px', color: 'var(--text-muted)' }}>
            {etapas.length - (etapaIdx + 1) === 0 ? 'Última etapa!' : `Faltam ${etapas.length - (etapaIdx + 1)} passo${etapas.length - (etapaIdx + 1) > 1 ? 's' : ''}`}
          </span>
        </div>

        {/* Stepper Bar Contínuo */}
        <div className="w-full h-2 rounded-full overflow-hidden bg-[var(--fundo-sidebar)] border border-[var(--borda)] relative">
          <div className="h-full transition-all duration-300 ease-out" 
               style={{ background: 'var(--amber)', width: `${((etapaIdx + 1) / etapas.length) * 100}%` }} />
        </div>

        {/* Rótulos das Etapas */}
        <div className="flex justify-between items-center mt-2.5">
          {etapas.map((e, i) => {
            const isAtivo = i <= etapaIdx;
            return (
              <span key={e.key} style={{ 
                fontFamily: 'var(--fonte-interface)', 
                fontSize: '10px', 
                fontWeight: i === etapaIdx ? 700 : isAtivo ? 500 : 400, 
                color: i === etapaIdx ? 'var(--amber)' : isAtivo ? 'var(--text-primary)' : 'var(--text-muted)', 
                textTransform: 'uppercase', 
                letterSpacing: '0.04em' 
              }}>
                {i + 1}. {e.label}
              </span>
            );
          })}
        </div>
      </div>

      {/* Header Contextual por Etapa */}
      <div className="mb-6">
        {etapa !== 'servico' && (
          <button onClick={() => {
            if (etapa === 'barbeiro') setEtapa('servico');
            if (etapa === 'data') setEtapa('barbeiro');
            if (etapa === 'confirmacao') setEtapa('data');
          }} className="flex items-center gap-2 mb-4"
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontFamily: 'var(--fonte-interface)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600 }}>
            <ArrowLeft size={14} /> Voltar uma etapa
          </button>
        )}
        
        <h1 style={{ fontFamily: 'var(--fonte-serif)', fontSize: '24px', fontWeight: 600, color: 'var(--text-primary)' }}>
          {etapa === 'servico' && 'Selecione o serviço que deseja fazer.'}
          {etapa === 'barbeiro' && 'Escolha o profissional de preferência.'}
          {etapa === 'data' && 'Escolha a data e horário ideal.'}
          {etapa === 'confirmacao' && 'Revise e confirme seu agendamento.'}
        </h1>
        
        {etapa === 'servico' && (
          <p className="flex items-center gap-1.5 mt-2" style={{ fontFamily: 'var(--fonte-interface)', fontSize: '12px', color: 'var(--amber)' }}>
            <Star size={14} weight="fill" /> Ganhe pontos no programa de fidelidade a cada atendimento
          </p>
        )}
      </div>

      {/* Conteúdo Etapa 1: Serviço */}
      {etapa === 'servico' && (
        <div className="flex flex-col gap-3">
          {servicosExibidos.map((s, idx) => {
            const isSel = servicoSel?.id === s.id;
            return (
              <button key={s.id} onClick={() => setServicoSel(s)}
                className="flex items-center justify-between p-4 w-full text-left transition-all rounded-md"
                style={{
                  background: isSel ? 'rgba(var(--cor-primaria-rgb), 0.12)' : 'var(--fundo-sidebar)',
                  border: isSel ? '1px solid var(--amber)' : '1px solid var(--borda)',
                  cursor: 'pointer',
                }}>
                <div className="flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${isSel ? 'bg-[var(--amber)] text-[#0a0a0a]' : 'bg-[var(--superficie-2)] text-[var(--text-muted)] border border-[var(--borda)]'}`}>
                    <Scissors size={18} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p style={{ fontFamily: 'var(--fonte-interface)', fontWeight: 600, color: 'var(--text-primary)', fontSize: '15px' }}>{s.nome}</p>
                      {idx === 0 && <span className="bg-[var(--amber)] text-black text-[9px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded-sm">Mais popular</span>}
                    </div>
                    <p style={{ fontFamily: 'var(--fonte-interface)', fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>{s.duracaoMinutos} min de duração</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span style={{ fontFamily: 'var(--fonte-mono)', fontSize: '15px', color: 'var(--text-primary)', fontWeight: 600 }}>{fmt(s.preco)}</span>
                  {isSel && <CheckCircle size={20} weight="fill" style={{ color: 'var(--amber)' }} />}
                </div>
              </button>
            );
          })}

          {temMaisServicos && (
            <button
              onClick={() => setMostrarTodosServicos(!mostrarTodosServicos)}
              className="w-full py-3 mt-2 flex items-center justify-center gap-2 rounded-md border border-[var(--borda)] bg-[var(--superficie-1)] hover:bg-[var(--superficie-2)] transition-colors"
              style={{ fontFamily: 'var(--fonte-interface)', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}
            >
              {mostrarTodosServicos ? (
                <>Ver menos opções <CaretUp size={14} /></>
              ) : (
                <>Ver mais {servicos.length - 7} serviços <CaretDown size={14} /></>
              )}
            </button>
          )}
        </div>
      )}

      {/* Conteúdo Etapa 2: Barbeiro */}
      {etapa === 'barbeiro' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {barbeiros.map(b => {
            const isSel = barbeiroSel?.id === b.id;
            return (
              <button key={b.id} onClick={() => setBarbeiroSel(b)}
                className="flex items-center justify-between p-4 w-full text-left transition-all rounded-md"
                style={{
                  background: isSel ? 'rgba(var(--cor-primaria-rgb), 0.12)' : 'var(--fundo-sidebar)',
                  border: isSel ? '1px solid var(--amber)' : '1px solid var(--borda)',
                  cursor: 'pointer',
                }}>
                <div className="flex items-center gap-4">
                  {b.foto ? (
                    <img 
                      src={b.foto} 
                      alt={b.usuario.nome} 
                      className="w-12 h-12 rounded-full object-cover border border-[var(--borda)]"
                    />
                  ) : (
                    <div className="w-12 h-12 flex items-center justify-center rounded-full bg-[var(--superficie-2)] border border-[var(--borda)] text-[var(--text-primary)] font-semibold font-interface">
                      {b.usuario.nome.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)}
                    </div>
                  )}
                  <div>
                    <p style={{ fontFamily: 'var(--fonte-interface)', fontWeight: 600, color: 'var(--text-primary)', fontSize: '15px' }}>{b.usuario.nome}</p>
                    <div className="flex gap-1.5 mt-1.5 flex-wrap">
                      {b.especialidades.slice(0, 2).map((e, i) => (
                        <span key={i} style={{ fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.04em', background: 'var(--superficie-1)', padding: '2px 6px', borderRadius: '4px', border: '1px solid var(--borda)', color: 'var(--text-muted)' }}>{e}</span>
                      ))}
                    </div>
                  </div>
                </div>
                {isSel && <CheckCircle size={20} weight="fill" style={{ color: 'var(--amber)' }} />}
              </button>
            );
          })}
        </div>
      )}

      {/* Conteúdo Etapa 3: Data e Horário */}
      {etapa === 'data' && (
        <div>
          <div className="mb-6 p-4 rounded-md" style={{ background: 'var(--fundo-sidebar)', border: '1px solid var(--borda)' }}>
            <label className="block mb-2" style={{ fontFamily: 'var(--fonte-interface)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)', fontWeight: 600 }}>Escolha a Data</label>
            <input type="date" value={dataSel} onChange={e => { setDataSel(e.target.value); setHorarioSel(''); }}
              min={hoje} className="w-full bg-[var(--fundo-input)] border border-[var(--borda)] rounded p-3 text-[var(--text-primary)] font-interface focus:outline-none focus:border-[var(--amber)] transition-colors outline-none" style={{ fontFamily: 'var(--fonte-mono)' }} />
          </div>

          {dataSel && (
            <div>
              <label className="block mb-3" style={{ fontFamily: 'var(--fonte-interface)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)', fontWeight: 600 }}>Horários Disponíveis</label>
              {carregandoSlots ? (
                <div className="grid grid-cols-4 md:grid-cols-5 gap-2">
                  {Array.from({ length: 10 }).map((_, i) => (
                    <SkeletonCard key={i} style={{ height: '44px', width: '100%' }} />
                  ))}
                </div>
              ) : slots.length > 0 ? (
                <div className="grid grid-cols-4 md:grid-cols-5 gap-2">
                  {slots.map(s => (
                    <button key={s.horario}
                      disabled={!s.disponivel}
                      onClick={() => setHorarioSel(s.horario)}
                      style={{
                        padding: '12px 4px',
                        fontFamily: 'var(--fonte-mono)',
                        fontSize: '14px',
                        textAlign: 'center',
                        cursor: s.disponivel ? 'pointer' : 'not-allowed',
                        background: horarioSel === s.horario ? 'var(--amber)' : s.disponivel ? 'var(--fundo-sidebar)' : 'transparent',
                        color: horarioSel === s.horario ? '#0A0A0A' : s.disponivel ? 'var(--text-primary)' : 'var(--text-disabled)',
                        border: horarioSel === s.horario ? '1px solid var(--amber)' : s.disponivel ? '1px solid var(--borda)' : '1px dashed var(--borda)',
                        opacity: s.disponivel ? 1 : 0.3,
                        borderRadius: '6px',
                        fontWeight: 600
                      }}>
                      {s.horario}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="p-6 text-center border border-dashed border-[var(--borda)] rounded-md">
                  <p style={{ fontFamily: 'var(--fonte-interface)', fontSize: '13px', color: 'var(--text-muted)' }}>Nenhum horário disponível nesta data. Tente outro dia.</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Conteúdo Etapa 4: Confirmação (Recibo Elegante) */}
      {etapa === 'confirmacao' && (
        <div className="w-full max-w-md mx-auto">
          <div className="rounded-t-lg p-6 relative overflow-hidden" style={{ background: 'var(--fundo-sidebar)', border: '1px solid var(--borda)', borderBottom: 'none' }}>
            <div className="absolute top-0 left-0 right-0 h-1 bg-[var(--amber)]" />
            <h3 style={{ fontFamily: 'var(--fonte-interface)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.2em', color: 'var(--text-muted)', textAlign: 'center', marginBottom: '24px', fontWeight: 600 }}>
              Resumo do Agendamento
            </h3>

            <div className="flex flex-col gap-5">
              <div className="flex justify-between items-start">
                <div>
                  <p style={{ fontFamily: 'var(--fonte-interface)', fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '2px', fontWeight: 600 }}>Serviço</p>
                  <p style={{ fontFamily: 'var(--fonte-interface)', fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)' }}>{servicoSel?.nome}</p>
                </div>
                <p style={{ fontFamily: 'var(--fonte-mono)', fontSize: '16px', color: 'var(--text-primary)', fontWeight: 700 }}>{fmt(servicoSel?.preco || '0')}</p>
              </div>

              <div className="flex justify-between items-start">
                <div>
                  <p style={{ fontFamily: 'var(--fonte-interface)', fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '2px', fontWeight: 600 }}>Profissional</p>
                  <p style={{ fontFamily: 'var(--fonte-interface)', fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)' }}>{barbeiroSel?.usuario.nome}</p>
                </div>
              </div>

              <div className="flex justify-between items-start">
                <div>
                  <p style={{ fontFamily: 'var(--fonte-interface)', fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '2px', fontWeight: 600 }}>Data</p>
                  <p className="capitalize" style={{ fontFamily: 'var(--fonte-interface)', fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)' }}>
                    {new Date(dataSel + 'T00:00').toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' })}
                  </p>
                </div>
                <div className="text-right">
                  <p style={{ fontFamily: 'var(--fonte-interface)', fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '2px', fontWeight: 600 }}>Horário</p>
                  <p style={{ fontFamily: 'var(--fonte-mono)', fontSize: '16px', color: 'var(--amber)', fontWeight: 700 }}>{horarioSel}</p>
                </div>
              </div>
            </div>
          </div>
          
          {/* Efeito serrilhado (recibo) */}
          <div className="w-full flex">
            {Array.from({ length: 24 }).map((_, i) => (
              <div key={i} className="flex-1 h-2" style={{ 
                background: 'var(--fundo-pagina)', 
                clipPath: 'polygon(0 0, 50% 100%, 100% 0)',
                marginTop: '-1px'
              }} />
            ))}
          </div>
        </div>
      )}

      {/* Botão Fixo no Mobile (Lei de Fitts: altura 48px, largura total na parte inferior) */}
      <div className="md:hidden fixed left-0 right-0 p-4 bg-[var(--fundo-superficie)] border-t border-[var(--borda)] shadow-2xl flex items-center justify-center"
        style={{
          bottom: 'calc(64px + env(safe-area-inset-bottom, 0px))',
          zIndex: 49,
        }}>
        <button
          onClick={proximaEtapa}
          disabled={!podeAvancar() && etapa !== 'confirmacao' || (etapa === 'confirmacao' && enviando)}
          className="btn-primary w-full justify-center flex items-center gap-2"
          style={{ height: '48px', fontSize: '13px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}
        >
          {getTextoBotao()}
        </button>
      </div>

      {/* Botão no Desktop */}
      <div className="hidden md:flex justify-end mt-8 pt-4 border-t border-[var(--borda)]">
        <button
          onClick={proximaEtapa}
          disabled={!podeAvancar() && etapa !== 'confirmacao' || (etapa === 'confirmacao' && enviando)}
          className="btn-primary justify-center flex items-center gap-2 px-8"
          style={{ height: '48px', fontSize: '13px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}
        >
          {getTextoBotao()}
        </button>
      </div>
    </div>
  );
}
