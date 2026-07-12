
import { useClientAuth } from '../../../hooks/useClientAuth';
import { useNavigate, useParams } from 'react-router-dom';

export function Inicio() {
  const { cliente } = useClientAuth();
  const { slug } = useParams();
  const navigate = useNavigate();

  return (
    <div className='p-6'>
      <h2 className='text-2xl font-bold mb-4'>Olá, <span className='text-orange-500'>{cliente?.nome.split(' ')[0]}</span>!</h2>
      <div className='bg-zinc-900 p-6 rounded-none mb-6 shadow-lg border border-zinc-800 flex flex-col items-center justify-center text-center'>
        <p className='text-zinc-400 mb-4'>Você não tem agendamentos próximos.</p>
        <button onClick={() => navigate('/b/' + slug + '/app/agendar')} className='bg-orange-500 text-zinc-950 font-bold py-3 px-8 rounded-none shadow-md'>Agendar Agora</button>
      </div>
    </div>
  );
}
