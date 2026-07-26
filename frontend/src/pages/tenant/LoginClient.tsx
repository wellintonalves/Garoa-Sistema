
import { useNavigate, useParams } from 'react-router-dom';
import { useClientAuth } from '../../hooks/useClientAuth';
import { useState } from 'react';
import { api } from '../../api';

export function LoginClient() {
  const navigate = useNavigate();
  const { slug } = useParams();
  const { entrar } = useClientAuth();
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');

  const handleLogin = async (e: any) => {
    e.preventDefault();
    try {
      const res = await api.post('/b/' + slug + '/auth/login', { email, senha });
      entrar(slug as string, res.data.token, res.data.usuario);
      navigate('/b/' + slug + '/app');
    } catch (err) {
      alert('Erro no login');
    }
  };

  return (
    <div className='flex flex-col items-center justify-center min-h-screen bg-[var(--superficie-2)] border-[var(--borda)] text-[var(--texto-principal)] p-4'>
      <h2 className='text-2xl text-orange-500 mb-6'>Login</h2>
      <form onSubmit={handleLogin} className='flex flex-col w-full max-w-xs'>
        <input className='mb-4 p-2 rounded bg-[var(--superficie-2)] border-[var(--borda-forte)] border bg-[var(--superficie-2)] border-[var(--borda-forte)] text-[var(--texto-principal)]' type='email' placeholder='Email' value={email} onChange={e => setEmail(e.target.value)} required />
        <input className='mb-6 p-2 rounded bg-[var(--superficie-2)] border-[var(--borda-forte)] border bg-[var(--superficie-2)] border-[var(--borda-forte)] text-[var(--texto-principal)]' type='password' placeholder='Senha' value={senha} onChange={e => setSenha(e.target.value)} required />
        <button type='submit' className='bg-orange-500 text-[var(--texto-principal)] p-2 rounded font-semibold'>Entrar</button>
      </form>
    </div>
  );
}
