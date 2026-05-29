const fs = require('fs');
const path = require('path');
const dir = path.join(__dirname, 'frontend/src/pages/tenant');

fs.mkdirSync(path.join(dir, 'app'), { recursive: true });

fs.writeFileSync(path.join(dir, 'Welcome.tsx'), `
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
`);

fs.writeFileSync(path.join(dir, 'LoginClient.tsx'), `
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
    <div className='flex flex-col items-center justify-center min-h-screen bg-zinc-950 text-white p-4'>
      <h2 className='text-2xl text-orange-500 mb-6'>Login</h2>
      <form onSubmit={handleLogin} className='flex flex-col w-full max-w-xs'>
        <input className='mb-4 p-2 rounded bg-zinc-900 border border-zinc-700 text-white' type='email' placeholder='Email' value={email} onChange={e => setEmail(e.target.value)} required />
        <input className='mb-6 p-2 rounded bg-zinc-900 border border-zinc-700 text-white' type='password' placeholder='Senha' value={senha} onChange={e => setSenha(e.target.value)} required />
        <button type='submit' className='bg-orange-500 text-zinc-950 p-2 rounded font-semibold'>Entrar</button>
      </form>
    </div>
  );
}
`);

fs.writeFileSync(path.join(dir, 'RegisterClient.tsx'), `
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
`);

fs.writeFileSync(path.join(dir, 'app', 'Inicio.tsx'), `
import { useClientAuth } from '../../../hooks/useClientAuth';
import { useNavigate, useParams } from 'react-router-dom';

export function Inicio() {
  const { cliente } = useClientAuth();
  const { slug } = useParams();
  const navigate = useNavigate();

  return (
    <div className='p-6'>
      <h2 className='text-2xl font-bold mb-4'>Olá, <span className='text-orange-500'>{cliente?.nome.split(' ')[0]}</span>!</h2>
      <div className='bg-zinc-900 p-6 rounded-2xl mb-6 shadow-lg border border-zinc-800 flex flex-col items-center justify-center text-center'>
        <p className='text-zinc-400 mb-4'>Você não tem agendamentos próximos.</p>
        <button onClick={() => navigate('/b/' + slug + '/app/agendar')} className='bg-orange-500 text-zinc-950 font-bold py-3 px-8 rounded-xl shadow-md'>Agendar Agora</button>
      </div>
    </div>
  );
}
`);

fs.writeFileSync(path.join(dir, 'app', 'AgendarTenant.tsx'), `
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
`);

fs.writeFileSync(path.join(dir, 'app', 'Historico.tsx'), `
import { useEffect, useState } from 'react';
import { api } from '../../../api';
import { useParams } from 'react-router-dom';

export function Historico() {
  const { slug } = useParams();
  const [agendamentos, setAgendamentos] = useState([]);

  useEffect(() => {
    api.get('/b/' + slug + '/app/meus-agendamentos').then(res => setAgendamentos(res.data)).catch(console.error);
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
`);

fs.writeFileSync(path.join(dir, 'app', 'FidelidadeTenant.tsx'), `
import { useEffect, useState } from 'react';
import { api } from '../../../api';
import { useParams } from 'react-router-dom';

export function FidelidadeTenant() {
  const { slug } = useParams();
  const [fidelidade, setFidelidade] = useState<any>(null);

  useEffect(() => {
    api.get('/b/' + slug + '/app/minha-fidelidade').then(res => setFidelidade(res.data)).catch(console.error);
  }, [slug]);

  return (
    <div className='p-6'>
      <h2 className='text-xl text-orange-500 mb-4'>Fidelidade</h2>
      <div className='bg-zinc-900 p-6 rounded-xl border border-zinc-800 mb-6'>
        <p className='text-center text-4xl font-black text-orange-500'>{fidelidade?.pontos || 0}</p>
        <p className='text-center text-zinc-400'>pontos</p>
      </div>
    </div>
  );
}
`);

fs.writeFileSync(path.join(dir, 'app', 'Perfil.tsx'), `
import { useClientAuth } from '../../../hooks/useClientAuth';
import { useNavigate } from 'react-router-dom';

export function Perfil() {
  const { cliente, sair } = useClientAuth();
  const navigate = useNavigate();

  const handleSair = () => {
    sair();
    navigate('/b/' + cliente?.barbeariaId);
  };

  return (
    <div className='p-6'>
      <h2 className='text-xl text-orange-500 mb-4'>Meu Perfil</h2>
      <div className='bg-zinc-900 p-4 rounded-xl mb-6'>
        <p className='text-white mb-2'><strong>Nome:</strong> {cliente?.nome}</p>
        <p className='text-white'><strong>Email:</strong> {cliente?.email}</p>
      </div>
      <button onClick={handleSair} className='w-full border border-red-500 text-red-500 py-3 rounded-xl font-bold mt-4'>Sair da Conta</button>
    </div>
  );
}
`);
console.log('Arquivos do Tenant criados com sucesso.');
