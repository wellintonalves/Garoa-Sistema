

interface Agendamento {
  id: string;
  dataHora: string;
  status: 'AGUARDANDO' | 'CONFIRMADO' | 'CONCLUIDO' | 'CANCELADO';
  valorCobrado: string;
  origem?: string;
  cliente: { usuario: { nome: string } };
  barbeiroId: string;
  barbeiro: { usuario: { nome: string }; cor: string };
  servico: { nome: string; duracaoMinutos: number; cor: string };
}

interface Bloqueio {
  id: string;
  barbeiroId: string;
  dataInicio: string;
  dataFim: string;
  motivo?: string;
  barbeiro: { usuario: { nome: string } };
}

interface Barbeiro {
  id: string;
  usuario: { nome: string };
  cor: string;
  ativo?: boolean;
}

interface AgendaMobileListProps {
  agendamentos: Agendamento[];
  bloqueios: Bloqueio[];
  barbeiros: Barbeiro[];
  diaMobile: Date;
  horarios: string[];
  setAgendamentoSelecionado: (ag: Agendamento) => void;
  abrirModal: (dataHora?: string) => void;
  getColor: (id: string) => string;
}

const statusLabels: Record<string, string> = {
  AGUARDANDO: 'Aguardando',
  CONFIRMADO: 'Confirmado',
  CONCLUIDO: 'Concluído',
  CANCELADO: 'Cancelado',
};

const statusStyles: Record<string, { bg: string; color: string }> = {
  AGUARDANDO:  { bg: 'rgba(var(--amber-rgb), 0.15)', color: 'var(--amber)' },
  CONFIRMADO:  { bg: 'rgba(var(--text-primary-rgb), 0.1)', color: 'var(--text-primary)' },
  CONCLUIDO:   { bg: 'var(--sucesso-fundo)', color: 'var(--sucesso)' },
  CANCELADO:   { bg: 'var(--perigo-fundo)', color: 'var(--error-text)' },
};

function getDataBrasilia(date: Date): string {
  const formatter = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const parts = formatter.formatToParts(date);
  const day = parts.find(p => p.type === 'day')?.value || '01';
  const month = parts.find(p => p.type === 'month')?.value || '01';
  const year = parts.find(p => p.type === 'year')?.value || '2026';
  return `${year}-${month}-${day}`;
}

function getHoraMinutoBrasilia(date: Date): { hora: number; minuto: number } {
  const formatter = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const parts = formatter.formatToParts(date);
  const hora = parseInt(parts.find(p => p.type === 'hour')?.value || '0', 10);
  const minuto = parseInt(parts.find(p => p.type === 'minute')?.value || '0', 10);
  return { hora, minuto };
}

export function AgendaMobileList({
  agendamentos,
  bloqueios,
  barbeiros,
  diaMobile,
  horarios,
  setAgendamentoSelecionado,
  abrirModal,
  getColor
}: AgendaMobileListProps) {
  const diaISO = getDataBrasilia(diaMobile);

  const agsDoDia = agendamentos.filter(ag => getDataBrasilia(new Date(ag.dataHora)) === diaISO && ag.status !== 'CANCELADO');
  
  if (agsDoDia.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center bg-[var(--bg-surface)] border border-[var(--border)] rounded-lg">
        <p className="text-[var(--texto-secundario)] mb-4" style={{ fontFamily: 'var(--fonte-interface)' }}>
          Nenhum agendamento neste dia
        </p>
        <button onClick={() => abrirModal()} className="btn-primary">
          Novo agendamento
        </button>
      </div>
    );
  }

  // Build the chronological list with gaps
  const elementos = [];
  let gapStart: string | null = null;
  let maxBarbeirosLivres = 0;

  for (let i = 0; i < horarios.length; i++) {
    const horario = horarios[i];
    
    // Find appointments starting exactly at this time
    const agsIniciando = agsDoDia.filter(ag => {
      const hm = getHoraMinutoBrasilia(new Date(ag.dataHora));
      const hStr = `${String(hm.hora).padStart(2, '0')}:${String(hm.minuto).padStart(2, '0')}`;
      return hStr === horario;
    });

    if (agsIniciando.length > 0) {
      // Flush gap if exists
      if (gapStart) {
        const gapEnd = horarios[i - 1];
        const gapText = gapStart === gapEnd ? gapStart : `${gapStart} às ${gapEnd}`;
        elementos.push(
          <div key={`gap-${gapStart}`} className="flex items-center justify-center py-2">
            <div className="h-px bg-[var(--border)] flex-1" />
            <span className="px-3 text-[11px] text-[var(--texto-secundario)] uppercase tracking-wider font-mono">
              {gapText} — {maxBarbeirosLivres} barbeiro{maxBarbeirosLivres !== 1 ? 's' : ''} livre{maxBarbeirosLivres !== 1 ? 's' : ''}
            </span>
            <div className="h-px bg-[var(--border)] flex-1" />
          </div>
        );
        gapStart = null;
        maxBarbeirosLivres = 0;
      }

      // Add appointments
      agsIniciando.sort((a, b) => a.barbeiro.usuario.nome.localeCompare(b.barbeiro.usuario.nome)).forEach(ag => {
        const color = getColor(ag.barbeiroId);
        const st = statusStyles[ag.status] || statusStyles['AGUARDANDO'];
        
        elementos.push(
          <div 
            key={ag.id}
            onClick={() => setAgendamentoSelecionado(ag)}
            className="flex flex-col bg-[var(--bg-surface)] border border-[var(--border)] mb-2 cursor-pointer transition-colors hover:bg-[var(--superficie-2)]"
            style={{ borderLeft: `4px solid ${color}`, borderRadius: '0 8px 8px 0' }}
          >
            <div className="p-3 flex flex-col gap-2">
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-3">
                  <span className="font-mono font-bold text-[var(--text-primary)]">{horario}</span>
                  <span className="font-semibold text-[var(--text-primary)]" style={{ fontFamily: 'var(--fonte-interface)' }}>
                    {ag.cliente.usuario.nome}
                  </span>
                </div>
                <div 
                  className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider"
                  style={{ background: st.bg, color: st.color }}
                >
                  {statusLabels[ag.status] || ag.status}
                </div>
              </div>
              <div className="flex items-center text-[13px] text-[var(--texto-secundario)]" style={{ fontFamily: 'var(--fonte-interface)' }}>
                <span>{ag.servico.nome}</span>
                <span className="mx-2">•</span>
                <span>{ag.barbeiro.usuario.nome}</span>
              </div>
            </div>
          </div>
        );
      });
    } else {
      // Calculate how many barbers are free at this exact slot
      let livres = 0;
      const dtAtual = new Date(diaISO + 'T' + horario + ':00-03:00');
      
      barbeiros.filter(b => b.ativo !== false).forEach(b => {
        // Check if any appointment is ongoing for this barber
        const isOcupadoAg = agsDoDia.some(ag => {
          if (ag.barbeiroId !== b.id) return false;
          if (ag.status === 'CANCELADO') return false;
          const dInicio = new Date(ag.dataHora);
          const dFim = new Date(dInicio.getTime() + ag.servico.duracaoMinutos * 60000);
          return dtAtual >= dInicio && dtAtual < dFim;
        });

        // Check if blocked
        const isBloqueado = bloqueios.some(bl => {
          if (bl.barbeiroId !== b.id) return false;
          const dInicio = new Date(bl.dataInicio);
          const dFim = new Date(bl.dataFim);
          return dtAtual >= dInicio && dtAtual < dFim;
        });

        if (!isOcupadoAg && !isBloqueado) {
          livres++;
        }
      });

      if (!gapStart) {
        gapStart = horario;
        maxBarbeirosLivres = livres;
      } else {
        if (livres > maxBarbeirosLivres) maxBarbeirosLivres = livres;
      }
    }
  }

  // Flush remaining gap if day ends with one
  if (gapStart) {
    const gapEnd = horarios[horarios.length - 1];
    const gapText = gapStart === gapEnd ? gapStart : `${gapStart} às 18:30`;
    elementos.push(
      <div key={`gap-${gapStart}`} className="flex items-center justify-center py-2">
        <div className="h-px bg-[var(--border)] flex-1" />
        <span className="px-3 text-[11px] text-[var(--texto-secundario)] uppercase tracking-wider font-mono">
          {gapText} — {maxBarbeirosLivres} barbeiro{maxBarbeirosLivres !== 1 ? 's' : ''} livre{maxBarbeirosLivres !== 1 ? 's' : ''}
        </span>
        <div className="h-px bg-[var(--border)] flex-1" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      {elementos}
    </div>
  );
}
