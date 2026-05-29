
import { useNavigate, useParams } from 'react-router-dom';
import { useClientAuth } from '../../hooks/useClientAuth';
import { useState } from 'react';
import { api } from '../../api';

export function RegisterClient() {
  const navigate = useNavigate();
  const { slug } = useParams();
  const { entrar } = useClientAuth();
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [telefone, setTelefone] = useState('');

  const handleRegister = async (e: any) => {
    e.preventDefault();
    try {
      const res = await api.post('/b/' + slug + '/auth/register', { nome, email, senha, telefone });
      entrar(slug as string, res.data.token, res.data.usuario);
      navigate('/b/' + slug + '/app');
    } catch (err) {
      alert('Erro ao registrar');
    }
  };

  return (
    <div className='flex flex-col items-center justify-center min-h-screen bg-zinc-950 text-white p-4'>
      <h2 className='text-2xl text-orange-500 mb-6'>Criar Conta</h2>
      <form onSubmit={handleRegister} className='flex flex-col w-full max-w-xs'>
        <input className='mb-4 p-2 rounded bg-zinc-900 border border-zinc-700 text-white' type='text' placeholder='Nome' value={nome} onChange={e => setNome(e.target.value)} required />
        <input className='mb-4 p-2 rounded bg-zinc-900 border border-zinc-700 text-white' type='email' placeholder='Email' value={email} onChange={e => setEmail(e.target.value)} required />
        <input className='mb-4 p-2 rounded bg-zinc-900 border border-zinc-700 text-white' type='text' placeholder='WhatsApp' value={telefone} onChange={e => setTelefone(e.target.value)} />
        <input className='mb-6 p-2 rounded bg-zinc-900 border border-zinc-700 text-white' type='password' placeholder='Senha' value={senha} onChange={e => setSenha(e.target.value)} required />
        <button type='submit' className='bg-orange-500 text-zinc-950 p-2 rounded font-semibold'>Cadastrar</button>
      </form>
    </div>
  );
}
