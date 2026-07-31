import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Clock } from '@phosphor-icons/react';
import { getDisponibilidadeSemana } from '../../../api/clienteApi';
import { SkeletonCard, SkeletonText } from '../../../components/ui/Skeleton';
import { diaBrasiliaStr } from '../../../utils/datas';

interface Slot {
  horario: string;
  disponivel: boolean;
}

interface DiaDisp {
  data: string;
  folga: boolean;
  fechado: boolean;
  slots: Slot[];
}

interface BarbeiroDisp {
  barbeiroId: string;
  barbeiroNome: string;
  dias: DiaDisp[];
}

export function ClienteBarbeariaDisponibilidade() {
  const { barbeariaId } = useParams<{ barbeariaId: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dadosDisponibilidade, setDadosDisponibilidade] = useState<BarbeiroDisp[]>([]);
  const [barbeiroSelecionado, setBarbeiroSelecionado] = useState<string>('todos');

  // Gerar faixa de 7 dias começando de hoje SP
  const diasRange = useMemo(() => {
    const arr = [];
    const hoje = new Date(`${diaBrasiliaStr()}T12:00:00Z`);
    for (let i = 0; i < 7; i++) {
      const d = new Date(hoje);
      d.setDate(hoje.getDate() + i);
      arr.push(d.toISOString().split('T')[0]);
    }
    return arr;
  }, []);

  const [dataSelecionada, setDataSelecionada] = useState<string>(diasRange[0]);

  useEffect(() => {
    if (!barbeariaId) return;
    
    const abortController = new AbortController();
    
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await getDisponibilidadeSemana(barbeariaId, {});
        if (!abortController.signal.aborted) {
          setDadosDisponibilidade(res.data);
        }
      } catch (err) {
        if (!abortController.signal.aborted) {
          console.error('Erro ao buscar disponibilidade:', err);
          setError('Não foi possível carregar os horários. Tente novamente.');
        }
      } finally {
        if (!abortController.signal.aborted) {
          setLoading(false);
        }
      }
    };

    fetchData();

    return () => {
      abortController.abort();
    };
  }, [barbeariaId]);

  const barbeirosAtivos = useMemo(() => {
    return (dadosDisponibilidade ?? []).map(d => ({ id: d.barbeiroId, nome: d.barbeiroNome }));
  }, [dadosDisponibilidade]);

  const fmtDiaSemana = (dStr: string) => {
    const d = new Date(`${dStr}T12:00:00Z`);
    const nomes = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
    return nomes[d.getDay()];
  };

  const fmtDiaMes = (dStr: string) => {
    return dStr.split('-')[2];
  };

  const getDisponibilidadeDiaSelecionado = () => {
    const listaFinal: { barbeiroId: string; barbeiroNome: string; dia: DiaDisp }[] = [];
    dadosDisponibilidade.forEach(barb => {
      if (barbeiroSelecionado !== 'todos' && barb.barbeiroId !== barbeiroSelecionado) return;
      const diaEncontrado = barb.dias.find(d => d.data === dataSelecionada);
      if (diaEncontrado) {
        listaFinal.push({ barbeiroId: barb.barbeiroId, barbeiroNome: barb.barbeiroNome, dia: diaEncontrado });
      }
    });
    return listaFinal;
  };

  const renderSlotsBarbeiro = (barbId: string, barbNome: string, diaInfo: DiaDisp) => {
    if (diaInfo.folga || diaInfo.fechado) {
      return (
        <div className="bg-[var(--superficie-1)] border border-[var(--borda)] rounded-lg p-5 text-center my-4">
          <p style={{ fontFamily: 'var(--fonte-interface)', fontSize: '14px', color: 'var(--texto-secundario)' }}>
            {barbNome} não atende neste dia.
          </p>
        </div>
      );
    }

    if (diaInfo.slots.length === 0) {
      return (
        <div className="bg-[var(--superficie-1)] border border-[var(--borda)] rounded-lg p-5 text-center my-4">
          <p style={{ fontFamily: 'var(--fonte-interface)', fontSize: '14px', color: 'var(--texto-secundario)' }}>
            Nenhum horário disponível para {barbNome} neste dia.
          </p>
        </div>
      );
    }

    return (
      <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2 my-4">
        {(diaInfo?.slots ?? []).map(s => (
          <button
            key={s.horario}
            disabled={!s.disponivel}
            onClick={() => {
              if (s.disponivel) {
                navigate(`/cliente/barbearia/${barbeariaId}/agendar?barbeiroId=${barbId}&data=${diaInfo.data}&hora=${s.horario}&fluxoRapido=true`);
              }
            }}
            className="flex items-center justify-center rounded-md border text-center transition-all min-h-[48px]"
            style={s.disponivel ? {
              background: 'rgba(var(--cor-primaria-rgb), 0.1)',
              borderColor: 'var(--amber)',
              color: 'var(--amber)',
              fontFamily: 'var(--fonte-mono)',
              fontSize: '14px',
              fontWeight: 600
            } : {
              background: 'var(--superficie-1)',
              borderColor: 'var(--borda)',
              color: 'var(--texto-secundario)',
              fontFamily: 'var(--fonte-mono)',
              fontSize: '14px',
              opacity: 0.5,
              cursor: 'not-allowed'
            }}
          >
            {s.horario}
          </button>
        ))}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-[var(--fundo-app)] flex flex-col">
      <header className="p-4 border-b border-[var(--borda)] bg-[var(--superficie-1)] sticky top-0 z-10 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-[var(--superficie-2)] text-[var(--text-primary)] transition-colors">
          <ArrowLeft size={20} />
        </button>
        <h1 style={{ fontFamily: 'var(--fonte-serif)', fontSize: '18px', fontWeight: 600, color: 'var(--text-primary)' }}>
          Horários disponíveis
        </h1>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-5 max-w-3xl mx-auto w-full pb-20">
        
        {/* Fita de Dias */}
        <div className="flex gap-2 overflow-x-auto pb-4 scrollbar-hide -mx-4 px-4">
          {(diasRange ?? []).map(dStr => {
            const isSel = dataSelecionada === dStr;
            return (
              <button
                key={dStr}
                onClick={() => setDataSelecionada(dStr)}
                className="flex-shrink-0 flex flex-col items-center justify-center w-[60px] h-[72px] rounded-lg border transition-colors min-h-[48px]"
                style={{
                  background: isSel ? 'var(--amber)' : 'var(--superficie-1)',
                  borderColor: isSel ? 'var(--amber)' : 'var(--borda)',
                  color: isSel ? '#000' : 'var(--text-primary)'
                }}
              >
                <span style={{ fontFamily: 'var(--fonte-interface)', fontSize: '11px', fontWeight: 600, opacity: isSel ? 0.8 : 0.6 }}>{fmtDiaSemana(dStr)}</span>
                <span style={{ fontFamily: 'var(--fonte-serif)', fontSize: '20px', fontWeight: 700, marginTop: '2px' }}>{fmtDiaMes(dStr)}</span>
              </button>
            );
          })}
        </div>

        {/* Aviso de Estimativa */}
        <div className="flex items-start gap-2 bg-[rgba(var(--cor-primaria-rgb),0.05)] border border-[rgba(var(--cor-primaria-rgb),0.2)] p-3 rounded-md mb-6 mt-2">
          <Clock size={18} className="text-[var(--amber)] mt-0.5 flex-shrink-0" />
          <p style={{ fontFamily: 'var(--fonte-interface)', fontSize: '12px', color: 'var(--texto-secundario)', lineHeight: 1.4 }}>
            Os horários exibidos são estimados. A disponibilidade real pode variar após a escolha do serviço.
          </p>
        </div>

        {/* Filtro de Barbeiros (Chips) */}
        {!loading && !error && barbeirosAtivos.length > 0 && (
          <div className="flex gap-2 overflow-x-auto pb-4 scrollbar-hide -mx-4 px-4 mb-2">
            <button
              onClick={() => setBarbeiroSelecionado('todos')}
              className="flex-shrink-0 px-4 h-9 rounded-full border flex items-center justify-center min-h-[48px] md:min-h-0"
              style={{
                background: barbeiroSelecionado === 'todos' ? 'rgba(var(--cor-primaria-rgb), 0.12)' : 'var(--superficie-1)',
                borderColor: barbeiroSelecionado === 'todos' ? 'var(--amber)' : 'var(--borda)',
                color: barbeiroSelecionado === 'todos' ? 'var(--amber)' : 'var(--text-primary)',
                fontFamily: 'var(--fonte-interface)', fontSize: '13px', fontWeight: 500
              }}
            >
              Todos
            </button>
            {(barbeirosAtivos ?? []).map(b => (
              <button
                key={b.id}
                onClick={() => setBarbeiroSelecionado(b.id)}
                className="flex-shrink-0 px-4 h-9 rounded-full border flex items-center justify-center min-h-[48px] md:min-h-0"
                style={{
                  background: barbeiroSelecionado === b.id ? 'rgba(var(--cor-primaria-rgb), 0.12)' : 'var(--superficie-1)',
                  borderColor: barbeiroSelecionado === b.id ? 'var(--amber)' : 'var(--borda)',
                  color: barbeiroSelecionado === b.id ? 'var(--amber)' : 'var(--text-primary)',
                  fontFamily: 'var(--fonte-interface)', fontSize: '13px', fontWeight: 500
                }}
              >
                {b.nome}
              </button>
            ))}
          </div>
        )}

        {/* Grade de Horários */}
        {loading ? (
          <div className="mt-6 flex flex-col gap-6">
            <SkeletonText lines={1} style={{ width: '150px' }} />
            <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
              {(Array.from({ length: 8 }) ?? []).map((_, i) => <SkeletonCard key={i} style={{ height: '48px' }} />)}
            </div>
          </div>
        ) : error ? (
          <div className="mt-8 text-center bg-[var(--erro-fundo)] border border-[var(--erro)] p-6 rounded-lg mx-auto max-w-sm">
            <p style={{ fontFamily: 'var(--fonte-interface)', color: 'var(--erro)' }}>{error}</p>
          </div>
        ) : barbeirosAtivos.length === 0 ? (
          <div className="mt-8 text-center bg-[var(--superficie-1)] border border-[var(--borda)] p-6 rounded-lg mx-auto max-w-sm">
            <p style={{ fontFamily: 'var(--fonte-interface)', fontSize: '14px', color: 'var(--texto-secundario)' }}>
              Esta barbearia ainda não tem barbeiros disponíveis para agendamento
            </p>
          </div>
        ) : (
          <div className="mt-4 flex flex-col gap-8">
            {getDisponibilidadeDiaSelecionado().length === 0 ? (
              <div className="text-center py-10">
                <p style={{ fontFamily: 'var(--fonte-interface)', fontSize: '14px', color: 'var(--texto-secundario)' }}>
                  Nenhuma informação disponível.
                </p>
              </div>
            ) : (
              (getDisponibilidadeDiaSelecionado() ?? []).map(info => (
                <div key={info.barbeiroId}>
                  {barbeiroSelecionado === 'todos' && (
                    <h3 style={{ fontFamily: 'var(--fonte-serif)', fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)' }}>
                      {info.barbeiroNome}
                    </h3>
                  )}
                  {renderSlotsBarbeiro(info.barbeiroId, info.barbeiroNome, info.dia)}
                </div>
              ))
            )}
          </div>
        )}

      </div>
    </div>
  );
}
