import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, WarningCircle, CalendarBlank } from '@phosphor-icons/react';
import clienteApi from '../../../api/clienteApi';
import { SkeletonCard, SkeletonText } from '../../../components/ui/Skeleton';
import { EstadoVazio } from '../../../components/ui/EstadoVazio';
import { formatarNomeServico } from '../../../utils/formato';

interface AgendamentoItem {
  id: string;
  dataHora: string;
  status: string;
  valorCobrado: string;
  servico: { id: string; nome: string };
  barbeiro: { id: string; usuario: { nome: string } };
}

type FiltroStatus = 'Todos' | 'Concluídos' | 'Cancelados';

export function ClienteBarbeariaHistorico() {
  const { barbeariaId } = useParams<{ barbeariaId: string }>();
  const navigate = useNavigate();
  const [agendamentos, setAgendamentos] = useState<AgendamentoItem[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState(false);
  const [filtro, setFiltro] = useState<FiltroStatus>('Todos');
  const [pagina, setPagina] = useState(1);
  const itensPorPagina = 10;

  const carregar = () => {
    setCarregando(true);
    setErro(false);
    clienteApi.get<AgendamentoItem[]>(`/cliente/barbearia/${barbeariaId}/agendamentos`)
      .then((res: any) => {
        const sorted = res.data.sort((a: AgendamentoItem, b: AgendamentoItem) => new Date(b.dataHora).getTime() - new Date(a.dataHora).getTime());
        setAgendamentos(sorted);
      })
      .catch(() => setErro(true))
      .finally(() => setCarregando(false));
  };

  useEffect(() => {
    if (barbeariaId) carregar();
  }, [barbeariaId]);

  const fmtData = (d: string) => new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
  const fmtHora = (d: string) => new Date(d).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

  const getStatusDisplay = (status: string) => {
    switch (status) {
      case 'CONCLUIDO': return <span style={{ fontSize: '11px', fontWeight: 600, padding: '4px 10px', borderRadius: '999px', background: 'rgba(52,211,153,0.14)', color: 'var(--sucesso)' }}>Concluído</span>;
      case 'CANCELADO': return <span style={{ fontSize: '11px', fontWeight: 600, padding: '4px 10px', borderRadius: '999px', background: 'rgba(239,68,68,0.14)', color: 'var(--erro)' }}>Cancelado</span>;
      default: return <span style={{ fontSize: '11px', fontWeight: 600, padding: '4px 10px', borderRadius: '999px', background: 'rgba(var(--cor-primaria-rgb),0.14)', color: 'var(--amber)' }}>Agendado</span>;
    }
  };

  const filtrados = useMemo(() => {
    if (filtro === 'Concluídos') return agendamentos.filter(a => a.status === 'CONCLUIDO');
    if (filtro === 'Cancelados') return agendamentos.filter(a => a.status === 'CANCELADO');
    return agendamentos;
  }, [agendamentos, filtro]);

  const exibidos = useMemo(() => filtrados.slice(0, pagina * itensPorPagina), [filtrados, pagina]);
  const temMais = exibidos.length < filtrados.length;

  if (carregando) {
    return (
      <div className="px-5 py-6 max-w-3xl mx-auto flex flex-col gap-4 animate-fade-in">
        <SkeletonText lines={1} style={{ width: '120px' }} />
        <SkeletonCard style={{ height: '48px' }} />
        {Array.from({ length: 5 }).map((_, i) => (
          <SkeletonCard key={i} style={{ height: '80px' }} />
        ))}
      </div>
    );
  }

  if (erro) {
    return (
      <div className="px-5 py-12 max-w-3xl mx-auto flex flex-col items-center justify-center text-center animate-fade-in">
        <WarningCircle size={48} className="text-[var(--erro)] mb-4" />
        <h2 style={{ fontFamily: 'var(--fonte-serif)', fontSize: '20px', color: 'var(--text-primary)', marginBottom: '8px' }}>Não foi possível carregar</h2>
        <p style={{ fontFamily: 'var(--fonte-interface)', fontSize: '14px', color: 'var(--texto-secundario)', marginBottom: '24px' }}>Tivemos um problema ao buscar seu histórico de agendamentos.</p>
        <button onClick={carregar} className="btn-primary px-6 flex items-center justify-center gap-2" style={{ height: '48px', fontSize: '13px', fontWeight: 600 }}>Tentar novamente</button>
      </div>
    );
  }

  return (
    <div className="px-5 py-6 max-w-3xl mx-auto pb-12 animate-fade-in">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate(`/cliente/barbearia/${barbeariaId}`)} className="p-2 -ml-2 rounded-full hover:bg-[var(--superficie-2)] transition-colors text-[var(--texto-secundario)]">
          <ArrowLeft size={20} />
        </button>
        <h1 style={{ fontFamily: 'var(--fonte-serif)', fontSize: '24px', fontWeight: 600, color: 'var(--text-primary)' }}>Histórico</h1>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-2 mb-4 hide-scrollbar">
        {(['Todos', 'Concluídos', 'Cancelados'] as const).map(f => (
          <button key={f} onClick={() => { setFiltro(f); setPagina(1); }}
            style={{
              padding: '6px 12px',
              borderRadius: '999px',
              fontFamily: 'var(--fonte-interface)',
              fontSize: '13px',
              fontWeight: 500,
              whiteSpace: 'nowrap',
              border: filtro === f ? '1px solid var(--amber)' : '1px solid var(--borda)',
              background: filtro === f ? 'rgba(var(--cor-primaria-rgb), 0.12)' : 'var(--superficie-1)',
              color: filtro === f ? 'var(--amber)' : 'var(--texto-secundario)'
            }}>
            {f}
          </button>
        ))}
      </div>

      {filtrados.length === 0 ? (
        <div className="mt-8 border border-[var(--borda)] rounded-md bg-[var(--superficie-1)] p-8">
          <EstadoVazio
            icone={CalendarBlank}
            titulo="Nenhum agendamento"
            descricao={filtro === 'Todos' ? 'Você ainda não possui agendamentos nesta barbearia.' : `Nenhum agendamento com o status ${filtro.toLowerCase()}.`}
          />
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {exibidos.map(a => (
            <div key={a.id} className="p-4 rounded-md border border-[var(--borda)] bg-[var(--superficie-1)] flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <p style={{ fontFamily: 'var(--fonte-interface)', fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)' }}>{formatarNomeServico(a)}</p>
                <p style={{ fontFamily: 'var(--fonte-interface)', fontSize: '13px', color: 'var(--texto-secundario)', marginTop: '2px' }}>com {a.barbeiro?.usuario?.nome || 'Profissional'}</p>
              </div>
              <div className="flex items-center justify-between md:flex-col md:items-end gap-2">
                <div className="text-left md:text-right">
                  <span style={{ fontFamily: 'var(--fonte-mono)', fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>R$ {a.valorCobrado || '--'}</span>
                  <p style={{ fontFamily: 'var(--fonte-mono)', fontSize: '12px', color: 'var(--texto-secundario)', marginTop: '2px' }}>{fmtData(a.dataHora)} às {fmtHora(a.dataHora)}</p>
                </div>
                {getStatusDisplay(a.status)}
              </div>
            </div>
          ))}

          {temMais && (
            <button onClick={() => setPagina(p => p + 1)} className="w-full mt-2 py-3 flex items-center justify-center rounded-md border border-[var(--borda)] bg-[var(--superficie-1)] hover:bg-[var(--superficie-2)] transition-colors"
              style={{ fontFamily: 'var(--fonte-interface)', fontSize: '13px', fontWeight: 600, color: 'var(--texto-secundario)', height: '48px' }}>
              Carregar mais
            </button>
          )}
        </div>
      )}
    </div>
  );
}
