// Aba Agendar — fluxo em etapas: serviço → barbeiro → data/horário → confirmação
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Check, ArrowLeft, Scissors, Star } from 'lucide-react';
import clienteApi from '../../../api/clienteApi';

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

  useEffect(() => {
    if (barbeariaId) {
      clienteApi.get<Servico[]>(`/cliente/barbearia/${barbeariaId}/servicos`).then(r => setServicos(r.data));
      clienteApi.get<Barbeiro[]>(`/cliente/barbearia/${barbeariaId}/barbeiros`).then(r => setBarbeiros(r.data));
    }
  }, [barbeariaId]);

  useEffect(() => {
    if (dataSel && barbeiroSel && servicoSel && barbeariaId) {
      clienteApi.get<Slot[]>(`/cliente/barbearia/${barbeariaId}/horarios-disponiveis`, {
        params: { barbeiroId: barbeiroSel.id, data: dataSel, servicoId: servicoSel.id }
      }).then(r => setSlots(r.data));
    }
  }, [dataSel, barbeiroSel, servicoSel, barbeariaId]);

  const fmt = (v: string | number) => Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  const hoje = new Date().toISOString().split('T')[0];

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
    } catch { alert('Erro ao agendar'); }
    finally { setEnviando(false); }
  }

  if (sucesso) {
    return (
      <div className="flex flex-col items-center justify-center px-6 py-16 animate-fade-in max-w-md mx-auto h-full">
        <div className="w-20 h-20 rounded-full flex items-center justify-center mb-6"
          style={{ background: 'rgba(34, 197, 94, 0.15)', border: '1px solid #22C55E' }}>
          <Check size={36} style={{ color: '#22C55E' }} />
        </div>
        <h2 style={{ fontFamily: 'var(--fonte-interface)', fontSize: '24px', color: 'var(--text-primary)', marginBottom: '8px', fontWeight: 600 }}>
          Agendamento Confirmado!
        </h2>
        <p style={{ fontFamily: 'var(--fonte-interface)', fontSize: '14px', color: 'var(--text-muted)', textAlign: 'center', marginBottom: '32px' }}>
          Te esperamos no dia {new Date(dataSel + 'T00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} às {horarioSel}.
        </p>
        <button onClick={() => navigate(`/cliente/barbearia/${barbeariaId}`)} className="btn-primary w-full justify-center py-4" style={{ textTransform: 'uppercase', fontSize: '13px', fontWeight: 600, letterSpacing: '0.04em' }}>
          Voltar ao Início
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

  return (
    <div className="px-5 py-6 animate-fade-in max-w-2xl mx-auto">
      {/* Stepper Circular Linha Conectada */}
      <div className="flex items-center justify-between mb-8 relative">
        <div className="absolute top-[12px] left-[10%] right-[10%] h-[2px]" style={{ background: 'var(--bg-surface)' }} />
        <div className="absolute top-[12px] left-[10%] h-[2px] transition-all duration-300" 
             style={{ background: 'var(--amber)', width: `${(etapaIdx / (etapas.length - 1)) * 80}%` }} />
        
        {etapas.map((e, i) => {
          const isAtivo = i <= etapaIdx;
          return (
            <div key={e.key} className="flex flex-col items-center gap-2 relative z-10 w-1/4">
              <div className={`stepper-dot ${isAtivo ? 'active' : 'inactive'}`}>
                {i + 1}
              </div>
              <span style={{ fontFamily: 'var(--fonte-interface)', fontSize: '9px', fontWeight: isAtivo ? 600 : 400, color: isAtivo ? 'var(--amber)' : 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                {e.label}
              </span>
            </div>
          );
        })}
      </div>

      {/* Header Contextual por Etapa */}
      <div className="mb-6">
        {etapa !== 'servico' && (
          <button onClick={() => {
            if (etapa === 'barbeiro') setEtapa('servico');
            if (etapa === 'data') setEtapa('barbeiro');
            if (etapa === 'confirmacao') setEtapa('data');
          }} className="flex items-center gap-2 mb-4"
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontFamily: 'var(--fonte-interface)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            <ArrowLeft size={14} /> Voltar
          </button>
        )}
        
        <h1 style={{ fontFamily: 'var(--fonte-interface)', fontSize: '24px', fontWeight: 600, color: 'var(--text-primary)' }}>
          {etapa === 'servico' && 'Selecione o que deseja fazer hoje.'}
          {etapa === 'barbeiro' && 'Escolha o profissional.'}
          {etapa === 'data' && 'Escolha o melhor horário.'}
          {etapa === 'confirmacao' && 'Revise seu agendamento.'}
        </h1>
        
        {etapa === 'servico' && (
          <p className="flex items-center gap-1.5 mt-2" style={{ fontFamily: 'var(--fonte-interface)', fontSize: '12px', color: 'var(--amber)' }}>
            <Star size={12} /> Ganhe 50 pts a cada atendimento
          </p>
        )}
      </div>

      {/* Conteúdo Etapa 1: Serviço */}
      {etapa === 'servico' && (
        <div className="flex flex-col gap-3">
          {servicos.map((s, idx) => (
            <button key={s.id} onClick={() => { setServicoSel(s); setEtapa('barbeiro'); }}
              className="flex items-center justify-between p-4 w-full text-left transition-all rounded-md"
              style={{
                background: servicoSel?.id === s.id ? 'rgba(var(--cor-primaria-rgb), 0.12)' : 'var(--fundo-sidebar)',
                border: servicoSel?.id === s.id ? '1px solid var(--amber)' : '1px solid var(--borda)',
                cursor: 'pointer',
              }}>
              <div className="flex items-center gap-4">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${servicoSel?.id === s.id ? 'bg-[var(--amber)] text-[#0a0a0a]' : 'bg-[var(--bg-surface)] text-[var(--cor-icone)] border border-[var(--borda)]'}`}>
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
              <span style={{ fontFamily: 'var(--fonte-numeros)', fontSize: '15px', color: 'var(--text-primary)', fontWeight: 500 }}>{fmt(s.preco)}</span>
            </button>
          ))}
        </div>
      )}

      {/* Conteúdo Etapa 2: Barbeiro */}
      {etapa === 'barbeiro' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {barbeiros.map(b => (
            <button key={b.id} onClick={() => { setBarbeiroSel(b); setEtapa('data'); }}
              className="flex items-center gap-4 p-4 w-full text-left transition-all rounded-md"
              style={{
                background: barbeiroSel?.id === b.id ? 'rgba(var(--cor-primaria-rgb), 0.12)' : 'var(--fundo-sidebar)',
                border: barbeiroSel?.id === b.id ? '1px solid var(--amber)' : '1px solid var(--borda)',
                cursor: 'pointer',
              }}>
              {b.foto ? (
                <img 
                  src={b.foto} 
                  alt={b.usuario.nome} 
                  className="w-12 h-12 rounded-full object-cover border border-[var(--borda)]"
                />
              ) : (
                <div className="w-12 h-12 flex items-center justify-center rounded-full bg-[var(--bg-surface)] border border-[var(--borda)] text-[var(--text-primary)] font-semibold font-interface">
                  {b.usuario.nome.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)}
                </div>
              )}
              <div>
                <p style={{ fontFamily: 'var(--fonte-interface)', fontWeight: 600, color: 'var(--text-primary)', fontSize: '15px' }}>{b.usuario.nome}</p>
                <div className="flex gap-1.5 mt-1.5 flex-wrap">
                  {b.especialidades.slice(0, 2).map((e, i) => (
                    <span key={i} style={{ fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.04em', background: 'var(--bg-surface)', padding: '2px 6px', borderRadius: '4px', border: '1px solid var(--borda)', color: 'var(--text-muted)' }}>{e}</span>
                  ))}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Conteúdo Etapa 3: Data e Horário */}
      {etapa === 'data' && (
        <div>
          <div className="mb-6 p-4 rounded-md" style={{ background: 'var(--fundo-sidebar)', border: '1px solid var(--borda)' }}>
            <label className="block mb-2" style={{ fontFamily: 'var(--fonte-interface)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)' }}>Escolha o dia</label>
            <input type="date" value={dataSel} onChange={e => { setDataSel(e.target.value); setHorarioSel(''); }}
              min={hoje} className="w-full bg-[var(--fundo-input)] border border-[var(--borda)] rounded p-3 text-[var(--text-primary)] font-interface focus:outline-none focus:border-[var(--amber)] transition-colors outline-none" />
          </div>

          {dataSel && (
            <div>
              <label className="block mb-3" style={{ fontFamily: 'var(--fonte-interface)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)' }}>Horários Disponíveis</label>
              {slots.length > 0 ? (
                <div className="grid grid-cols-4 md:grid-cols-5 gap-2">
                  {slots.map(s => (
                    <button key={s.horario}
                      disabled={!s.disponivel}
                      onClick={() => { setHorarioSel(s.horario); setEtapa('confirmacao'); }}
                      style={{
                        padding: '12px 4px',
                        fontFamily: 'var(--fonte-numeros)',
                        fontSize: '14px',
                        textAlign: 'center',
                        cursor: s.disponivel ? 'pointer' : 'not-allowed',
                        background: horarioSel === s.horario ? 'var(--amber)' : s.disponivel ? 'var(--fundo-sidebar)' : 'transparent',
                        color: horarioSel === s.horario ? '#0A0A0A' : s.disponivel ? 'var(--text-primary)' : 'var(--text-disabled)',
                        border: horarioSel === s.horario ? '1px solid var(--amber)' : s.disponivel ? '1px solid var(--borda)' : '1px dashed var(--borda)',
                        opacity: s.disponivel ? 1 : 0.3,
                        borderRadius: '6px',
                        fontWeight: 500
                      }}>
                      {s.horario}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="p-6 text-center border border-dashed border-[var(--borda)] rounded-md">
                  <p style={{ fontFamily: 'var(--fonte-interface)', fontSize: '13px', color: 'var(--text-muted)' }}>Nenhum horário disponível neste dia.</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Conteúdo Etapa 4: Confirmação (Recibo Elegante) */}
      {etapa === 'confirmacao' && (
        <div className="w-full max-w-sm mx-auto">
          <div className="rounded-t-lg p-6 relative overflow-hidden" style={{ background: 'var(--fundo-sidebar)', border: '1px solid var(--borda)', borderBottom: 'none' }}>
            <div className="absolute top-0 left-0 right-0 h-1 bg-[var(--amber)]" />
            <h3 style={{ fontFamily: 'var(--fonte-interface)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.2em', color: 'var(--text-muted)', textAlign: 'center', marginBottom: '24px' }}>
              Resumo do Agendamento
            </h3>

            <div className="flex flex-col gap-5">
              <div className="flex justify-between items-start">
                <div>
                  <p style={{ fontFamily: 'var(--fonte-interface)', fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '2px' }}>Serviço</p>
                  <p style={{ fontFamily: 'var(--fonte-interface)', fontSize: '16px', fontWeight: 500, color: 'var(--text-primary)' }}>{servicoSel?.nome}</p>
                </div>
                <p style={{ fontFamily: 'var(--fonte-numeros)', fontSize: '16px', color: 'var(--text-primary)' }}>{fmt(servicoSel?.preco || '0')}</p>
              </div>

              <div className="flex justify-between items-start">
                <div>
                  <p style={{ fontFamily: 'var(--fonte-interface)', fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '2px' }}>Profissional</p>
                  <p style={{ fontFamily: 'var(--fonte-interface)', fontSize: '16px', fontWeight: 500, color: 'var(--text-primary)' }}>{barbeiroSel?.usuario.nome}</p>
                </div>
              </div>

              <div className="flex justify-between items-start">
                <div>
                  <p style={{ fontFamily: 'var(--fonte-interface)', fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '2px' }}>Data</p>
                  <p className="capitalize" style={{ fontFamily: 'var(--fonte-interface)', fontSize: '16px', fontWeight: 500, color: 'var(--text-primary)' }}>
                    {new Date(dataSel + 'T00:00').toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' })}
                  </p>
                </div>
                <div className="text-right">
                  <p style={{ fontFamily: 'var(--fonte-interface)', fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '2px' }}>Horário</p>
                  <p style={{ fontFamily: 'var(--fonte-numeros)', fontSize: '16px', color: 'var(--amber)', fontWeight: 600 }}>{horarioSel}</p>
                </div>
              </div>
            </div>
          </div>
          
          {/* Efeito serrilhado (recibo) */}
          <div className="w-full flex">
            {Array.from({ length: 20 }).map((_, i) => (
              <div key={i} className="flex-1 h-2" style={{ 
                background: 'var(--fundo-pagina)', 
                clipPath: 'polygon(0 0, 50% 100%, 100% 0)',
                marginTop: '-1px'
              }} />
            ))}
          </div>

          <div className="mt-8">
            <button onClick={confirmarAgendamento} disabled={enviando}
              className="btn-primary w-full justify-center py-4"
              style={{ fontSize: '14px', fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
              {enviando ? 'Confirmando...' : 'Confirmar e Agendar'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
