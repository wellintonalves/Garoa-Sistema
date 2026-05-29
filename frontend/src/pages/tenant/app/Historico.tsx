
import { useEffect, useState } from 'react';
import { api } from '../../../api';
import { useParams } from 'react-router-dom';

export function Historico() {
  const { slug } = useParams();
  const [agendamentos, setAgendamentos] = useState([]);

  useEffect(() => {
    api.get('/b/' + slug + '/app/meus-agendamentos').then((res: any) => setAgendamentos(res.data)).catch(console.error);
  }, [slug]);

  return (
    <div className='p-6'>
      <h2 className='text-xl text-orange-500 mb-4'>Histórico</h2>
      {agendamentos.length === 0 ? <p className="text-zinc-400">Nenhum agendamento encontrado.</p> : agendamentos.map((ag: any) => (
        <div key={ag.id} className='bg-zinc-900 p-4 rounded-xl mb-3 border border-zinc-800'>
          <p className='font-bold text-orange-400'>{ag.servico?.nome || 'Serviço'}</p>
          <p className='text-sm text-zinc-400'>{new Date(ag.dataHora).toLocaleString('pt-BR')} com {ag.barbeiro?.usuario?.nome}</p>
        </div>
      ))}
    </div>
  );
}
