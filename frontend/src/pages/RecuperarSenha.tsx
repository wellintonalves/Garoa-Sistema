import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { isAxiosError } from 'axios';
import { Envelope, Lock, WarningCircle, CheckCircle, ArrowLeft, Eye, EyeSlash } from '@phosphor-icons/react';
import api from '../api/client';
import { Input, Select, Botao } from '../components/ui';
import { criarContextoRecuperacao, loginDaRecuperacao, papelRecuperacaoDoPerfil, type ContextoRecuperacao } from '../utils/recuperacaoSenha';

type Etapa = 'email' | 'codigo' | 'nova-senha' | 'sucesso';

function mensagemErroRecuperacao(erro: unknown, mensagem: string): string {
  // O interceptor já traduz falhas de transporte e servidor. Nunca mostre
  // respostas de domínio que possam revelar a existência ou vínculo da conta.
  if (isAxiosError(erro) && (!erro.response || erro.response.status >= 500)) return erro.message;
  return mensagem;
}

export function RecuperarSenha() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [etapa, setEtapa] = useState<Etapa>('email');
  const [email, setEmail] = useState('');
  const [papel, setPapel] = useState(() => papelRecuperacaoDoPerfil(searchParams.get('perfil')));
  const [barbeariaSlug, setBarbeariaSlug] = useState(() => (searchParams.get('barbeariaSlug') || '').slice(0, 100));
  const [contextoEnviado, setContextoEnviado] = useState<ContextoRecuperacao | null>(null);
  const [codigos, setCodigos] = useState(['', '', '', '', '', '']);
  const [novaSenha, setNovaSenha] = useState('');
  const [mostrarNovaSenha, setMostrarNovaSenha] = useState(false);
  const [confirmarSenha, setConfirmarSenha] = useState('');
  const [mostrarConfirmarSenha, setMostrarConfirmarSenha] = useState(false);
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(false);
  const [countdown, setCountdown] = useState(60);
  const [podeReenviar, setPodeReenviar] = useState(false);

  useEffect(() => {
    if (etapa === 'codigo' && countdown > 0) {
      const timer = setTimeout(() => setCountdown(c => c - 1), 1000);
      return () => clearTimeout(timer);
    } else if (countdown === 0) {
      setPodeReenviar(true);
    }
  }, [etapa, countdown]);

  async function handleSolicitarCodigo(e: React.FormEvent) {
    e.preventDefault();
    if (carregando) return;
    const contexto = criarContextoRecuperacao({ email, papel, barbeariaSlug });
    setErro('');
    setCarregando(true);
    try {
      await api.post('/recuperacao/solicitar', contexto);
      setContextoEnviado(contexto);
      setCodigos(['', '', '', '', '', '']);
      setEtapa('codigo');
      setCountdown(60);
      setPodeReenviar(false);
    } catch (err: unknown) {
      setErro(mensagemErroRecuperacao(err, 'Não foi possível enviar o código agora. Confira os dados e tente novamente.'));
    } finally {
      setCarregando(false);
    }
  }

  async function handleReenviar() {
    if (!podeReenviar || carregando || !contextoEnviado) return;
    setErro('');
    setCarregando(true);
    try {
      await api.post('/recuperacao/solicitar', contextoEnviado);
      setCodigos(['', '', '', '', '', '']);
      setCountdown(60);
      setPodeReenviar(false);
    } catch (err: unknown) {
      setErro(mensagemErroRecuperacao(err, 'Não foi possível reenviar o código agora. Tente novamente em instantes.'));
    } finally {
      setCarregando(false);
    }
  }

  function handleCodigoInput(index: number, value: string, inputsRef: (HTMLInputElement | null)[]) {
    if (!/^\d*$/.test(value)) return;
    const novos = [...codigos];
    novos[index] = value.slice(-1);
    setCodigos(novos);
    if (value && index < 5) {
      inputsRef[index + 1]?.focus();
    }
  }

  function handleCodigoKeyDown(index: number, e: React.KeyboardEvent, inputsRef: (HTMLInputElement | null)[]) {
    if (e.key === 'Backspace' && !codigos[index] && index > 0) {
      inputsRef[index - 1]?.focus();
    }
  }

  function handleConfirmarCodigo() {
    if (carregando) return;
    const codigo = codigos.join('');
    if (codigo.length < 6) {
      setErro('Digite o código completo de 6 dígitos.');
      return;
    }
    setErro('');
    setEtapa('nova-senha');
  }

  async function handleRedefinirSenha(e: React.FormEvent) {
    e.preventDefault();
    if (carregando || !contextoEnviado) return;
    setErro('');
    if (novaSenha !== confirmarSenha) {
      setErro('As senhas não coincidem.');
      return;
    }
    if (novaSenha.length < 6) {
      setErro('A senha deve ter no mínimo 6 caracteres.');
      return;
    }
    setCarregando(true);
    try {
      await api.post('/recuperacao/redefinir', {
        ...contextoEnviado,
        codigo: codigos.join(''),
        novaSenha,
      });
      setEtapa('sucesso');
    } catch (err: unknown) {
      setErro(mensagemErroRecuperacao(err, 'Não foi possível redefinir a senha. Confira o código ou solicite outro e tente novamente.'));
      setEtapa('codigo');
      setCodigos(['', '', '', '', '', '']);
    } finally {
      setCarregando(false);
    }
  }

  const titulos = {
    'email': 'Esqueci minha senha',
    'codigo': 'Digite o código',
    'nova-senha': 'Nova senha',
    'sucesso': 'Senha redefinida!',
  };

  const subtitulos = {
    'email': 'Informe seu email e o tipo de conta que deseja recuperar.',
    'codigo': `Se os dados corresponderem a uma conta, você receberá um código em ${contextoEnviado?.email}. Confira também a pasta de spam.`,
    'nova-senha': 'Defina sua nova senha abaixo.',
    'sucesso': 'Sua senha foi redefinida com sucesso.',
  };
  const loginDestino = loginDaRecuperacao(contextoEnviado || { papel, barbeariaSlug });

  function handleAlterarDados() {
    if (carregando) return;
    setContextoEnviado(null);
    setCodigos(['', '', '', '', '', '']);
    setNovaSenha('');
    setConfirmarSenha('');
    setErro('');
    setEtapa('email');
  }

  if (etapa === 'sucesso') {
    return (
      <div style={{
        minHeight: '100dvh', width: '100vw', background: 'var(--fundo-pagina)',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        padding: 'var(--espaco-4)', boxSizing: 'border-box', overflowY: 'auto',
      }}>
        <div style={{
          width: '100%', maxWidth: '420px', background: 'var(--fundo-superficie)',
          borderRadius: 'var(--raio-xl)', padding: 'clamp(var(--espaco-4), 4vw, var(--espaco-6))',
          border: '1px solid var(--borda-sutil)', boxShadow: 'var(--elevacao-2)',
          boxSizing: 'border-box', display: 'flex', flexDirection: 'column', alignItems: 'center',
        }}>
          <CheckCircle size={48} weight="regular" color="var(--sucesso)" style={{ marginBottom: 'var(--espaco-4)' }} aria-hidden="true" />
          <h1 style={{
            fontFamily: 'var(--fonte-serif)', fontSize: 'var(--texto-h1, 1.75rem)',
            fontWeight: 400, color: 'var(--texto-principal)', margin: '0 0 var(--espaco-2)', textAlign: 'center',
          }}>
            {titulos[etapa]}
          </h1>
          <p style={{ color: 'var(--texto-secundario)', fontSize: 'var(--texto-sm, 0.75rem)', margin: '0 0 var(--espaco-6)', textAlign: 'center', lineHeight: 1.6 }}>
            {subtitulos[etapa]}
          </p>
          <Botao
            type="button"
            variante="primario"
            onClick={() => navigate(loginDestino)}
            style={{ width: '100%' }}
          >
            Ir para o login
          </Botao>
        </div>
      </div>
    );
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
        padding: 'clamp(var(--espaco-4), 4vw, var(--espaco-6))',
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

        <h1 style={{
          fontFamily: 'var(--fonte-serif)',
          fontSize: 'var(--texto-h1, 1.75rem)',
          fontWeight: 400,
          color: 'var(--texto-principal)',
          margin: '0 0 var(--espaco-1)',
          textAlign: 'center'
        }}>
          {titulos[etapa]}
        </h1>
        <p style={{ color: 'var(--texto-secundario)', fontSize: 'var(--texto-sm, 0.75rem)', margin: '0 0 var(--espaco-4)', textAlign: 'center', lineHeight: 1.6 }}>
          {subtitulos[etapa]}
        </p>

        {/* Reserva de altura para alerta/erro */}
        <div style={{ width: '100%', minHeight: '44px', marginBottom: 'var(--espaco-3)', display: 'flex', alignItems: 'center' }}>
          {erro ? (
            <div style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: 'var(--espaco-2)',
              background: 'var(--erro-fundo)', border: '1px solid var(--erro)',
              borderRadius: 'var(--raio-md)', padding: 'var(--espaco-2) var(--espaco-3)',
              color: 'var(--erro)', fontSize: 'var(--texto-sm, 0.75rem)',
            }} role="alert">
              <WarningCircle size={18} weight="regular" style={{ flexShrink: 0 }} aria-hidden="true" />
              <span>{erro}</span>
            </div>
          ) : null}
        </div>

        {/* ETAPA 1 — Email */}
        {etapa === 'email' && (
          <form onSubmit={handleSolicitarCodigo} style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 'var(--espaco-4)' }}>
            <Input
              label="Email"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="seu@email.com"
              required
              maxLength={254}
              disabled={carregando}
              inputMode="email"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              autoComplete="email"
              iconeEsquerda={<Envelope size={18} weight="regular" aria-hidden="true" />}
            />
            <Select
              label="Tipo de conta"
              value={papel}
              onChange={e => setPapel(papelRecuperacaoDoPerfil(e.target.value.toLowerCase()))}
              disabled={carregando}
            >
              <option value="CLIENTE">Cliente</option>
              <option value="BARBEIRO">Barbeiro</option>
              <option value="ADMIN">Administrador</option>
            </Select>
            <Input
              label="Endereço da barbearia (opcional)"
              value={barbeariaSlug}
              onChange={e => setBarbeariaSlug(e.target.value)}
              placeholder="minha-barbearia"
              maxLength={100}
              disabled={carregando}
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              hint={papel === 'CLIENTE'
                ? 'Use o nome após /b/ no link da barbearia. Se criou sua conta na página principal, deixe em branco.'
                : 'Use o nome após /b/ no link da barbearia. Se tem conta em mais de uma, informe qual deseja recuperar.'}
            />
            <Botao type="submit" variante="primario" loading={carregando} style={{ width: '100%' }}>
              Enviar código
            </Botao>
          </form>
        )}

        {/* ETAPA 2 — Código */}
        {etapa === 'codigo' && (
          <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 'var(--espaco-4)' }}>
            <CodigoInputs
              codigos={codigos}
              onChange={(i, v, refs) => handleCodigoInput(i, v, refs)}
              onKeyDown={(i, e, refs) => handleCodigoKeyDown(i, e, refs)}
            />
            <Botao type="button" variante="primario" onClick={handleConfirmarCodigo} disabled={carregando} style={{ width: '100%' }}>
              Confirmar código
            </Botao>
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <button
                type="button"
                onClick={handleReenviar}
                disabled={!podeReenviar || carregando}
                style={{
                  background: 'none', border: 'none', cursor: podeReenviar ? 'pointer' : 'default',
                  fontSize: 'var(--texto-sm, 0.75rem)', color: podeReenviar ? 'var(--cor-primaria)' : 'var(--texto-secundario)',
                  textDecoration: podeReenviar ? 'underline' : 'none', minHeight: '48px',
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '0 var(--espaco-2)'
                }}
              >
                {carregando ? 'Reenviando…' : podeReenviar ? 'Reenviar código' : `Reenviar em ${countdown}s`}
              </button>
            </div>
          </div>
        )}

        {/* ETAPA 3 — Nova senha */}
        {etapa === 'nova-senha' && (
          <form onSubmit={handleRedefinirSenha} style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 'var(--espaco-4)' }}>
            <Input
              label="Nova senha"
              type={mostrarNovaSenha ? "text" : "password"}
              value={novaSenha}
              maxLength={128}
              onChange={e => setNovaSenha(e.target.value)}
              placeholder="Mínimo 6 caracteres"
              required
              minLength={6}
              iconeEsquerda={<Lock size={18} weight="regular" aria-hidden="true" />}
              iconeDireita={
                <button
                  type="button"
                  onClick={() => setMostrarNovaSenha(!mostrarNovaSenha)}
                  aria-label={mostrarNovaSenha ? "Ocultar senha" : "Mostrar senha"}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--texto-secundario)', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '44px', height: '44px', padding: 0 }}
                >
                  {mostrarNovaSenha ? <EyeSlash size={18} weight="regular" aria-hidden="true" /> : <Eye size={18} weight="regular" aria-hidden="true" />}
                </button>
              }
            />

            <Input
              label="Confirmar nova senha"
              type={mostrarConfirmarSenha ? "text" : "password"}
              value={confirmarSenha}
              maxLength={128}
              onChange={e => setConfirmarSenha(e.target.value)}
              placeholder="Repita a nova senha"
              required
              iconeEsquerda={<Lock size={18} weight="regular" aria-hidden="true" />}
              iconeDireita={
                <button
                  type="button"
                  onClick={() => setMostrarConfirmarSenha(!mostrarConfirmarSenha)}
                  aria-label={mostrarConfirmarSenha ? "Ocultar senha" : "Mostrar senha"}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--texto-secundario)', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '44px', height: '44px', padding: 0 }}
                >
                  {mostrarConfirmarSenha ? <EyeSlash size={18} weight="regular" aria-hidden="true" /> : <Eye size={18} weight="regular" aria-hidden="true" />}
                </button>
              }
            />

            <Botao type="submit" variante="primario" loading={carregando} style={{ width: '100%' }}>
              Redefinir senha
            </Botao>
          </form>
        )}

        {(etapa === 'codigo' || etapa === 'nova-senha') && (
          <Botao type="button" variante="fantasma" onClick={handleAlterarDados} disabled={carregando} style={{ marginTop: 'var(--espaco-2)' }}>
            Corrigir dados da conta
          </Botao>
        )}

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 'var(--espaco-4)' }}>
          <button
            type="button"
            onClick={() => navigate(loginDestino)}
            disabled={carregando}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--texto-secundario)', fontSize: 'var(--texto-sm, 0.75rem)',
              textDecoration: 'underline', minHeight: '48px', display: 'inline-flex',
              alignItems: 'center', justifyContent: 'center', gap: 'var(--espaco-1)', padding: '0 var(--espaco-2)'
            }}
          >
            <ArrowLeft size={18} weight="regular" aria-hidden="true" /> Voltar para o login
          </button>
        </div>
      </div>
    </div>
  );
}

function CodigoInputs({ codigos, onChange, onKeyDown }: {
  codigos: string[];
  onChange: (i: number, v: string, refs: (HTMLInputElement | null)[]) => void;
  onKeyDown: (i: number, e: React.KeyboardEvent, refs: (HTMLInputElement | null)[]) => void;
}) {
  const refs: (HTMLInputElement | null)[] = [];

  return (
    <div style={{ display: 'flex', gap: 'var(--espaco-1)', marginBottom: 'var(--espaco-2)', justifyContent: 'center' }}>
      {codigos.map((c, i) => (
        <input
          key={i}
          ref={el => { refs[i] = el; }}
          type="text" inputMode="numeric" maxLength={1} value={c}
          aria-label={`Dígito ${i + 1} do código`}
          onChange={e => onChange(i, e.target.value, refs)}
          onKeyDown={e => onKeyDown(i, e, refs)}
          style={{
            width: '48px', minWidth: 0, height: '56px', textAlign: 'center',
            background: 'var(--fundo-superficie-2)',
            border: `1px solid ${c ? 'var(--cor-primaria)' : 'var(--borda-sutil)'}`,
            borderRadius: 'var(--raio-md)', color: 'var(--texto-principal)',
            fontFamily: "var(--fonte-mono, 'JetBrains Mono', monospace)",
            fontVariantNumeric: 'tabular-nums',
            fontSize: 'var(--texto-h2, 1.5rem)', fontWeight: 500, outline: 'none',
            transition: 'border-color 0.15s', boxSizing: 'border-box',
          }}
        />
      ))}
    </div>
  );
}
