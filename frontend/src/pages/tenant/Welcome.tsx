
import { useNavigate, useParams } from 'react-router-dom';
export function Welcome() {
  const navigate = useNavigate();
  const { slug } = useParams();
  return (
    <div className='flex flex-col items-center justify-center min-h-screen bg-zinc-950 text-orange-500'>
      <h1 className='text-3xl font-bold mb-8'>Bem-vindo</h1>
      <button onClick={() => navigate('/b/' + slug + '/login')} className='bg-orange-500 text-zinc-950 px-6 py-2 rounded-lg font-semibold mb-4 w-64'>Entrar</button>
      <button onClick={() => navigate('/b/' + slug + '/register')} className='bg-transparent border border-orange-500 text-orange-500 px-6 py-2 rounded-lg font-semibold w-64'>Criar Conta</button>
    </div>
  );
}
