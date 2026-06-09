// Aba Agendar — fluxo em etapas: serviço → barbeiro → data/horário → confirmação
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Check, ArrowLeft, Calendar, Clock, Scissors, User } from 'lucide-react';
import clienteApi from '../../../api/clienteApi';

interface Servico { id: string; nome: string; preco: string; duracaoMinutos: number; }
interface Barbeiro { id: string; usuario: { nome: string }; especialidades: string[]; }
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
      <div className="flex flex-col items-center justify-center px-6 py-16 animate-fade-in">
        <div className="w-20 h-20 rounded-full flex items-center justify-center mb-6"
          style={{ background: 'var(--success)', border: '2px solid var(--success-text)' }}>
          <Check size={40} style={{ color: 'var(--success-text)' }} />
        </div>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '28px', color: 'var(--text-primary)', marginBottom: '8px' }}>
          Agendado!
        </h2>
        <p style={{ fontFamily: 'var(--font-body)', fontSize: '14px', color: 'var(--text-muted)', textAlign: 'center', marginBottom: '24px' }}>
          Seu agendamento foi confirmado com sucesso.
        </p>
        <button onClick={() => navigate(`/cliente/barbearia/${barbeariaId}`)} className="btn-primary">
          Voltar ao Início
        </button>
      </div>
    );
  }

  const etapas: { key: Etapa; label: string }[] = [
    { key: 'servico', label: 'Serviço' },
    { key: 'barbeiro', label: 'Barbeiro' },
    { key: 'data', label: 'Data/Hora' },
    { key: 'confirmacao', label: 'Confirmar' },
  ];
  const etapaIdx = etapas.findIndex(e => e.key === etapa);

  return (
    <div className="px-5 py-6 animate-fade-in">
      {/* Stepper */}
      <div className="flex items-center gap-1 mb-8">
        {etapas.map((e, i) => (
          <div key={e.key} className="flex items-center gap-1 flex-1">
            <div className="flex items-center justify-center w-7 h-7 text-xs font-bold"
              style={{
                background: i <= etapaIdx ? 'var(--amber)' : 'var(--bg-surface2)',
                color: i <= etapaIdx ? 'var(--bg-primary)' : 'var(--text-disabled)',
                fontFamily: 'var(--font-mono)',
                fontSize: '10px',
              }}>
              {i + 1}
            </div>
            {i < etapas.length - 1 && (
              <div className="flex-1 h-px" style={{ background: i < etapaIdx ? 'var(--amber)' : 'var(--border)' }} />
            )}
          </div>
        ))}
      </div>

      {/* Etapa 1: Serviço */}
      {etapa === 'servico' && (
        <div>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '22px', color: 'var(--text-primary)', marginBottom: '16px' }}>
            Escolha o Serviço
          </h2>
          <div className="flex flex-col gap-3">
            {servicos.map(s => (
              <button key={s.id} onClick={() => { setServicoSel(s); setEtapa('barbeiro'); }}
                className="flex items-center justify-between p-4 w-full text-left transition-all"
                style={{
                  background: servicoSel?.id === s.id ? 'var(--amber-dim)' : 'var(--bg-surface)',
                  border: servicoSel?.id === s.id ? '1px solid var(--amber)' : '1px solid var(--border)',
                  cursor: 'pointer',
                }}>
                <div className="flex items-center gap-3">
                  <Scissors size={18} style={{ color: 'var(--cor-icone)' }} />
                  <div>
                    <p style={{ fontFamily: 'var(--font-body)', fontWeight: 700, color: 'var(--text-primary)', fontSize: '14px' }}>{s.nome}</p>
                    <p style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-muted)' }}>{s.duracaoMinutos} min</p>
                  </div>
                </div>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', color: 'var(--cor-icone)', fontWeight: 600 }}>{fmt(s.preco)}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Etapa 2: Barbeiro */}
      {etapa === 'barbeiro' && (
        <div>
          <button onClick={() => setEtapa('servico')} className="flex items-center gap-1 mb-4"
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: '11px' }}>
            <ArrowLeft size={14} /> Voltar
          </button>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '22px', color: 'var(--text-primary)', marginBottom: '16px' }}>
            Escolha o Barbeiro
          </h2>
          <div className="flex flex-col gap-3">
            {barbeiros.map(b => (
              <button key={b.id} onClick={() => { setBarbeiroSel(b); setEtapa('data'); }}
                className="flex items-center gap-4 p-4 w-full text-left transition-all"
                style={{
                  background: barbeiroSel?.id === b.id ? 'var(--amber-dim)' : 'var(--bg-surface)',
                  border: barbeiroSel?.id === b.id ? '1px solid var(--amber)' : '1px solid var(--border)',
                  cursor: 'pointer',
                }}>
                <div className="w-11 h-11 flex items-center justify-center"
                  style={{ background: 'var(--amber-dim)', fontFamily: 'var(--font-display)', fontSize: '18px', color: 'var(--amber-light)' }}>
                  {b.usuario.nome.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                </div>
                <div>
                  <p style={{ fontFamily: 'var(--font-body)', fontWeight: 700, color: 'var(--text-primary)', fontSize: '14px' }}>{b.usuario.nome}</p>
                  <div className="flex gap-1 mt-1">
                    {b.especialidades.slice(0, 3).map((e, i) => (
                      <span key={i} className="badge badge-info">{e}</span>
                    ))}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Etapa 3: Data e Horário */}
      {etapa === 'data' && (
        <div>
          <button onClick={() => setEtapa('barbeiro')} className="flex items-center gap-1 mb-4"
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: '11px' }}>
            <ArrowLeft size={14} /> Voltar
          </button>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '22px', color: 'var(--text-primary)', marginBottom: '16px' }}>
            Data e Horário
          </h2>

          <div className="mb-5">
            <label className="input-label"><Calendar size={12} className="inline mr-1" />Data</label>
            <input type="date" value={dataSel} onChange={e => { setDataSel(e.target.value); setHorarioSel(''); }}
              min={hoje} className="ds-input" />
          </div>

          {dataSel && (
            <div>
              <label className="input-label"><Clock size={12} className="inline mr-1" />Horários Disponíveis</label>
              <div className="grid grid-cols-4 gap-2 mt-2">
                {slots.map(s => (
                  <button key={s.horario}
                    disabled={!s.disponivel}
                    onClick={() => { setHorarioSel(s.horario); setEtapa('confirmacao'); }}
                    style={{
                      padding: '10px 4px',
                      fontFamily: 'var(--font-mono)',
                      fontSize: '12px',
                      textAlign: 'center',
                      cursor: s.disponivel ? 'pointer' : 'not-allowed',
                      background: horarioSel === s.horario ? 'var(--amber)' : s.disponivel ? 'var(--bg-surface)' : 'var(--bg-surface2)',
                      color: horarioSel === s.horario ? 'var(--bg-primary)' : s.disponivel ? 'var(--text-primary)' : 'var(--text-disabled)',
                      border: horarioSel === s.horario ? '1px solid var(--amber)' : '1px solid var(--border)',
                      opacity: s.disponivel ? 1 : 0.4,
                    }}>
                    {s.horario}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Etapa 4: Confirmação */}
      {etapa === 'confirmacao' && (
        <div>
          <button onClick={() => setEtapa('data')} className="flex items-center gap-1 mb-4"
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: '11px' }}>
            <ArrowLeft size={14} /> Voltar
          </button>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '22px', color: 'var(--text-primary)', marginBottom: '20px' }}>
            Confirmar Agendamento
          </h2>

          <div className="flex flex-col gap-4 mb-8">
            <div className="p-4" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
              <div className="flex items-center gap-3 mb-3">
                <Scissors size={16} style={{ color: 'var(--cor-icone)' }} />
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--cor-icone)', letterSpacing: '0.12em', textTransform: 'uppercase' as const }}>Serviço</span>
              </div>
              <p style={{ fontFamily: 'var(--font-body)', fontWeight: 700, color: 'var(--text-primary)', fontSize: '15px' }}>{servicoSel?.nome}</p>
              <p style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--cor-icone)', marginTop: '4px' }}>{fmt(servicoSel?.preco || '0')}</p>
            </div>

            <div className="p-4" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
              <div className="flex items-center gap-3 mb-3">
                <User size={16} style={{ color: 'var(--cor-icone)' }} />
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--cor-icone)', letterSpacing: '0.12em', textTransform: 'uppercase' as const }}>Barbeiro</span>
              </div>
              <p style={{ fontFamily: 'var(--font-body)', fontWeight: 700, color: 'var(--text-primary)', fontSize: '15px' }}>{barbeiroSel?.usuario.nome}</p>
            </div>

            <div className="p-4" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
              <div className="flex items-center gap-3 mb-3">
                <Calendar size={16} style={{ color: 'var(--cor-icone)' }} />
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--cor-icone)', letterSpacing: '0.12em', textTransform: 'uppercase' as const }}>Data e Hora</span>
              </div>
              <p style={{ fontFamily: 'var(--font-body)', fontWeight: 700, color: 'var(--text-primary)', fontSize: '15px' }}>
                {new Date(dataSel + 'T00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })}
              </p>
              <p style={{ fontFamily: 'var(--font-mono)', fontSize: '14px', color: 'var(--cor-icone)', marginTop: '4px' }}>{horarioSel}</p>
            </div>
          </div>

          <button onClick={confirmarAgendamento} disabled={enviando}
            className="btn-primary w-full justify-center"
            style={{ padding: '16px', fontSize: '14px' }}>
            {enviando ? 'Confirmando...' : 'Confirmar Agendamento'}
          </button>
        </div>
      )}
    </div>
  );
}
