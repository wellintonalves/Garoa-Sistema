import { useState, useEffect } from 'react';
import { AgendaMobileChips } from './AgendaMobileChips';
import { AgendaMobileToggle } from './AgendaMobileToggle';
import { AgendaMobileGrid } from './AgendaMobileGrid';
import { AgendaMobileList } from './AgendaMobileList';

interface Agendamento {
  id: string;
  dataHora: string;
  status: 'AGUARDANDO' | 'CONFIRMADO' | 'CONCLUIDO' | 'CANCELADO';
  valorCobrado: string;
  origem?: string;
  cliente: { id: string; usuario: { nome: string } };
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

interface AgendaMobileProps {
  agendamentos: Agendamento[];
  bloqueios: Bloqueio[];
  barbeiros: Barbeiro[];
  diaMobile: Date;
  horarios: string[];
  getColor: (id: string) => string;
  abrirModal: (dataHora?: string, barbeiroId?: string) => void;
  setAgendamentoSelecionado: (ag: Agendamento) => void;
  removerBloqueio: (id: string) => void;
  modo: 'grade' | 'lista';
  setModo: (modo: 'grade' | 'lista') => void;
}

export function AgendaMobile({
  agendamentos,
  bloqueios,
  barbeiros,
  diaMobile,
  horarios,
  getColor,
  abrirModal,
  setAgendamentoSelecionado,
  removerBloqueio,
  modo,
  setModo
}: AgendaMobileProps) {
  const barbeirosValidos = barbeiros.filter(b => b.ativo !== false);

  const [barbeiroSelecionado, setBarbeiroSelecionado] = useState<string>(() => {
    return localStorage.getItem('agenda.barbeiroSelecionado') || '';
  });

  // Fallback to first barber if none selected or if selected doesn't exist anymore
  useEffect(() => {
    if (barbeirosValidos.length > 0) {
      if (!barbeiroSelecionado || !barbeirosValidos.find(b => b.id === barbeiroSelecionado)) {
        setBarbeiroSelecionado(barbeirosValidos[0].id);
        localStorage.setItem('agenda.barbeiroSelecionado', barbeirosValidos[0].id);
      }
    }
  }, [barbeirosValidos, barbeiroSelecionado]);

  // Handle manual selection
  const handleSelectBarbeiro = (id: string) => {
    setBarbeiroSelecionado(id);
    localStorage.setItem('agenda.barbeiroSelecionado', id);
  };

  return (
    <div className="flex flex-col gap-4 w-full">
      {modo === 'grade' && barbeirosValidos.length > 0 && (
        <AgendaMobileChips 
          barbeiros={barbeirosValidos} 
          selecionado={barbeiroSelecionado} 
          onSelect={handleSelectBarbeiro}
          getColor={getColor}
        />
      )}
      
      <AgendaMobileToggle modo={modo} onChange={setModo} />

      {modo === 'grade' && barbeiroSelecionado ? (
        <AgendaMobileGrid 
          agendamentos={agendamentos}
          bloqueios={bloqueios}
          barbeiroSelecionado={barbeiroSelecionado}
          diaMobile={diaMobile}
          horarios={horarios}
          setAgendamentoSelecionado={setAgendamentoSelecionado}
          removerBloqueio={removerBloqueio}
          abrirModal={abrirModal}
        />
      ) : (
        <AgendaMobileList 
          agendamentos={agendamentos}
          bloqueios={bloqueios}
          barbeiros={barbeirosValidos}
          diaMobile={diaMobile}
          horarios={horarios}
          setAgendamentoSelecionado={setAgendamentoSelecionado}
          abrirModal={abrirModal}
          getColor={getColor}
        />
      )}
    </div>
  );
}
