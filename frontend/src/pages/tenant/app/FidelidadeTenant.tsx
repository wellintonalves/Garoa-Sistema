
import { useEffect, useState } from 'react';
import { api } from '../../../api';
import { useParams } from 'react-router-dom';

export function FidelidadeTenant() {
  const { slug } = useParams();
  const [fidelidade, setFidelidade] = useState<any>(null);

  useEffect(() => {
    api.get('/b/' + slug + '/app/minha-fidelidade').then((res: any) => setFidelidade(res.data)).catch(console.error);
  }, [slug]);

  return (
    <div className='p-6'>
      <h2 className='text-xl text-orange-500 mb-4'>Fidelidade</h2>
      <div className='bg-zinc-900 p-6 rounded-none border border-zinc-800 mb-6'>
        <p className='text-center text-4xl font-black text-orange-500'>{fidelidade?.pontos || 0}</p>
        <p className='text-center text-zinc-400'>pontos</p>
      </div>
    </div>
  );
}
