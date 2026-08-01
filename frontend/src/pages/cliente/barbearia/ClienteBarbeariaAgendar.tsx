// Aba Agendar — fluxo em etapas: serviço → barbeiro → data/horário → confirmação
import { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { Check, ArrowLeft, Scissors, Star, CheckCircle, CaretDown, CaretUp } from '@phosphor-icons/react';
import { ModalAlert } from '../../../components/ModalAlert';
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
  const [servicoPopularId, setServicoPopularId] = useState<string | null>(null);

  const [servicosSel, setServicosSel] = useState<Servico[]>([]);
  const [barbeiroSel, setBarbeiroSel] = useState<Barbeiro | null>(null);
  const [dataSel, setDataSel] = useState('');
  const [horarioSel, setHorarioSel] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [sucesso, setSucesso] = useState(false);
  const [animado, setAnimado] = useState(false);

  const [carregando, setCarregando] = useState(true);
  const [carregandoSlots, setCarregandoSlots] = useState(false);
  const [mostrarTodosServicos, setMostrarTodosServicos] = useState(false);

  const [searchParams] = useSearchParams();
  const isFluxoRapido = searchParams.get('fluxoRapido') === 'true' || searchParams.get('fluxoRapido') === '1';
  const preServicoId = searchParams.get('servicoId');
  const preBarbeiroId = searchParams.get('barbeiroId');
  const [fluxoRapidoProcessado, setFluxoRapidoProcessado] = useState(false);

  const [erroDuracao, setErroDuracao] = useState('');
  const [erroSlots, setErroSlots] = useState('');
  const [modalObj, setModalObj] = useState<{aberto: boolean; titulo: string; mensagem: string; tipo: 'erro'|'sucesso'|'aviso'|'info'; textoBotao?: string; onConfirm?: () => void; isConfirm?: boolean}>({ aberto: false, titulo: '', mensagem: '', tipo: 'info' });
  const [retrySlots, setRetrySlots] = useState(0);

  const scrollRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const scrollDates = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const scrollAmount = direction === 'left' ? -200 : 200;
      scrollRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };

  useEffect(() => {
    if (barbeariaId) {
      setCarregando(true);
      Promise.allSettled([
        clienteApi.get<Servico[]>(`/cliente/barbearia/${barbeariaId}/servicos`),
        clienteApi.get<Barbeiro[]>(`/cliente/barbearia/${barbeariaId}/barbeiros`),
        clienteApi.get<{ servicoId: string | null }>(`/cliente/barbearia/${barbeariaId}/servico-mais-popular`).catch(() => ({ data: { servicoId: null } }))
      ]).then(([resServicos, resBarbeiros, resPopular]) => {
        if (resServicos.status === 'fulfilled') {
          setServicos(resServicos.value.data);
        }
        if (resBarbeiros.status === 'fulfilled') {
          setBarbeiros(resBarbeiros.value.data);
        }
        if (resPopular && resPopular.status === 'fulfilled' && (resPopular.value as any)?.data) {
          setServicoPopularId((resPopular.value as any).data.servicoId);
        }
      }).finally(() => setCarregando(false));
    }
  }, [barbeariaId]);

  useEffect(() => {
    if (barbeariaId && !carregando && servicos.length > 0 && barbeiros.length > 0) {
      if (isFluxoRapido && preBarbeiroId && preServicoId && !fluxoRapidoProcessado) {
        setFluxoRapidoProcessado(true);
        const s = servicos.find(serv => serv.id === preServicoId);
        const b = barbeiros.find(barb => barb.id === preBarbeiroId);
        
        if (!s) {
          setModalObj({ aberto: true, titulo: 'Aviso', mensagem: 'O serviço do seu último corte não está mais disponível.', tipo: 'aviso' });
          setEtapa('servico');
        } else if (!b) {
          setServicosSel([s]);
          setModalObj({ aberto: true, titulo: 'Aviso', mensagem: 'O barbeiro do seu último corte não está mais atendendo.', tipo: 'aviso' });
          setEtapa('barbeiro');
        } else {
          setServicosSel([s]);
          setBarbeiroSel(b);
          setEtapa('data');
        }
      }
    }
  }, [carregando, servicos, barbeiros, isFluxoRapido, preBarbeiroId, preServicoId, barbeariaId, fluxoRapidoProcessado]);

  useEffect(() => {
    // Revalidação de duração no fluxo rápido ao selecionar serviços
    if (isFluxoRapido && dataSel && barbeiroSel && servicosSel.length > 0 && barbeariaId && horarioSel) {
      setCarregandoSlots(true);
      setErroDuracao('');
      setErroSlots('');
      if (abortControllerRef.current) abortControllerRef.current.abort();
      abortControllerRef.current = new AbortController();
      
      clienteApi.get<Slot[]>(`/cliente/barbearia/${barbeariaId}/horarios-disponiveis`, {
        params: { barbeiroId: barbeiroSel.id, data: dataSel, servicoId: servicosSel[0]?.id },
        signal: abortControllerRef.current.signal
      }).then(r => {
        const availableSlots = r.data;
        setSlots(availableSlots);
        
        // Verifica se o slot pré-selecionado ainda existe na lista
        const slotAindaValido = availableSlots.find(s => s.horario === horarioSel && s.disponivel);
        
        if (!slotAindaValido) {
          setErroDuracao(`Os serviços selecionados levam ${servicosSel.reduce((a,b)=>a+b.duracaoMinutos,0)} min e não cabem no horário de ${horarioSel}.`);
          setHorarioSel(''); 
        } else {
          setEtapa('confirmacao');
        }
      })
      .catch(err => {
        if (err.name === 'CanceledError' || err.name === 'AbortError') return;
        setSlots([]);
        setErroSlots('Falha de rede. Não foi possível buscar os horários.');
      })
      .finally(() => setCarregandoSlots(false));
      return () => abortControllerRef.current?.abort(); // sai para não cair no useEffect de slots normal
    }

    if (dataSel && barbeiroSel && servicosSel.length > 0 && barbeariaId && etapa === 'data') {
      setCarregandoSlots(true);
      setErroSlots('');
      const controller = new AbortController();

      clienteApi.get<Slot[]>(`/cliente/barbearia/${barbeariaId}/horarios-disponiveis`, {
        params: { barbeiroId: barbeiroSel.id, data: dataSel, servicoId: servicosSel[0]?.id, servicosIds: servicosSel.map(s => s.id).join(',') },
        signal: controller.signal
      }).then(r => setSlots(r.data))
        .catch(err => {
          if (err.name === 'CanceledError' || err.name === 'AbortError') return;
          setSlots([]);
          setErroSlots('Falha de rede. Não foi possível buscar os horários.');
        })
        .finally(() => setCarregandoSlots(false));
        
      return () => controller.abort();
    }
  }, [dataSel, barbeiroSel, servicosSel, barbeariaId, etapa, isFluxoRapido, retrySlots]);

  useEffect(() => {
    if (sucesso) {
      const t = setTimeout(() => setAnimado(true), 10);
      return () => clearTimeout(t);
    }
  }, [sucesso]);

  const fmt = (v: string | number) => Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const hoje = hojeBrasilia();

  const diasDisponiveis = useMemo(() => {
    return Array.from({ length: 14 }).map((_, i) => {
      const d = new Date(hoje + 'T12:00:00');
      d.setDate(d.getDate() + i);
      return d.toISOString().split('T')[0];
    });
  }, [hoje]);

  // Se não tem dataSel e diasDisponiveis está preenchido, seleciona o primeiro
  useEffect(() => {
    if (etapa === 'data' && !dataSel && diasDisponiveis.length > 0) {
      setDataSel(diasDisponiveis[0]);
    }
  }, [etapa, dataSel, diasDisponiveis]);

  const totalPreco = servicosSel.reduce((acc, s) => acc + Number(s.preco), 0);
  const totalDuracao = servicosSel.reduce((acc, s) => acc + s.duracaoMinutos, 0);

  async function confirmarAgendamento() {
    if (servicosSel.length === 0 || !barbeiroSel || !dataSel || !horarioSel) return;
    setEnviando(true);
    try {
      await clienteApi.post(`/cliente/barbearia/${barbeariaId}/agendar`, {
        servicosIds: servicosSel.map(s => s.id),
        barbeiroId: barbeiroSel.id,
        data: dataSel,
        hora: horarioSel,
      });
      setSucesso(true);
      setModalObj({ 
        aberto: true, 
        titulo: 'Agendamento Confirmado!', 
        mensagem: 'Seu horário foi marcado com sucesso. Te esperamos na barbearia!', 
        tipo: 'sucesso', 
        textoBotao: 'Ver meus agendamentos',
        onConfirm: () => navigate(`/cliente/barbearia/${barbeariaId}`)
      });
    } catch { 
      setModalObj({ aberto: true, titulo: 'Erro no agendamento', mensagem: 'Erro ao realizar o agendamento. Tente outro horário.', tipo: 'erro' });
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
        <p style={{ fontFamily: 'var(--fonte-interface)', fontSize: '14px', color: 'var(--texto-secundario)', textAlign: 'center', marginBottom: '28px' }}>
          {(() => {
            const dataObj = new Date(dataSel + 'T00:00');
            const dataFormatada = dataObj.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' });
            const prefixoData = /^[0-9]/.test(dataFormatada) ? 'no dia ' : '';
            return (
              <>
                Tudo pronto! Te esperamos {prefixoData}<span className="font-semibold text-[var(--text-primary)]">{dataFormatada}</span> às <span className="font-semibold text-[var(--amber)]">{horarioSel}</span>.
              </>
            );
          })()}
        </p>

        {/* Card Resumo do Agendamento */}
        <div className="w-full bg-[var(--fundo-sidebar)] border border-[var(--borda)] rounded-lg p-5 mb-8 text-left shadow-md">
          <div className="flex justify-between items-start pb-3 border-b border-[var(--borda)] mb-3">
            <span style={{ fontFamily: 'var(--fonte-interface)', fontSize: '12px', color: 'var(--texto-secundario)' }}>Serviços</span>
            <div className="flex flex-col items-end text-right">
              {servicosSel.map(s => (
                <span key={s.id} style={{ fontFamily: 'var(--fonte-interface)', fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>{s.nome}</span>
              ))}
            </div>
          </div>
          <div className="flex justify-between items-center pb-3 border-b border-[var(--borda)] mb-3">
            <span style={{ fontFamily: 'var(--fonte-interface)', fontSize: '12px', color: 'var(--texto-secundario)' }}>Profissional</span>
            <span style={{ fontFamily: 'var(--fonte-interface)', fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>{barbeiroSel?.usuario.nome}</span>
          </div>
          <div className="flex justify-between items-center pb-3 border-b border-[var(--borda)] mb-3">
            <span style={{ fontFamily: 'var(--fonte-interface)', fontSize: '12px', color: 'var(--texto-secundario)' }}>Horário</span>
            <span style={{ fontFamily: 'var(--fonte-mono)', fontSize: '14px', fontWeight: 600, color: 'var(--amber)' }}>{horarioSel}</span>
          </div>
          <div className="flex justify-between items-center">
            <span style={{ fontFamily: 'var(--fonte-interface)', fontSize: '12px', color: 'var(--texto-secundario)' }}>Valor Total</span>
            <span style={{ fontFamily: 'var(--fonte-mono)', fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>{fmt(totalPreco)}</span>
          </div>
        </div>

        <button onClick={() => navigate(`/cliente/barbearia/${barbeariaId}`)} className="btn-primary w-full justify-center flex items-center gap-2" style={{ height: '48px', fontSize: '13px', fontWeight: 600, letterSpacing: '0.04em' }}>
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
    if (etapa === 'servico') return servicosSel.length > 0;
    if (etapa === 'barbeiro') return !!barbeiroSel;
    if (etapa === 'data') return !!dataSel && !!horarioSel;
    return false;
  };

  const proximaEtapa = () => {
    if (etapa === 'servico' && servicosSel.length > 0) setEtapa('barbeiro');
    else if (etapa === 'barbeiro' && barbeiroSel) setEtapa('data');
    else if (etapa === 'data' && dataSel && horarioSel) setEtapa('confirmacao');
    else if (etapa === 'confirmacao') confirmarAgendamento();
  };

  const getTextoBotao = () => {
    if (etapa === 'servico') return 'Avançar para barbeiro →';
    if (etapa === 'barbeiro') return 'Avançar para horário →';
    if (etapa === 'data') return 'Avançar para resumo →';
    if (etapa === 'confirmacao') return enviando ? 'Confirmando...' : 'Confirmar agendamento';
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
          <span style={{ fontFamily: 'var(--fonte-interface)', fontSize: '11px', fontWeight: 600, color: 'var(--amber)', letterSpacing: '0.06em' }}>
            Passo {etapaIdx + 1} de {etapas.length}
          </span>
          <span style={{ fontFamily: 'var(--fonte-interface)', fontSize: '11px', color: 'var(--texto-secundario)' }}>
            {etapas.length - (etapaIdx + 1) === 0 ? 'Última etapa!' : `Faltam ${etapas.length - (etapaIdx + 1)} passo${etapas.length - (etapaIdx + 1) > 1 ? 's' : ''}`}
          </span>
        </div>

        {/* Stepper Bar Contínuo */}
        <div className="w-full h-2 rounded-full overflow-hidden bg-[var(--fundo-sidebar)] border border-[var(--borda)] relative flex">
          {etapas.map((e, i) => {
            const isAtivo = i <= etapaIdx || (isFluxoRapido && etapaIdx >= 2 && i < 2);
            return (
              <div key={e.key} className="h-full flex-1 border-r border-[var(--borda)] last:border-0 transition-all duration-300"
                   style={{ background: isAtivo ? 'var(--amber)' : 'transparent', opacity: i === etapaIdx ? 1 : isAtivo ? 0.6 : 1 }} />
            );
          })}
        </div>

        {/* Rótulos das Etapas */}
        <div className="flex justify-between items-center mt-2.5">
          {etapas.map((e, i) => {
            const isAtivo = i <= etapaIdx || (isFluxoRapido && etapaIdx >= 2 && i < 2);
            return (
              <span key={e.key} style={{ 
                fontFamily: 'var(--fonte-interface)', 
                fontSize: '10px', 
                fontWeight: i === etapaIdx ? 700 : isAtivo ? 600 : 400, 
                color: i === etapaIdx ? 'var(--amber)' : isAtivo ? 'var(--amber)' : 'var(--texto-secundario)', 
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
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--texto-secundario)', fontFamily: 'var(--fonte-interface)', fontSize: '11px', letterSpacing: '0.04em', fontWeight: 600, minHeight: '48px' }}>
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
          {servicosExibidos.map((s, _idx) => {
            const isSel = servicosSel.some(ps => ps.id === s.id);
            const toggleServico = () => {
              setServicosSel(prev => {
                if (prev.some(ps => ps.id === s.id)) return prev.filter(ps => ps.id !== s.id);
                return [...prev, s];
              });
            };
            return (
              <button key={s.id} onClick={toggleServico}
                className="flex items-center justify-between p-4 w-full text-left transition-all rounded-md"
                style={{
                  background: isSel ? 'rgba(var(--cor-primaria-rgb), 0.12)' : 'var(--fundo-sidebar)',
                  border: isSel ? '1px solid var(--amber)' : '1px solid var(--borda)',
                  cursor: 'pointer',
                }}>
                <div className="min-w-0 flex items-center gap-4">
                  <div className={`w-10 h-10 flex-shrink-0 rounded-full flex items-center justify-center ${isSel ? 'bg-[var(--amber)] text-[var(--texto-sobre-primaria)]' : 'bg-[var(--superficie-2)] text-[var(--texto-secundario)] border border-[var(--borda)]'}`}>
                    <Scissors size={18} />
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
                      <p className="truncate" style={{ fontFamily: 'var(--fonte-interface)', fontWeight: 600, color: 'var(--text-primary)', fontSize: '15px' }}>{s.nome}</p>
                      {s.id === servicoPopularId && <span className="inline-block w-fit bg-[var(--amber)] text-[var(--texto-sobre-primaria)] text-[10px] font-bold px-2 py-0.5 rounded-sm whitespace-nowrap">Mais popular</span>}
                    </div>
                    <p style={{ fontFamily: 'var(--fonte-interface)', fontSize: '11px', color: 'var(--texto-secundario)', marginTop: '2px' }}>{s.duracaoMinutos} min de duração</p>
                  </div>
                </div>
                <div className="flex flex-shrink-0 items-center gap-4">
                  <span className="whitespace-nowrap" style={{ fontFamily: 'var(--fonte-mono)', fontSize: '15px', color: 'var(--text-primary)', fontWeight: 600 }}>{fmt(s.preco)}</span>
                  <div className={`w-5 h-5 rounded border flex items-center justify-center flex-shrink-0 transition-colors ${isSel ? 'bg-[var(--amber)] border-[var(--amber)] text-[var(--texto-sobre-primaria)]' : 'border-[var(--borda)] bg-[var(--superficie-1)]'}`}>
                    {isSel && <Check size={14} weight="bold" />}
                  </div>
                </div>
              </button>
            );
          })}

          {temMaisServicos && (
            <button
              onClick={() => setMostrarTodosServicos(!mostrarTodosServicos)}
              className="w-full py-3 mt-2 flex items-center justify-center gap-2 rounded-md border border-[var(--borda)] bg-[var(--superficie-1)] hover:bg-[var(--superficie-2)] transition-colors"
              style={{ fontFamily: 'var(--fonte-interface)', fontSize: '12px', fontWeight: 600, color: 'var(--texto-secundario)', letterSpacing: '0.04em' }}
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
                        <span key={i} style={{ fontSize: '9px', letterSpacing: '0.04em', background: 'var(--superficie-1)', padding: '2px 6px', borderRadius: '4px', border: '1px solid var(--borda)', color: 'var(--texto-secundario)' }}>{e}</span>
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
          <div className="mb-6 p-4 rounded-md relative group" style={{ background: 'var(--fundo-sidebar)', border: '1px solid var(--borda)' }}>
            <label className="block mb-3" style={{ fontFamily: 'var(--fonte-interface)', fontSize: '11px', letterSpacing: '0.04em', color: 'var(--texto-secundario)', fontWeight: 600 }}>Escolha a data</label>
            
            {/* Setas de navegação no desktop */}
            <button onClick={() => scrollDates('left')} className="hidden md:flex absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 items-center justify-center bg-[var(--superficie-1)] border border-[var(--borda)] rounded-full shadow-sm z-10 hover:bg-[var(--fundo-input)] opacity-0 group-hover:opacity-100 transition-opacity">
              <CaretDown size={16} weight="bold" className="rotate-90 text-[var(--text-primary)]" />
            </button>
            <button onClick={() => scrollDates('right')} className="hidden md:flex absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 items-center justify-center bg-[var(--superficie-1)] border border-[var(--borda)] rounded-full shadow-sm z-10 hover:bg-[var(--fundo-input)] opacity-0 group-hover:opacity-100 transition-opacity">
              <CaretDown size={16} weight="bold" className="-rotate-90 text-[var(--text-primary)]" />
            </button>

            <div ref={scrollRef} className="flex gap-2 overflow-x-auto pb-2 hide-scrollbar scroll-smooth" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none', scrollSnapType: 'x mandatory' }}>
              {diasDisponiveis.map((diaStr: string) => {
                const dateObj = new Date(diaStr + 'T12:00:00');
                const isSel = dataSel === diaStr;
                const sem = dateObj.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '');
                const num = dateObj.getDate();
                return (
                  <button
                    key={diaStr}
                    onClick={() => { setDataSel(diaStr); setHorarioSel(''); }}
                    style={{ scrollSnapAlign: 'start' }}
                    className={`flex-shrink-0 w-16 py-3 rounded-lg flex flex-col items-center gap-1 border transition-all ${
                      isSel 
                        ? 'border-[var(--amber)] bg-[rgba(var(--amber-rgb),0.1)]' 
                        : 'border-[var(--borda)] bg-[var(--superficie-1)] hover:border-[var(--amber)] hover:bg-[rgba(var(--amber-rgb),0.05)]'
                    }`}
                  >
                    <span style={{ fontFamily: 'var(--fonte-interface)', fontSize: '11px', color: isSel ? 'var(--amber)' : 'var(--texto-secundario)', fontWeight: 600 }}>
                      {sem.charAt(0).toUpperCase() + sem.slice(1)}
                    </span>
                    <span style={{ fontSize: '18px', fontFamily: 'var(--fonte-mono)', color: isSel ? 'var(--amber)' : 'var(--text-primary)', fontWeight: 700 }}>{num}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {dataSel && (
            <div>
              {erroDuracao && (
                <div className="mb-4 bg-[var(--erro-fundo)] border border-[var(--erro)] p-3 rounded-md text-[var(--erro)] text-sm flex items-start gap-2">
                  <CheckCircle size={20} className="flex-shrink-0 mt-0.5" />
                  <p style={{ fontFamily: 'var(--fonte-interface)' }}>{erroDuracao}</p>
                </div>
              )}
              <label className="block mb-3" style={{ fontFamily: 'var(--fonte-interface)', fontSize: '11px', letterSpacing: '0.04em', color: 'var(--texto-secundario)', fontWeight: 600 }}>Horários Disponíveis</label>
              {erroSlots ? (
                <div className="p-6 text-center border border-dashed border-[var(--erro)] rounded-md bg-[var(--erro-fundo)]">
                  <p className="mb-3 text-[var(--erro)] font-medium text-sm font-interface">{erroSlots}</p>
                  <button onClick={() => setRetrySlots(r => r + 1)} className="px-4 py-2 bg-[var(--erro)] rounded font-interface text-sm font-semibold hover:opacity-90 transition-opacity" style={{ color: 'var(--texto-sobre-primaria)' }}>
                    Tentar novamente
                  </button>
                </div>
              ) : carregandoSlots ? (
                <div className="grid grid-cols-4 md:grid-cols-5 gap-2">
                  {Array.from({ length: 10 }).map((_, i) => (
                    <SkeletonCard key={i} style={{ height: '48px', width: '100%' }} />
                  ))}
                </div>
              ) : slots.length > 0 ? (
                <div className="grid grid-cols-4 md:grid-cols-5 gap-2">
                  {slots.map(s => (
                    <button key={s.horario}
                      disabled={!s.disponivel}
                      aria-disabled={!s.disponivel}
                      onClick={() => setHorarioSel(s.horario)}
                      style={{
                        height: '48px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontFamily: 'var(--fonte-mono)',
                        fontSize: '14px',
                        textAlign: 'center',
                        cursor: s.disponivel ? 'pointer' : 'not-allowed',
                        background: horarioSel === s.horario ? 'var(--amber)' : s.disponivel ? 'var(--fundo-sidebar)' : 'var(--superficie-2)',
                        color: horarioSel === s.horario ? 'var(--texto-sobre-primaria)' : s.disponivel ? 'var(--text-primary)' : 'var(--texto-secundario)',
                        border: horarioSel === s.horario ? '1px solid var(--amber)' : s.disponivel ? '1px solid var(--borda)' : '1px dashed var(--borda)',
                        opacity: s.disponivel ? 1 : 0.6,
                        borderRadius: '6px',
                        fontWeight: 600
                      }}>
                      {s.horario}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="p-6 text-center border border-dashed border-[var(--borda)] rounded-md">
                  <p style={{ fontFamily: 'var(--fonte-interface)', fontSize: '13px', color: 'var(--texto-secundario)' }}>Nenhum horário disponível nesta data. Tente outro dia.</p>
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
            <h3 style={{ fontFamily: 'var(--fonte-interface)', fontSize: '11px', letterSpacing: '0.2em', color: 'var(--texto-secundario)', textAlign: 'center', marginBottom: '24px', fontWeight: 600 }}>
              Resumo do Agendamento
            </h3>

            <div className="flex flex-col gap-5">
              <div className="flex justify-between items-start">
                <div>
                  <p style={{ fontFamily: 'var(--fonte-interface)', fontSize: '10px', color: 'var(--texto-secundario)', marginBottom: '4px', fontWeight: 600 }}>Serviços</p>
                  <div className="flex flex-col gap-1">
                    {servicosSel.map(s => (
                      <p key={s.id} style={{ fontFamily: 'var(--fonte-interface)', fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>{s.nome}</p>
                    ))}
                  </div>
                </div>
                <p style={{ fontFamily: 'var(--fonte-mono)', fontSize: '16px', color: 'var(--text-primary)', fontWeight: 700 }}>{fmt(totalPreco)}</p>
              </div>

              <div className="flex justify-between items-start">
                <div>
                  <p style={{ fontFamily: 'var(--fonte-interface)', fontSize: '10px', color: 'var(--texto-secundario)', marginBottom: '2px', fontWeight: 600 }}>Profissional</p>
                  <p style={{ fontFamily: 'var(--fonte-interface)', fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)' }}>{barbeiroSel?.usuario.nome}</p>
                </div>
              </div>

              <div className="flex justify-between items-start">
                <div>
                  <p style={{ fontFamily: 'var(--fonte-interface)', fontSize: '10px', color: 'var(--texto-secundario)', marginBottom: '2px', fontWeight: 600 }}>Data</p>
                  <p style={{ fontFamily: 'var(--fonte-interface)', fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)' }}>
                    {(() => {
                      const str = new Date(dataSel + 'T00:00').toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' });
                      return str.charAt(0).toUpperCase() + str.slice(1);
                    })()}
                  </p>
                </div>
                <div className="text-right">
                  <p style={{ fontFamily: 'var(--fonte-interface)', fontSize: '10px', color: 'var(--texto-secundario)', marginBottom: '2px', fontWeight: 600 }}>Horário</p>
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
      <div className="md:hidden fixed left-0 right-0 bg-[var(--fundo-superficie)] border-t border-[var(--borda)] shadow-2xl flex flex-col"
        style={{
          bottom: 'calc(64px + env(safe-area-inset-bottom, 0px))',
          zIndex: 49,
        }}>
        {etapa === 'servico' && servicosSel.length > 0 && (
          <div className="px-5 py-2.5 border-b border-[var(--borda)] flex justify-between items-center bg-[var(--fundo-sidebar)]">
            <span style={{ fontFamily: 'var(--fonte-interface)', fontSize: '12px', color: 'var(--texto-secundario)', fontWeight: 600 }}>Total selecionado:</span>
            <div className="text-right">
              <span style={{ fontFamily: 'var(--fonte-mono)', fontSize: '15px', color: 'var(--text-primary)', fontWeight: 700 }}>{fmt(totalPreco)}</span>
              <span style={{ fontFamily: 'var(--fonte-interface)', fontSize: '12px', color: 'var(--texto-secundario)', marginLeft: '6px' }}>({totalDuracao} min)</span>
            </div>
          </div>
        )}
        <div className="p-4 flex items-center justify-center">
          <button
            onClick={proximaEtapa}
            disabled={(!podeAvancar() && etapa !== 'confirmacao') || (etapa === 'confirmacao' && enviando)}
            className="btn-primary w-full justify-center flex items-center gap-2"
            style={{ height: '48px', fontSize: '13px', fontWeight: 600, letterSpacing: '0.04em' }}
          >
            {getTextoBotao()}
          </button>
        </div>
      </div>

      {/* Botão no Desktop */}
      <div className="hidden md:flex flex-col items-end mt-8 pt-4 border-t border-[var(--borda)]">
        {etapa === 'servico' && servicosSel.length > 0 && (
          <div className="flex justify-end items-center gap-4 mb-4">
            <span style={{ fontFamily: 'var(--fonte-interface)', fontSize: '13px', color: 'var(--texto-secundario)', fontWeight: 600 }}>Total selecionado:</span>
            <div className="flex items-center gap-2">
              <span style={{ fontFamily: 'var(--fonte-mono)', fontSize: '18px', color: 'var(--text-primary)', fontWeight: 700 }}>{fmt(totalPreco)}</span>
              <span style={{ fontFamily: 'var(--fonte-interface)', fontSize: '13px', color: 'var(--texto-secundario)' }}>({totalDuracao} min)</span>
            </div>
          </div>
        )}
        <button
          onClick={proximaEtapa}
          disabled={(!podeAvancar() && etapa !== 'confirmacao') || (etapa === 'confirmacao' && enviando)}
          className="btn-primary justify-center flex items-center gap-2 px-8"
          style={{ height: '48px', fontSize: '13px', fontWeight: 600, letterSpacing: '0.04em' }}
        >
          {getTextoBotao()}
        </button>
      </div>
      {/* Modal Alert */}
      <ModalAlert 
        aberto={modalObj.aberto} 
        titulo={modalObj.titulo} 
        mensagem={modalObj.mensagem} 
        tipo={modalObj.tipo} 
        isConfirm={modalObj.isConfirm}
        textoBotao={modalObj.tipo === 'sucesso' ? 'Ver meus agendamentos' : 'Entendi'}
        onConfirmar={modalObj.onConfirm}
        onFechar={() => {
          setModalObj(m => ({ ...m, aberto: false }));
          if (modalObj.tipo === 'sucesso' && modalObj.onConfirm) {
            modalObj.onConfirm();
          }
        }} 
      />
    </div>
  );
}
