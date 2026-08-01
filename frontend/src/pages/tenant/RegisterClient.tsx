
import { useNavigate, useParams } from 'react-router-dom';
import { useClientAuth } from '../../hooks/useClientAuth';
import { useState } from 'react';
import { api } from '../../api';
import { ModalAlert } from '../../components/ModalAlert';

export function RegisterClient() {
  const navigate = useNavigate();
  const { slug } = useParams();
  const { entrar } = useClientAuth();
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [telefone, setTelefone] = useState('');
  const [modalObj, setModalObj] = useState<{aberto: boolean; titulo: string; mensagem: string; tipo: 'erro'|'sucesso'|'aviso'|'info'; isConfirm?: boolean, onConfirm?: () => void, textoBotao?: string}>({ aberto: false, titulo: '', mensagem: '', tipo: 'info' });

  const handleRegister = async (e: any) => {
    e.preventDefault();
    try {
      const res = await api.post('/b/' + slug + '/auth/register', { nome, email, senha, telefone });
      entrar(slug as string, res.data.token, res.data.usuario);
      navigate('/b/' + slug + '/app');
    } catch (err: any) {
      setModalObj({ aberto: true, titulo: 'Falha no cadastro', mensagem: err.response?.data?.erro || 'Erro ao registrar', tipo: 'erro', textoBotao: 'Entendi' });
    }
  };

  return (
    <div className='flex flex-col items-center justify-center min-h-screen bg-[var(--superficie-2)] border-[var(--borda)] text-[var(--texto-principal)] p-4'>
      <h2 className='text-2xl text-orange-500 mb-6'>Criar Conta</h2>
      <form onSubmit={handleRegister} className='flex flex-col w-full max-w-xs'>
        <input className='mb-4 p-2 rounded bg-[var(--superficie-2)] border-[var(--borda-forte)] border bg-[var(--superficie-2)] border-[var(--borda-forte)] text-[var(--texto-principal)]' type='text' placeholder='Nome' value={nome} onChange={e => setNome(e.target.value)} required />
        <input className='mb-4 p-2 rounded bg-[var(--superficie-2)] border-[var(--borda-forte)] border bg-[var(--superficie-2)] border-[var(--borda-forte)] text-[var(--texto-principal)]' type='email' placeholder='Email' value={email} onChange={e => setEmail(e.target.value)} required />
        <input className='mb-4 p-2 rounded bg-[var(--superficie-2)] border-[var(--borda-forte)] border bg-[var(--superficie-2)] border-[var(--borda-forte)] text-[var(--texto-principal)]' type='text' placeholder='WhatsApp' value={telefone} onChange={e => setTelefone(e.target.value)} />
        <input className='mb-6 p-2 rounded bg-[var(--superficie-2)] border-[var(--borda-forte)] border bg-[var(--superficie-2)] border-[var(--borda-forte)] text-[var(--texto-principal)]' type='password' placeholder='Senha' value={senha} onChange={e => setSenha(e.target.value)} required />
        <button type='submit' className='bg-orange-500 text-[var(--texto-principal)] p-2 rounded font-semibold'>Cadastrar</button>
      </form>
      
      <ModalAlert 
        aberto={modalObj.aberto} 
        titulo={modalObj.titulo} 
        mensagem={modalObj.mensagem} 
        tipo={modalObj.tipo} 
        isConfirm={modalObj.isConfirm}
        textoBotao={modalObj.textoBotao || 'Entendi'}
        onConfirmar={modalObj.onConfirm}
        onFechar={() => {
          setModalObj(m => ({ ...m, aberto: false }));
        }} 
      />
    </div>
  );
}
