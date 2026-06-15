// Tela de cadastro do cliente
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useClienteAuth } from '../../hooks/useClienteAuth';
import { Scissors, ArrowLeft } from 'lucide-react';

export function ClienteRegister() {
  const navigate = useNavigate();
  const { registrar } = useClienteAuth();
  const [nome, setNome] = useState('');
  const [telefone, setTelefone] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro('');

    if (senha.length < 6) {
      setErro('A senha deve ter pelo menos 6 caracteres');
      return;
    }

    setEnviando(true);
    try {
      await registrar(nome, email, senha, telefone);
      navigate('/cliente/home');
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { erro?: string } } };
      setErro(axiosErr.response?.data?.erro || 'Erro ao criar conta');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="flex flex-col min-h-screen px-6 py-8"
      style={{ background: '#0F172A' }}>

      {/* Header */}
      <button onClick={() => navigate('/cliente')}
        className="flex items-center gap-2 mb-8"
        style={{ color: '#94A3B8', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--fonte-interface)', fontSize: '11px', letterSpacing: '0.1em', textTransform: 'uppercase' as const }}>
        <ArrowLeft size={16} /> Voltar
      </button>

      {/* Logo */}
      <div className="flex flex-col items-center mb-8">
        <div className="w-16 h-16 rounded-full flex items-center justify-center mb-4"
          style={{ background: 'rgba(245, 158, 11, 0.10)' }}>
          <Scissors size={28} style={{ color: '#F59E0B' }} />
        </div>
        <h1 style={{
          fontFamily: 'var(--fonte-interface)',
          fontSize: '28px',
          letterSpacing: '0.04em',
          color: '#FFFFFF',
        }}>
          Criar Conta
        </h1>
      </div>

      {/* Formulário */}
      <form onSubmit={handleSubmit} className="flex flex-col gap-4 w-full max-w-sm mx-auto animate-fade-in">
        {erro && (
          <div style={{
            background: 'var(--error)',
            color: 'var(--error-text)',
            padding: '10px 14px',
            fontFamily: 'var(--fonte-interface)',
            fontSize: '11px',
          }}>{erro}</div>
        )}

        <div>
          <label className="input-label">Nome Completo</label>
          <input
            type="text"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            className="w-full bg-[#1E293B] border border-[#334155] rounded text-[#FFFFFF] placeholder-[#64748B] focus:outline-none focus:border-[#F59E0B] py-2.5"
            placeholder="Seu nome completo"
            required
          />
        </div>

        <div>
          <label className="input-label">WhatsApp</label>
          <input
            type="tel"
            value={telefone}
            onChange={(e) => setTelefone(e.target.value)}
            className="w-full bg-[#1E293B] border border-[#334155] rounded text-[#FFFFFF] placeholder-[#64748B] focus:outline-none focus:border-[#F59E0B] py-2.5"
            placeholder="(11) 99999-9999"
          />
        </div>

        <div>
          <label className="input-label">Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full bg-[#1E293B] border border-[#334155] rounded text-[#FFFFFF] placeholder-[#64748B] focus:outline-none focus:border-[#F59E0B] py-2.5"
            placeholder="seu@email.com"
            required
          />
        </div>

        <div>
          <label className="input-label">Senha</label>
          <input
            type="password"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            className="w-full bg-[#1E293B] border border-[#334155] rounded text-[#FFFFFF] placeholder-[#64748B] focus:outline-none focus:border-[#F59E0B] py-2.5"
            placeholder="Mínimo 6 caracteres"
            required
          />
        </div>

        <button type="submit" disabled={enviando}
          className="flex items-center gap-2 py-3 bg-[#F59E0B] hover:bg-[#D97706] text-[#0F172A] font-bold uppercase tracking-widest text-xs rounded transition-colors w-full justify-center"
          style={{ padding: '14px', fontSize: '13px', marginTop: '8px' }}>
          {enviando ? 'Criando...' : 'Criar Minha Conta'}
        </button>

        <div className="flex justify-center mt-4">
          <button type="button" onClick={() => navigate('/cliente/login')}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              fontFamily: 'var(--fonte-interface)', fontSize: '11px',
              color: '#F59E0B', letterSpacing: '0.08em',
            }}>
            Já tenho conta, entrar
          </button>
        </div>
      </form>
    </div>
  );
}
