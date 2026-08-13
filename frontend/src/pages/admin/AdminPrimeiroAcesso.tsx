import { useState } from 'react';
import { User, Envelope as Mail, Lock, WarningCircle as AlertCircle, CheckCircle, Eye, EyeSlash as EyeOff } from '@phosphor-icons/react';
import { useNavigate } from 'react-router-dom';
import api from '../../api/client';
import { Input, Botao } from '../../components/ui';

export function AdminPrimeiroAcesso() {
  const navigate = useNavigate();
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState(false);
  const [carregando, setCarregando] = useState(false);

  async function handleRegistro(e: React.FormEvent) {
    e.preventDefault();
    setErro('');
    setCarregando(true);
    try {
      const res = await api.post('/auth/register', { nome: nome.trim(), email: email.trim(), senha, papel: 'ADMIN' });
      setSucesso(true);
      const token = res.data.token;
      const usuarioId = res.data.usuario.id;
      setTimeout(() => navigate('/verificar-email', {
        state: {
          email: email.trim(),
          nome: nome.trim(),
          token,
          usuarioId,
          destino: '/admin/login',
        }
      }), 2000);
    } catch (error: any) {
      setErro(error?.response?.data?.erro || 'Erro ao criar administrador.');
    } finally {
      setCarregando(false);
    }
  }

  return (
    <div style={{
      minHeight: '100dvh',
      width: '100vw',
      background: 'var(--fundo-pagina)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 'var(--espaco-4)',
      boxSizing: 'border-box',
      overflowY: 'auto'
    }}>
      <div style={{
        width: '100%',
        maxWidth: '420px',
        background: 'var(--fundo-superficie)',
        borderRadius: 'var(--raio-xl)',
        padding: 'var(--espaco-6)',
        border: '1px solid var(--borda-sutil)',
        boxShadow: 'var(--elevacao-2)',
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center'
      }}>
        {/* Logo / Animação */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--espaco-2)', marginBottom: 'var(--espaco-4)' }}>
          <div style={{
            width: '36px', height: '36px', borderRadius: 'var(--raio-md)', background: 'var(--cor-primaria)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 'var(--texto-body, 0.875rem)', fontWeight: 700, color: 'var(--texto-sobre-primaria)', flexShrink: 0,
          }}>V</div>
          <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.1 }}>
            <strong style={{ fontSize: 'var(--texto-h3, 1.25rem)', fontWeight: 700, color: 'var(--texto-principal)' }}>Valen</strong>
            <span style={{ fontSize: 'var(--texto-detalhe, 0.75rem)', fontWeight: 400, color: 'var(--texto-secundario)', letterSpacing: '0.08em' }}>BARBER</span>
          </div>
        </div>

        <div style={{ marginBottom: 'var(--espaco-2)' }}>
          <ScissorAnimation />
        </div>

        <h1 style={{
          fontFamily: 'var(--fonte-serif)',
          fontSize: 'var(--texto-h1, 1.75rem)',
          fontWeight: 400,
          color: 'var(--texto-principal)',
          margin: '0 0 var(--espaco-1)',
          textAlign: 'center'
        }}>
          Primeiro acesso
        </h1>
        <p style={{ color: 'var(--texto-secundario)', fontSize: 'var(--texto-sm, 0.75rem)', margin: '0 0 var(--espaco-4)', textAlign: 'center' }}>
          Crie o usuário administrador inicial
        </p>

        {/* Reserva de altura para alerta/erro */}
        <div style={{ width: '100%', minHeight: '44px', marginBottom: 'var(--espaco-3)', display: 'flex', alignItems: 'center' }}>
          {sucesso ? (
            <div style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: 'var(--espaco-2)',
              background: 'var(--sucesso-fundo)', border: '1px solid var(--sucesso)',
              borderRadius: 'var(--raio-md)', padding: 'var(--espaco-2) var(--espaco-3)',
              color: 'var(--sucesso)', fontSize: 'var(--texto-sm, 0.75rem)',
            }} role="alert">
              <CheckCircle size={16} style={{ flexShrink: 0 }} />
              <span>Administrador criado! Redirecionando...</span>
            </div>
          ) : erro ? (
            <div style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: 'var(--espaco-2)',
              background: 'var(--erro-fundo)', border: '1px solid var(--erro)',
              borderRadius: 'var(--raio-md)', padding: 'var(--espaco-2) var(--espaco-3)',
              color: 'var(--erro)', fontSize: 'var(--texto-sm, 0.75rem)',
            }} role="alert">
              <AlertCircle size={16} style={{ flexShrink: 0 }} />
              <span>{erro}</span>
            </div>
          ) : null}
        </div>

        <form onSubmit={handleRegistro} style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 'var(--espaco-4)' }}>
          <Input
            label="Nome"
            type="text"
            value={nome}
            onChange={e => setNome(e.target.value)}
            placeholder="Nome do administrador"
            required
            iconeEsquerda={<User size={16} />}
          />

          <Input
            label="Email"
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value.trim().toLowerCase())}
            placeholder="admin@email.com"
            required
            iconeEsquerda={<Mail size={16} />}
            inputMode="email"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            autoComplete="email"
          />

          <Input
            label="Senha"
            type={mostrarSenha ? "text" : "password"}
            value={senha}
            onChange={e => setSenha(e.target.value)}
            placeholder="••••••••"
            required
            minLength={6}
            iconeEsquerda={<Lock size={16} />}
            iconeDireita={
              <button
                type="button"
                onClick={() => setMostrarSenha(!mostrarSenha)}
                aria-label={mostrarSenha ? "Ocultar senha" : "Mostrar senha"}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--texto-secundario)', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '44px', height: '44px', padding: 0 }}
              >
                {mostrarSenha ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            }
          />

          <Botao
            type="submit"
            variante="primario"
            loading={carregando}
            disabled={sucesso}
            style={{ width: '100%' }}
          >
            Criar administrador
          </Botao>
        </form>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 'var(--espaco-4)' }}>
          <button
            type="button"
            onClick={() => navigate('/admin/login')}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--texto-secundario)', fontSize: 'var(--texto-sm, 0.75rem)',
              textDecoration: 'underline', minHeight: '44px', display: 'inline-flex',
              alignItems: 'center', justifyContent: 'center', padding: '0 var(--espaco-2)'
            }}
          >
            ← Voltar para o login
          </button>
        </div>
      </div>
    </div>
  );
}

function ScissorAnimation() {
  return (
    <svg width="100" height="100" viewBox="0 0 140 140">
      <style>{`
        @keyframes bladetop { 0%,100%{transform:rotate(-20deg)} 50%{transform:rotate(0deg)} }
        @keyframes bladebottom { 0%,100%{transform:rotate(20deg)} 50%{transform:rotate(0deg)} }
        #bt-pa { transform-origin:52px 70px; animation:bladetop 1.4s ease-in-out infinite; }
        #bb-pa { transform-origin:52px 70px; animation:bladebottom 1.4s ease-in-out infinite; }
      `}</style>
      <g id="bt-pa">
        <path d="M52 70 Q70 58 100 42 Q108 38 112 40 Q116 43 113 47 Q110 50 102 50 Q88 52 70 62 Z" fill="var(--cor-primaria)"/>
        <circle cx="52" cy="70" r="13" fill="none" stroke="var(--cor-primaria)" strokeWidth="4"/>
        <circle cx="52" cy="70" r="5" fill="var(--cor-primaria)"/>
        <line x1="39" y1="62" x2="26" y2="54" stroke="var(--cor-primaria)" strokeWidth="3.5" strokeLinecap="round"/>
        <line x1="39" y1="70" x2="24" y2="70" stroke="var(--cor-primaria)" strokeWidth="3.5" strokeLinecap="round"/>
      </g>
      <g id="bb-pa">
        <path d="M52 70 Q70 82 100 98 Q108 102 112 100 Q116 97 113 93 Q110 90 102 90 Q88 88 70 78 Z" fill="var(--cor-primaria)"/>
        <circle cx="52" cy="70" r="13" fill="none" stroke="var(--cor-primaria)" strokeWidth="4"/>
        <circle cx="52" cy="70" r="5" fill="var(--texto-secundario)"/>
        <line x1="39" y1="70" x2="24" y2="70" stroke="var(--cor-primaria)" strokeWidth="3.5" strokeLinecap="round"/>
        <line x1="39" y1="78" x2="26" y2="86" stroke="var(--cor-primaria)" strokeWidth="3.5" strokeLinecap="round"/>
      </g>
    </svg>
  );
}
