
import { useNavigate, useParams } from 'react-router-dom';
export function AgendarTenant() {
  const { slug } = useParams();
  const navigate = useNavigate();
  return (
    <div className='p-6 text-center'>
       <h2 className='text-xl text-orange-500 mb-4'>Novo Agendamento</h2>
       <p className='text-zinc-400 mb-8'>Aqui entra o fluxo completo de agendamento...</p>
       <button onClick={() => navigate('/b/' + slug + '/app')} className='bg-orange-500 text-zinc-950 px-6 py-2 rounded font-bold'>Voltar</button>
    </div>
  );
}
