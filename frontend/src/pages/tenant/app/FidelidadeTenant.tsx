
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
      <div className='bg-[var(--superficie-2)] border-[var(--borda)] p-6 rounded-xl border bg-[var(--superficie-2)] border-[var(--borda)] mb-6'>
        <p className='text-center text-4xl font-black text-orange-500'>{fidelidade?.pontos || 0}</p>
        <p className='text-center text-[var(--texto-secundario)]'>pontos</p>
      </div>
    </div>
  );
}
