
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
      <div className='bg-[var(--superficie-2)] border-[var(--borda)] p-4 rounded-xl mb-6'>
        <p className='text-[var(--texto-principal)] mb-2'><strong>Nome:</strong> {cliente?.nome}</p>
        <p className='text-[var(--texto-principal)]'><strong>Email:</strong> {cliente?.email}</p>
      </div>
      <button onClick={handleSair} className='w-full border border-[var(--perigo)] text-[var(--perigo)] py-3 rounded-xl font-bold mt-4'>Sair da Conta</button>
    </div>
  );
}
