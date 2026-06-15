// Tela inicial do app do cliente — Welcome
import { useNavigate } from 'react-router-dom';
import { useClienteAuth } from '../../hooks/useClienteAuth';
import { LoadingSpinner } from '../../components/LoadingSpinner';
import { Scissors } from 'lucide-react';

export function ClienteWelcome() {
  const navigate = useNavigate();
  const { cliente, carregando } = useClienteAuth();

  if (carregando) return <LoadingSpinner />;

  // Se já está logado, vai direto pro home
  if (cliente) {
    navigate('/cliente/home', { replace: true });
    return null;
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-6"
      style={{ background: 'linear-gradient(180deg, #0A0A0A 0%, #141414 50%, #1A1408 100%)' }}>

      {/* Logo */}
      <div className="mb-8 animate-fade-in flex flex-col items-center">
        <div className="w-24 h-24 rounded-full flex items-center justify-center mb-6"
          style={{
            background: 'linear-gradient(135deg, #F59E0B 0%, rgba(245, 158, 11, 0.15) 100%)',
            boxShadow: '0 0 60px rgba(212, 130, 10, 0.3)',
          }}>
          <Scissors size={48} style={{ color: '#0A0A0A' }} />
        </div>

        <h1 style={{
          fontFamily: 'var(--fonte-interface)',
          fontSize: '48px',
          letterSpacing: '0.06em',
          color: '#FFFFFF',
          lineHeight: 1,
        }}>
          GAROA
        </h1>
        <p style={{
          fontFamily: 'var(--fonte-numeros)',
          fontSize: '11px',
          letterSpacing: '0.3em',
          color: '#F59E0B',
          textTransform: 'uppercase',
          marginTop: '8px',
        }}>
          Barbearia App
        </p>
      </div>

      {/* Botões */}
      <div className="w-full max-w-xs flex flex-col gap-4 animate-fade-in" style={{ animationDelay: '0.2s' }}>
        <button
          onClick={() => navigate('/cliente/login')}
          className="flex items-center gap-2 py-3 bg-[#F59E0B] hover:bg-[#D97706] text-[#0F172A] font-bold uppercase tracking-widest text-xs rounded transition-colors w-full justify-center"
          style={{ padding: '16px 24px', fontSize: '13px' }}
        >
          Entrar
        </button>
        <button
          onClick={() => navigate('/cliente/register')}
          className="btn-secondary w-full justify-center"
          style={{ padding: '15px 24px', fontSize: '13px' }}
        >
          Criar Conta
        </button>
      </div>

      {/* Footer */}
      <p style={{
        position: 'absolute',
        bottom: '2rem',
        fontFamily: 'var(--fonte-numeros)',
        fontSize: '9px',
        color: 'var(--text-disabled)',
        letterSpacing: '0.15em',
        textTransform: 'uppercase',
      }}>
        Garoa Sistema © 2025
      </p>
    </div>
  );
}
